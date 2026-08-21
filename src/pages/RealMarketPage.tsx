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
          <div className="market-source-window">
            <div className="market-source-track">
              <div className="market-source-layer">
                <span className="market-source-name">Market, Supplier and Logistics data</span>
              </div>
              <div className="market-source-layer">
                <span className="market-source-name">Ontology</span>
              </div>
              <div className="market-source-layer">
                <span className="market-source-name">Decision Support System</span>
              </div>
              <div className="market-source-layer" aria-hidden="true">
                <span className="market-source-name">Market, Supplier and Logistics data</span>
              </div>
            </div>
          </div>
          <div className="market-source-ticks" aria-hidden="true">
            <span />
          </div>
        </div>
        <div className="market-flow-arrow" aria-hidden="true">
          <span className="market-arrow-chevron market-arrow-chevron-primary" />
          <span className="market-arrow-chevron market-arrow-chevron-secondary" />
        </div>
        <div className="market-intelligence-cluster">
          <div className="market-intelligence-box">
            <span className="market-intelligence-label">Market intelligence</span>
            <span className="market-intelligence-note">One synthesized operating view</span>
          </div>
          <div className="market-intelligence-nodes" aria-hidden="true">
            <div className="market-node-col">
              <span className="market-node">Risk</span>
              <span className="market-node">Compliance</span>
            </div>
            <div className="market-node-col">
              <span className="market-node">Investment Analysis</span>
              <span className="market-node">Rule checking</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
