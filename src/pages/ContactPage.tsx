import { ArrowRight, Mail, Sparkles } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'

export default function ContactPage() {
  return (
    <section className="page-panel contact-page" aria-labelledby="contact-title">
      <div className="contact-hero">
        <h1 className="hero-title" id="contact-title">
          Let’s design the system your business actually needs.
        </h1>
        <p className="lead page-lead">
          Tell us where the friction is, what needs to feel clearer, and what should happen automatically.
          We’ll help turn that into a sharper operating layer.
        </p>
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
            <p>Share your workflow, bottleneck, or product idea and we’ll shape the right system with you.</p>
          </div>
        </article>
      </div>

      <div className="cta-row contact-actions">
        <a className={buttonVariants({ variant: 'default', size: 'lg' })} href="mailto:hello@chiefmind.io">
          Email Chiefmind <ArrowRight size={16} />
        </a>
        <a className={buttonVariants({ variant: 'outline', size: 'lg' })} href="#about">
          Learn About Us
        </a>
      </div>
    </section>
  )
}
