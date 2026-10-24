package store

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
)

func TestGameConfigDefaultsAndPersistence(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	ctx := context.Background()
	config, err := database.GetGameConfig(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(config.Profiles) != 8 || config.Settings.RotationIntervalSeconds != 15 || len(config.StatusMappings) < 4 {
		t.Fatalf("unexpected defaults: %#v", config)
	}
	accountID := "jira-account-commander"
	for index := range config.Profiles {
		if config.Profiles[index].CharacterID == "commander" {
			config.Profiles[index].JiraAccountID = &accountID
		}
	}
	config.Settings.RotationIntervalSeconds = 30
	saved, err := database.SaveGameConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Settings.RotationIntervalSeconds != 30 {
		t.Fatalf("rotation interval was not persisted: %#v", saved.Settings)
	}
	for _, profile := range saved.Profiles {
		if profile.CharacterID == "commander" && (profile.JiraAccountID == nil || *profile.JiraAccountID != accountID) {
			t.Fatalf("Commander mapping was not persisted: %#v", profile)
		}
	}
}

func TestGameConfigRejectsDuplicateJiraMapping(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	ctx := context.Background()
	config, err := database.GetGameConfig(ctx)
	if err != nil {
		t.Fatal(err)
	}
	accountID := "duplicate-account"
	config.Profiles[0].JiraAccountID = &accountID
	config.Profiles[1].JiraAccountID = &accountID
	_, err = database.SaveGameConfig(ctx, config)
	if err == nil || !strings.Contains(err.Error(), "mapped more than once") {
		t.Fatalf("expected duplicate mapping validation error, got %v", err)
	}
}
