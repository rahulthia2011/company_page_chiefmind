import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Mail, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'

type FieldKey =
  | 'title'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'industry'
  | 'dataDescription'
  | 'businessOutcome'

const titleOptions = [
  'Mr',
  'Mrs',
  'Ms',
  'Miss',
  'Mx',
  'Dr',
  'Prof',
  'Rev',
  'Sir',
  'Dame',
  'Lord',
  'Lady',
  'Capt',
  'Hon',
  'Prefer not to say',
]

const emptyValues: Record<FieldKey, string> = {
  title: '',
  firstName: '',
  lastName: '',
  email: '',
  industry: '',
  dataDescription: '',
  businessOutcome: '',
}

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const INTAKE_ENDPOINT = import.meta.env.VITE_INTAKE_ENDPOINT ?? '/intake'
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''
const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

type TurnstileWidget = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      theme?: 'light' | 'dark' | 'auto'
      callback: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
      'timeout-callback'?: () => void
    },
  ) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileWidget
  }
}

let turnstileScriptPromise: Promise<void> | null = null
const loadTurnstileScript = () => {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (turnstileScriptPromise) return turnstileScriptPromise
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onload = () => resolve()
    script.onerror = () => {
      turnstileScriptPromise = null
      reject(new Error('Failed to load Turnstile script'))
    }
    document.head.appendChild(script)
  })
  return turnstileScriptPromise
}

