import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";

const COLOR_MAP = {
  White: "rgba(60, 165, 165, 0.85)",
  Black: "rgba(200, 160, 50, 0.85)",
  Hispanic: "rgba(130, 90, 180, 0.85)",
  Asian: "rgba(120, 170, 100, 0.85)"
};

const FILL_MAP = {
  White: "rgba(60, 165, 165, 0.15)",
  Black: "rgba(200, 160, 50, 0.15)",
  Hispanic: "rgba(130, 90, 180, 0.15)",
  Asian: "rgba(120, 170, 100, 0.15)"
};

export default function EIKDEChart({ data }) {
  const allGroups = data ? Object.keys(data) : [];
  const [group1, setGroup1] = useState("");
  const [group2, setGroup2] = useState("");

  // Initialize selections once data arrives
  useEffect(() => {
    if (allGroups.length >= 2 && !group1 && !group2) {
      setGroup1(allGroups[0]);
      setGroup2(allGroups[1]);
    }
  }, [allGroups.length]); // only re-run when data loads

  if (!data || allGroups.length < 2) {
    return <div className="placeholder-card">No KDE data available</div>;
  }

  const traces = [];
  if (data[group1]) {
    traces.push({
      x: data[group1].map(d => d.x),
      y: data[group1].map(d => d.y),
      type: "scatter",
      mode: "lines",
      name: group1,
      fill: "tozeroy",
      line: { color: COLOR_MAP[group1] || "#888", width: 2, shape: "spline" },
      fillcolor: FILL_MAP[group1] || "rgba(128,128,128,0.15)",
    });
  }
  if (data[group2]) {
    traces.push({
      x: data[group2].map(d => d.x),
      y: data[group2].map(d => d.y),
      type: "scatter",
      mode: "lines",
      name: group2,
      fill: "tozeroy",
      line: { color: COLOR_MAP[group2] || "#888", width: 2, shape: "spline" },
      fillcolor: FILL_MAP[group2] || "rgba(128,128,128,0.15)",
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="chart-controls">
        <span className="chart-controls-label">Group 1:</span>
        <select
          className="heatmap-group-select"
          value={group1}
          onChange={(e) => setGroup1(e.target.value)}
        >
          {allGroups.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <span className="chart-controls-label" style={{ marginLeft: 16 }}>Group 2:</span>
        <select
          className="heatmap-group-select"
          value={group2}
          onChange={(e) => setGroup2(e.target.value)}
        >
          {allGroups.map(g => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>
      <Plot
        data={traces}
        layout={{
          xaxis: {
            title: {
              text: "% Support for Democratic Candidate",
              font: { family: "'Verdana', sans-serif", size: 11, color: "#888" }
            },
            range: [0, 100],
            gridcolor: "#f0f0f0",
            zeroline: false,
          },
          yaxis: {
            title: {
              text: "Density",
              font: { family: "'Verdana', sans-serif", size: 11, color: "#888" }
            },
            gridcolor: "#f0f0f0",
            zeroline: false,
          },
          hovermode: "x unified",
          showlegend: true,
          legend: {
            font: { family: "'Verdana', sans-serif", size: 10 },
            orientation: "h",
            x: 0,
            y: -0.2,
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
}
