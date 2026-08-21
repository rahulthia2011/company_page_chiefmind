# Chiefmind Intake Worker

A Cloudflare Worker that receives contact-form submissions from the marketing site over HTTPS
and persists them in a Cloudflare D1 database.

## Architecture

```
Browser (chiefmind.io)  --HTTPS/TLS-->  Cloudflare edge  -->  Worker  -->  D1 (chiefmind_intake)
```

TLS is terminated by Cloudflare. Requests to `*.workers.dev` or a Cloudflare-managed custom
domain (e.g. `api.chiefmind.io`) are HTTPS-only; certificates are auto-provisioned and
renewed by Cloudflare (Universal SSL / Advanced Certificate Manager).

## Endpoints

| Method | Path      | Description                                          |
| ------ | --------- | ---------------------------------------------------- |
| POST   | `/intake` | Store an intake submission. JSON body, see below.    |
| GET    | `/health` | Liveness probe. Returns `{ "ok": true }`.            |
| OPTIONS| `/intake` | CORS preflight.                                      |

### Request body

```json
{
  "title": "Mx",
  "firstName": "Alex",
  "lastName": "Rivera",
  "email": "alex@example.com",
  "industry": "Fintech",
  "dataDescription": "Transactional signals ...",
  "businessOutcome": "Faster pricing decisions ..."
}
```

Responses: `201` on success (`{ "ok": true, "id": "<uuid>" }`), `400` validation error,
`403` origin not allowed, `413` payload too large, `415` wrong content-type, `500` storage error.

## Local development

```sh
cd worker
npm install
# One-time: create the D1 database, then paste the printed database_id into wrangler.toml
npm run d1:create
# Apply migrations to the local (miniflare) D1 shim
npm run d1:migrate:local
npm run dev
```

The dev server prints an `http://127.0.0.1:8787` URL. From the site, set
`VITE_INTAKE_ENDPOINT=http://127.0.0.1:8787/intake` in `.env.local`.

## Configuration

All configuration lives in [wrangler.toml](wrangler.toml).

- `ALLOWED_ORIGINS` — comma-separated allow-list for CORS + origin check.
- `MAX_BODY_BYTES` — hard cap on the request body (default 16 KiB).
- `ENFORCE_HTTPS` — set to `false` to disable the HTTP→HTTPS redirect (default `true`).
- `IP_HASH_SALT` — secret salt for hashing `CF-Connecting-IP`. Set via
  `wrangler secret put IP_HASH_SALT --env production`.
- `TURNSTILE_SECRET` — Cloudflare Turnstile secret key. When set, the Worker requires and
  verifies a Turnstile token on every submission. Set via
  `wrangler secret put TURNSTILE_SECRET --env production`.

### Bindings

- `DB` — Cloudflare D1 database (`chiefmind_intake`).
- `RATE_LIMITER` — Workers Rate Limiting binding, per-IP limit (10 req / 60 s in prod,
  20 req / 60 s in staging). Adjust `simple.limit` / `simple.period` in
  [wrangler.toml](wrangler.toml).

### Encryption in transit

- TLS is terminated at the Cloudflare edge; `*.workers.dev` and Cloudflare custom domains
  serve HTTPS only, with auto-issued/renewed certificates.
- The Worker sets `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  on every response.
- When `ENFORCE_HTTPS=true` (default) any `http://` request is 308-redirected to `https://`.
- The frontend refuses to POST unless `VITE_INTAKE_ENDPOINT` is an `https://` URL
  (or `localhost` for dev).
- Turn on **SSL/TLS → Edge Certificates → Always Use HTTPS** and **Automatic HTTPS Rewrites**
  in the Cloudflare zone dashboard for defence in depth.

Environments defined:

- default (dev on `*.workers.dev`)
- `staging` → `chiefmind-intake-staging.<account>.workers.dev`
- `production` → routed at `api.chiefmind.io/intake*` (custom domain, auto TLS)

## Deployment

### 1. Prerequisites

- A Cloudflare account with the target zone (`chiefmind.io`) added.
- `wrangler` authenticated: `npx wrangler login`.

### 2. Create the D1 databases

```sh
cd worker
npx wrangler d1 create chiefmind_intake
npx wrangler d1 create chiefmind_intake_staging
```

Copy each printed `database_id` into the matching `[[d1_databases]]` block in
[wrangler.toml](wrangler.toml).

### 3. Apply migrations to remote D1

