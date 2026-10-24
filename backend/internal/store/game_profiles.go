package store

import "database/sql"

type GameProfile struct {
	CharacterID    string  `json:"characterId"`
	DisplayName    string  `json:"displayName"`
	CharacterClass string  `json:"characterClass"`
	JiraAccountID  *string `json:"jiraAccountId"`
	HomeLocation   string  `json:"homeLocation"`
	Workstation    string  `json:"workstation"`
	MiniatureAsset string  `json:"miniatureAsset"`
	PortraitAsset  string  `json:"portraitAsset"`
	Enabled        bool    `json:"enabled"`
}

func (s *Store) ListGameProfiles() ([]GameProfile, error) {
	rows, err := s.db.Query(`SELECT p.character_id,c.name,c.role,p.jira_account_id,p.home_location,p.workstation,p.miniature_asset,p.portrait_asset,p.enabled
		FROM character_game_profiles p JOIN characters c ON c.id=p.character_id ORDER BY c.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	profiles := []GameProfile{}
	for rows.Next() {
		var profile GameProfile
		var jiraAccount sql.NullString
		if err := rows.Scan(&profile.CharacterID, &profile.DisplayName, &profile.CharacterClass, &jiraAccount, &profile.HomeLocation,
			&profile.Workstation, &profile.MiniatureAsset, &profile.PortraitAsset, &profile.Enabled); err != nil {
			return nil, err
		}
		profile.JiraAccountID = ptr(jiraAccount)
		profiles = append(profiles, profile)
	}
	return profiles, rows.Err()
}
