# Alternative builders

Gunpla Archive can be built from the repository root with Docker, Nixpacks, or Cloud Native Buildpacks. All three paths run the same application contract:

- Node.js 22
- build command: `npm run build`
- start command: `npm run start`
- listen address: `0.0.0.0`
- port: the runtime-provided `PORT` value, falling back to `3000` locally

Runtime variables and secrets belong in the NEO App service configuration. Do not put database, S3, or admin credentials in a builder file.

## Dockerfile

Use `Dockerfile` from the repository root. This remains the most deterministic option because the build and runtime images are explicitly defined.

## Nixpacks

Use the repository root as the source and select Nixpacks as the builder. `nixpacks.toml` installs locked dependencies, runs the Astro build, and starts the SSR server. `package.json` selects Node.js 22.

Local verification when the Nixpacks CLI and Docker are installed:

```powershell
nixpacks build . --name gunpla-nixpacks
docker run --rm -p 3000:3000 --env-file .env gunpla-nixpacks
```

Nixpacks also recognizes `Procfile`; it declares the same `web` process as the explicit start command.

## Cloud Native Buildpacks

Use a Node.js builder that supports the Paketo Node.js buildpacks. `project.toml` asks the builder to run the `build` package script, while the package `start` script supplies the web process.

Local verification with Pack and Docker:

```powershell
pack build gunpla-buildpacks --builder paketobuildpacks/builder-jammy-base
docker run --rm -p 3000:3000 --env-file .env gunpla-buildpacks
```

The platform must support the standard `project.toml` descriptor and a builder containing Node.js buildpacks. If NEO App does not yet expose Nixpacks or Buildpacks as a source/build option, keep using the existing Dockerfile; repository files alone cannot enable an unsupported platform builder.

## NEO App runtime settings

Whichever builder is selected:

1. Deploy it as a **Web Service** from the repository root.
2. Attach PostgreSQL / NEO DB and private S3-compatible storage.
3. Add the variables and secrets listed in `neoapp.env.example`.
4. Enable public networking.
5. Use `/readyz` for dependency readiness and `/healthz` for lightweight liveness.
6. Let NEO App inject `PORT`; do not store a fixed production port in Git.
