import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { ArrowRight, Check, ChevronDown, ChevronLeft, Mail, Send, Sparkles } from 'lucide-react'
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

type Step = {
  key: FieldKey
  label: string
  prompt: string
  hint: string
  placeholder: string
  kind: 'text' | 'email' | 'select' | 'textarea'
  options?: string[]
  required?: boolean
}

const steps: Step[] = [
  {
    key: 'title',
    label: 'Title',
    prompt: 'How should I address you?',
    hint: 'Pick the title you prefer.',
    placeholder: 'Select a title',
    kind: 'select',
    options: [
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
    ],
    required: true,
  },
  {
    key: 'firstName',
    label: 'First name',
    prompt: 'What is your first name?',
    hint: 'Just the name you go by day-to-day.',
    placeholder: 'e.g. Alex',
    kind: 'text',
    required: true,
  },
  {
    key: 'lastName',
    label: 'Last name',
    prompt: 'And your last name?',
    hint: 'So we can address you formally in the summary.',
    placeholder: 'e.g. Rivera',
    kind: 'text',
    required: true,
  },
  {
    key: 'email',
    label: 'Email',
    prompt: 'Where should we send our reply?',
    hint: 'A work email works best — we never share it.',
    placeholder: 'you@company.com',
    kind: 'email',
    required: true,
  },
  {
    key: 'industry',
    label: 'Industry',
    prompt: 'Which industry are you operating in?',
    hint: 'This helps me shape the right context for your system.',
    placeholder: 'e.g. Fintech, Healthcare, Logistics…',
    kind: 'text',
    required: true,
  },
  {
    key: 'dataDescription',
    label: 'Data to process',
    prompt: 'What kind of data would you like to process?',
    hint: 'Signals, transactions, documents, telemetry — describe the raw material.',
    placeholder: 'Describe the data sources, formats, and volume you deal with…',
    kind: 'textarea',
    required: true,
  },
  {
    key: 'businessOutcome',
    label: 'Business outcome',
    prompt: 'What business outcome do you want to see?',
    hint: 'The decision, revenue lift, or clarity you want the system to produce.',
    placeholder: 'e.g. Faster pricing decisions, cleaner pipeline signal, reduced risk…',
    kind: 'textarea',
    required: true,
  },
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
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  const totalSteps = steps.length
  const isReviewing = stepIndex >= totalSteps
  const currentStep = !isReviewing ? steps[stepIndex] : null
  const progress = Math.min(100, Math.round((stepIndex / totalSteps) * 100))

  const completeName = useMemo(
    () => [values.title, values.firstName, values.lastName].filter(Boolean).join(' ').trim(),
    [values.title, values.firstName, values.lastName],
  )

  useEffect(() => {
    if (currentStep && currentStep.kind !== 'select' && inputRef.current) {
      inputRef.current.focus()
    }
  }, [stepIndex, currentStep])

  useEffect(() => {
    if (!isReviewing || submitted || !TURNSTILE_SITE_KEY) return
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
  }, [isReviewing, submitted])

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

  const validateCurrent = (step: Step, value: string): string | null => {
    if (step.required && !value.trim()) {
      return 'A response is required to continue.'
    }
    if (step.kind === 'email' && !isValidEmail(value)) {
      return 'That does not look like a valid email.'
    }
    return null
  }

  const goNext = () => {
    if (!currentStep) return
    const raw = values[currentStep.key]
    const message = validateCurrent(currentStep, raw)
    if (message) {
      setError(message)
      return
    }
    setValues((prev) => ({ ...prev, [currentStep.key]: raw.trim() }))
    setStepIndex((idx) => idx + 1)
  }

  const goBack = () => {
    if (stepIndex === 0) return
    setError(null)
    setStepIndex((idx) => idx - 1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!currentStep) return
    if (event.key === 'Enter' && !event.shiftKey && currentStep.kind !== 'textarea') {
      event.preventDefault()
      goNext()
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && currentStep.kind === 'textarea') {
      event.preventDefault()
      goNext()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i]
      const message = validateCurrent(step, values[step.key])
      if (message) {
        setStepIndex(i)
        setError(message)
        return
      }
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

  const renderInput = () => {
    if (!currentStep) return null
    const value = values[currentStep.key]

    if (currentStep.kind === 'select') {
      return (
        <IntakeDropdown
          value={value}
          options={currentStep.options ?? []}
          placeholder={currentStep.placeholder}
          ariaLabel={currentStep.prompt}
          onChange={(next) => setValue(currentStep.key, next)}
          onCommit={goNext}
        />
      )
    }

    if (currentStep.kind === 'textarea') {
      return (
        <textarea
          ref={(node) => {
            inputRef.current = node
          }}
          className="intake-textarea"
          value={value}
          onChange={(event) => setValue(currentStep.key, event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={currentStep.placeholder}
          rows={5}
          aria-label={currentStep.prompt}
        />
      )
    }

    return (
      <input
        ref={(node) => {
          inputRef.current = node
        }}
        className="intake-input"
        type={currentStep.kind === 'email' ? 'email' : 'text'}
        value={value}
        onChange={(event) => setValue(currentStep.key, event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={currentStep.placeholder}
        aria-label={currentStep.prompt}
        autoComplete={
          currentStep.key === 'firstName'
            ? 'given-name'
            : currentStep.key === 'lastName'
              ? 'family-name'
              : currentStep.key === 'email'
                ? 'email'
                : 'off'
        }
      />
    )
  }

  return (
    <section className="page-panel contact-page" aria-labelledby="contact-title">
      <div className="contact-hero">
        <h1 className="hero-title" id="contact-title">
          Tell us about your data — we’ll be in touch.
        </h1>
        <p className="lead page-lead">
          Share a few details about you and what you’re trying to solve. We’ll review your intake and
          reply with a clear next step.
        </p>
      </div>

      <div className="intake-shell">
        <aside className="intake-sidebar" aria-hidden="true">
          <div className="intake-orb">
            <span className="intake-orb-core" />
            <span className="intake-orb-ring" />
            <span className="intake-orb-ring intake-orb-ring-delay" />
          </div>
          <p className="intake-sidebar-label">Chiefmind Intake</p>
          <p className="intake-sidebar-status">
            {submitted ? 'Transmission ready' : isReviewing ? 'Reviewing signal' : 'Listening…'}
          </p>
          <ol className="intake-steplist">
            {steps.map((step, idx) => {
              const done = idx < stepIndex || isReviewing
              const active = idx === stepIndex && !isReviewing
              return (
                <li
                  key={step.key}
                  className={`intake-step${done ? ' intake-step-done' : ''}${
                    active ? ' intake-step-active' : ''
                  }`}
                >
                  <span className="intake-step-dot">{done ? <Check size={11} /> : idx + 1}</span>
                  <span className="intake-step-label">{step.label}</span>
                </li>
              )
            })}
          </ol>
        </aside>

        <form className="intake-panel" onSubmit={handleSubmit} noValidate>
          <div className="intake-progress" aria-hidden="true">
            <span
              className="intake-progress-fill"
              style={{ width: `${isReviewing ? 100 : progress}%` }}
            />
          </div>

          {!submitted && currentStep && (
            <div className="intake-turn" key={currentStep.key}>
              <p className="intake-eyebrow">
                <Sparkles size={12} /> Step {stepIndex + 1} of {totalSteps}
              </p>
              <p className="intake-prompt">{currentStep.prompt}</p>
              <p className="intake-hint">{currentStep.hint}</p>
              <div className="intake-field">{renderInput()}</div>
              {error && (
                <p className="intake-error" role="alert">
                  {error}
                </p>
              )}
              <div className="intake-controls">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={goBack}
                  disabled={stepIndex === 0}
                >
                  <ChevronLeft size={14} /> Back
                </Button>
                <span className="intake-hotkey">
                  {currentStep.kind === 'textarea' ? '⌘ + Enter to continue' : 'Enter to continue'}
                </span>
                <Button type="button" onClick={goNext}>
                  Continue <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {!submitted && isReviewing && (
            <div className="intake-turn">
              <p className="intake-eyebrow">
                <Sparkles size={12} /> Signal summary
              </p>
              <p className="intake-prompt">Here’s what I heard. Send it when it feels right.</p>
              <p className="intake-hint">
                We’ll draft an email to hello@chiefmind.io with your responses attached.
              </p>

              <dl className="intake-summary">
                <div>
                  <dt>Name</dt>
                  <dd>{completeName}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{values.email}</dd>
                </div>
                <div>
                  <dt>Industry</dt>
                  <dd>{values.industry}</dd>
                </div>
                <div>
                  <dt>Data to process</dt>
                  <dd>{values.dataDescription}</dd>
                </div>
                <div>
                  <dt>Business outcome</dt>
                  <dd>{values.businessOutcome}</dd>
                </div>
              </dl>

              {TURNSTILE_SITE_KEY && (
                <div className="intake-turnstile">
                  <div ref={turnstileContainerRef} />
                  <p className="intake-hint intake-hint-sm">
                    Protected by Cloudflare Turnstile. No tracking cookies are set.
                  </p>
                </div>
              )}

              <div className="intake-controls">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={goBack}
                  disabled={isSubmitting}
                >
                  <ChevronLeft size={14} /> Edit last
                </Button>
                <span className="intake-hotkey">
                  {isSubmitting ? 'Transmitting…' : 'Review complete'}
                </span>
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
                    setStepIndex(0)
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
            <p className="contact-label">What happens next</p>
            <p>A human reads every intake and replies with a shaped next step.</p>
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

type IntakeDropdownProps = {
  value: string
  options: string[]
  placeholder: string
  ariaLabel: string
  onChange: (next: string) => void
  onCommit?: () => void
}

function IntakeDropdown({
  value,
  options,
  placeholder,
  ariaLabel,
  onChange,
  onCommit,
}: IntakeDropdownProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(() => Math.max(0, options.indexOf(value)))
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const active = listRef.current?.querySelector<HTMLLIElement>('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [open, highlight])

  const commitSelection = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
      setHighlight(Math.max(0, options.indexOf(value)))
    }
  }

  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((idx) => (idx + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((idx) => (idx - 1 + options.length) % options.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setHighlight(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setHighlight(options.length - 1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const picked = options[highlight]
      if (picked) {
        commitSelection(picked)
        onCommit?.()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="intake-dropdown" ref={rootRef}>
      <button
        type="button"
        className={`intake-dropdown-trigger${open ? ' intake-dropdown-trigger-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => {
          setOpen((prev) => !prev)
          setHighlight(Math.max(0, options.indexOf(value)))
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={value ? '' : 'intake-dropdown-placeholder'}>{value || placeholder}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="intake-dropdown-list"
          tabIndex={-1}
          ref={(node) => {
            listRef.current = node
            node?.focus()
          }}
          onKeyDown={handleListKeyDown}
        >
          {options.map((option, idx) => {
            const active = idx === highlight
            const selected = option === value
            return (
              <li
                key={option}
                role="option"
                aria-selected={selected}
                data-active={active}
                className={`intake-dropdown-option${selected ? ' intake-dropdown-option-selected' : ''}${
                  active ? ' intake-dropdown-option-active' : ''
                }`}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => commitSelection(option)}
              >
                <span>{option}</span>
                {selected && <Check size={12} aria-hidden="true" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

