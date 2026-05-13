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
  const pts = [];
  for (let i = 0; i <= 199; i++) {
    const x = i / 199;
    const y = a + b*x + c*x*x + d*x*x*x;
    pts.push({ x, y });
  }
  return pts;
}

// Augment each datum with party so the pointer layer can distinguish Dem vs Rep by y-position
function makePartyPoints(points) {
  const dem = points.map(p => ({ datum: p, party: "dem" }));
  const rep = points.map(p => ({ datum: p, party: "rep" }));
  return [...dem, ...rep];
}

function buildMarks(points, regression, selectedPoint) {
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

  // Pointer layer over both Dem and Rep positions so the nearest party dot is identified on click
  const partyPoints = makePartyPoints(points);
  const pointerLayer = Plot.dot(partyPoints, Plot.pointer({
    x: d => d.datum.x * 100,
    y: d => d.party === "dem" ? d.datum.y * 100 : (1 - d.datum.y) * 100,
    r: 6,
    fill: "transparent",
    stroke: "transparent",
  }));

  // Highlight only the clicked party's dot for the selected precinct
  const selDem = selectedPoint?.party === "dem" ? [selectedPoint.datum] : [];
  const selRep = selectedPoint?.party === "rep" ? [selectedPoint.datum] : [];
  const selectedDots = [
    Plot.dot(selDem, { x: d => d.x * 100, y: d => d.y * 100,       fill: "steelblue", fillOpacity: 0.9, r: 6, stroke: "#000", strokeWidth: 1.5, clip: true }),
    Plot.dot(selRep, { x: d => d.x * 100, y: d => (1 - d.y) * 100, fill: "tomato",    fillOpacity: 0.9, r: 6, stroke: "#000", strokeWidth: 1.5, clip: true }),
  ];

  return [...dots, ...lines, midline, label, ...selectedDots, pointerLayer];
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

const GinglesScatterPlot = ({ points, regression, group, onSelectPrecinct, selectedPoint }) => {
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
    plotEl.innerHTML = "";
    const marks = buildMarks(points, regression, selectedPoint);
    const svg = Plot.plot(buildPlotConfig(dims, group, marks));

    if (onSelectPrecinct) {
      // svg.value is a { datum, party } object from the pointer layer
      svg.addEventListener("click", () => {
        if (svg.value) onSelectPrecinct(svg.value);
      });
    }

    plotEl.appendChild(svg);
  }, [plotEl, points, regression, group, dims, selectedPoint, onSelectPrecinct]);

  return (
    <div ref={setContainerEl} className="gingles-scatter-container">
      <div className="gingles-legend">
        <span><span className="gingles-legend-dot gingles-legend-dot--dem" />Dem Vote Share</span>
        <span><span className="gingles-legend-dot gingles-legend-dot--rep" />Rep Vote Share</span>
        {regression?.length > 0 && (
          <span><span className="gingles-legend-line gingles-legend-line--dem" />Regression</span>
        )}
      </div>
      <div ref={setPlotEl} className="gingles-scatter-clickable" />
    </div>
  );
};

export default GinglesScatterPlot;
