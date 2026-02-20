import React from "react";
import { useParams, useNavigate } from "react-router-dom";

const STATE_DATA = {
  texas: {
    name: "Texas",
    abbr: "TX",
    districts: 38,
    population: "30.5M",
    description:
      "Texas has 38 congressional districts, making it one of the largest and most complex states for redistricting analysis.",
  },
  massachusetts: {
    name: "Massachusetts",
    abbr: "MA",
    districts: 9,
    population: "7.0M",
    description:
      "Massachusetts has 9 congressional districts with a compact geographic footprint that presents unique redistricting challenges.",
  },
};

export default function StatePage() {
  const { stateSlug } = useParams();
  const navigate = useNavigate();
  const stateInfo = STATE_DATA[stateSlug];

  if (!stateInfo) {
    return (
      <div className="state-page">
        <div className="state-page-inner">
          <h1>State not found</h1>
          <button className="back-button" onClick={() => navigate("/")}>
            Back to Map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="state-page fade-in">
      <nav className="state-nav">
        <button className="back-button" onClick={() => navigate("/")}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Map
        </button>
        <span className="nav-title">Redistricting Analysis</span>
      </nav>

      <header className="state-header">
        <span className="state-abbr-badge">{stateInfo.abbr}</span>
        <h1 className="state-name">{stateInfo.name}</h1>
        <div className="state-meta">
          <div className="meta-item">
            <span className="meta-label">Congressional Districts</span>
            <span className="meta-value">{stateInfo.districts}</span>
          </div>
          <div className="meta-divider"></div>
          <div className="meta-item">
            <span className="meta-label">Population</span>
            <span className="meta-value">{stateInfo.population}</span>
          </div>
        </div>
      </header>

      <main className="state-content">
        <section className="state-section">
          <h2 className="section-title">Overview</h2>
          <p className="section-text">{stateInfo.description}</p>
        </section>

        <section className="state-section">
          <h2 className="section-title">Analysis Tools</h2>
          <div className="tools-grid">
            <div className="tool-card">
              <h3>Ensemble Analysis</h3>
              <p>
                Generate and compare thousands of possible district maps using
                Markov chain Monte Carlo methods.
              </p>
            </div>
            <div className="tool-card">
              <h3>District Metrics</h3>
              <p>
                Evaluate compactness, population equality, and other
                redistricting criteria across plans.
              </p>
            </div>
            <div className="tool-card">
              <h3>Demographic Data</h3>
              <p>
                Explore census data and demographic distributions at the
                precinct level.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
