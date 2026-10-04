import pg from "pg";
import { databaseUrl, enabled } from "./config";

const { Pool } = pg;
let pool: pg.Pool | undefined;
let schemaPromise: Promise<void> | undefined;

function getPool() {
  if (!pool) {
    const ssl = enabled(process.env.DATABASE_SSL)
      ? { rejectUnauthorized: !/^(0|false|no|off)$/i.test(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || "true") }
      : undefined;

    pool = new Pool({
      connectionString: databaseUrl(),
      ssl,
      max: Number(process.env.DATABASE_POOL_SIZE || 5),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export type ImageRecord = {
  gunpla_id: string;
  object_key: string;
  content_type: string;
  alt_text: string;
  size_bytes: number;
  etag: string | null;
  updated_at: string;
};

export async function ensureSchema() {
  if (!enabled(process.env.DATABASE_AUTO_MIGRATE)) return;
  schemaPromise ||= getPool().query(`
    CREATE TABLE IF NOT EXISTS gunpla_images (
      gunpla_id TEXT PRIMARY KEY,
      object_key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      alt_text TEXT NOT NULL DEFAULT '',
      size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
      etag TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() => undefined);
  return schemaPromise;
}

export async function getImage(gunplaId: string): Promise<ImageRecord | null> {
  await ensureSchema();
  const result = await getPool().query<ImageRecord>(
    "SELECT gunpla_id, object_key, content_type, alt_text, size_bytes::float8 AS size_bytes, etag, updated_at FROM gunpla_images WHERE gunpla_id = $1",
    [gunplaId],
  );
  return result.rows[0] || null;
}

export async function listImages(): Promise<ImageRecord[]> {
  await ensureSchema();
  const result = await getPool().query<ImageRecord>(
    "SELECT gunpla_id, object_key, content_type, alt_text, size_bytes::float8 AS size_bytes, etag, updated_at FROM gunpla_images ORDER BY gunpla_id",
  );
  return result.rows;
}

export async function saveImage(record: Omit<ImageRecord, "updated_at">) {
  await ensureSchema();
  const result = await getPool().query<ImageRecord>(`
    INSERT INTO gunpla_images (gunpla_id, object_key, content_type, alt_text, size_bytes, etag)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (gunpla_id) DO UPDATE SET
      object_key = EXCLUDED.object_key,
      content_type = EXCLUDED.content_type,
      alt_text = EXCLUDED.alt_text,
      size_bytes = EXCLUDED.size_bytes,
      etag = EXCLUDED.etag,
      updated_at = NOW()
    RETURNING gunpla_id, object_key, content_type, alt_text, size_bytes::float8 AS size_bytes, etag, updated_at
  `, [record.gunpla_id, record.object_key, record.content_type, record.alt_text, record.size_bytes, record.etag]);
  return result.rows[0];
}

export async function removeImage(gunplaId: string) {
  await ensureSchema();
  const result = await getPool().query<ImageRecord>(
    "DELETE FROM gunpla_images WHERE gunpla_id = $1 RETURNING gunpla_id, object_key, content_type, alt_text, size_bytes::float8 AS size_bytes, etag, updated_at",
    [gunplaId],
  );
  return result.rows[0] || null;
}

export async function checkDatabase() {
  await ensureSchema();
  await getPool().query("SELECT 1");
}
