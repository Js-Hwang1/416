import React from "react";
import Plot from "react-plotly.js";

// GUI-22: Overlapping histograms of "number of minority-effective districts
// per plan" comparing race-blind vs VRA-constrained ensembles, for the
// selected minority group.

const DISPLAY = { Hispanic: "Latino", Black: "Black", Asian: "Asian", White: "White" };
const RB_COLOR = "rgba(70, 160, 100, 0.55)";   // green
const VRA_COLOR = "rgba(90, 110, 200, 0.55)";  // blue

function toBars(arr, allCounts) {
  const map = new Map();
  for (const r of arr || []) map.set(r.count, r.freq);
  return allCounts.map((c) => map.get(c) ?? 0);
}

export default function EffectivenessHistogram({ data, group, threshold }) {
  if (!data) return <div className="placeholder-card">Loading effectiveness data…</div>;

  const groupKey = group ? group.charAt(0).toUpperCase() + group.slice(1).toLowerCase() : null;
  const groupData = groupKey ? data[groupKey] : null;
  if (!groupData) {
    return <div className="placeholder-card">No data for "{group}".</div>;
  }

  const rb = groupData.effective?.raceBlindData || [];
  const vra = groupData.effective?.vraData || [];
  const enacted = groupData.effective?.enacted;

  const allCountsSet = new Set([...rb.map(r => r.count), ...vra.map(r => r.count)]);
  if (allCountsSet.size === 0) {
    return <div className="placeholder-card">No effective-district outcomes recorded for {DISPLAY[groupKey] || groupKey}.</div>;
  }
  const allCounts = [...allCountsSet].sort((a, b) => a - b);

  const traces = [
    {
      x: allCounts,
      y: toBars(rb, allCounts),
      type: "bar",
      name: "Race-Blind",
      marker: { color: RB_COLOR, line: { color: "rgba(40,120,60,1)", width: 1 } },
    },
    {
      x: allCounts,
      y: toBars(vra, allCounts),
      type: "bar",
      name: "VRA-Constrained",
      marker: { color: VRA_COLOR, line: { color: "rgba(50,70,170,1)", width: 1 } },
    },
  ];

  const shapes = [];
  if (typeof enacted === "number" && allCounts.includes(enacted)) {
    shapes.push({
      type: "line",
      x0: enacted, x1: enacted,
      y0: 0, y1: 1, yref: "paper",
      line: { color: "#c0392b", width: 2, dash: "dash" },
    });
  }

  const display = DISPLAY[groupKey] || groupKey;
  const layout = {
    title: { text: `${display} effectiveness (threshold ${threshold})`, font: { family: "'Verdana', sans-serif", size: 13, color: "#000", weight: 700 } },
    barmode: "overlay",
    bargap: 0.1,
    showlegend: true,
    legend: { orientation: "h", x: 0, y: -0.2 },
    xaxis: {
      title: { text: `Number of districts with ${display} effectiveness ≥ ${threshold}`, font: { family: "'Verdana', sans-serif", size: 11, color: "#000", weight: 700 } },
      dtick: 1,
      tickfont: { family: "'Verdana', sans-serif", size: 10, color: "#000" },
      gridcolor: "#f0f0f0",
      zeroline: false,
    },
    yaxis: {
      title: { text: "Plans", font: { family: "'Verdana', sans-serif", size: 11, color: "#000", weight: 700 } },
      tickfont: { family: "'Verdana', sans-serif", size: 10, color: "#000" },
      gridcolor: "#f0f0f0",
      zeroline: false,
    },
    plot_bgcolor: "#fff",
    paper_bgcolor: "#fff",
    margin: { l: 60, r: 20, t: 40, b: 70 },
    shapes,
    annotations: shapes.length
      ? [{
          x: enacted, y: 1, yref: "paper",
          xanchor: "left", yanchor: "top",
          text: `&nbsp;Enacted (${enacted})`,
          showarrow: false,
          font: { family: "'Verdana', sans-serif", size: 10, color: "#c0392b", weight: 700 },
        }]
      : [],
    autosize: true,
  };

  return (
    <div className="probability-curve-container">
      <Plot
        data={traces}
        layout={layout}
        className="probability-curve-plot"
        useResizeHandler={true}
        config={{ responsive: true, displayModeBar: false }}
      />
    </div>
  );
}
