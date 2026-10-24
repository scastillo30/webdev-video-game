package store

import (
	"path/filepath"
	"testing"
)

func TestGameProfilesSeedCompleteDistinctRoster(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	profiles, err := database.ListGameProfiles()
	if err != nil {
		t.Fatal(err)
	}
	if len(profiles) != 8 {
		t.Fatalf("expected eight game profiles, got %d", len(profiles))
	}
	byID := make(map[string]GameProfile, len(profiles))
	for _, profile := range profiles {
		byID[profile.CharacterID] = profile
		if profile.JiraAccountID != nil {
			t.Fatalf("seeded profile %s must not invent a Jira mapping", profile.CharacterID)
		}
	}
	commander, commanderOK := byID["commander"]
	rogue, rogueOK := byID["rogue"]
	if !commanderOK || !rogueOK {
		t.Fatal("Commander and Rogue must both have game profiles")
	}
	if commander.MiniatureAsset == rogue.MiniatureAsset || commander.PortraitAsset == rogue.PortraitAsset {
		t.Fatal("Commander and Rogue must keep distinct visual assets")
	}
}
