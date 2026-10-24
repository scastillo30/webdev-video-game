package store

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

type GameSettings struct {
	Scene                   string  `json:"scene"`
	MovementEnabled         bool    `json:"movementEnabled"`
	EffectsEnabled          bool    `json:"effectsEnabled"`
	AnimationSpeed          float64 `json:"animationSpeed"`
	SpectatorEnabled        bool    `json:"spectatorEnabled"`
	RotationIntervalSeconds int     `json:"rotationIntervalSeconds"`
	TVScale                 float64 `json:"tvScale"`
	SoundEnabled            bool    `json:"soundEnabled"`
}

type StatusBehaviorMapping struct {
	Status   string `json:"status"`
	Behavior string `json:"behavior"`
}

type GameConfig struct {
	Settings       GameSettings            `json:"settings"`
	Profiles       []GameProfile           `json:"profiles"`
	StatusMappings []StatusBehaviorMapping `json:"statusMappings"`
}

var allowedAnchors = map[string]bool{
	"command-dais": true, "north-forge": true, "west-archive": true, "east-library": true,
	"south-sanctum": true, "west-gate": true, "training-hall": true, "east-stage": true,
	"planning-table": true, "ops-console": true, "frontend-desk": true, "api-orb": true,
	"design-table": true, "support-desk": true, "qa-board": true, "automation-console": true,
}

var allowedBehaviors = map[string]bool{
	"IDLE": true, "WORKING": true, "DISCUSSING": true, "REVIEWING": true, "BLOCKED": true, "CELEBRATING": true,
}

func (s *Store) GetGameConfig(ctx context.Context) (GameConfig, error) {
	var config GameConfig
	if err := s.db.QueryRowContext(ctx, `SELECT scene,movement_enabled,effects_enabled,animation_speed,spectator_enabled,rotation_interval_seconds,tv_scale,sound_enabled FROM game_settings WHERE singleton=1`).Scan(
		&config.Settings.Scene, &config.Settings.MovementEnabled, &config.Settings.EffectsEnabled, &config.Settings.AnimationSpeed,
		&config.Settings.SpectatorEnabled, &config.Settings.RotationIntervalSeconds, &config.Settings.TVScale, &config.Settings.SoundEnabled); err != nil {
		return config, err
	}
	profiles, err := s.ListGameProfiles()
	if err != nil {
		return config, err
	}
	config.Profiles = profiles
	config.StatusMappings = []StatusBehaviorMapping{}
	rows, err := s.db.QueryContext(ctx, `SELECT status_name,behavior FROM jira_status_behavior_mappings ORDER BY status_name COLLATE NOCASE`)
	if err != nil {
		return config, err
	}
	defer rows.Close()
	for rows.Next() {
		var mapping StatusBehaviorMapping
		if err := rows.Scan(&mapping.Status, &mapping.Behavior); err != nil {
			return config, err
		}
		config.StatusMappings = append(config.StatusMappings, mapping)
	}
	return config, rows.Err()
}

