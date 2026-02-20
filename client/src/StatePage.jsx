import React, { useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as d3 from "d3";

const DISTRICT_COLORS = [
  "#e8e8e8", "#d4d4d4", "#c0c0c0", "#acacac",
  "#e0dcd0", "#ccc8bc", "#d8d4c8", "#c4c0b4",
  "#dcdcdc", "#c8c8c8", "#b4b4b4", "#e4e0d8",
  "#d0ccc0", "#bcb8ac", "#d4d0c4", "#c0bcb0",
  "#e0e0e0", "#cccccc", "#b8b8b8", "#a8a8a8",
  "#dcd8cc", "#c8c4b8", "#d4d0c8", "#c0bcb4",
  "#d8d8d8", "#c4c4c4", "#b0b0b0", "#e8e4dc",
  "#d4d0c4", "#c0bcb0", "#dcd8d0", "#c8c4bc",
  "#e4e4e4", "#d0d0d0", "#bcbcbc", "#d8d4cc",
  "#c4c0b8", "#b0aca4",
];

const STATE_DATA = {
  texas: {
    name: "Texas",
    abbr: "TX",
    fips: 48,
    districts: 38,
    population: "30,503,340",
    geojson: "/data/tx_districts.geojson",
    ensembles: [
      {
        id: 1,
        type: "Race-Blind",
        plans: 5000,
        populationThreshold: "2.0%",
      },
      {
        id: 2,
        type: "VRA-Constrained",
        plans: 5000,
        populationThreshold: "2.0%",
      },
    ],
  },
  massachusetts: {
    name: "Massachusetts",
    abbr: "MA",
    fips: 25,
    districts: 9,
    population: "7,029,917",
    geojson: "/data/ma_districts.geojson",
    ensembles: [
      {
        id: 1,
        type: "Race-Blind",
        plans: 5000,
        populationThreshold: "2.0%",
      },
      {
        id: 2,
        type: "VRA-Constrained",
        plans: 5000,
        populationThreshold: "2.0%",
      },
    ],
  },
};

function StateMap({ geojsonPath }) {
  const svgRef = useRef();

  useEffect(() => {
    const width = 600;
    const height = 450;

    d3.json(geojsonPath).then((geojson) => {
      const svg = d3
        .select(svgRef.current)
        .attr("viewBox", [0, 0, width, height])
        .style("width", "100%")
        .style("height", "auto");

      svg.selectAll("*").remove();

      const projection = d3.geoMercator();
      const path = d3.geoPath().projection(projection);

      projection.fitExtent(
        [
          [20, 20],
          [width - 20, height - 20],
        ],
        geojson
      );

      const g = svg.append("g");

      // Draw congressional districts
      g.selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", path)
        .attr("fill", (d, i) => DISTRICT_COLORS[i % DISTRICT_COLORS.length])
        .attr("stroke", "#555")
        .attr("stroke-width", 1)
        .append("title")
        .text((d) => d.properties.name);
    });
  }, [geojsonPath]);

  return <svg ref={svgRef}></svg>;
}

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

        <select
          className="state-dropdown"
          value={stateSlug}
          onChange={(e) => navigate(`/state/${e.target.value}`)}
        >
          <option value="texas">Texas</option>
          <option value="massachusetts">Massachusetts</option>
        </select>

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
        <div className="state-layout">
          <div className="state-map-panel">
            <h2 className="section-title">State Map</h2>
            <div className="state-map-wrapper">
              <StateMap geojsonPath={stateInfo.geojson} />
            </div>
          </div>

          <div className="state-info-panel">
            <section className="state-section">
              <h2 className="section-title">Available Ensembles</h2>
              <table className="ensemble-table">
                <thead>
                  <tr>
                    <th>Ensemble Type</th>
                    <th>District Plans</th>
                    <th>Pop. Equality Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {stateInfo.ensembles.map((e) => (
                    <tr key={e.id}>
                      <td>{e.type}</td>
                      <td>{e.plans.toLocaleString()}</td>
                      <td>{e.populationThreshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
