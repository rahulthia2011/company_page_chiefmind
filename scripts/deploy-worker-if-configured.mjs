#!/usr/bin/env node
// Runs after `vite build` inside Cloudflare Pages (or any CI). Deploys the Worker
// only when CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID are present; otherwise
// exits 0 so local `npm run build:cf` still succeeds without credentials.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const workerDir = resolve(repoRoot, 'worker')

const env = process.env
const hasCreds = Boolean(env.CLOUDFLARE_API_TOKEN && env.CLOUDFLARE_ACCOUNT_ID)
const skip = env.SKIP_WORKER_DEPLOY === '1' || env.SKIP_WORKER_DEPLOY === 'true'

if (skip) {
  console.log('[worker-deploy] SKIP_WORKER_DEPLOY set — skipping.')
  process.exit(0)
}

if (!hasCreds) {
  console.log(
    '[worker-deploy] CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID not set — skipping Worker deploy.',
  )
  process.exit(0)
}

if (!existsSync(resolve(workerDir, 'wrangler.toml'))) {
  console.error('[worker-deploy] worker/wrangler.toml not found — aborting.')
  process.exit(1)
}

const workerEnv = env.CF_WORKER_ENV ?? inferEnvFromBranch(env.CF_PAGES_BRANCH) ?? 'production'
console.log(`[worker-deploy] target env: ${workerEnv}`)

// Ensure Worker deps are present (Pages only installs the root package).
run('npm', ['ci', '--no-audit', '--no-fund'], workerDir) ||
  run('npm', ['install', '--no-audit', '--no-fund'], workerDir, true)

// Apply D1 migrations before deploying new code.
run(
  'npx',
  ['--yes', 'wrangler', 'd1', 'migrations', 'apply', 'chiefmind_intake', '--remote', '--env', workerEnv],
  workerDir,
  true,
)

// Deploy the Worker.
run('npx', ['--yes', 'wrangler', 'deploy', '--env', workerEnv], workerDir, true)

function run(cmd, args, cwd, required = false) {
  console.log(`[worker-deploy] $ ${cmd} ${args.join(' ')}  (cwd=${cwd})`)
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env })
  if (result.status !== 0) {
    if (required) {
      console.error(`[worker-deploy] command failed with exit ${result.status}`)
      process.exit(result.status ?? 1)
    }
    return false
  }
  return true
}

function inferEnvFromBranch(branch) {
  if (!branch) return null
  if (branch === 'main' || branch === 'master' || branch === 'production') return 'production'
  if (branch === 'staging' || branch === 'develop') return 'staging'
  return null
}
