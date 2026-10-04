CREATE TABLE IF NOT EXISTS gunpla_images (
  gunpla_id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  etag TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
