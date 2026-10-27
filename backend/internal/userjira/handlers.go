package userjira

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"webdev-mmorpg/backend/internal/store"
)

const credentialCookieName = "webdev_jira_credential"

type Service struct {
	database *store.Store
	keyring  *Keyring
	sessions *SessionManager
	client   *HTTPClient
	activity *ActivityService
	baseURL  string
	host     string
	secure   bool
	now      func() time.Time
}

func NewService(database *store.Store, keyring *Keyring, sessions *SessionManager, client *HTTPClient, activity *ActivityService, baseURL string, secure bool) (*Service, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Host == "" {
		return nil, errors.New("JIRA_BASE_URL must be configured")
	}
	return &Service{database: database, keyring: keyring, sessions: sessions, client: client, activity: activity,
		baseURL: strings.TrimRight(baseURL, "/"), host: strings.ToLower(parsed.Host), secure: secure, now: time.Now}, nil
}

type loginRequest struct {
	Server   string `json:"server"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type testResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type credentialResponse struct {
	Connected bool    `json:"connected"`
	Invalid   bool    `json:"invalid"`
	Host      string  `json:"host"`
	Username  *string `json:"username"`
	ExpiresAt *string `json:"expires_at"`
}

type connectionResponse struct {
	Configured string  `json:"configured"`
	Host       string  `json:"host"`
	LastSyncAt *string `json:"last_sync_at"`
}

type liveConnectionResponse struct {
	State      string  `json:"state"`
	Host       string  `json:"host"`
	LastSyncAt *string `json:"last_sync_at"`
	CheckedAt  string  `json:"checked_at"`
	Detail     string  `json:"detail,omitempty"`
}

type credentialState int

const (
	credentialNone credentialState = iota
	credentialInvalid
	credentialValid
)

func (s *Service) TestConnectionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	s.sessions.Ensure(w, r)
	var request loginRequest
	if !decodeJSON(w, r, &request) {
		return
	}
	if strings.TrimSpace(request.Username) == "" || request.Password == "" {
		writeJSON(w, http.StatusOK, testResponse{Success: false, Message: "Authentication failed. Check username and password."})
		return
	}
	server, err := s.jiraServer(request.Server)
	if err != nil {
		writeJSON(w, http.StatusOK, testResponse{Success: false, Message: err.Error()})
		return
	}
	ok, message := s.client.TestConnection(r.Context(), server, request.Username, request.Password)
	writeJSON(w, http.StatusOK, testResponse{Success: ok, Message: message})
}

func (s *Service) CredentialHandler(w http.ResponseWriter, r *http.Request) {
	session := s.sessions.Ensure(w, r)
	switch r.Method {
	case http.MethodGet:
		state, claims := s.readCredential(r, session)
		writeJSON(w, http.StatusOK, s.credentialStatus(state, claims))
	case http.MethodPut:
		var request loginRequest
		if !decodeJSON(w, r, &request) {
			return
		}
		server, serverErr := s.jiraServer(request.Server)
		if serverErr != nil {
			writeDetail(w, http.StatusBadRequest, serverErr.Error())
			return
		}
		ok, message := s.client.TestConnection(r.Context(), server, request.Username, request.Password)
		if !ok {
			writeDetail(w, http.StatusBadRequest, message)
			return
		}
		claims := CredentialClaims{UserID: session.UserID, SID: session.SID, Server: server, Username: strings.TrimSpace(request.Username), Password: request.Password, IssuedAt: s.now().UTC().Unix()}
		token, err := s.keyring.Seal(claims)
		if err != nil {
			writeDetail(w, http.StatusInternalServerError, "Could not protect Jira credentials.")
			return
		}
		expires := s.keyring.ExpiresAt(claims)
		http.SetCookie(w, &http.Cookie{Name: credentialCookieName, Value: token, Path: "/api", HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteStrictMode,
			MaxAge: int(credentialMaxAge.Seconds()), Expires: expires})
		writeJSON(w, http.StatusOK, s.credentialStatus(credentialValid, claims))
	case http.MethodDelete:
		s.clearCredential(w)
		s.sessions.Reset(w, r)
		writeJSON(w, http.StatusOK, s.credentialStatus(credentialNone, CredentialClaims{}))
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (s *Service) ConnectionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	session := s.sessions.Ensure(w, r)
	state, claims := s.readCredential(r, session)
	configured := "none"
	if state == credentialInvalid {
		configured = "invalid"
	} else if state == credentialValid {
		configured = "present"
	}
	selectedServer := s.claimsServer(claims)
	selectedHost := jiraHost(selectedServer)
	lastSync, _ := s.database.UserJiraLastSync(r.Context(), session.UserID, selectedHost)
	lastSync = normalizeStoredTime(lastSync)
	writeJSON(w, http.StatusOK, connectionResponse{Configured: configured, Host: selectedHost, LastSyncAt: lastSync})
}

func (s *Service) CheckConnectionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	session := s.sessions.Ensure(w, r)
	state, claims := s.readCredential(r, session)
	selectedServer := s.claimsServer(claims)
	selectedHost := jiraHost(selectedServer)
	lastSync, _ := s.database.UserJiraLastSync(r.Context(), session.UserID, selectedHost)
	lastSync = normalizeStoredTime(lastSync)
	response := liveConnectionResponse{State: "not_configured", Host: selectedHost, LastSyncAt: lastSync, CheckedAt: formatOffsetTime(s.now())}
	if state == credentialInvalid {
		response.State = "auth_expired"
		response.Detail = "Your Jira connection expired or can no longer be read — reconnect in Settings → Jira Integration."
		writeJSON(w, http.StatusOK, response)
		return
	}
	if state == credentialNone {
		writeJSON(w, http.StatusOK, response)
		return
	}
	ok, message := s.client.TestConnection(r.Context(), selectedServer, claims.Username, claims.Password)
	if ok {
		response.State = "connected"
	} else if strings.HasPrefix(message, "Authentication failed") {
		response.State = "auth_expired"
		response.Detail = "Jira authentication failed."
	} else {
		response.State = "unreachable"
		response.Detail = message
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Service) EmployeeActivityHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost && strings.TrimSuffix(r.URL.Path, "/") == "/api/employees/activity/refresh" {
		s.backgroundRefresh(w, r)
		return
	}
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	prefix := "/api/employees/"
	remainder := strings.TrimPrefix(r.URL.Path, prefix)
	if !strings.HasSuffix(remainder, "/activity") {
		writeDetail(w, http.StatusNotFound, "Employee not found")
		return
	}
	id := strings.TrimSuffix(remainder, "/activity")
	character, err := s.database.Get(id)
	if err == sql.ErrNoRows {
		writeDetail(w, http.StatusNotFound, "Employee not found")
		return
	}
	if err != nil {
		writeDetail(w, http.StatusInternalServerError, "Could not load employee")
		return
	}
	if character.JiraActivityURL == nil || strings.TrimSpace(*character.JiraActivityURL) == "" {
		writeJSON(w, http.StatusOK, ActivityResponse{Available: false, Reason: "not_configured"})
		return
	}
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 500 {
			writeDetail(w, http.StatusBadRequest, "limit must be between 1 and 500")
			return
		}
	}
	session := s.sessions.Ensure(w, r)
	state, claims := s.readCredential(r, session)
	if state == credentialNone {
		writeJSON(w, http.StatusOK, ActivityResponse{Available: false, Reason: "no_jira_account"})
		return
	}
	if state == credentialInvalid {
		writeJSON(w, http.StatusOK, ActivityResponse{Available: false, Reason: "credentials_invalid", Message: "Your Jira connection expired or can no longer be read — reconnect in Settings → Jira Integration."})
		return
	}
	response, err := s.activity.Fetch(r.Context(), session, claims, character, limit)
	if err != nil {
		writeDetail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Service) backgroundRefresh(w http.ResponseWriter, r *http.Request) {
	session := s.sessions.Ensure(w, r)
	state, claims := s.readCredential(r, session)
	if state != credentialValid {
		writeJSON(w, http.StatusAccepted, map[string]bool{"started": false})
		return
	}
	characters, err := s.database.List()
	if err != nil {
		writeDetail(w, http.StatusInternalServerError, "Could not load employee profiles")
		return
	}
	go s.activity.RefreshAll(session, claims, characters)
	writeJSON(w, http.StatusAccepted, map[string]bool{"started": true})
}

func (s *Service) readCredential(r *http.Request, session Session) (credentialState, CredentialClaims) {
	cookie, err := r.Cookie(credentialCookieName)
	if err == http.ErrNoCookie {
		return credentialNone, CredentialClaims{}
	}
	if err != nil || cookie.Value == "" {
		return credentialInvalid, CredentialClaims{}
	}
	claims, err := s.keyring.Unseal(cookie.Value, session.UserID, session.SID)
	if err != nil {
		return credentialInvalid, CredentialClaims{}
	}
	if subtle.ConstantTimeCompare([]byte(claims.UserID), []byte(session.UserID)) != 1 || subtle.ConstantTimeCompare([]byte(claims.SID), []byte(session.SID)) != 1 {
		return credentialInvalid, CredentialClaims{}
	}
	server, err := s.jiraServer(claims.Server)
	if err != nil {
		return credentialInvalid, CredentialClaims{}
	}
	claims.Server = server
	return credentialValid, claims
}

func (s *Service) credentialStatus(state credentialState, claims CredentialClaims) credentialResponse {
	response := credentialResponse{Connected: false, Invalid: state == credentialInvalid, Host: s.claimsServer(claims)}
	if state == credentialValid {
		username := claims.Username
		expires := formatOffsetTime(s.keyring.ExpiresAt(claims))
		response.Connected, response.Username, response.ExpiresAt = true, &username, &expires
	}
	return response
}

func (s *Service) claimsServer(claims CredentialClaims) string {
	if claims.Server != "" {
		return claims.Server
	}
	return s.baseURL
}

func (s *Service) jiraServer(raw string) (string, error) {
	candidate := strings.TrimSpace(raw)
	if candidate == "" {
		candidate = s.baseURL
	}
	parsed, err := url.Parse(candidate)
	configured, configuredErr := url.Parse(s.baseURL)
	if err != nil || configuredErr != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return "", errors.New("Enter a valid Jira server URL, for example https://jira.example.com")
	}
	if origin(parsed) != origin(configured) {
		return "", errors.New("Jira server is not allowed by the backend JIRA_BASE_URL configuration")
	}
	return strings.TrimRight(parsed.String(), "/"), nil
}

func jiraHost(server string) string {
	parsed, err := url.Parse(server)
	if err != nil || parsed.Host == "" {
		return ""
	}
	return strings.ToLower(parsed.Host)
}

func formatOffsetTime(value time.Time) string {
	return value.UTC().Format("2006-01-02T15:04:05-07:00")
}

func normalizeStoredTime(value *string) *string {
	if value == nil {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339Nano, *value)
	if err != nil {
		return value
	}
	formatted := formatOffsetTime(parsed)
	return &formatted
}

func (s *Service) clearCredential(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: credentialCookieName, Value: "", Path: "/api", HttpOnly: true, Secure: s.secure, SameSite: http.SameSiteStrictMode,
		MaxAge: -1, Expires: time.Unix(1, 0)})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if decoder.Decode(target) != nil {
		writeDetail(w, http.StatusBadRequest, "Invalid JSON body")
		return false
	}
	return true
}

func writeDetail(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"detail": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
