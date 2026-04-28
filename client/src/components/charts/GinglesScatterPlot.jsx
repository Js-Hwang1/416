import React, { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

const GROUP_LABELS = { hispanic: "Latino", black: "Black", asian: "Asian" };

// Each pair produces one dem (steelblue) mark and one rep (tomato) mark
function partyDots(data, opts) {
  return [
    Plot.dot(data, { x: d => d.x * 100, y: d => d.y * 100,         fill: "steelblue", ...opts }),
    Plot.dot(data, { x: d => d.x * 100, y: d => (1 - d.y) * 100,   fill: "tomato",    ...opts }),
  ];
}

function partyLines(data) {
  const lineOpts = { x: d => d.x * 100, strokeWidth: 2.5, curve: "catmull-rom", clip: true };
  return [
    Plot.line(data, { ...lineOpts, y: d => d.y * 100,         stroke: "steelblue" }),
    Plot.line(data, { ...lineOpts, y: d => (1 - d.y) * 100,   stroke: "tomato"    }),
  ];
}

function buildRegressionPoints(coeffs) {
  const evalPoly = (x) => coeffs.reduce((sum, c, i) => sum + c * Math.pow(x, i), 0);
  return Array.from({ length: 200 }, (_, i) => {
    const x = i / 199;
    return { x, y: evalPoly(x) };
  });
}

const GinglesScatterPlot = ({ points, regression, group, selectedIdx, onPointClick }) => {
  const containerRef = useRef();
  const plotRef = useRef();
  const [dims, setDims] = useState({ width: 600, height: 350 });

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
    if (!plotRef.current) return;
    plotRef.current.innerHTML = "";
    if (!points || points.length === 0) return;

    const marks = [
      // --- scatter points ---
      ...partyDots(points, { fillOpacity: 0.18, r: 2.5, clip: true }),

      // --- selected point highlight ---
      ...(selectedIdx != null && points[selectedIdx]
        ? partyDots([points[selectedIdx]], { stroke: "#000", strokeWidth: 2, r: 6, clip: true })
        : []),

      // --- regression lines ---
      ...(regression?.length > 0 ? partyLines(buildRegressionPoints(regression)) : []),

      // --- annotations ---
      Plot.ruleY([50], { stroke: "#999", strokeDasharray: "4,4", strokeWidth: 1 }),
      Plot.text([`${points.length.toLocaleString()} precincts`], {
        frameAnchor: "top", dy: -5, textAnchor: "middle",
        fill: "#555", fontSize: 12, fontFamily: "Verdana, sans-serif",
      }),
    ];

    const legendHeight = 36;
    const plot = Plot.plot({
      width: dims.width,
      height: Math.max(dims.height - legendHeight, 150),
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
    });

    plotRef.current.appendChild(plot);

    if (!onPointClick || points.length === 0) return;

    const svg = plotRef.current.querySelector("svg");
    if (!svg) return;
    svg.style.cursor = "crosshair";

    const handleClick = (e) => {
      const rect = svg.getBoundingClientRect();
      const svgX = e.clientX - rect.left;
      const svgY = e.clientY - rect.top;

      const inset = 10;
      const marginLeft = 40, marginRight = 20, marginTop = 20, marginBottom = 30;
      const innerW = dims.width - marginLeft - marginRight - 2 * inset;
      const innerH = Math.max(dims.height - legendHeight - marginTop - marginBottom - 2 * inset, 150);

      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const px = marginLeft + inset + points[i].x * innerW;
        const py = marginTop + inset + (1 - points[i].y) * innerH;
        const dist = Math.hypot(svgX - px, svgY - py);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
      if (bestIdx >= 0 && bestDist < 15) onPointClick(bestIdx);
    };

    svg.addEventListener("click", handleClick);
    return () => svg.removeEventListener("click", handleClick);
  }, [points, regression, group, dims, selectedIdx, onPointClick]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "14px", marginTop: "8px", fontSize: "11px" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "steelblue", marginRight: 4 }} />Dem Vote Share</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "tomato",    marginRight: 4 }} />Rep Vote Share</span>
        {regression?.length > 0 && (
          <span><span style={{ display: "inline-block", width: 16, height: 2, background: "steelblue", marginRight: 4, verticalAlign: "middle" }} />Regression</span>
        )}
      </div>
      <div ref={plotRef} />
    </div>
  );
};

export default GinglesScatterPlot;
