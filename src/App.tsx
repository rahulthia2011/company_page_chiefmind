import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import './App.css'

const loadAboutPage = () => import('@/pages/AboutPage')
const loadContactPage = () => import('@/pages/ContactPage')
const loadRealMarketPage = () => import('@/pages/RealMarketPage')
const loadRealChannelPage = () => import('@/pages/RealChannelPage')

const AboutPage = lazy(loadAboutPage)
const ContactPage = lazy(loadContactPage)
const RealMarketPage = lazy(loadRealMarketPage)
const RealChannelPage = lazy(loadRealChannelPage)

type ProductLink = {
  name: string
  description: string
  children?: ProductLink[]
}

type Page = 'home' | 'about' | 'contact' | 'real-market' | 'real-channel'

const starColors = ['#ffffff', '#ddecff', '#b9dfff', '#ffe6ad', '#ffd36e'] as const
const BACKGROUND_STAR_COUNT = 640

const buildBackgroundStars = () =>
  Array.from({ length: BACKGROUND_STAR_COUNT }, (_, index) => {
    const depth = Math.random()
    const size = depth > 0.94 ? Math.random() * 1.5 + 1.2 : Math.random() * 0.95 + 0.45
    const opacity = depth > 0.94 ? Math.random() * 0.28 + 0.72 : Math.random() * 0.5 + 0.28

    return {
      id: `background-star-${index}`,
      color: starColors[Math.floor(Math.random() * starColors.length)],
      delay: Math.random() * -8,
      duration: Math.random() * 5 + 4,
      opacity,
      size,
      x: Math.random() * 100,
      y: Math.random() * 100,
    }
  })

const backgroundStars = buildBackgroundStars()

const constellationStars = [
  { centerX: 142, centerY: 94, radius: 4.2 },
  { centerX: 216, centerY: 122, radius: 3.7 },
  { centerX: 290, centerY: 92, radius: 4.7 },
  { centerX: 364, centerY: 126, radius: 3.8 },
  { centerX: 438, centerY: 105, radius: 3.4 },
  { centerX: 308, centerY: 168, radius: 3.5 },
  { centerX: 276, centerY: 224, radius: 4 },
  { centerX: 318, centerY: 288, radius: 4.3 },
  { centerX: 392, centerY: 328, radius: 3.7 },
  { centerX: 188, centerY: 198, radius: 3.2 },
  { centerX: 236, centerY: 250, radius: 3.3 },
  { centerX: 412, centerY: 190, radius: 3.5 },
  { centerX: 488, centerY: 300, radius: 3.2 },
]

const productDropdowns: ProductLink[] = [
  {
    name: 'Chiefmind™ REAL',
    description: 'A reality-aware AI layer for reading live business context, decisions, and operational signals.',
    children: [
      {
        name: 'Chiefmind™ REAL - Market',
        description: 'Market intelligence workflows for visibility, signals, and decision support.',
      },
    ],
  },
]

const getProductHash = (name: string) => {
  if (name.includes('Market')) {
    return '#real-market'
  }

  if (name.includes('Channel')) {
    return '#real-channel'
  }

  return '#home'
}

const getCurrentPage = (): Page => {
  if (typeof window === 'undefined') {
    return 'home'
  }

  switch (window.location.hash) {
    case '#home':
      return 'home'
    case '#about':
      return 'about'
    case '#contact':
      return 'contact'
    case '#real-market':
      return 'real-market'
    case '#real-channel':
      return 'real-channel'
    default:
      return 'home'
  }
}

