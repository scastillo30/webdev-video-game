ALTER TABLE game_settings ADD COLUMN holiday_mode TEXT NOT NULL DEFAULT 'none' CHECK(holiday_mode IN ('none','halloween','christmas'));
ALTER TABLE game_settings ADD COLUMN holiday_items TEXT NOT NULL DEFAULT '["pumpkins","bats","cobwebs","trees","gifts","garlands"]';
