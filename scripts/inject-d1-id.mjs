import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const filePath = resolve(process.cwd(), 'wrangler.jsonc')
const databaseId = process.env.CF_D1_DATABASE_ID?.trim()
const isCi = Boolean(process.env.CI || process.env.CF_PAGES || process.env.CF_PAGES_BRANCH)
const PLACEHOLDER = 'REPLACE_WITH_D1_DATABASE_ID'
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/
const source = readFileSync(filePath, 'utf8')
const DATABASE_ID_RE = /(?:"database_id"|database_id)\s*:\s*"([^"]+)"/
const DATABASE_ID_REPLACE_RE = /((?:"database_id"|database_id)\s*:\s*")[^"]+(")/
const match = source.match(DATABASE_ID_RE)
const currentDatabaseId = match?.[1]

if (!databaseId) {
  if (!currentDatabaseId) {
    console.error('[cf:inject-d1-id] Could not find database_id in wrangler.jsonc.')
    process.exit(1)
  }

  if (currentDatabaseId === PLACEHOLDER) {
    if (isCi) {
      console.error(
        '[cf:inject-d1-id] CF_D1_DATABASE_ID is required in CI because wrangler.jsonc still has placeholder database_id.',
      )
      process.exit(1)
    }
    console.log(
      '[cf:inject-d1-id] CF_D1_DATABASE_ID is not set and placeholder remains; skipping locally. Set the env var before deploy.',
    )
    process.exit(0)
  }

  if (!UUID_RE.test(currentDatabaseId)) {
    console.error('[cf:inject-d1-id] Existing database_id in wrangler.jsonc is not a valid UUID.')
    process.exit(1)
  }

  console.log('[cf:inject-d1-id] CF_D1_DATABASE_ID is not set; using existing database_id in wrangler.jsonc.')
  process.exit(0)
}

if (!UUID_RE.test(databaseId)) {
  console.error('[cf:inject-d1-id] CF_D1_DATABASE_ID is not a valid UUID.')
  process.exit(1)
}

const next = source.replace(
  DATABASE_ID_REPLACE_RE,
  `$1${databaseId}$2`,
)

if (next === source) {
  console.error(
    `[cf:inject-d1-id] Could not find database_id in wrangler.jsonc at ${filePath}. Ensure d1_databases has a database_id field.`,
  )
  process.exit(1)
}

writeFileSync(filePath, next, 'utf8')
console.log('[cf:inject-d1-id] Injected database_id into wrangler.jsonc.')
