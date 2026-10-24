CREATE TABLE IF NOT EXISTS character_game_profiles (
  character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  jira_account_id TEXT UNIQUE,
  home_location TEXT NOT NULL,
  workstation TEXT NOT NULL,
  miniature_asset TEXT NOT NULL,
  portrait_asset TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO character_game_profiles(character_id,home_location,workstation,miniature_asset,portrait_asset) VALUES
('commander','command-dais','planning-table','assets/commander_full.webp','assets/commander_head.webp'),
('guardian','north-forge','ops-console','assets/guardian_full.webp','assets/guardian_head.webp'),
('rogue','west-archive','frontend-desk','assets/rogue_full.webp','assets/rogue_head.webp'),
('mage','east-library','api-orb','assets/mage_full.webp','assets/mage_head.webp'),
('healer','south-sanctum','design-table','assets/healer_full.webp','assets/healer_head.webp'),
('courier','west-gate','support-desk','assets/courier_full.webp','assets/courier_head.webp'),
('swordsman','training-hall','qa-board','assets/swordsman_full.webp','assets/swordsman_head.webp'),
('bard','east-stage','automation-console','assets/bard_full.webp','assets/bard_head.webp');
