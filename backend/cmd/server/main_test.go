package main

import (
	"bytes"
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
