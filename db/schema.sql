CREATE TABLE IF NOT EXISTS gunpla_models (
  id TEXT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  series VARCHAR(100) NOT NULL,
  type VARCHAR(60) NOT NULL,
  faction VARCHAR(100) NOT NULL,
  pilot VARCHAR(140) NOT NULL,
  release_year VARCHAR(20) NOT NULL,
  price VARCHAR(80) NOT NULL,
  scale VARCHAR(30) NOT NULL,
  lore TEXT NOT NULL,
  armament TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gunpla_gallery_images (
  image_id TEXT PRIMARY KEY,
  gunpla_id TEXT NOT NULL REFERENCES gunpla_models(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 7),
  object_key TEXT NOT NULL UNIQUE,
  content_type VARCHAR(80) NOT NULL,
  alt_text VARCHAR(180) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  etag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gunpla_id, position)
);

CREATE INDEX IF NOT EXISTS gunpla_models_series_idx ON gunpla_models(series);
CREATE INDEX IF NOT EXISTS gunpla_gallery_gunpla_idx ON gunpla_gallery_images(gunpla_id, position);

-- Version 1 compatibility: the application copies every legacy gunpla_images row
-- into gallery position 1. Keep the old table until the migrated gallery is verified.
