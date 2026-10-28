package userjira

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
	"webdev-mmorpg/backend/internal/store"
)

func testUserJiraService(t *testing.T, jiraHandler http.Handler) (*Service, *store.Store, *httptest.Server) {
	t.Helper()
	server := httptest.NewServer(jiraHandler)
	database, err := store.Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		server.Close()
		t.Fatal(err)
	}
	keyring, _ := ParseKeyring(encodedKey(7))
	client, err := NewHTTPClient(server.URL, "", nil)
	if err != nil {
		database.Close()
		server.Close()
		t.Fatal(err)
	}
	activity, err := NewActivityService(database, client, server.URL, filepath.Join(t.TempDir(), "activity"))
	if err != nil {
		database.Close()
		server.Close()
		t.Fatal(err)
	}
	service, err := NewService(database, keyring, NewSessionManager(false), client, activity, server.URL, false)
	if err != nil {
		database.Close()
		server.Close()
		t.Fatal(err)
	}
	return service, database, server
}

func cookieByName(cookies []*http.Cookie, name string) *http.Cookie {
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie
		}
	}
	return nil
}

func TestCredentialRoutesNeverEchoPasswordAndMatchStatusShape(t *testing.T) {
	service, database, server := testUserJiraService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/api/2/myself" && r.Header.Get("Authorization") != "" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"displayName":"Jane Doe"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer database.Close()
	defer server.Close()

	body, _ := json.Marshal(loginRequest{Server: server.URL, Username: "jdoe", Password: "top-secret"})
	request := httptest.NewRequest(http.MethodPut, "/api/jira/credential", bytes.NewReader(body))
	response := httptest.NewRecorder()
	service.CredentialHandler(response, request)
	if response.Code != http.StatusOK || bytes.Contains(response.Body.Bytes(), []byte("top-secret")) {
		t.Fatalf("credential save failed or echoed password: code=%d body=%s", response.Code, response.Body.String())
	}
	var status credentialResponse
	if err := json.Unmarshal(response.Body.Bytes(), &status); err != nil || !status.Connected || status.Invalid || status.Host != server.URL || status.Username == nil || *status.Username != "jdoe" || status.ExpiresAt == nil {
		t.Fatalf("unexpected status: %#v err=%v", status, err)
	}
	sessionCookie := cookieByName(response.Result().Cookies(), sessionCookieName)
	credentialCookie := cookieByName(response.Result().Cookies(), credentialCookieName)
	if sessionCookie == nil || credentialCookie == nil || !credentialCookie.HttpOnly || credentialCookie.Path != "/api" || credentialCookie.SameSite != http.SameSiteStrictMode {
		t.Fatalf("missing secure cookie contract: session=%#v credential=%#v", sessionCookie, credentialCookie)
	}

	request = httptest.NewRequest(http.MethodGet, "/api/jira/credential", nil)
	request.AddCookie(sessionCookie)
	request.AddCookie(credentialCookie)
	response = httptest.NewRecorder()
	service.CredentialHandler(response, request)
	if response.Code != http.StatusOK || bytes.Contains(response.Body.Bytes(), []byte("top-secret")) || !strings.Contains(response.Body.String(), `"connected":true`) {
		t.Fatalf("credential read response invalid: %s", response.Body.String())
	}
}

