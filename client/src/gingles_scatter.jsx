import React, { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

const GROUP_LABELS = {
  hispanic: "Hispanic",
  black: "Black",
  asian: "Asian",
};

const GinglessScatterPlot = ({ points, regression, group }) => {
  const containerRef = useRef();
  const plotRef = useRef();
  const [width, setWidth] = useState(600);

  // Track container width responsively
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!plotRef.current) return;
    plotRef.current.innerHTML = "";

    if (!points || points.length === 0) {
      return;
    }

    const groupLabel = GROUP_LABELS[group] || group;

    const marks = [
      // Dem vote scatter (blue)
      Plot.dot(points, {
        x: d => d.minority_vap_pct * 100,
        y: d => d.d_vote_share * 100,
        fill: "steelblue",
        fillOpacity: 0.18,
        r: 2.5,
      }),
      // Rep vote scatter (red) — mirror of Dem
      Plot.dot(points, {
        x: d => d.minority_vap_pct * 100,
        y: d => (1 - d.d_vote_share) * 100,
        fill: "tomato",
        fillOpacity: 0.18,
        r: 2.5,
      }),
    ];

    // Add regression curves if available
    if (regression && regression.length > 0) {
      marks.push(
        Plot.line(regression, {
          x: d => d.x * 100,
          y: d => d.y * 100,
          stroke: "steelblue",
          strokeWidth: 2.5,
          curve: "catmull-rom",
        })
      );
      // Mirror regression for Rep
      marks.push(
        Plot.line(regression, {
          x: d => d.x * 100,
          y: d => (1 - d.y) * 100,
          stroke: "tomato",
          strokeWidth: 2.5,
          curve: "catmull-rom",
        })
      );
    }

    // 50% threshold line
    marks.push(
      Plot.ruleY([50], { stroke: "#999", strokeDasharray: "4,4", strokeWidth: 1 })
    );

    const plot = Plot.plot({
      width: width,
      height: Math.round(width * 0.55),
      inset: 10,
      grid: true,
      style: { fontFamily: "Inter, sans-serif", fontSize: "12px", background: "transparent" },
      x: {
        label: `% ${groupLabel} VAP in precinct`,
        tickFormat: d => `${d}%`,
        domain: [0, 100],
      },
      y: {
        label: "Party Vote Share (%)",
        domain: [0, 100],
      },
      marks,
    });

    plotRef.current.appendChild(plot);
  }, [points, regression, group, width]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginBottom: "4px", fontSize: "11px" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "steelblue", marginRight: 4 }} />Dem Vote Share</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "tomato", marginRight: 4 }} />Rep Vote Share</span>
        {regression && regression.length > 0 && (
          <span><span style={{ display: "inline-block", width: 16, height: 2, background: "steelblue", marginRight: 4, verticalAlign: "middle" }} />Regression</span>
        )}
      </div>
      <div ref={plotRef} />
    </div>
  );
};

export default GinglessScatterPlot;
