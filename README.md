# Gundam Wing MG Gunpla Archive

An Astro server-rendered catalog with an administrator-only image manager. Catalog images are stored in private S3-compatible object storage, while PostgreSQL / NEO DB stores the mapping between each Gunpla record and its current image.

## What changed

- The project is now a **Web Service**, not a Static Site.
- `/` is the public searchable catalog.
- `/admin` is the protected image manager.
- `/api/images/<gunpla-id>` safely streams private images to public visitors.
- `/healthz` checks the web process.
- `/readyz` checks both PostgreSQL and object storage.
- JPG, PNG, and WebP uploads are accepted up to 5 MB by default.
- Uploaded bytes are inspected; file extensions alone are not trusted.
- Replacing an image saves the new image first and removes the previous object afterward.
- The original 30-item catalog is kept in `src/data/gunpla.json`.

The browser never receives S3 credentials. Uploads pass through the web service, so NEO object storage does not need browser CORS configuration and the bucket can remain private.

## Beginner-friendly NEO App deployment

### 1. Prepare the repository

Push this folder as the root of its own Git repository. `Dockerfile`, `package.json`, and `src` should be visible at the repository root.

Do not commit a real `.env` file, database URL, S3 secret, password hash, or session secret.

### 2. Create the database

1. Open the intended NEO project.
2. Create a **NEO DB / PostgreSQL** resource.
3. Wait until it is ready.
4. Record or attach its PostgreSQL connection value as `DATABASE_URL`.

The application creates only the `gunpla_images` table when `DATABASE_AUTO_MIGRATE=true`. The operation is idempotent. The equivalent SQL is available in `db/schema.sql`.

### 3. Prepare object storage

1. Create or select an S3-compatible Object Storage resource.
2. Create a private bucket, for example `gunpla-assets`.
3. Record its endpoint, region, bucket name, access key, and secret key.
4. The credentials require `GetObject`, `PutObject`, `DeleteObject`, and bucket-read/head access for the selected bucket. Restrict them to the `gunpla/` prefix when the provider supports prefix policies.

The application deliberately does not create or make a bucket public.

### 4. Generate admin secrets locally

Install dependencies, then generate the password hash:

```powershell
npm ci
npm run hash-password -- "replace-this-with-your-long-admin-password"
```

Copy the complete output beginning with `scrypt$`. That output becomes `ADMIN_PASSWORD_HASH`; the plain password is what you enter on `/admin/login`.

Generate a session secret in PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Save that output as `SESSION_SECRET`. It must contain at least 32 characters.

### 5. Create the Web Service

1. In the same NEO project, choose to create a **Web Service**.
2. Select the Git repository and branch.
3. Select **Build File / Dockerfile** as the build method.
4. Use `Dockerfile` at the repository root.
5. Attach the NEO DB and ensure its value is available as `DATABASE_URL`.
6. Attach the object-storage resource if NEO supports attachment, then verify the generated variable names.
7. Configure service/container port `3000` if NEO does not discover it from the Dockerfile.
8. Enable public access.
9. Use `/readyz` as the health-check path. `/healthz` is only the process-liveness check.
10. Start with one replica, deploy, and wait for readiness.

### 6. Add environment variables

Use `neoapp.env.example` as the checklist. Add each value through the NEO secret/environment-variable form:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Attached PostgreSQL connection URL |
| `DATABASE_AUTO_MIGRATE` | Yes initially | Set `true` to create the image table |
| `DATABASE_SSL` | Only if required | Set `true` when the DB requires TLS |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No | Keep `true`; use `false` only for a DB certificate that cannot be verified |
| `S3_ENDPOINT` | Yes | S3-compatible service endpoint, not a console URL |
| `S3_REGION` | Yes | Exact region shown by the attached storage resource (for example `WJV-1`); do not assume `us-east-1` |
| `S3_BUCKET` | Yes | Existing private bucket name |
| `S3_PREFIX` | No | Defaults to `gunpla` |
| `S3_FORCE_PATH_STYLE` | Provider-dependent | Usually `true` for S3-compatible platforms |
| `S3_ACCESS_KEY_ID` | Yes | Storage access key; `S3_ACCESS_KEY` and `AWS_ACCESS_KEY_ID` are also accepted |
| `S3_SECRET_ACCESS_KEY` | Yes | Storage secret; `S3_SECRET_KEY` and `AWS_SECRET_ACCESS_KEY` are also accepted |
| `ADMIN_USERNAME` | Yes | Admin login name; defaults to `admin` |
| `ADMIN_PASSWORD_HASH` | Yes | Output from the password-hash command |
| `SESSION_SECRET` | Yes | Random value of at least 32 characters |
| `MAX_IMAGE_BYTES` | No | Defaults to `5242880` (5 MB) |

Do not manually set `PORT` when NEO injects it automatically. The container defaults to port `3000` and listens on `0.0.0.0`.

### 7. Verify the deployment

Open these paths on the assigned NEO public domain:

1. `/healthz` should return `status: ok`.
2. `/readyz` should return `database: ready`, `storage: ready`, and `admin: ready`.
3. `/` should show the public catalog and image placeholders.
4. `/admin` should redirect to `/admin/login`.
5. Sign in and upload a JPG, PNG, or WebP image for one record.
6. Refresh `/` and verify the image appears on its card and detail modal.
7. Replace the image and verify the public image changes.
8. Remove it and verify the catalog returns to its placeholder.

If `/readyz` returns `503`, check the service logs. The most common causes are an incorrect `DATABASE_URL`, using the S3 console URL instead of the API endpoint, a missing bucket, or incorrect path-style configuration.

Both probe responses disable caching. `/readyz` evaluates the database, private S3 bucket, and admin configuration independently, so its response shows which dependency needs attention without exposing credentials.

## Run locally with Docker

1. Copy `.env.example` to `.env`.
2. Replace every `change-this` or `replace-with` value.
3. Generate `ADMIN_PASSWORD_HASH` using the command above.
4. Start the complete app, PostgreSQL, and MinIO stack:

Keep the generated hash inside single quotes in the local `.env` file because a scrypt hash contains `$` characters. In the NEO environment-variable form, paste the raw hash without quotes.

```powershell
docker compose up --build
```

Then open:

- Public catalog: <http://localhost:3000>
- Admin login: <http://localhost:3000/admin>
- MinIO console: <http://localhost:9001>

Stop it with `docker compose down`. Add `-v` only when you intentionally want to delete the local database and stored test images.

## Development without Docker

Provide a reachable PostgreSQL database and S3-compatible bucket, export the variables from `.env.example`, and run:

```powershell
npm ci
npm run dev
```

Astro does not automatically load arbitrary production secrets from NEO; configure them in the NEO service settings.

## Security notes

- Never store S3 credentials or the admin password in browser-side JavaScript.
- Keep the bucket private; public reads go through `/api/images/<id>`.
- Admin sessions are signed, HTTP-only, same-site cookies and are marked secure in production.
- Upload, replace, and delete routes validate the session and request origin.
- SVG and arbitrary files are rejected.
- Use images you have permission to publish; Gundam artwork and product photography may be copyrighted.
