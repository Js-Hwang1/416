import React, { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";
import * as d3 from "d3";

const GinglessScatterPlot = ({ data, group, onGroupChange }) => {
  const containerRef = useRef();
  const plotRef = useRef();
  const actualData = data?.precint_data || [];
  const groups = actualData?.length
    ? Object.keys(actualData[0]).filter(k => k.includes("_pct"))
    : [];

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
    if (!actualData.length || !plotRef.current) return;

    plotRef.current.innerHTML = "";

    // Aggregate data for trend lines
    const aggregated = d3.rollups(
      actualData,
      v => ({
        dem: d3.mean(v, d => d.dem_vote_share),
        rep: d3.mean(v, d => d.rep_vote_share)
      }),
      d => d[group]
    ).map(([percent, votes]) => ({
      [group]: percent,
      dem_vote_share: votes.dem,
      rep_vote_share: votes.rep
    }));

    const plot = Plot.plot({
      width: width,
      height: Math.round(width * 0.55),
      inset: 10,
      grid: true,
      style: { fontFamily: "Inter, sans-serif", fontSize: "12px", background: "transparent" },
      x: {
        label: `% ${group.replace("_pct", "").replace(/_/g, " ")} in precinct`,
        tickFormat: d => `${d}%`
      },
      y: { label: "Party Vote Share (%)", domain: [0, 100] },
      marks: [
        Plot.dot(actualData, { x: d => d[group], y: d => d.dem_vote_share, fill: "steelblue", fillOpacity: 0.25, r: 3 }),
        Plot.dot(actualData, { x: d => d[group], y: d => d.rep_vote_share, fill: "tomato", fillOpacity: 0.25, r: 3 }),
        Plot.line(aggregated, { x: group, y: "dem_vote_share", stroke: "steelblue", strokeWidth: 2.5, curve: "catmull-rom" }),
        Plot.line(aggregated, { x: group, y: "rep_vote_share", stroke: "tomato", strokeWidth: 2.5, curve: "catmull-rom" })
      ]
    });

    plotRef.current.appendChild(plot);
  }, [group, actualData, width]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
      <div ref={plotRef} />
    </div>
  );
};

export default GinglessScatterPlot;