func TestCredentialRoutesRejectServerOutsideConfiguredJiraOrigin(t *testing.T) {
	var requests atomic.Int32
	service, database, server := testUserJiraService(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		requests.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	defer database.Close()
	defer server.Close()

	body := `{"server":"https://untrusted.example","username":"jdoe","password":"secret"}`
	request := httptest.NewRequest(http.MethodPost, "/api/jira/test-connection", bytes.NewBufferString(body))
	response := httptest.NewRecorder()
	service.TestConnectionHandler(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"success":false`) || !strings.Contains(response.Body.String(), "not allowed") {
		t.Fatalf("test route did not reject untrusted server: code=%d body=%s", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodPut, "/api/jira/credential", bytes.NewBufferString(body))
	response = httptest.NewRecorder()
	service.CredentialHandler(response, request)
	if response.Code != http.StatusBadRequest || !strings.Contains(response.Body.String(), `"detail":"Jira server is not allowed`) {
		t.Fatalf("save route did not reject untrusted server: code=%d body=%s", response.Code, response.Body.String())
	}
	if requests.Load() != 0 {
		t.Fatalf("untrusted server validation reached Jira HTTP handler %d times", requests.Load())
	}
}

func TestCredentialSaveReturnsExactDetailOnBadLogin(t *testing.T) {
	service, database, server := testUserJiraService(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer database.Close()
	defer server.Close()
	request := httptest.NewRequest(http.MethodPut, "/api/jira/credential", bytes.NewBufferString(`{"username":"jdoe","password":"wrong"}`))
	response := httptest.NewRecorder()
	service.CredentialHandler(response, request)
	if response.Code != http.StatusBadRequest || response.Body.String() != "{\"detail\":\"Authentication failed. Check username and password.\"}\n" || bytes.Contains(response.Body.Bytes(), []byte("wrong")) {
		t.Fatalf("bad-login response mismatch: code=%d body=%s", response.Code, response.Body.String())
	}
}

func TestConnectionResponseNormalizesLastSyncTimestamp(t *testing.T) {
	service, database, server := testUserJiraService(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer database.Close()
	defer server.Close()

	request := httptest.NewRequest(http.MethodGet, "/api/jira/connection", nil)
	response := httptest.NewRecorder()
	session := service.sessions.Ensure(response, request)
	if err := database.RecordUserJiraSync(context.Background(), session.UserID, service.host, time.Date(2026, 10, 26, 9, 41, 0, 0, time.UTC)); err != nil {
		t.Fatal(err)
	}

	request = httptest.NewRequest(http.MethodGet, "/api/jira/connection", nil)
	request.AddCookie(cookieByName(response.Result().Cookies(), sessionCookieName))
	response = httptest.NewRecorder()
	service.ConnectionHandler(response, request)
	expected := `{"configured":"none","host":"` + service.host + `","last_sync_at":"2026-10-26T09:41:00+00:00"}` + "\n"
	if response.Code != http.StatusOK || response.Body.String() != expected {
		t.Fatalf("connection response mismatch: code=%d body=%s", response.Code, response.Body.String())
	}
}

func TestEmployeeActivityEndpointStates(t *testing.T) {
	service, database, server := testUserJiraService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/rest/api/2/myself" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.URL.Path == "/activity" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer database.Close()
	defer server.Close()

	request := httptest.NewRequest(http.MethodGet, "/api/employees/commander/activity?limit=50", nil)
	response := httptest.NewRecorder()
	service.EmployeeActivityHandler(response, request)
	if response.Body.String() != "{\"available\":false,\"reason\":\"not_configured\"}\n" {
		t.Fatalf("unexpected not-configured response: %s", response.Body.String())
	}
	character, _ := database.Get("commander")
	activityURL := server.URL + "/activity?streams=user+IS+jdoe"
	character.JiraActivityURL = &activityURL
	if _, err := database.Update(character.ID, character); err != nil {
		t.Fatal(err)
	}
	request = httptest.NewRequest(http.MethodGet, "/api/employees/commander/activity?limit=50", nil)
	response = httptest.NewRecorder()
	service.EmployeeActivityHandler(response, request)
	if !strings.Contains(response.Body.String(), `"reason":"no_jira_account"`) {
		t.Fatalf("unexpected no-account response: %s", response.Body.String())
	}
	sessionCookie := cookieByName(response.Result().Cookies(), sessionCookieName)

	credentialRequest := httptest.NewRequest(http.MethodPut, "/api/jira/credential", bytes.NewBufferString(`{"username":"jdoe","password":"secret"}`))
	credentialRequest.AddCookie(sessionCookie)
	credentialResponse := httptest.NewRecorder()
	service.CredentialHandler(credentialResponse, credentialRequest)
	credentialCookie := cookieByName(credentialResponse.Result().Cookies(), credentialCookieName)
	request = httptest.NewRequest(http.MethodGet, "/api/employees/commander/activity?limit=50", nil)
	request.AddCookie(sessionCookie)
	request.AddCookie(credentialCookie)
	response = httptest.NewRecorder()
	service.EmployeeActivityHandler(response, request)
	if !strings.Contains(response.Body.String(), `"reason":"auth_failed"`) || !strings.Contains(response.Body.String(), "Jira authentication failed") {
		t.Fatalf("unexpected auth-failed response: %s", response.Body.String())
	}

	request = httptest.NewRequest(http.MethodGet, "/api/employees/commander/activity", nil)
	request.AddCookie(sessionCookie)
	request.AddCookie(&http.Cookie{Name: credentialCookieName, Value: "tampered"})
	response = httptest.NewRecorder()
	service.EmployeeActivityHandler(response, request)
	if !strings.Contains(response.Body.String(), `"reason":"credentials_invalid"`) {
		t.Fatalf("unexpected invalid-credential response: %s", response.Body.String())
	}
}

func TestActivityStaleFallbackAndPerUserCacheIsolation(t *testing.T) {
	var fail atomic.Bool
	feed := `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:activity="http://activitystrea.ms/spec/1.0/">
<updated>2026-10-09T18:02:11.120Z</updated><entry><id>urn:uuid:0001</id><published>2026-10-09T17:30:00Z</published><title type="html">Jane Doe logged work 57h 15m on ABC-12 - Fix login &amp; logout</title><activity:verb>http://activitystrea.ms/schema/1.0/post</activity:verb><link rel="alternate" href="REPLACE/browse/ABC-12"/></entry></feed>`
	service, database, server := testUserJiraService(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if fail.Load() {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/atom+xml")
		_, _ = w.Write([]byte(feed))
	}))
	defer database.Close()
	defer server.Close()
	service.activity.directory = filepath.Join(t.TempDir(), "isolated")
	character, _ := database.Get("commander")
	activityURL := server.URL + "/activity"
	character.JiraActivityURL = &activityURL
	session := Session{UserID: "viewer-a", SID: "sid-a"}
	claims := CredentialClaims{UserID: session.UserID, SID: session.SID, Username: "jdoe", Password: "secret"}
	response, err := service.activity.Fetch(context.Background(), session, claims, character, 50)
	if err != nil || !response.Available || response.ActivityCount != 1 {
		t.Fatalf("fresh fetch failed: response=%#v err=%v", response, err)
	}
	if len(response.Days) != 1 || len(response.Days[0].Entries) != 1 || response.Days[0].Entries[0].OccurredAt != "2026-10-09T17:30:00Z" {
		t.Fatalf("activity response must preserve its machine-readable occurrence time: %#v", response.Days)
	}
	if _, err = service.activity.readCache("viewer-b", character); !errorsIsNotExist(err) {
		t.Fatalf("viewer B accessed viewer A cache: %v", err)
	}
	fail.Store(true)
	response, err = service.activity.Fetch(context.Background(), session, claims, character, 50)
	if err != nil || !response.Available || !response.Stale || response.Message == "" {
		t.Fatalf("stale fallback failed: response=%#v err=%v", response, err)
	}
	encoded, _ := json.Marshal(response)
	if !bytes.Contains(encoded, []byte(`"stale":true`)) || !bytes.Contains(encoded, []byte(`"logged_total_seconds":206100`)) {
		t.Fatalf("stale response shape or rollup is wrong: %s", encoded)
	}
}

func errorsIsNotExist(err error) bool { return err != nil && os.IsNotExist(err) }
