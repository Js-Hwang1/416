import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";

// High-contrast palette (d3 Category10–ish). One hex per group; line uses
// it solid, fill uses the same hue at low opacity so 2+ curves overlap legibly.
const GROUP_HEX = {
  black:    "#d62728", // red
  hispanic: "#9467bd", // purple
  asian:    "#2ca02c", // green
  white:    "#1f77b4", // blue
};

const hexToRgba = (hex, alpha) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const colorFor = (key) => {
  const k = (key || "").toLowerCase();
  return GROUP_HEX[k] || "#888";
};

const fillFor = (key) => hexToRgba(colorFor(key), 0.25);
const lineFor = (key) => hexToRgba(colorFor(key), 1);

const DISPLAY_NAME = {
  hispanic: "Latino", white: "White", black: "Black", asian: "Asian",
  Hispanic: "Latino", White: "White", Black: "Black", Asian: "Asian",
};
const displayName = (key) => DISPLAY_NAME[key] || key;

const CANDIDATE_TO_PARTY = { "Harris (D)": "Democratic", "Trump (R)": "Republican" };
const getPartyLabel = (candidate) => CANDIDATE_TO_PARTY[candidate] || candidate;

const AXIS_FONT = { family: "'Verdana', sans-serif", size: 12, color: "#000", weight: 700 };
const TICK_FONT = { family: "'Verdana', sans-serif", size: 11, color: "#000" };

function buildLayout(selectedCandidate) {
  return {
    xaxis: {
      title: { text: `% of Group Voting ${getPartyLabel(selectedCandidate)}`, font: AXIS_FONT },
      tickfont: TICK_FONT,
      gridcolor: "#f0f0f0",
      zeroline: false,
    },
    yaxis: {
      title: { text: "Probability Density", font: AXIS_FONT, standoff: 15 },
      tickfont: TICK_FONT,
      gridcolor: "#f0f0f0",
      zeroline: false,
    },
    hovermode: "x unified",
    showlegend: true,
    legend: { font: { family: "'Verdana', sans-serif", size: 10 }, orientation: "h", x: 0, y: -0.2 },
    plot_bgcolor: "#fff",
    paper_bgcolor: "#fff",
    margin: { l: 65, r: 20, t: 10, b: 70 },
    font: { family: "'Verdana', sans-serif", color: "#000" },
    autosize: true,
  };
}

// Overlap coefficient between two KDE traces on a common 0..100 integer grid.
// Returns 0..1: 0 = disjoint, 1 = identical distributions.
function overlapCoefficient(a, b) {
  const sampleAt = (curve, x) => {
    const pts = curve.data;
    if (!pts.length) return 0;
    if (x <= pts[0].percent) return 0;
    if (x >= pts[pts.length - 1].percent) return 0;
    let lo = 0, hi = pts.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].percent <= x) lo = mid; else hi = mid;
    }
    const p0 = pts[lo], p1 = pts[hi];
    const t = (x - p0.percent) / (p1.percent - p0.percent);
    return p0.probability + t * (p1.probability - p0.probability);
  };
  const minSum = (curve) => curve.data.reduce((s, p) => s + p.probability, 0);
  const aTotal = minSum(a), bTotal = minSum(b);
  if (aTotal <= 0 || bTotal <= 0) return 0;
  let overlap = 0;
  for (let x = 0; x <= 100; x += 1) {
    overlap += Math.min(sampleAt(a, x), sampleAt(b, x));
  }
  // Normalize by the smaller total (the standard overlap coefficient).
  return overlap / Math.min(aTotal, bTotal);
}

function buildTraces(filteredData) {
  return filteredData.map(d => ({
    x: d.data.map(point => point.percent),
    y: d.data.map(point => point.probability),
    type: "scatter",
    mode: "lines",
    name: displayName(d.race),
    fill: "tozeroy",
    // The KDE ships ~61 dense points; linear interpolation between them looks
    // smooth and avoids the ringing/overshoot plotly's spline produces on the
    // steep tails of narrow posteriors.
    line: { color: lineFor(d.race), width: 2.5, shape: "linear" },
    fillcolor: fillFor(d.race),
  }));
}

const ProbabilityChart = ({ data }) => {
  const dataJson = data || [];
  const allRaces = [...new Set(dataJson.map(d => d.race))];
  const allCandidates = [...new Set(dataJson.map(d => d.candidate))];
  const [selectedRaces, setSelectedRaces] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");

  useEffect(() => {
    if (dataJson.length > 0 && selectedRaces.length === 0 && !selectedCandidate) {
      setSelectedRaces(allRaces.slice(0, 2));
      setSelectedCandidate(allCandidates[0] || "");
    }
  }, [dataJson.length]);

  const filteredData = dataJson.filter(
    d => selectedRaces.includes(d.race) && d.candidate === selectedCandidate
  );

  const handleRaceToggle = (race) =>
    setSelectedRaces(prev =>
      prev.includes(race) ? prev.filter(r => r !== race) : [...prev, race]
    );

  if (dataJson.length === 0) {
    return <div className="placeholder-card">{data === null ? "Loading..." : "No EI probability data available"}</div>;
  }

  return (
    <div className="probability-curve-container">
      <div className="chart-controls">
        <span className="chart-controls-label">Party:</span>
        {allCandidates.map(cand => (
          <button
            key={cand}
            className={`chart-control-btn${selectedCandidate === cand ? " active" : ""}`}
            onClick={() => setSelectedCandidate(cand)}
          >
            {getPartyLabel(cand)}
          </button>
        ))}
        <span className="chart-controls-label chart-controls-label--spaced">Groups:</span>
        {allRaces.map(race => (
          <label key={race} className="chart-control-checkbox">
            <input type="checkbox" checked={selectedRaces.includes(race)} onChange={() => handleRaceToggle(race)} />
            <span className="chart-control-swatch" style={{ background: colorFor(race) }} />
            {displayName(race)}
          </label>
        ))}
      </div>
      <Plot
        data={buildTraces(filteredData)}
        layout={buildLayout(selectedCandidate)}
        className="probability-curve-plot"
        useResizeHandler={true}
        config={{ responsive: true, displayModeBar: false }}
      />
      {filteredData.length >= 2 && (
        <div className="chart-controls" style={{ marginTop: 8 }}>
          <span className="chart-controls-label">Curve overlap (lower = more polarized):</span>
          {filteredData.flatMap((a, i) =>
            filteredData.slice(i + 1).map((b) => (
              <span
                key={`${a.race}-${b.race}`}
                style={{
                  fontFamily: "'Verdana', sans-serif",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "2px 6px",
                  background: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  borderRadius: 3,
                  marginRight: 4,
                }}
              >
                {displayName(a.race)} ∩ {displayName(b.race)} = {(overlapCoefficient(a, b) * 100).toFixed(1)}%
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ProbabilityChart;
