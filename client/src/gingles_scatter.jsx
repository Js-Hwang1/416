import React, { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

const GROUP_LABELS = {
  hispanic: "Latino",
  black: "Black",
  asian: "Asian",
};

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

    const groupLabel = GROUP_LABELS[group] || group;
    const clamp = (v) => Math.max(0, Math.min(v, 100));

    const marks = [
      Plot.dot(points, {
        x: d => clamp(d.x * 100),
        y: d => clamp(d.y * 100),
        fill: "steelblue",
        fillOpacity: 0.18,
        r: 2.5,
      }),
      Plot.dot(points, {
        x: d => clamp(d.x * 100),
        y: d => clamp((1 - d.y) * 100),
        fill: "tomato",
        fillOpacity: 0.18,
        r: 2.5,
      }),
    ];

    if (selectedIdx !== null && selectedIdx !== undefined && points[selectedIdx]) {
      const sel = points[selectedIdx];
      marks.push(
        Plot.dot([sel], {
          x: d => clamp(d.x * 100),
          y: d => clamp(d.y * 100),
          fill: "steelblue",
          stroke: "#000",
          strokeWidth: 2,
          r: 6,
        }),
        Plot.dot([sel], {
          x: d => clamp(d.x * 100),
          y: d => clamp((1 - d.y) * 100),
          fill: "tomato",
          stroke: "#000",
          strokeWidth: 2,
          r: 6,
        })
      );
    }

    if (regression?.length > 0) {
      const evalPoly = (x) => regression.reduce((sum, c, i) => sum + c * Math.pow(x, i), 0);
      const regPoints = Array.from({ length: 200 }, (_, i) => {
        const x = i / 199;
        return { x, y: evalPoly(x) };
      });
      marks.push(
        Plot.line(regPoints, {
          x: d => d.x * 100,
          y: d => clamp(d.y * 100),
          stroke: "steelblue",
          strokeWidth: 2.5,
          curve: "catmull-rom",
        }),
        Plot.line(regPoints, {
          x: d => d.x * 100,
          y: d => clamp((1 - d.y) * 100),
          stroke: "tomato",
          strokeWidth: 2.5,
          curve: "catmull-rom",
        })
      );
    }

    marks.push(
      Plot.ruleY([50], { stroke: "#999", strokeDasharray: "4,4", strokeWidth: 1 }),
      Plot.text([`${points.length.toLocaleString()} precincts`], {
        frameAnchor: "top",
        dy: -5,
        textAnchor: "middle",
        fill: "#555",
        fontSize: 12,
        fontFamily: "Verdana, sans-serif",
      })
    );

    const legendHeight = 36;
    const plotHeight = dims.height - legendHeight;

    const plot = Plot.plot({
      width: dims.width,
      height: Math.max(plotHeight, 150),
      inset: 10,
      grid: true,
      marginLeft: 60,
      marginBottom: 50,
      style: { fontFamily: "Verdana, sans-serif", fontSize: "12px", background: "transparent", color: "#000" },
      x: {
        label: `Percent ${groupLabel}`,
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

      const plotWidth = dims.width;
      const legendH = 36;
      const ph = Math.max(Math.min(Math.round(plotWidth * 0.55), dims.height - legendH), 150);
      const inset = 10;
      const marginLeft = 40;
      const marginRight = 20;
      const marginTop = 20;
      const marginBottom = 30;
      const innerW = plotWidth - marginLeft - marginRight - 2 * inset;
      const innerH = ph - marginTop - marginBottom - 2 * inset;

      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < points.length; i++) {
        const px = marginLeft + inset + points[i].x * innerW;
        const py = marginTop + inset + (1 - points[i].y) * innerH;
        const dist = Math.hypot(svgX - px, svgY - py);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
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
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "tomato", marginRight: 4 }} />Rep Vote Share</span>
        {regression?.length > 0 && (
          <span><span style={{ display: "inline-block", width: 16, height: 2, background: "steelblue", marginRight: 4, verticalAlign: "middle" }} />Regression</span>
        )}
      </div>
      <div ref={plotRef} />
    </div>
  );
};

export default GinglesScatterPlot;