const isSecureEndpoint = (endpoint: string) => {
  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'https://localhost/'
    const url = new URL(endpoint, base)
    if (url.protocol === 'https:') return true
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export default function ContactPage() {
  const [values, setValues] = useState<Record<FieldKey, string>>(emptyValues)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  useEffect(() => {
    if (submitted || !TURNSTILE_SITE_KEY) return
    let cancelled = false
    loadTurnstileScript()
      .then(() => {
        if (cancelled) return
        const container = turnstileContainerRef.current
        if (!container || !window.turnstile) return
        if (turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current)
          return
        }
        turnstileWidgetId.current = window.turnstile.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          callback: (token) => setTurnstileToken(token),
          'error-callback': () => setTurnstileToken(null),
          'expired-callback': () => setTurnstileToken(null),
          'timeout-callback': () => setTurnstileToken(null),
        })
      })
      .catch(() => {
        if (!cancelled) setError('Could not load bot check. Refresh and try again.')
      })
    return () => {
      cancelled = true
    }
  }, [submitted])

  useEffect(() => {
    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current)
        turnstileWidgetId.current = null
      }
    }
  }, [])

  const setValue = (key: FieldKey, next: string) => {
    setValues((prev) => ({ ...prev, [key]: next }))
    if (error) setError(null)
  }

  const validateForm = (): string | null => {
    if (!values.firstName.trim()) return 'First name is required.'
    if (!values.lastName.trim()) return 'Last name is required.'
    if (!values.email.trim()) return 'Email is required.'
    if (!isValidEmail(values.email)) return 'That does not look like a valid email.'
    if (!values.industry.trim()) return 'Industry is required.'
    if (!values.dataDescription.trim()) return 'Please describe the data you want to process.'
    if (!values.businessOutcome.trim()) return 'Please share your intended business outcome.'
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    if (!INTAKE_ENDPOINT) {
      setError('Intake endpoint is not configured. Set VITE_INTAKE_ENDPOINT.')
      return
    }

    if (!isSecureEndpoint(INTAKE_ENDPOINT)) {
      setError('Refusing to send over an insecure connection.')
      return
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Please complete the bot-check to continue.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(INTAKE_ENDPOINT, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, turnstileToken }),
      })

      if (!response.ok) {
        let detail = `Submission failed (${response.status}).`
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload?.error) detail = payload.error
        } catch {
          // ignore JSON parse errors
        }
        if (window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current)
          setTurnstileToken(null)
        }
        setError(detail)
        return
      }

      setSubmitted(true)
    } catch {
      setError('Network error — please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page-panel contact-page" aria-labelledby="contact-title">
      <div className="contact-hero">
        <h1 className="hero-title" id="contact-title">
          Let's design the system your business actually needs.
        </h1>
        <p className="lead page-lead">
          Tell us where the friction is, what needs to feel clearer, and what should happen
          automatically. We'll help turn that into a sharper operating layer.
        </p>
      </div>

      <div className="intake-shell intake-shell-simple">
        <form className="intake-panel" onSubmit={handleSubmit} noValidate>
          {!submitted && (
            <div className="intake-turn">
              <p className="intake-eyebrow">
                <Sparkles size={12} /> Contact form
              </p>
              <p className="intake-prompt">Share a few details and we'll get back to you.</p>
              <p className="intake-hint">
                No workflow steps. Just fill this form and send.
              </p>

              <div className="intake-form-grid">
                <label className="intake-field">
                  <span className="intake-field-label">Title</span>
                  <select
                    className="intake-input"
                    value={values.title}
                    onChange={(event) => setValue('title', event.target.value)}
                    aria-label="Title"
                  >
                    <option value="">Select a title</option>
                    {titleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="intake-field">
                  <span className="intake-field-label">First name</span>
                  <input
                    className="intake-input"
                    type="text"
                    value={values.firstName}
                    onChange={(event) => setValue('firstName', event.target.value)}
                    placeholder="e.g. Alex"
                    autoComplete="given-name"
                    aria-label="First name"
                  />
                </label>

                <label className="intake-field">
                  <span className="intake-field-label">Last name</span>
                  <input
                    className="intake-input"
                    type="text"
                    value={values.lastName}
                    onChange={(event) => setValue('lastName', event.target.value)}
                    placeholder="e.g. Rivera"
                    autoComplete="family-name"
                    aria-label="Last name"
                  />
                </label>

                <label className="intake-field intake-field-full">
                  <span className="intake-field-label">Email</span>
                  <input
                    className="intake-input"
                    type="email"
                    value={values.email}
                    onChange={(event) => setValue('email', event.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    aria-label="Email"
                  />
                </label>

                <label className="intake-field intake-field-full">
                  <span className="intake-field-label">Industry</span>
                  <input
                    className="intake-input"
                    type="text"
                    value={values.industry}
                    onChange={(event) => setValue('industry', event.target.value)}
                    placeholder="e.g. Fintech, Healthcare, Logistics"
                    aria-label="Industry"
                  />
                </label>

                <label className="intake-field intake-field-full">
                  <span className="intake-field-label">Data to process</span>
                  <textarea
                    className="intake-textarea"
                    value={values.dataDescription}
                    onChange={(event) => setValue('dataDescription', event.target.value)}
                    placeholder="Describe the data sources, formats, and volume you deal with"
                    rows={5}
                    aria-label="Data to process"
                  />
                </label>

                <label className="intake-field intake-field-full">
                  <span className="intake-field-label">Business outcome</span>
                  <textarea
                    className="intake-textarea"
                    value={values.businessOutcome}
                    onChange={(event) => setValue('businessOutcome', event.target.value)}
                    placeholder="e.g. Faster pricing decisions, cleaner pipeline signal, reduced risk"
                    rows={5}
                    aria-label="Business outcome"
                  />
                </label>
              </div>

              {error && (
                <p className="intake-error" role="alert">
                  {error}
                </p>
              )}

              {TURNSTILE_SITE_KEY && (
                <div className="intake-turnstile">
                  <div ref={turnstileContainerRef} />
                  <p className="intake-hint intake-hint-sm">
                    Protected by Cloudflare Turnstile. No tracking cookies are set.
                  </p>
                </div>
              )}

              <div className="intake-controls">
                <span className="intake-hotkey">We'll reply by email.</span>
                <Button
                  type="submit"
                  disabled={isSubmitting || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
                >
                  {isSubmitting ? 'Sending…' : 'Send'} <Send size={14} />
                </Button>
              </div>
            </div>
          )}

          {submitted && (
            <div className="intake-turn intake-turn-success" role="status">
              <p className="intake-eyebrow">
                <Sparkles size={12} /> Signal received
              </p>
              <p className="intake-prompt">Thank you, {values.firstName}.</p>
              <p className="intake-hint">
                Your intake has been securely transmitted. A human will reach out to{' '}
                <strong>{values.email}</strong>. Prefer email? Reach us at{' '}
                <a className="contact-link" href="mailto:hello@chiefmind.io">
                  hello@chiefmind.io
                </a>
                .
              </p>
              <div className="intake-controls">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setValues(emptyValues)
                    setSubmitted(false)
                    setError(null)
                    setTurnstileToken(null)
                    if (window.turnstile && turnstileWidgetId.current) {
                      window.turnstile.reset(turnstileWidgetId.current)
                    }
                  }}
                >
                  Start over
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>

      <div className="contact-showcase">
        <article className="feature-card contact-card contact-card-primary">
          <div className="contact-card-icon" aria-hidden="true">
            <Mail size={18} />
          </div>
          <div>
            <p className="contact-label">Email</p>
            <a className="contact-link" href="mailto:hello@chiefmind.io">
              hello@chiefmind.io
            </a>
          </div>
        </article>

        <article className="feature-card contact-card">
          <div className="contact-card-icon" aria-hidden="true">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="contact-label">Next step</p>
            <p>Share your workflow, bottleneck, or product idea and we'll shape the right system with you.</p>
          </div>
        </article>
      </div>

      <div className="cta-row contact-actions">
        <a className={buttonVariants({ variant: 'outline', size: 'lg' })} href="#about">
          Learn About Us <ArrowRight size={16} />
        </a>
      </div>
    </section>
  )
}

