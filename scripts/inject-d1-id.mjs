import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const filePath = resolve(process.cwd(), 'wrangler.jsonc')
const databaseId = process.env.CF_D1_DATABASE_ID?.trim()

if (!databaseId) {
  console.log('[cf:inject-d1-id] CF_D1_DATABASE_ID is not set; keeping wrangler.jsonc as-is.')
  process.exit(0)
}

if (!/^[0-9a-fA-F-]{36}$/.test(databaseId)) {
  console.error('[cf:inject-d1-id] CF_D1_DATABASE_ID is not a valid UUID.')
  process.exit(1)
}

const source = readFileSync(filePath, 'utf8')
const next = source.replace(
  /("database_id"\s*:\s*")[^"]+(")/,
  `$1${databaseId}$2`,
)

if (next === source) {
  console.error('[cf:inject-d1-id] Could not find database_id in wrangler.jsonc.')
  process.exit(1)
}

writeFileSync(filePath, next, 'utf8')
console.log('[cf:inject-d1-id] Injected database_id into wrangler.jsonc.')
