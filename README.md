# Gundam Wing MG Gunpla Archive

A standalone Astro static site containing a searchable and filterable Master Grade Gundam Wing catalog. The build produces static files and requires no backend server, database, queue, object storage, secrets, or environment variables.

## Local verification

```bash
npm ci
npm run build
npm run preview
```

## NEO App deployment

- Repository branch: `main`
- Root Directory: leave blank when this folder is the repository root; otherwise use `demo-example/gunpla`
- Build method: Automatic / Railpack
- Build command: `npm run build` if Astro is not detected automatically
- Publish/output directory: `dist`
- Environment variables: none
- Runtime port: do not configure one for the generated static build
- Health-check path: `/`

Astro generates the production site at build time. The application loads Tailwind CSS, Font Awesome, and Google Fonts from public CDNs in the visitor's browser.