function App() {
  const solutionsDropdownRef = useRef<HTMLDetailsElement>(null)
  const [page, setPage] = useState<Page>(getCurrentPage)

  const closeSolutionsDropdown = () => {
    const dropdown = solutionsDropdownRef.current

    if (!dropdown) {
      return
    }

    dropdown.removeAttribute('open')
    dropdown.querySelectorAll('details[open]').forEach((detail) => {
      detail.removeAttribute('open')
    })
  }

  const handleInternalNavigation = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as Element).closest('a[href^="#"]')
    const hash = link?.getAttribute('href')

    if (!hash) {
      return
    }

    event.preventDefault()

    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash)
    }

    setPage(getCurrentPage())
    closeSolutionsDropdown()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const dropdown = solutionsDropdownRef.current

      if (!dropdown || dropdown.contains(event.target as Node)) {
        return
      }

      closeSolutionsDropdown()
    }

    const handleHashChange = () => {
      setPage(getCurrentPage())
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('hashchange', handleHashChange)

    const preloadPages = () => {
      loadAboutPage()
      loadContactPage()
      loadRealMarketPage()
      loadRealChannelPage()
    }

    let idleId: number | undefined
    let preloadTimeout: number | undefined

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(preloadPages, { timeout: 1500 })
    } else {
      preloadTimeout = window.setTimeout(preloadPages, 800)
    }

    return () => {
      if (idleId !== undefined) {
        window.cancelIdleCallback?.(idleId)
      }

      if (preloadTimeout !== undefined) {
        window.clearTimeout(preloadTimeout)
      }

      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  const isAboutPage = page === 'about'
  const isContactPage = page === 'contact'
  const isRealMarketPage = page === 'real-market'
  const isRealChannelPage = page === 'real-channel'

  return (
    <div className="site-shell" onClick={handleInternalNavigation}>
      <div className="bg-layer" aria-hidden="true">
        <div className="star-field">
          <div className="random-stars">
            {backgroundStars.map((star) => (
              <span
                className="background-star"
                key={star.id}
                style={{
                  '--star-color': star.color,
                  '--star-delay': `${star.delay}s`,
                  '--star-duration': `${star.duration}s`,
                  '--star-opacity': star.opacity,
                  '--star-size': `${star.size}px`,
                  '--star-x': `${star.x}%`,
                  '--star-y': `${star.y}%`,
                } as CSSProperties}
              />
            ))}
          </div>
          <div className="bright-star star-a" />
          <div className="bright-star star-b" />
          <div className="bright-star star-c" />
          <div className="bright-star star-d" />
          <div className="bright-star star-e" />
          <div className="bright-star star-f" />
          <div className="bright-star star-g" />
          <div className="bright-star star-h" />
          <div className="bright-star star-i" />
          <div className="bright-star star-j" />
          <div className="milky-dust" />
          {page === 'home' ? (
            <svg className="constellation" viewBox="0 0 620 420" role="img">
              <path className="constellation-line line-one" d="M142 94 L216 122 L290 92 L364 126 L438 105" />
              <path className="constellation-line line-two" d="M290 92 L308 168 L276 224 L318 288 L392 328" />
              <path className="constellation-line line-three" d="M216 122 L188 198 L236 250 L318 288" />
              <path className="constellation-line line-four" d="M364 126 L412 190 L392 328 L488 300" />
              <g className="constellation-stars">
                {constellationStars.map((star) => (
                  <g
                    className="constellation-star"
                    key={`${star.centerX}-${star.centerY}`}
                  >
                    <circle
                      className="constellation-star-core"
                      cx={star.centerX}
                      cy={star.centerY}
                      r={star.radius}
                    />
                  </g>
                ))}
              </g>
            </svg>
          ) : null}
        </div>
      </div>

      <header className="site-header">
        <a className="brand-mark" href="#home" aria-label="Chiefmind home">
          Chiefmind
        </a>
        <nav className="top-nav" aria-label="Primary navigation">
          <a className={`nav-tab${isAboutPage ? ' nav-tab-active' : ''}`} href="#about" aria-current={isAboutPage ? 'page' : undefined}>About Us</a>
          <details
            className="solutions-dropdown"
            ref={solutionsDropdownRef}
          >
            <summary className="nav-tab">
              <span>Solutions</span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="solutions-panel">
              {productDropdowns.map((product) => (
                product.children ? (
                  <details className="solution-group" key={product.name}>
                    <summary className="solution-trigger">
                      <span>{product.name}</span>
                      <small>{product.description}</small>
                    </summary>
                    <div className="solution-children">
                      {product.children.map((child) => (
                        <a className="solution-link solution-child-link" href={getProductHash(child.name)} key={child.name}>
                          <span>{child.name}</span>
                          <small>{child.description}</small>
                        </a>
                      ))}
                    </div>
                  </details>
                ) : (
                  <a className="solution-link" href="#home" key={product.name}>
                    <span>{product.name}</span>
                    <small>{product.description}</small>
                  </a>
                )
              ))}
            </div>
          </details>
          <a className={`nav-tab${isContactPage ? ' nav-tab-active' : ''}`} href="#contact" aria-current={isContactPage ? 'page' : undefined}>Contact</a>
        </nav>
      </header>

      <main className="content" id="home">
        {page === 'home' ? (
          <>
            <h1 className="hero-title">
              Where intelligent systems take shape
            </h1>
            <div className="hero-copy">
              <p className="lead">
                We develop high-trust digital systems that connect data, actions,
                operations
              </p>

              <div className="cta-row">
                <Button variant="default" size="lg">
                  Start a project <ArrowRight size={16} />
                </Button>
                <a className={buttonVariants({ variant: 'outline', size: 'lg' })} href="#about">
                  View capabilities
                </a>
              </div>
            </div>
          </>
        ) : null}

        {isAboutPage ? (
          <Suspense fallback={<section className="page-panel about-panel"><p className="eyebrow">Loading</p></section>}>
            <AboutPage />
          </Suspense>
        ) : null}

        {isRealMarketPage ? (
          <Suspense fallback={<section className="page-panel"><p className="eyebrow">Loading</p></section>}>
            <RealMarketPage />
          </Suspense>
        ) : null}

        {isRealChannelPage ? (
          <Suspense fallback={<section className="page-panel"><p className="eyebrow">Loading</p></section>}>
            <RealChannelPage />
          </Suspense>
        ) : null}

        {isContactPage ? (
          <Suspense fallback={<section className="page-panel"><p className="eyebrow">Loading</p></section>}>
            <ContactPage />
          </Suspense>
        ) : null}
      </main>
    </div>
  )
}

export default App
