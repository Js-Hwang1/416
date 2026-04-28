import React, { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

function buildCurveData(data) {
  const demCurve = data.dem_curve || data.curve || [];
  const repCurve = data.rep_curve || demCurve.map(d => ({
    vote_share: 100 - d.vote_share,
    seat_share: 100 - d.seat_share,
  }));
  return { demCurve, repCurve };
}

function buildMarks(demCurve, repCurve) {
  return [
    // proportional representation reference line
    Plot.line([{ x: 0, y: 0 }, { x: 100, y: 100 }], {
      x: "x", y: "y", stroke: "#ccc", strokeDasharray: "4,4", strokeWidth: 1,
    }),
    // 50% reference lines
    Plot.ruleX([50], { stroke: "#ddd", strokeWidth: 1 }),
    Plot.ruleY([50], { stroke: "#ddd", strokeWidth: 1 }),
    // vote-seat curves
    Plot.line(demCurve, { x: "vote_share", y: "seat_share", stroke: "#2c7bb6", strokeWidth: 2.5, curve: "catmull-rom" }),
    Plot.line(repCurve, { x: "vote_share", y: "seat_share", stroke: "#c0392b", strokeWidth: 2.5, curve: "catmull-rom" }),
  ];
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
    x: { label: "Party Vote Share (%)", domain: [0, 100], tickFormat: d => `${d}%`, labelAnchor: "center", labelOffset: 40 },
    y: { label: "Party Seat Share (%)", domain: [0, 100], tickFormat: d => `${d}%`, labelAnchor: "center", labelOffset: 56 },
    marks,
  };
}

export default function VoteSeatChart({ data }) {
  const containerRef = useRef();
  const plotRef = useRef();
  const [dims, setDims] = useState({ width: 600, height: 400 });

  // Boilerplate to make the chart resizable
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
    if (!plotRef.current || !data) return;
    plotRef.current.innerHTML = ""; // clean up old svg from Plot
    const { demCurve, repCurve } = buildCurveData(data);
    const plot = Plot.plot(buildPlotConfig(dims, buildMarks(demCurve, repCurve)));
    plotRef.current.appendChild(plot);
  }, [data, dims]);

  if (!data) {
    return <div className="placeholder-card">No vote-seat data available</div>;
  }

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", alignItems: "center", marginTop: "12px", marginBottom: "6px", fontSize: "11px", flexShrink: 0 }}>
        <span><span style={{ display: "inline-block", width: 16, height: 2, background: "#2c7bb6", marginRight: 4, verticalAlign: "middle" }} />Democratic</span>
        <span><span style={{ display: "inline-block", width: 16, height: 2, background: "#c0392b", marginRight: 4, verticalAlign: "middle" }} />Republican</span>
        <span><span style={{ display: "inline-block", width: 16, height: 2, background: "#ccc", marginRight: 4, verticalAlign: "middle", borderBottom: "1px dashed #ccc" }} />Proportional</span>
      </div>
      <div ref={plotRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
