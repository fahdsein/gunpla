import { randomUUID } from "node:crypto";
import pg from "pg";
import seedCatalog from "../data/gunpla.json";
import { databaseUrl, enabled } from "./config";

const { Pool } = pg;
let pool: pg.Pool | undefined;
let schemaPromise: Promise<void> | undefined;

function getPool() {
  if (!pool) {
    const ssl = enabled(process.env.DATABASE_SSL)
      ? { rejectUnauthorized: !/^(0|false|no|off)$/i.test(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || "true") }
      : undefined;
    pool = new Pool({ connectionString:databaseUrl(), ssl, max:Number(process.env.DATABASE_POOL_SIZE || 5), connectionTimeoutMillis:5000, idleTimeoutMillis:30000 });
  }
  return pool;
}

export type GunplaRecord = {
  id:string; name:string; series:string; type:string; faction:string; pilot:string;
  release:string; price:string; scale:string; lore:string; armament:string;
  tags:string[]; notes:string; created_at:string; updated_at:string;
};

export type ImageRecord = {
  image_id:string; gunpla_id:string; position:number; object_key:string;
  content_type:string; alt_text:string; size_bytes:number; etag:string|null;
  created_at:string; updated_at:string;
};

function mapGunpla(row:any):GunplaRecord {
  return { ...row, tags:Array.isArray(row.tags)?row.tags:[], release:String(row.release_year || ""), created_at:String(row.created_at), updated_at:String(row.updated_at) };
}

export async function ensureSchema() {
  if (!enabled(process.env.DATABASE_AUTO_MIGRATE)) return;
  schemaPromise ||= (async()=>{
    const db=getPool();
    await db.query(`
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
    `);
    for (const item of seedCatalog) {
      await db.query(`
        INSERT INTO gunpla_models (id,name,series,type,faction,pilot,release_year,price,scale,lore,armament,tags,notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'[]'::jsonb,'')
        ON CONFLICT (id) DO NOTHING
      `,[item.id,item.name,item.series,item.type,item.faction,item.pilot,item.release,item.price,item.scale,item.lore,item.armament]);
    }
    const legacy=(await db.query("SELECT to_regclass('public.gunpla_images') AS table_name")).rows[0]?.table_name;
    if (legacy) {
      await db.query(`
        INSERT INTO gunpla_gallery_images (image_id,gunpla_id,position,object_key,content_type,alt_text,size_bytes,etag,updated_at)
        SELECT 'legacy-' || gunpla_id,gunpla_id,1,object_key,content_type,alt_text,size_bytes,etag,updated_at
        FROM gunpla_images WHERE gunpla_id IN (SELECT id FROM gunpla_models)
        ON CONFLICT DO NOTHING
      `);
    }
  })();
  try {
    await schemaPromise;
  } catch (error) {
    schemaPromise = undefined;
    throw error;
  }
}

export async function listGunpla():Promise<GunplaRecord[]> {await ensureSchema();return (await getPool().query("SELECT * FROM gunpla_models ORDER BY created_at ASC,name ASC")).rows.map(mapGunpla);}
export async function getGunpla(id:string):Promise<GunplaRecord|null> {await ensureSchema();const result=await getPool().query("SELECT * FROM gunpla_models WHERE id=$1",[id]);return result.rows[0]?mapGunpla(result.rows[0]):null;}

export async function saveGunpla(value:Omit<GunplaRecord,"created_at"|"updated_at">):Promise<GunplaRecord> {
  await ensureSchema();const id=value.id||randomUUID();
  const result=await getPool().query(`
    INSERT INTO gunpla_models (id,name,series,type,faction,pilot,release_year,price,scale,lore,armament,tags,notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,series=EXCLUDED.series,type=EXCLUDED.type,faction=EXCLUDED.faction,pilot=EXCLUDED.pilot,release_year=EXCLUDED.release_year,price=EXCLUDED.price,scale=EXCLUDED.scale,lore=EXCLUDED.lore,armament=EXCLUDED.armament,tags=EXCLUDED.tags,notes=EXCLUDED.notes,updated_at=NOW()
    RETURNING *
  `,[id,value.name,value.series,value.type,value.faction,value.pilot,value.release,value.price,value.scale,value.lore,value.armament,JSON.stringify(value.tags),value.notes]);
  return mapGunpla(result.rows[0]);
}

