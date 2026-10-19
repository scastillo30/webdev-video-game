CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY CHECK(length(id) BETWEEN 1 AND 64),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  epithet TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '#69d5ff',
  animation_path TEXT NOT NULL DEFAULT '',
  poster_path TEXT NOT NULL DEFAULT '',
  thumb_path TEXT NOT NULL DEFAULT '',
  comment_thumb_path TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO characters(id,name,role,epithet,animation_path,poster_path,thumb_path,comment_thumb_path) VALUES
('commander','Commander','Architect','Architect of the Living Gate','assets/characters/commander/sword-ready/v001/idle.webp','assets/characters/commander/sword-ready/v001/poster.webp','assets/commander_full.webp','assets/characters/commander/sword-ready/v001/head.webp'),
('guardian','Guardian','DevOps','Warden of the Unbroken Realm','assets/characters/cube-wanderer/cube-wind/v002/web/idle.webp','assets/characters/cube-wanderer/cube-wind/v002/web/poster.webp','assets/guardian_full.webp','assets/characters/cube-wanderer/cube-wind/v002/web/head.webp'),
('rogue','Rogue','Frontend','Pathfinder of Hidden Routes','assets/rogue-pointing/pointing.webp','assets/rogue-pointing/poster.webp','assets/rogue_full.webp','assets/rogue-pointing/head.webp'),
('mage','Tech Mage','Backend','Keeper of the Service Arcana','','assets/mage_full.webp','assets/mage_full.webp','assets/mage_head.webp'),
('healer','Healer','UX / UI','Restorer of the Traveler’s Path','assets/characters/healer/crosier-victory/v002/web/idle.webp','assets/characters/healer/crosier-victory/v002/web/poster.webp','assets/healer_full.webp','assets/characters/healer/crosier-victory/v002/web/head.webp'),
('courier','Moon Courier','Support','Messenger Between the Outposts','','assets/courier_full.webp','assets/courier_full.webp','assets/courier_head.webp'),
('swordsman','Swordsman','QA','Blade of Unerring Precision','','assets/swordsman_full.webp','assets/swordsman_full.webp','assets/swordsman_head.webp'),
('bard','Shadow Bard','Automation','Singer of the Final Sequence','','assets/bard_full.webp','assets/bard_full.webp','assets/bard_head.webp');