```sh
npx wrangler d1 migrations apply chiefmind_intake --remote
npx wrangler d1 migrations apply chiefmind_intake_staging --remote --env staging
```

### 4. Set secrets

```sh
npx wrangler secret put IP_HASH_SALT --env production
npx wrangler secret put IP_HASH_SALT --env staging
npx wrangler secret put TURNSTILE_SECRET --env production
npx wrangler secret put TURNSTILE_SECRET --env staging
```

Grab the Turnstile secret + site key from the Cloudflare dashboard →
**Turnstile → Add site**. The site key is public and belongs in
`VITE_TURNSTILE_SITE_KEY` on the frontend; the secret must only ever live in
`wrangler secret`.

### 5. Deploy

```sh
npx wrangler deploy --env staging
npx wrangler deploy --env production
```

The production deploy attaches the Worker to `api.chiefmind.io/intake*`. Cloudflare issues
and renews the TLS certificate automatically. Enable **SSL/TLS → Edge Certificates → Always
Use HTTPS** and **Automatic HTTPS Rewrites** in the zone dashboard to force HTTPS for any
mixed-content edge cases.

### 6. Point the frontend at the Worker

Add to `.env.production` (or the hosting platform's env vars) in the repo root:

```
VITE_INTAKE_ENDPOINT=https://api.chiefmind.io/intake
VITE_TURNSTILE_SITE_KEY=<public-site-key>
```

Rebuild the site (`npm run build`) so the values are baked into the client bundle.

## Inspecting data

```sh
npx wrangler d1 execute chiefmind_intake --remote \
  --command "SELECT id, created_at, email, industry FROM intake_submissions ORDER BY created_at DESC LIMIT 20;"
```

## Rollback

```sh
npx wrangler rollback --env production
```

## Automation — deploy on build

Deployment is fully driven by the Cloudflare Pages build. Every push that triggers a Pages
build also creates-or-updates the Worker (idempotent), so there is no separate CI to
maintain.

### Cloudflare Pages build hook

The root [`package.json`](../package.json) exposes a `build:cf` script:

```
npm run build:cf
```

It runs the normal Vite build, then invokes
[`scripts/deploy-worker-if-configured.mjs`](../scripts/deploy-worker-if-configured.mjs) which:

1. Skips silently unless `CLOUDFLARE_API_TOKEN` **and** `CLOUDFLARE_ACCOUNT_ID` are set
   (so local `npm run build:cf` still works with no credentials).
2. Runs `npm ci` inside `worker/`.
3. Applies remote D1 migrations for the target environment.
4. Runs `wrangler deploy --env <target>` — creates the Worker if missing, updates it otherwise.

Cloudflare Pages configuration:

| Setting                | Value                                                          |
| ---------------------- | -------------------------------------------------------------- |
| Build command          | `npm run build:cf`                                             |
| Build output directory | `dist`                                                         |
| Root directory         | `/`                                                            |
| Node version           | `20` (set `NODE_VERSION=20` in Pages env vars)                 |

Required Pages environment variables (Settings → Environment variables):

| Name                     | Scope             | Notes                                          |
| ------------------------ | ----------------- | ---------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`   | Prod + Preview    | Token with **Workers Scripts: Edit** + **D1: Edit** on the account. Mark as secret. |
| `CLOUDFLARE_ACCOUNT_ID`  | Prod + Preview    | Cloudflare account ID.                         |
| `CF_WORKER_ENV`          | Optional          | Force target env (`production` / `staging`). Otherwise inferred from `CF_PAGES_BRANCH`. |
| `VITE_INTAKE_ENDPOINT`   | Prod + Preview    | e.g. `https://api.chiefmind.io/intake`         |
| `VITE_TURNSTILE_SITE_KEY`| Prod + Preview    | Public Turnstile site key.                     |
| `SKIP_WORKER_DEPLOY`     | Optional          | Set to `1` on a branch to skip Worker deploy.  |

Branch → env mapping used by the script when `CF_WORKER_ENV` is unset:

- `main` / `master` / `production` → `production`
- `staging` / `develop` → `staging`
- anything else → `production` (change in the script if needed)

Trigger a deploy from the dashboard **Deployments → Retry deployment**, or by pushing to the
connected branch. First Pages build creates the Worker; every subsequent build updates it.

### Local one-shot equivalent

```sh
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… CF_WORKER_ENV=production \
  npm run worker:sync
```