export async function importGunpla(records:Array<Omit<GunplaRecord,"created_at"|"updated_at">>) {
  await ensureSchema();const client=await getPool().connect();
  try {await client.query("BEGIN");for(const value of records){const id=value.id||randomUUID();await client.query(`
    INSERT INTO gunpla_models (id,name,series,type,faction,pilot,release_year,price,scale,lore,armament,tags,notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,series=EXCLUDED.series,type=EXCLUDED.type,faction=EXCLUDED.faction,pilot=EXCLUDED.pilot,release_year=EXCLUDED.release_year,price=EXCLUDED.price,scale=EXCLUDED.scale,lore=EXCLUDED.lore,armament=EXCLUDED.armament,tags=EXCLUDED.tags,notes=EXCLUDED.notes,updated_at=NOW()
  `,[id,value.name,value.series,value.type,value.faction,value.pilot,value.release,value.price,value.scale,value.lore,value.armament,JSON.stringify(value.tags),value.notes]);}await client.query("COMMIT");}
  catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  return listGunpla();
}

export async function removeGunpla(id:string){await ensureSchema();const images=await listImages(id);const result=await getPool().query("DELETE FROM gunpla_models WHERE id=$1 RETURNING id",[id]);return{removed:result.rowCount===1,images};}
export async function getImage(imageId:string):Promise<ImageRecord|null>{await ensureSchema();const result=await getPool().query<ImageRecord>("SELECT image_id,gunpla_id,position,object_key,content_type,alt_text,size_bytes::float8 AS size_bytes,etag,created_at,updated_at FROM gunpla_gallery_images WHERE image_id=$1",[imageId]);return result.rows[0]||null;}
export async function listImages(gunplaId?:string):Promise<ImageRecord[]>{await ensureSchema();const query=gunplaId?{text:"SELECT image_id,gunpla_id,position,object_key,content_type,alt_text,size_bytes::float8 AS size_bytes,etag,created_at,updated_at FROM gunpla_gallery_images WHERE gunpla_id=$1 ORDER BY position",values:[gunplaId]}:{text:"SELECT image_id,gunpla_id,position,object_key,content_type,alt_text,size_bytes::float8 AS size_bytes,etag,created_at,updated_at FROM gunpla_gallery_images ORDER BY gunpla_id,position",values:[]};return(await getPool().query<ImageRecord>(query)).rows;}
export async function saveImage(record:Omit<ImageRecord,"created_at"|"updated_at">){await ensureSchema();const result=await getPool().query<ImageRecord>("INSERT INTO gunpla_gallery_images (image_id,gunpla_id,position,object_key,content_type,alt_text,size_bytes,etag) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING image_id,gunpla_id,position,object_key,content_type,alt_text,size_bytes::float8 AS size_bytes,etag,created_at,updated_at",[record.image_id,record.gunpla_id,record.position,record.object_key,record.content_type,record.alt_text,record.size_bytes,record.etag]);return result.rows[0];}
export async function removeImage(imageId:string){await ensureSchema();const client=await getPool().connect();try{await client.query("BEGIN");const result=await client.query<ImageRecord>("DELETE FROM gunpla_gallery_images WHERE image_id=$1 RETURNING image_id,gunpla_id,position,object_key,content_type,alt_text,size_bytes::float8 AS size_bytes,etag,created_at,updated_at",[imageId]);const removed=result.rows[0]||null;if(removed)await client.query("UPDATE gunpla_gallery_images SET position=position-1,updated_at=NOW() WHERE gunpla_id=$1 AND position>$2",[removed.gunpla_id,removed.position]);await client.query("COMMIT");return removed;}catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}}
export async function checkDatabase(){await ensureSchema();await getPool().query("SELECT 1");}
