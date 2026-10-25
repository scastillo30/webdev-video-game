package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
	"webdev-mmorpg/backend/internal/jira"
	"webdev-mmorpg/backend/internal/store"
)

func TestGameConfigHandlerRoundTrip(t *testing.T) {
	database, err := store.Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	service := jira.NewService(jira.DisabledSource{}, database, time.Minute)
	handler := gameConfig(database, service)

	request := httptest.NewRequest(http.MethodGet, "/api/game/config", nil)
	response := httptest.NewRecorder()
	handler(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("GET returned %d: %s", response.Code, response.Body.String())
	}
	var config store.GameConfig
	if err = json.Unmarshal(response.Body.Bytes(), &config); err != nil {
		t.Fatal(err)
	}
	config.Settings.RefreshIntervalSeconds = 120
	body, _ := json.Marshal(config)
	request = httptest.NewRequest(http.MethodPut, "/api/game/config", bytes.NewReader(body))
	response = httptest.NewRecorder()
	handler(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("PUT returned %d: %s", response.Code, response.Body.String())
	}
	var saved store.GameConfig
	if err = json.Unmarshal(response.Body.Bytes(), &saved); err != nil {
		t.Fatal(err)
	}
	if saved.Settings.RefreshIntervalSeconds != 120 {
		t.Fatalf("refresh interval was not persisted: %#v", saved.Settings)
	}
}

func TestGameConfigHandlerRejectsMalformedBody(t *testing.T) {
	database, err := store.Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	handler := gameConfig(database, jira.NewService(jira.DisabledSource{}, database, time.Minute))
	response := httptest.NewRecorder()
	handler(response, httptest.NewRequest(http.MethodPut, "/api/game/config", bytes.NewBufferString("{")))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("malformed body returned %d", response.Code)
	}
}

func TestOperationsStatusIsCredentialSafe(t *testing.T) {
	database, err := store.Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	service := jira.NewService(jira.DisabledSource{}, database, time.Minute)
	response := httptest.NewRecorder()
	operationsStatus(database, service, time.Now().Add(-time.Minute))(response, httptest.NewRequest(http.MethodGet, "/api/operations/status", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("operations status returned %d: %s", response.Code, response.Body.String())
	}
	var payload operationsResponse
	if err = json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Status != "ok" || payload.UptimeSeconds < 59 || payload.TargetFPS != 30 || payload.Database != "ready" {
		t.Fatalf("unexpected operations payload: %#v", payload)
	}
	if bytes.Contains(response.Body.Bytes(), []byte("apiToken")) || bytes.Contains(response.Body.Bytes(), []byte("email")) {
		t.Fatalf("operations payload exposed credential fields: %s", response.Body.String())
	}
}

func TestHealthAndReadinessMethods(t *testing.T) {
	database, err := store.Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	readiness(database)(response, httptest.NewRequest(http.MethodGet, "/api/ready", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("readiness returned %d: %s", response.Code, response.Body.String())
	}
	var payload readinessResponse
	if err = json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Status != "ready" || payload.Database != "ready" || payload.CheckedAt == "" {
		t.Fatalf("unexpected readiness payload: %#v", payload)
	}

	response = httptest.NewRecorder()
	health()(response, httptest.NewRequest(http.MethodPost, "/api/health", nil))
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST health returned %d", response.Code)
	}

	if err = database.Close(); err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	readiness(database)(response, httptest.NewRequest(http.MethodGet, "/api/ready", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("closed database readiness returned %d", response.Code)
	}
}

func TestVersionInfoIsAvailableAndMethodBound(t *testing.T) {
	response := httptest.NewRecorder()
	versionInfo()(response, httptest.NewRequest(http.MethodGet, "/api/version", nil))
	if response.Code != http.StatusOK {
		t.Fatalf("version returned %d: %s", response.Code, response.Body.String())
	}
	var payload buildInfoResponse
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Version == "" || payload.Commit == "" || payload.BuiltAt == "" || payload.Target == "" {
		t.Fatalf("incomplete version payload: %#v", payload)
	}
	response = httptest.NewRecorder()
	versionInfo()(response, httptest.NewRequest(http.MethodPost, "/api/version", nil))
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("POST version returned %d", response.Code)
	}
}

func TestSecurityHeadersAndCorsAllowlist(t *testing.T) {
	handler := securityHeaders(cors(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		write(w, http.StatusOK, map[string]string{"status": "ok"})
	}), "http://localhost:4200"))

	request := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	request.Header.Set("Origin", "http://localhost:4200")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Header().Get("Access-Control-Allow-Origin") != "http://localhost:4200" || response.Header().Get("X-Content-Type-Options") != "nosniff" || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("missing runtime headers: %#v", response.Header())
	}

	request = httptest.NewRequest(http.MethodOptions, "/api/health", nil)
	request.Header.Set("Origin", "https://unexpected.example")
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusForbidden || response.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("unexpected origin was allowed: code=%d headers=%#v", response.Code, response.Header())
	}
}

func TestMutationAuditIsCredentialSafeAndRequestCorrelated(t *testing.T) {
	database, err := store.Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	handler := auditMutations(database, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		write(w, http.StatusCreated, map[string]string{"status": "created"})
	}))
	request := httptest.NewRequest(http.MethodPut, "/api/characters/private-id?token=do-not-store", bytes.NewBufferString(`{"email":"private@example.test","apiToken":"secret"}`))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusCreated || response.Header().Get("X-Request-ID") == "" {
		t.Fatalf("mutation was not correlated: code=%d headers=%#v", response.Code, response.Header())
	}
	entries, err := database.ListAudit(request.Context(), 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 || entries[0].Action != "character.update" || entries[0].Path != "/api/characters/:id" || entries[0].StatusCode != http.StatusCreated {
		t.Fatalf("unexpected audit entry: %#v", entries)
	}
	encoded, _ := json.Marshal(entries)
	for _, secret := range []string{"private-id", "token", "private@example.test", "apiToken", "secret"} {
		if bytes.Contains(encoded, []byte(secret)) {
			t.Fatalf("audit stored sensitive request material %q: %s", secret, encoded)
		}
	}

	response = httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/characters/private-id", nil))
	entries, err = database.ListAudit(request.Context(), 10)
	if err != nil || len(entries) != 1 {
		t.Fatalf("read request was audited: entries=%#v err=%v", entries, err)
	}
}

func TestOperationsAuditIsReadOnly(t *testing.T) {
	database, err := store.Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if err = database.RecordAudit(context.Background(), store.AuditEntry{RequestID: "request", Action: "jira.refresh", Method: "POST", Path: "/api/jira/refresh", StatusCode: 200}); err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	operationsAudit(database)(response, httptest.NewRequest(http.MethodGet, "/api/operations/audit?limit=1", nil))
	if response.Code != http.StatusOK || !bytes.Contains(response.Body.Bytes(), []byte("jira.refresh")) {
		t.Fatalf("audit endpoint failed: code=%d body=%s", response.Code, response.Body.String())
	}
	response = httptest.NewRecorder()
	operationsAudit(database)(response, httptest.NewRequest(http.MethodDelete, "/api/operations/audit", nil))
	if response.Code != http.StatusMethodNotAllowed {
		t.Fatalf("audit endpoint accepted mutation: %d", response.Code)
	}
}
