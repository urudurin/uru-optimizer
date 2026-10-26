# Enka proxy (Cloudflare Worker)

One-click Enka import on a hosted copy of the site. Enka.Network doesn't accept requests made from other sites' pages,
so the site asks this worker, which asks Enka. Under `npm start` the dev server does the same job (`/enka-proxy` in
`vite.config.ts`), so this is only needed for a hosted site.

It is deliberately narrow (see `src/proxy.ts`):

- only `GET` requests for a Genshin (`/api/uid/<uid>`) or ZZZ (`/api/zzz/uid/<uid>`) player profile, nothing else
- only for the sites listed in `ALLOWED_ORIGINS` (`wrangler.toml`)
- a custom User-Agent, and each profile cached until Enka's `ttl` runs out, as Enka's API guidelines ask

Personal, non-commercial use. Cloudflare's free plan covers it (100,000 requests a day).

## Deploy

1. Add the hosted site's address to `ALLOWED_ORIGINS` in `wrangler.toml`, e.g. `https://urudurin.github.io`
   (origin only: no path, no trailing slash).
2. From this folder, log in to Cloudflare (opens your browser) and deploy:

   ```bash
   npx wrangler login
   ```

   ```bash
   npx wrangler deploy
   ```

   Wrangler prints the worker's address, e.g. `https://uru-enka-proxy.<your-account>.workers.dev`.
3. Build the site with that address, so its Enka import goes through the worker:

   ```bash
   VITE_ENKA_PROXY_URL=https://uru-enka-proxy.<your-account>.workers.dev npm run build
   ```

   In PowerShell:

   ```powershell
   $env:VITE_ENKA_PROXY_URL = 'https://uru-enka-proxy.<your-account>.workers.dev'; npm run build
   ```

   Or put `VITE_ENKA_PROXY_URL=...` in a `.env.production.local` file in the repo root (git ignores it).

## Test locally

```bash
npx wrangler dev --port 8787
```

Then, from a page on an allowed origin (`http://localhost:3002` is listed), `fetch('http://127.0.0.1:8787/api/uid/<uid>/')`
returns the profile. Unit tests (no Cloudflare needed), from the repo root:

```bash
npx vitest --run workers/enka-proxy
```
