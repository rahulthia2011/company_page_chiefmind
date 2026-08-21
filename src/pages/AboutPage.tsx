import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'

export default function AboutPage() {
  return (
    <section className="page-panel about-panel" aria-labelledby="about-title">
      <section className="about-detail-section about-flow-section" aria-labelledby="about-title">
        <div className="about-detail-heading">
          <p className="niche-label">Built for Chaos</p>
          <h1 className="hero-title about-main-title" id="about-title">
            We build the intelligence layer between signal, judgment, and action.
          </h1>
        </div>
        <div className="flow-composition" aria-label="Chiefmind company model">
          <div className="flow-stack flow-signal-grid">
            <div className="signal-tile" style={{ '--w': 11, '--h': 2 } as CSSProperties}><span>market feed</span></div>
            <div className="signal-tile" style={{ '--w': 13, '--h': 2 } as CSSProperties}><span>maritime data</span></div>
            <div className="signal-tile" style={{ '--w': 12, '--h': 1 } as CSSProperties}><span>supply chain</span></div>
            <div className="signal-tile" style={{ '--w': 14, '--h': 1 } as CSSProperties}><span>remote sensing</span></div>
            <div className="signal-tile" style={{ '--w': 13, '--h': 0, fontSize: '1.75rem' } as CSSProperties}><span>sensor fusion</span></div>
            <div className="signal-tile" style={{ '--w': 17, '--h': 0 } as CSSProperties}><span>transport systems</span></div>
          </div>
        </div>
      </section>

      <section className="about-detail-section niche-section" aria-labelledby="niche-title">
        <div className="about-detail-heading">
          <p className="niche-label">Built for the uncommon</p>
          <h2 id="niche-title">We build what off-the-shelf software cannot solve.</h2>
        </div>
        <div className="flow-composition" aria-label="What Chiefmind delivers for uncommon problems">
          <div className="flow-stack flow-signal-grid">
            <div className="signal-tile" style={{ '--w': 19, '--h': 2 } as CSSProperties}><span>neural net training</span></div>
            <div className="signal-tile" style={{ '--w': 19, '--h': 2 } as CSSProperties}><span>intelligent systems</span></div>
            <div className="signal-tile" style={{ '--w': 15, '--h': 1 } as CSSProperties}><span>agentic systems</span></div>
            <div className="signal-tile" style={{ '--w': 17, '--h': 1 } as CSSProperties}><span>data distribution</span></div>
            <div className="signal-tile" style={{ '--w': 13, '--h': 0 } as CSSProperties}><span>reports</span></div>
            <div className="signal-tile" style={{ '--w': 13, '--h': 0 } as CSSProperties}><span>alerts</span></div>
          </div>
        </div>
      </section>

      <div className="about-details">
        <section className="about-detail-section" aria-labelledby="origin-title">
          <div className="about-detail-heading">
            <p className="niche-label">Origin</p>
            <h2 id="origin-title">Born where ordinary software stops being useful.</h2>
          </div>
          <div className="about-detail-copy">
            <p>
              Chiefmind began with a simple observation: the hardest business problems are rarely caused by a
              lack of tools. They come from tools that cannot understand the specific reality of the team using
              them.
            </p>
            <p>
              We started building for the edge cases, the unusual operating models, and the decisions that
              require more than a template. The challenge was making deeply custom systems feel clear enough to
              use every day. That challenge became our discipline.
            </p>
          </div>
        </section>

        <section className="about-detail-section" aria-labelledby="principles-title">
          <div className="about-detail-heading">
            <p className="niche-label">Principles</p>
            <h2 id="principles-title">Useful intelligence should be precise, accountable, and human.</h2>
          </div>
          <div className="principle-list">
            <article>
              <h3>Specificity over scale</h3>
              <p>We design for the enterprise in front of us, not an imaginary average customer.</p>
            </article>
            <article>
              <h3>Clarity over spectacle</h3>
              <p>Every system should make the next important decision easier to see.</p>
            </article>
            <article>
              <h3>Responsibility stays visible</h3>
              <p>Automation can move quickly without hiding who owns the outcome.</p>
            </article>
          </div>
        </section>

      </div>

      <div className="cta-row">
        <a className={buttonVariants({ variant: 'default', size: 'lg' })} href="mailto:hello@chiefmind.io">
          Email Chiefmind <ArrowRight size={16} />
        </a>
        <a className={buttonVariants({ variant: 'outline', size: 'lg' })} href="#contact">
          Contact Us
        </a>
      </div>
    </section>
  )
}
