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

function buildTraces(filteredData) {
  return filteredData.map(d => ({
    x: d.data.map(point => point.percent),
    y: d.data.map(point => point.probability),
    type: "scatter",
    mode: "lines",
    name: displayName(d.race),
    fill: "tozeroy",
    line: { color: lineFor(d.race), width: 2.5, shape: "spline" },
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
    </div>
  );
};

export default ProbabilityChart;
