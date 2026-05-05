import React, { useEffect, useState } from "react";
import * as Plot from "@observablehq/plot";

const GROUP_LABELS = { hispanic: "Latino", black: "Black", asian: "Asian" };
const LEGEND_HEIGHT = 36;

function partyDots(data, opts) {
  const demDot = Plot.dot(data, { x: d => d.x * 100, y: d => d.y * 100,       fill: "steelblue", ...opts });
  const repDot = Plot.dot(data, { x: d => d.x * 100, y: d => (1 - d.y) * 100, fill: "tomato",    ...opts });
  return [demDot, repDot];
}

function partyLines(data) {
  const shared = { x: d => d.x * 100, strokeWidth: 2.5, curve: "catmull-rom", clip: true };
  const demLine = Plot.line(data, { ...shared, y: d => d.y * 100,         stroke: "steelblue" });
  const repLine = Plot.line(data, { ...shared, y: d => (1 - d.y) * 100,   stroke: "tomato"    });
  return [demLine, repLine];
}

function buildRegressionPoints([a, b, c, d]) {
  const points = [];
  for (let i = 0; i <= 199; i++) {
    const x = i / 199;
    const y = a + b*x + c*x*x + d*x*x*x;
    points.push({ x, y });
  }
  return points;
}

function buildMarks(points, regression) {
  const dots = partyDots(points, { fillOpacity: 0.18, r: 2.5, clip: true });

  const lines = regression?.length > 0
    ? partyLines(buildRegressionPoints(regression))
    : [];

  const midline = Plot.ruleY([50], {
    stroke: "#999",
    strokeDasharray: "4,4",
    strokeWidth: 1,
  });

  const label = Plot.text([`${points.length.toLocaleString()} precincts`], {
    frameAnchor: "top",
    dy: -5,
    textAnchor: "middle",
    fill: "#555",
    fontSize: 12,
    fontFamily: "Verdana, sans-serif",
  });

  return [...dots, ...lines, midline, label];
}

function buildPlotConfig(dims, group, marks) {
  return {
    width: dims.width,
    height: Math.max(dims.height - LEGEND_HEIGHT, 150),
    inset: 10,
    grid: true,
    marginLeft: 60,
    marginBottom: 50,
    style: { fontFamily: "Verdana, sans-serif", fontSize: "12px", background: "transparent", color: "#000" },
    x: {
      label: `Percent ${GROUP_LABELS[group] ?? group}`,
      tickFormat: d => `${d}%`,
      domain: [0, 100],
      labelAnchor: "center",
      labelOffset: 40,
    },
    y: {
      label: "Party Vote Share (%)",
      domain: [0, 100],
      labelAnchor: "center",
      labelOffset: 56,
    },
    marks,
  };
}

const GinglesScatterPlot = ({ points, regression, group }) => {
  const [containerEl, setContainerEl] = useState(null);
  const [plotEl, setPlotEl] = useState(null);
  const [dims, setDims] = useState({ width: 600, height: 350 });

  // allows resizing
  useEffect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDims({ width, height });
      }
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [containerEl]);

  useEffect(() => {
    if (!plotEl || !points?.length) return;
    plotEl.innerHTML = ""; // cleanup old svg
    plotEl.appendChild(Plot.plot(buildPlotConfig(dims, group, buildMarks(points, regression))));
  }, [plotEl, points, regression, group, dims]);

  return (
    <div ref={setContainerEl} className="gingles-scatter-container">
      <div className="gingles-legend">
        <span><span className="gingles-legend-dot gingles-legend-dot--dem" />Dem Vote Share</span>
        <span><span className="gingles-legend-dot gingles-legend-dot--rep" />Rep Vote Share</span>
        {regression?.length > 0 && (
          <span><span className="gingles-legend-line gingles-legend-line--dem" />Regression</span>
        )}
      </div>
      <div ref={setPlotEl} />
    </div>
  );
};

export default GinglesScatterPlot;
