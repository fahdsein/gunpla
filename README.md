# Gunpla Archive

An Astro SSR web service for a personal Gunpla knowledge base. It follows the same durable-content model as the Book Summary app: catalog records live in PostgreSQL / NEO DB and uploaded media lives in private S3-compatible object storage.

## Included functionality

- Public searchable and filterable catalog at `/`.
- Full admin CRUD for Gunpla records at `/admin`.
- Comma-separated tags, builder notes, lore, armament, pilot, faction, release, price, and scale fields.
- JSON merge import and JSON export. Import updates matching IDs and keeps records omitted from the file.
- Up to **7 JPG, PNG, or WebP images per Gunpla**. Each file is checked by its real byte signature and is limited to 5 MB by default.
- Private S3 bucket support. Visitors see images through `/api/images/<image-id>`; credentials never reach the browser.
- Signed HTTP-only admin sessions, same-origin mutation checks, liveness at `/healthz`, and dependency readiness at `/readyz`.
- Automatic migration of the original 30 records from `src/data/gunpla.json` and legacy single-image mappings into gallery slot 1.

Images are not embedded in JSON exports. Importing or editing a record preserves its existing gallery. Deleting a record removes its database gallery mapping and attempts to delete all related S3 objects.

## JSON import format

Import either a direct array or an object containing a `gunpla` array:

```json
{
  "schemaVersion": 2,
  "gunpla": [
    {
      "id": "wing-zero-ew",
      "name": "Wing Gundam Zero EW",
      "series": "Endless Waltz",
      "type": "Retail",
      "faction": "Operation Meteor",
      "pilot": "Heero Yuy",
      "release": "2004",
      "price": "¥3,800",
      "scale": "1/100 MG",
      "lore": "Short catalog explanation.",
      "armament": "Twin Buster Rifle, beam sabers",
      "tags": ["Wing", "EW", "Gundam"],
      "notes": "Personal build notes."
    }
  ]
}
```

When `id` matches an existing record it is updated. A new or omitted ID creates a new record. Up to 500 records are accepted per import.

## Deploy on NEO App

The repository supports three source-build paths:

- `Dockerfile` — recommended when you want the most deterministic build.
- `nixpacks.toml` — Nixpacks build plan.
- `project.toml` plus the package scripts — Cloud Native Buildpacks with a Paketo-compatible Node.js builder.

See [BUILDING.md](BUILDING.md) for the exact builder behavior and local verification commands. Builder choice does not replace the NEO DB, private S3, runtime-variable, health-check, or networking setup below.

### 1. Prepare NEO resources

In one NEO App project and environment:

1. Create a **NEO DB / PostgreSQL** resource.
2. Create or attach S3-compatible object storage and make a private bucket such as `gunpla-assets`.
3. Give the application credentials access to `HeadBucket`, `GetObject`, `PutObject`, and `DeleteObject` for that bucket, preferably restricted to the `gunpla/` prefix.

No public-read bucket policy or filesystem mount is needed.

### 2. Generate admin secrets locally

```powershell
npm ci
npm run hash-password -- "choose-a-long-admin-password"
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Use the `scrypt$...` output as `ADMIN_PASSWORD_HASH`. Use the random Base64 value as `SESSION_SECRET`. Keep the plain password for signing in; do not store it in Git.

### 3. Create the web service

1. Choose **Web Service**, connect this repository, and select its branch.
2. Select **Dockerfile / Build File** and use `Dockerfile` in the repository root.
3. Attach the NEO DB and object-storage resources.
4. Use container port `3000` only if NEO does not detect it automatically. The app listens on `0.0.0.0`.
5. Enable public networking.
6. Configure `/readyz` as the readiness/health path. `/healthz` is the lightweight liveness path.
7. Start with one replica and approve the deployment.

### 4. Configure variables

Copy values from `neoapp.env.example` into the service variable/secret form:

| Variable | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection URL from the attached NEO DB |
| `DATABASE_AUTO_MIGRATE` | Yes initially | `true` creates/updates the app tables and seeds the original catalog |
| `DATABASE_SSL` | Provider-dependent | Use `true` when the database requires TLS |
| `S3_ENDPOINT` | Yes | Storage API endpoint, not its browser console URL |
| `S3_REGION` | Yes | Exact storage region shown by NEO |
| `S3_BUCKET` | Yes | Existing private bucket |
| `S3_FORCE_PATH_STYLE` | Provider-dependent | Commonly `true` for S3-compatible storage |
| `S3_ACCESS_KEY_ID` | Yes | Bucket-scoped access key |
| `S3_SECRET_ACCESS_KEY` | Yes | Bucket-scoped secret key |
| `ADMIN_USERNAME` | Yes | Admin sign-in name; default is `admin` |
| `ADMIN_PASSWORD_HASH` | Yes | Generated `scrypt$...` hash |
| `SESSION_SECRET` | Yes | Random value of at least 32 characters |
| `MAX_IMAGE_BYTES` | No | Per-image limit; default `5242880` (5 MB) |

NEO normally injects `PORT`; do not create it manually unless the platform requires it. Never commit real database, S3, or admin secrets.

### 5. Verify after deployment

1. Open `/healthz`; expect HTTP 200 and `status: ok`.
2. Open `/readyz`; expect database, storage, and admin to report `ready`.
3. Open `/`; the original seeded catalog should appear.
4. Open `/admin`, sign in, create or edit one record, and refresh `/` to confirm it persists.
5. Upload 2–7 images, confirm the public card shows the first image, and open the detail gallery.
6. Try an eighth image; the UI and server must reject it.
7. Export JSON, edit a record in the file, import it, and confirm other records and galleries remain.

If `/readyz` returns 503, inspect service logs. Common causes are an incorrect `DATABASE_URL`, an S3 console URL used as `S3_ENDPOINT`, a missing bucket, or incorrect path-style/region settings.

## Run locally with Docker

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Keep `ADMIN_PASSWORD_HASH` inside single quotes in `.env` because it contains `$` characters.
3. Start PostgreSQL, MinIO, bucket initialization, and the app:

```powershell
docker compose up --build
```

Open <http://localhost:3000> and <http://localhost:3000/admin>. The MinIO console is at <http://localhost:9001>. Stop with `docker compose down`; add `-v` only when you intentionally want to erase local database and storage volumes.

## Security and operational notes

- Keep S3 private. Public-read permissions are unnecessary because the app streams authorized objects.
- Rotate S3 and admin secrets through NEO settings, never source control.
- SVG and arbitrary uploads are rejected to reduce script/content-type risks.
- All admin pages and mutation APIs require a signed session; write calls also validate the request origin.
- Use imagery you have permission to publish.
- `db/schema.sql` documents the schema. Runtime migration is idempotent when `DATABASE_AUTO_MIGRATE=true`.
