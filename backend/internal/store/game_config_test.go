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
	config.Settings.JiraProjects = []string{" planna ", "livebug", "PLANNA"}
	config.Settings.JiraIssueTypes = []string{"Bug", " Task ", "bug"}
	config.Settings.FeaturedTicketRule = "highest-priority"
	config.Settings.RefreshIntervalSeconds = 90
	config.Settings.TargetFPS = 24
	saved, err := database.SaveGameConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Settings.RotationIntervalSeconds != 30 {
		t.Fatalf("rotation interval was not persisted: %#v", saved.Settings)
	}
	if len(saved.Settings.JiraProjects) != 2 || saved.Settings.JiraProjects[0] != "PLANNA" || saved.Settings.RefreshIntervalSeconds != 90 || saved.Settings.TargetFPS != 24 {
		t.Fatalf("extended settings were not normalized and persisted: %#v", saved.Settings)
	}
	for _, profile := range saved.Profiles {
		if profile.CharacterID == "commander" && (profile.JiraAccountID == nil || *profile.JiraAccountID != accountID) {
			t.Fatalf("Commander mapping was not persisted: %#v", profile)
		}
	}
}

func TestGameConfigRejectsUnsafeRuntimePreferences(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	config, err := database.GetGameConfig(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	config.Settings.JiraProjects = []string{"NOT A PROJECT"}
	if _, err = database.SaveGameConfig(context.Background(), config); err == nil || !strings.Contains(err.Error(), "project key") {
		t.Fatalf("expected invalid project validation, got %v", err)
	}
	config, _ = database.GetGameConfig(context.Background())
	config.Settings.TargetFPS = 55
	if _, err = database.SaveGameConfig(context.Background(), config); err == nil || !strings.Contains(err.Error(), "target FPS") {
		t.Fatalf("expected FPS validation, got %v", err)
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

func TestHolidayDecorationsPersistAndValidate(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "holiday.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	ctx := context.Background()
	config, err := database.GetGameConfig(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if config.Settings.HolidayMode != "none" || len(config.Settings.HolidayItems) != 6 {
		t.Fatalf("unexpected holiday defaults: %#v", config.Settings)
	}
	for _, mode := range []string{"halloween", "christmas", "none"} {
		config.Settings.HolidayMode = mode
		config.Settings.HolidayItems = []string{"pumpkins", "trees"}
		saved, err := database.SaveGameConfig(ctx, config)
		if err != nil {
			t.Fatal(err)
		}
		if saved.Settings.HolidayMode != mode || len(saved.Settings.HolidayItems) != 2 {
			t.Fatalf("holiday selection not persisted: %#v", saved.Settings)
		}
	}
	config.Settings.HolidayMode = "unknown"
	if _, err := database.SaveGameConfig(ctx, config); err == nil {
		t.Fatal("accepted unknown holiday mode")
	}
	config.Settings.HolidayMode = "halloween"
	config.Settings.HolidayItems = []string{"unknown"}
	if _, err := database.SaveGameConfig(ctx, config); err == nil {
		t.Fatal("accepted unknown decoration")
	}
	config.Settings.HolidayItems = []string{}
	saved, err := database.SaveGameConfig(ctx, config)
	if err != nil || len(saved.Settings.HolidayItems) != 0 {
		t.Fatalf("cannot deselect all items: %v", err)
	}
}
