/**
 * Chiefmind intake Worker.
 *
 * Accepts JSON POST /intake from the marketing site over HTTPS,
 * validates it, and stores it in Cloudflare D1.
 *
 * TLS is terminated by Cloudflare (workers.dev + custom domains are HTTPS-only).
 */

export interface Env {
  DB: D1Database
  RATE_LIMITER: RateLimit
  ALLOWED_ORIGINS: string
  MAX_BODY_BYTES: string
  ENFORCE_HTTPS?: string
  IP_HASH_SALT?: string
  TURNSTILE_SECRET?: string
}

interface RateLimitOutcome {
  success: boolean
}

interface RateLimit {
  limit(input: { key: string }): Promise<RateLimitOutcome>
}

type IntakePayload = {
  title: string
  firstName: string
  lastName: string
  email: string
  industry: string
  dataDescription: string
  businessOutcome: string
}

const FIELD_LIMITS: Record<keyof IntakePayload, number> = {
  title: 16,
  firstName: 80,
  lastName: 80,
  email: 254,
  industry: 120,
  dataDescription: 4000,
  businessOutcome: 4000,
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors = buildCorsHeaders(origin, env)

    // Refuse plaintext HTTP at the edge. Cloudflare terminates TLS, but if a
    // request somehow arrives on http://, redirect to https:// instead of serving.
    const enforceHttps = (env.ENFORCE_HTTPS ?? 'true').toLowerCase() !== 'false'
    if (enforceHttps && url.protocol === 'http:' && url.hostname !== 'localhost') {
      url.protocol = 'https:'
      return Response.redirect(url.toString(), 308)
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: true }, 200, cors)
    }

    if (url.pathname !== '/intake') {
      return json({ error: 'Not found' }, 404, cors)
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, {
        ...cors,
        Allow: 'POST, OPTIONS',
      })
    }

    if (origin && !isAllowedOrigin(origin, env)) {
      return json({ error: 'Origin not allowed' }, 403, cors)
    }

    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown'

    // Per-IP rate limit before we touch the body / verifier / D1.
    if (env.RATE_LIMITER) {
      try {
        const outcome = await env.RATE_LIMITER.limit({ key: `intake:${clientIp}` })
        if (!outcome.success) {
          return json({ error: 'Too many requests' }, 429, {
            ...cors,
            'Retry-After': '60',
          })
        }
      } catch (error) {
        console.warn('Rate limiter unavailable, allowing request', error)
      }
    }

    const maxBytes = Number.parseInt(env.MAX_BODY_BYTES ?? '16384', 10) || 16384
    const contentLength = Number.parseInt(request.headers.get('Content-Length') ?? '0', 10)
    if (contentLength > maxBytes) {
      return json({ error: 'Payload too large' }, 413, cors)
    }

    const contentType = request.headers.get('Content-Type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return json({ error: 'Expected application/json' }, 415, cors)
    }

    let raw: unknown
    try {
      const text = await request.text()
      if (text.length > maxBytes) {
        return json({ error: 'Payload too large' }, 413, cors)
      }
      raw = JSON.parse(text)
    } catch {
      return json({ error: 'Invalid JSON' }, 400, cors)
    }

    const parsed = validate(raw)
    if (!parsed.ok) {
      return json({ error: 'Validation failed', details: parsed.errors }, 400, cors)
    }

    if (env.TURNSTILE_SECRET) {
      const token = extractTurnstileToken(raw)
      if (!token) {
        return json({ error: 'Bot-check token missing' }, 400, cors)
      }
      const verified = await verifyTurnstile(token, clientIp, env.TURNSTILE_SECRET)
      if (!verified) {
        return json({ error: 'Bot-check failed' }, 403, cors)
      }
    }

    const id = crypto.randomUUID()
    const userAgent = request.headers.get('User-Agent')?.slice(0, 512) ?? null
    const country = (request.cf as { country?: string } | undefined)?.country ?? null
    const ipHash = await hashIp(clientIp === 'unknown' ? null : clientIp, env.IP_HASH_SALT)

    try {
      await env.DB.prepare(
        `INSERT INTO intake_submissions
           (id, title, first_name, last_name, email, industry,
            data_description, business_outcome, user_agent, country, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          parsed.value.title,
          parsed.value.firstName,
          parsed.value.lastName,
          parsed.value.email,
          parsed.value.industry,
          parsed.value.dataDescription,
          parsed.value.businessOutcome,
          userAgent,
          country,
          ipHash,
        )
        .run()
    } catch (error) {
      console.error('D1 insert failed', error)
      return json({ error: 'Storage error' }, 500, cors)
    }

    ctx.waitUntil(Promise.resolve())

    return json({ ok: true, id }, 201, cors)
  },
} satisfies ExportedHandler<Env>

function validate(
  input: unknown,
): { ok: true; value: IntakePayload } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}

  if (typeof input !== 'object' || input === null) {
    return { ok: false, errors: { _: 'Body must be a JSON object' } }
  }

  const record = input as Record<string, unknown>
  const value = {} as IntakePayload

  for (const key of Object.keys(FIELD_LIMITS) as (keyof IntakePayload)[]) {
    const rawValue = record[key]
    if (typeof rawValue !== 'string') {
      errors[key] = 'Must be a string'
      continue
    }
    const trimmed = rawValue.trim()
    if (!trimmed) {
      errors[key] = 'Required'
      continue
    }
    if (trimmed.length > FIELD_LIMITS[key]) {
      errors[key] = `Must be ${FIELD_LIMITS[key]} characters or fewer`
      continue
    }
    value[key] = trimmed
  }

  if (!errors.email && !EMAIL_RE.test(value.email)) {
    errors.email = 'Invalid email'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, value }
}

function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function isAllowedOrigin(origin: string, env: Env): boolean {
  return parseAllowedOrigins(env).includes(origin)
}

function buildCorsHeaders(origin: string | null, env: Env): Record<string, string> {
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
  if (origin && isAllowedOrigin(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function json(body: unknown, status: number, extraHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...extraHeaders,
    },
  })
}

async function hashIp(ip: string | null, salt: string | undefined): Promise<string | null> {
  if (!ip) return null
  const data = new TextEncoder().encode(`${salt ?? ''}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function extractTurnstileToken(input: unknown): string | null {
  if (typeof input !== 'object' || input === null) return null
  const value = (input as Record<string, unknown>).turnstileToken
  return typeof value === 'string' && value.length > 0 && value.length <= 2048 ? value : null
}

async function verifyTurnstile(token: string, remoteIp: string, secret: string): Promise<boolean> {
  const body = new URLSearchParams()
  body.set('secret', secret)
  body.set('response', token)
  if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })
    if (!response.ok) return false
    const data = (await response.json()) as { success?: boolean }
    return data.success === true
  } catch (error) {
    console.error('Turnstile verify failed', error)
    return false
  }
}
