import React, { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

// GUI-18: Vote share vs seat share curve. The Shen-software output ships
// a single curve (Democratic vote share -> Democratic seat share). The
// Republican curve is its mathematical reflection through (50, 50) and
// would trace identical points, so we render just the one curve plus the
// enacted-plan marker.

function buildMarks(curve, enacted) {
  const marks = [
    // Proportional-representation reference diagonal (vote = seat)
    Plot.line([{ x: 0, y: 0 }, { x: 100, y: 100 }], {
      x: "x", y: "y", stroke: "#bbb", strokeDasharray: "4,4", strokeWidth: 1,
    }),
    // 50/50 reference rules
    Plot.ruleX([50], { stroke: "#e8e8e8", strokeWidth: 1 }),
    Plot.ruleY([50], { stroke: "#e8e8e8", strokeWidth: 1 }),
    // Vote-seat curve (Democratic)
    Plot.line(curve, {
      x: "vote_share", y: "seat_share",
      stroke: "#2c7bb6", strokeWidth: 2.5, curve: "monotone-x",
    }),
  ];

  if (enacted && typeof enacted.vote_share === "number" && typeof enacted.seat_share === "number") {
    const e = [{ x: enacted.vote_share, y: enacted.seat_share }];
    marks.push(
      Plot.dot(e, { x: "x", y: "y", r: 6, fill: "#c0392b", stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(e, {
        x: "x", y: "y",
        text: () => `Enacted (${enacted.vote_share.toFixed(1)}%, ${enacted.seat_share.toFixed(1)}%)`,
        dx: 10, dy: -10, textAnchor: "start",
        fill: "#c0392b", fontWeight: 700, fontSize: 11,
      })
    );
  }
  return marks;
}

function buildPlotConfig(dims, marks) {
  return {
    width: dims.width,
    height: Math.max(dims.height - 30, 200),
    inset: 10,
    grid: true,
    marginLeft: 60,
    marginBottom: 50,
    style: { fontFamily: "Verdana, sans-serif", fontSize: "12px", background: "transparent", color: "#000" },
    x: { label: "Democratic Vote Share (%)", domain: [0, 100], tickFormat: d => `${d}%`, labelAnchor: "center", labelOffset: 40 },
    y: { label: "Democratic Seat Share (%)", domain: [0, 100], tickFormat: d => `${d}%`, labelAnchor: "center", labelOffset: 56 },
    marks,
  };
}

export default function VoteSeatChart({ data }) {
  const containerRef = useRef();
  const plotRef = useRef();
  const [dims, setDims] = useState({ width: 600, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDims({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!data || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width > 0 && height > 0) setDims({ width, height });
  }, [data]);

  useEffect(() => {
    if (!plotRef.current || !data) return;
    plotRef.current.innerHTML = "";
    const curve = data.curve || data.dem_curve || [];
    const enacted = data.enacted;
    const plot = Plot.plot(buildPlotConfig(dims, buildMarks(curve, enacted)));
    plotRef.current.appendChild(plot);
  }, [data, dims]);

  if (!data) {
    return <div className="placeholder-card">No vote-seat data available</div>;
  }

  return (
    <div ref={containerRef} className="vote-seat-container">
      <div className="vote-seat-legend">
        <span><span className="vote-seat-legend-line vote-seat-legend-line--dem" />Seats-Votes Curve (D)</span>
        <span><span className="vote-seat-legend-line vote-seat-legend-line--prop" />Proportional (vote = seat)</span>
        <span><span className="vote-seat-legend-dot" />Enacted Plan</span>
      </div>
      <div ref={plotRef} className="vote-seat-plot" />
    </div>
  );
}
