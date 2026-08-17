export default function RealMarketPage() {
  return (
    <section className="page-panel" aria-labelledby="real-market-title">
      <h1 className="hero-title" id="real-market-title">
        Chiefmind™ REAL - Market
      </h1>
      <p className="lead page-lead market-description">
        Market reads shipping data, import and export activity, and supplier data from multiple sources to understand how the companies you invest in actually operate. It turns that operational context into clearer signals for better investment decisions.
      </p>
      <div className="market-flow" aria-label="Market intelligence data sources">
        <div className="market-source-panel">
          <div className="market-source-header">
            <span className="market-source-status" aria-hidden="true" />
            <span>Live sources</span>
          </div>
          <div className="market-source-window">
            <div className="market-source-track">
              <div className="market-source-layer">
                <span className="market-source-name">Shipping data</span>
              </div>
              <div className="market-source-layer">
                <span className="market-source-name">Supplier data</span>
              </div>
              <div className="market-source-layer">
                <span className="market-source-name">Market feed</span>
              </div>
              <div className="market-source-layer" aria-hidden="true">
                <span className="market-source-name">Shipping data</span>
              </div>
            </div>
          </div>
          <div className="market-source-ticks" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="market-flow-arrow" aria-hidden="true">
          <span className="market-arrow-chevron market-arrow-chevron-primary" />
          <span className="market-arrow-chevron market-arrow-chevron-secondary" />
        </div>
        <div className="market-intelligence-box">
          <span className="market-intelligence-glow" aria-hidden="true" />
          <span className="market-intelligence-label">Market intelligence</span>
          <span className="market-intelligence-note">One synthesized operating view</span>
        </div>
      </div>
    </section>
  )
}
