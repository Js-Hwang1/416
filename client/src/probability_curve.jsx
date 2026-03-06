import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";

const COLOR_MAP = {
  White: "rgba(60, 165, 165, 0.85)",
  Black: "rgba(200, 160, 50, 0.85)",
  Hispanic: "rgba(130, 90, 180, 0.85)",
  Asian: "rgba(120, 170, 100, 0.85)"
};

const FILL_MAP = {
  White: "rgba(60, 165, 165, 0.2)",
  Black: "rgba(200, 160, 50, 0.2)",
  Hispanic: "rgba(130, 90, 180, 0.2)",
  Asian: "rgba(120, 170, 100, 0.2)"
};

const ProbabilityChart = ({ data }) => {
  const dataJson = data || [];
  const allRaces = [...new Set(dataJson.map(d => d.race))];
  const allCandidates = [...new Set(dataJson.map(d => d.candidate))];
  const [selectedRaces, setSelectedRaces] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState("");

  // Initialize selections once data arrives
  useEffect(() => {
    if (dataJson.length > 0 && selectedRaces.length === 0 && !selectedCandidate) {
      setSelectedRaces(allRaces.slice(0, 2));
      setSelectedCandidate(allCandidates[0] || "");
    }
  }, [dataJson.length]); // only re-run when data loads

  const filteredData = dataJson.filter(
    d => selectedRaces.includes(d.race) && d.candidate === selectedCandidate
  );

  const handleRaceToggle = (race) => {
    setSelectedRaces(prev =>
      prev.includes(race)
        ? prev.filter(r => r !== race)
        : [...prev, race]
    );
  };

  const traces = filteredData.map(d => ({
    x: d.data.map(point => point.percent),
    y: d.data.map(point => point.probability),
    type: "scatter",
    mode: "lines",
    name: `${d.race}`,
    fill: "tozeroy",
    line: {
      color: COLOR_MAP[d.race] || "rgba(128, 128, 128, 0.8)",
      width: 2,
      shape: "spline"
    },
    fillcolor: FILL_MAP[d.race] || "rgba(128, 128, 128, 0.15)"
  }));

  if (dataJson.length === 0) {
    return <div className="placeholder-card">{data === null ? "Loading..." : "No EI probability data available"}</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="chart-controls">
        <span className="chart-controls-label">Candidate:</span>
        {allCandidates.map(cand => (
          <button
            key={cand}
            className={`chart-control-btn${selectedCandidate === cand ? " active" : ""}`}
            onClick={() => setSelectedCandidate(cand)}
          >
            {cand}
          </button>
        ))}
        <span className="chart-controls-label" style={{ marginLeft: 16 }}>Groups:</span>
        {allRaces.map(race => (
          <label key={race} className="chart-control-checkbox">
            <input
              type="checkbox"
              checked={selectedRaces.includes(race)}
              onChange={() => handleRaceToggle(race)}
            />
            <span
              className="chart-control-swatch"
              style={{ background: COLOR_MAP[race] || "#888" }}
            ></span>
            {race}
          </label>
        ))}
      </div>
      <Plot
        data={traces}
        layout={{
          xaxis: {
            title: {
              text: "% of Group Voting for Candidate",
              font: { family: "'Verdana', sans-serif", size: 11, color: "#888" }
            },
            gridcolor: "#f0f0f0",
            zeroline: false
          },
          yaxis: {
            title: {
              text: "Probability Density",
              font: { family: "'Verdana', sans-serif", size: 11, color: "#888" }
            },
            gridcolor: "#f0f0f0",
            zeroline: false
          },
          hovermode: "x unified",
          showlegend: true,
          legend: {
            font: { family: "'Verdana', sans-serif", size: 10 },
            orientation: "h",
            x: 0,
            y: -0.2
          },
          plot_bgcolor: "#fff",
          paper_bgcolor: "#fff",
          margin: { l: 55, r: 20, t: 10, b: 70 },
          font: { family: "'Verdana', sans-serif" },
          autosize: true,
        }}
        style={{ width: "100%", flex: 1, minHeight: 0 }}
        useResizeHandler={true}
        config={{ responsive: true, displayModeBar: false }}
      />
    </div>
  );
};

export default ProbabilityChart;
