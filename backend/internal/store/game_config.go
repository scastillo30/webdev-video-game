package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
)

type GameSettings struct {
	HolidayMode             string   `json:"holidayMode"`
	HolidayItems            []string `json:"holidayItems"`
	Scene                   string   `json:"scene"`
	MovementEnabled         bool     `json:"movementEnabled"`
	EffectsEnabled          bool     `json:"effectsEnabled"`
	AnimationSpeed          float64  `json:"animationSpeed"`
	SpectatorEnabled        bool     `json:"spectatorEnabled"`
	RotationIntervalSeconds int      `json:"rotationIntervalSeconds"`
	TVScale                 float64  `json:"tvScale"`
	SoundEnabled            bool     `json:"soundEnabled"`
	JiraProjects            []string `json:"jiraProjects"`
	JiraIssueTypes          []string `json:"jiraIssueTypes"`
	FeaturedTicketRule      string   `json:"featuredTicketRule"`
	RefreshIntervalSeconds  int      `json:"refreshIntervalSeconds"`
	TVModeEnabled           bool     `json:"tvModeEnabled"`
	FullscreenEnabled       bool     `json:"fullscreenEnabled"`
	TargetFPS               int      `json:"targetFps"`
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

var allowedFeaturedTicketRules = map[string]bool{
	"recently-updated": true, "highest-priority": true, "nearest-due-date": true,
}

var projectKeyPattern = regexp.MustCompile(`^[A-Z][A-Z0-9_-]{0,49}$`)

func (s *Store) GetGameConfig(ctx context.Context) (GameConfig, error) {
	var config GameConfig
	var projectsJSON, issueTypesJSON, holidayItemsJSON string
	if err := s.db.QueryRowContext(ctx, `SELECT holiday_mode,holiday_items,scene,movement_enabled,effects_enabled,animation_speed,spectator_enabled,rotation_interval_seconds,tv_scale,sound_enabled,jira_projects,jira_issue_types,featured_ticket_rule,refresh_interval_seconds,tv_mode_enabled,fullscreen_enabled,target_fps FROM game_settings WHERE singleton=1`).Scan(
		&config.Settings.HolidayMode, &holidayItemsJSON, &config.Settings.Scene, &config.Settings.MovementEnabled, &config.Settings.EffectsEnabled, &config.Settings.AnimationSpeed,
		&config.Settings.SpectatorEnabled, &config.Settings.RotationIntervalSeconds, &config.Settings.TVScale, &config.Settings.SoundEnabled,
		&projectsJSON, &issueTypesJSON, &config.Settings.FeaturedTicketRule, &config.Settings.RefreshIntervalSeconds,
		&config.Settings.TVModeEnabled, &config.Settings.FullscreenEnabled, &config.Settings.TargetFPS); err != nil {
		return config, err
	}
	if err := json.Unmarshal([]byte(projectsJSON), &config.Settings.JiraProjects); err != nil {
		return config, fmt.Errorf("decode Jira projects: %w", err)
	}
	if err := json.Unmarshal([]byte(issueTypesJSON), &config.Settings.JiraIssueTypes); err != nil {
		return config, fmt.Errorf("decode Jira issue types: %w", err)
	}
	if err := json.Unmarshal([]byte(holidayItemsJSON), &config.Settings.HolidayItems); err != nil {
		return config, fmt.Errorf("decode holiday items: %w", err)
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
	if config.Settings.HolidayMode == "" {
		config.Settings.HolidayMode = "none"
	}
	config.Settings.HolidayItems = normalizeList(config.Settings.HolidayItems, false)
	config.Settings.JiraProjects = normalizeList(config.Settings.JiraProjects, true)
	config.Settings.JiraIssueTypes = normalizeList(config.Settings.JiraIssueTypes, false)
	if err := s.validateGameConfig(ctx, config); err != nil {
		return GameConfig{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return GameConfig{}, err
	}
	defer tx.Rollback()
	settings := config.Settings
	holidayItemsJSON, _ := json.Marshal(settings.HolidayItems)
	projectsJSON, _ := json.Marshal(settings.JiraProjects)
	issueTypesJSON, _ := json.Marshal(settings.JiraIssueTypes)
	if _, err = tx.ExecContext(ctx, `UPDATE game_settings SET holiday_mode=?,holiday_items=?,scene=?,movement_enabled=?,effects_enabled=?,animation_speed=?,spectator_enabled=?,rotation_interval_seconds=?,tv_scale=?,sound_enabled=?,jira_projects=?,jira_issue_types=?,featured_ticket_rule=?,refresh_interval_seconds=?,tv_mode_enabled=?,fullscreen_enabled=?,target_fps=?,updated_at=CURRENT_TIMESTAMP WHERE singleton=1`,
		settings.HolidayMode, string(holidayItemsJSON), settings.Scene, settings.MovementEnabled, settings.EffectsEnabled, settings.AnimationSpeed, settings.SpectatorEnabled,
		settings.RotationIntervalSeconds, settings.TVScale, settings.SoundEnabled, string(projectsJSON), string(issueTypesJSON),
		settings.FeaturedTicketRule, settings.RefreshIntervalSeconds, settings.TVModeEnabled, settings.FullscreenEnabled, settings.TargetFPS); err != nil {
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
	if settings.HolidayMode != "none" && settings.HolidayMode != "halloween" && settings.HolidayMode != "christmas" {
		return errors.New("unsupported holiday mode")
	}
	allowedItems := map[string]bool{"pumpkins": true, "bats": true, "cobwebs": true, "trees": true, "gifts": true, "garlands": true}
	for _, item := range settings.HolidayItems {
		if !allowedItems[item] {
			return fmt.Errorf("unsupported holiday item %q", item)
		}
	}
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
	if !allowedFeaturedTicketRules[settings.FeaturedTicketRule] {
		return errors.New("unsupported featured ticket rule")
	}
	if settings.RefreshIntervalSeconds < 10 || settings.RefreshIntervalSeconds > 3600 {
		return errors.New("refresh interval must be between 10 and 3600 seconds")
	}
	if settings.TargetFPS != 24 && settings.TargetFPS != 30 && settings.TargetFPS != 60 {
		return errors.New("target FPS must be 24, 30, or 60")
	}
	if len(settings.JiraProjects) > 50 || len(settings.JiraIssueTypes) > 50 {
		return errors.New("no more than 50 Jira projects or issue types are allowed")
	}
	for _, project := range settings.JiraProjects {
		if !projectKeyPattern.MatchString(project) {
			return fmt.Errorf("invalid Jira project key %q", project)
		}
	}
	for _, issueType := range settings.JiraIssueTypes {
		if issueType == "" || len(issueType) > 100 {
			return fmt.Errorf("invalid Jira issue type %q", issueType)
		}
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

func normalizeList(values []string, uppercase bool) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if uppercase {
			value = strings.ToUpper(value)
		}
		key := strings.ToLower(value)
		if value == "" || seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, value)
	}
	return result
}