func (s *Store) SaveGameConfig(ctx context.Context, config GameConfig) (GameConfig, error) {
	if err := s.validateGameConfig(ctx, config); err != nil {
		return GameConfig{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return GameConfig{}, err
	}
	defer tx.Rollback()
	settings := config.Settings
	if _, err = tx.ExecContext(ctx, `UPDATE game_settings SET scene=?,movement_enabled=?,effects_enabled=?,animation_speed=?,spectator_enabled=?,rotation_interval_seconds=?,tv_scale=?,sound_enabled=?,updated_at=CURRENT_TIMESTAMP WHERE singleton=1`,
		settings.Scene, settings.MovementEnabled, settings.EffectsEnabled, settings.AnimationSpeed, settings.SpectatorEnabled,
		settings.RotationIntervalSeconds, settings.TVScale, settings.SoundEnabled); err != nil {
		return GameConfig{}, err
	}
	for _, profile := range config.Profiles {
		if profile.JiraAccountID != nil {
			trimmed := strings.TrimSpace(*profile.JiraAccountID)
			if trimmed == "" {
				profile.JiraAccountID = nil
			} else {
				profile.JiraAccountID = &trimmed
			}
		}
		if _, err = tx.ExecContext(ctx, `UPDATE character_game_profiles SET jira_account_id=?,home_location=?,workstation=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE character_id=?`,
			profile.JiraAccountID, profile.HomeLocation, profile.Workstation, profile.Enabled, profile.CharacterID); err != nil {
			return GameConfig{}, err
		}
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM jira_status_behavior_mappings`); err != nil {
		return GameConfig{}, err
	}
	for _, mapping := range config.StatusMappings {
		if _, err = tx.ExecContext(ctx, `INSERT INTO jira_status_behavior_mappings(status_name,behavior) VALUES(?,?)`, strings.TrimSpace(mapping.Status), mapping.Behavior); err != nil {
			return GameConfig{}, err
		}
	}
	if err = tx.Commit(); err != nil {
		return GameConfig{}, err
	}
	return s.GetGameConfig(ctx)
}

func (s *Store) validateGameConfig(ctx context.Context, config GameConfig) error {
	settings := config.Settings
	if settings.Scene != "castle-command-center" {
		return errors.New("unsupported scene")
	}
	if settings.AnimationSpeed < 0.5 || settings.AnimationSpeed > 2 {
		return errors.New("animation speed must be between 0.5 and 2")
	}
	if settings.RotationIntervalSeconds < 5 || settings.RotationIntervalSeconds > 300 {
		return errors.New("rotation interval must be between 5 and 300 seconds")
	}
	if settings.TVScale < 0.8 || settings.TVScale > 1.4 {
		return errors.New("TV scale must be between 0.8 and 1.4")
	}
	known := map[string]bool{}
	rows, err := s.db.QueryContext(ctx, `SELECT id FROM characters`)
	if err != nil {
		return err
	}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		known[id] = true
	}
	if err := rows.Close(); err != nil {
		return err
	}
	seenCharacters, seenJiraIDs := map[string]bool{}, map[string]bool{}
	for _, profile := range config.Profiles {
		if !known[profile.CharacterID] || seenCharacters[profile.CharacterID] {
			return fmt.Errorf("unknown or duplicate character id %q", profile.CharacterID)
		}
		seenCharacters[profile.CharacterID] = true
		if !allowedAnchors[profile.HomeLocation] || !allowedAnchors[profile.Workstation] {
			return fmt.Errorf("unsupported location for %s", profile.CharacterID)
		}
		if !safeGameAsset(profile.MiniatureAsset) || !safeGameAsset(profile.PortraitAsset) {
			return fmt.Errorf("unsafe visual asset for %s", profile.CharacterID)
		}
		if profile.JiraAccountID != nil {
			id := strings.TrimSpace(*profile.JiraAccountID)
			if id == "" {
				continue
			} else if seenJiraIDs[id] {
				return fmt.Errorf("Jira account %q is mapped more than once", id)
			} else {
				seenJiraIDs[id] = true
			}
		}
	}
	if len(seenCharacters) != len(known) {
		return errors.New("configuration must include every character exactly once")
	}
	if len(config.StatusMappings) > 50 {
		return errors.New("no more than 50 status mappings are allowed")
	}
	seenStatuses := map[string]bool{}
	for _, mapping := range config.StatusMappings {
		status := strings.TrimSpace(mapping.Status)
		key := strings.ToLower(status)
		if status == "" || len(status) > 100 || seenStatuses[key] {
			return fmt.Errorf("invalid or duplicate Jira status %q", status)
		}
		if !allowedBehaviors[mapping.Behavior] {
			return fmt.Errorf("unsupported behavior %q", mapping.Behavior)
		}
		seenStatuses[key] = true
	}
	return nil
}

func safeGameAsset(path string) bool {
	clean := filepath.ToSlash(filepath.Clean(path))
	return clean == path && strings.HasPrefix(clean, "assets/") && !strings.Contains(clean, "..") && !filepath.IsAbs(path)
}
