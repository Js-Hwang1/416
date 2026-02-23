import React, { useState } from "react";
import Plot from "react-plotly.js";
import dataJson from "./dummy_data/dummy_probability_curve.json";

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

const ProbabilityChart = () => {
  const allRaces = [...new Set(dataJson.map(d => d.race))];
  const [selectedRaces, setSelectedRaces] = useState(["White", "Black"]);

  const filteredData = dataJson.filter(d => selectedRaces.includes(d.race));

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
    name: `${d.candidate} – ${d.race}`,
    fill: "tozeroy",
    line: {
      color: COLOR_MAP[d.race] || "rgba(128, 128, 128, 0.8)",
      width: 2,
      shape: "spline"
    },
    fillcolor: FILL_MAP[d.race] || "rgba(128, 128, 128, 0.15)"
  }));

  return (
    <div style={{ width: "100%" }}>
      <div className="chart-controls">
        <span className="chart-controls-label">Groups:</span>
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
              font: { family: "'Inter', sans-serif", size: 11, color: "#888" }
            },
            gridcolor: "#f0f0f0",
            zeroline: false
          },
          yaxis: {
            title: {
              text: "Probability Density",
              font: { family: "'Inter', sans-serif", size: 11, color: "#888" }
            },
            gridcolor: "#f0f0f0",
            zeroline: false
          },
          hovermode: "x unified",
          showlegend: true,
          legend: {
            font: { family: "'Inter', sans-serif", size: 10 },
            orientation: "h",
            x: 0,
            y: -0.2
          },
          plot_bgcolor: "#fff",
          paper_bgcolor: "#fff",
          margin: { l: 55, r: 20, t: 10, b: 70 },
          font: { family: "'Inter', sans-serif" }
        }}
        style={{ width: "100%", height: "420px" }}
        config={{ responsive: true, displayModeBar: false }}
      />
    </div>
  );
};

export default ProbabilityChart;
