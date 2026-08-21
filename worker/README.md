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

> **Deployment note.** For production the repo also ships a root
> [`wrangler.jsonc`](../wrangler.jsonc) that Cloudflare Workers Builds uses to deploy the
> site (from `./dist`) and this Worker together as a single project. See
> [Deployment](#deployment) below. The `worker/wrangler.toml` here is kept for local dev
> (`wrangler dev` from inside `worker/`) and stand-alone deploys.

## Deployment

The recommended deployment is Cloudflare's git-connected **Workers Builds**, driven by the
root [`wrangler.jsonc`](../wrangler.jsonc). One Worker serves both the built site
(as static assets from `./dist`) and the intake API (`/intake`, `/health`).

### 1. Prerequisites

- A Cloudflare account with the target zone (`chiefmind.io`) added.
- `wrangler` authenticated: `npx wrangler login`.

### 2. Create the D1 database

```sh
npx wrangler d1 create chiefmind_intake
```

Paste the printed `database_id` into **both**:

- root [`wrangler.jsonc`](../wrangler.jsonc) — used by Cloudflare Workers Builds.
- [`worker/wrangler.toml`](wrangler.toml) — used for local `wrangler dev`.

### 3. Apply migrations to remote D1

```sh
# from repo root — uses wrangler.jsonc
npx wrangler d1 migrations apply chiefmind_intake --remote
```

### 4. Set secrets on the unified Worker

```sh
# from repo root — targets the "chiefmind" Worker defined in wrangler.jsonc
npx wrangler secret put IP_HASH_SALT
npx wrangler secret put TURNSTILE_SECRET
```

Grab the Turnstile secret + site key from the Cloudflare dashboard →
**Turnstile → Add site**. The site key is public and belongs in
`VITE_TURNSTILE_SITE_KEY` on the frontend; the secret must only ever live in
`wrangler secret`.

### 5. Connect the repo to Cloudflare Workers Builds

Dashboard → **Workers & Pages → Create → Connect to Git** → pick the repo.

| Setting                | Value              |
| ---------------------- | ------------------ |
| Build command          | `npm run build`    |
| Deploy command         | `npx wrangler deploy` (default; leave unset) |
| Root directory         | `/`                |
| Node version           | `20` (set `NODE_VERSION=20` under Variables) |

Add these variables on the project:

| Name                     | Kind      | Notes                                    |
| ------------------------ | --------- | ---------------------------------------- |
| `VITE_INTAKE_ENDPOINT`   | Variable  | `/intake` (same-origin, default in code) |
| `VITE_TURNSTILE_SITE_KEY`| Variable  | Public Turnstile site key                |
| `NODE_VERSION`           | Variable  | `20`                                     |

Push to the connected branch. Cloudflare will:

1. Run `npm run build` → static site in `./dist`.
2. Detect `wrangler.jsonc` at the root.
3. Run `npx wrangler deploy` → uploads the Worker + assets binding to the same project.

Every subsequent push updates the same Worker (the deploy is idempotent).

### 6. Frontend endpoint

Because the site and the Worker share an origin, the frontend defaults to a same-origin
`/intake`. You only need to set `VITE_INTAKE_ENDPOINT` explicitly if you split them onto
separate origins (e.g. keeping Pages for the site and a Worker at `api.chiefmind.io`).

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

Deployment is fully driven by Cloudflare Workers Builds using the root
[`wrangler.jsonc`](../wrangler.jsonc). Every push to the connected branch runs:

```
npm run build          # site → ./dist
npx wrangler deploy    # uploads Worker + assets binding
```

First push creates the Worker, subsequent pushes update it — no separate CI to maintain.

### Local one-shot equivalent

```sh
npm run worker:sync
```

Runs `npm run build && wrangler d1 migrations apply --remote && wrangler deploy` from the
repo root using [`wrangler.jsonc`](../wrangler.jsonc).
