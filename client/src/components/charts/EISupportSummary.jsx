import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const CANDIDATE_COLORS = {
  0: "rgba(100, 170, 160, 0.85)",
  1: "rgba(200, 170, 80, 0.85)",
};

const CANDIDATE_TO_PARTY = { "Harris (D)": "Democratic", "Trump (R)": "Republican" };

// D3 text style helpers — use with .call(applyLabelStyle) or .call(applyTickStyle)
const applyLabelStyle = (sel) =>
  sel.style("font-family", "'Verdana', sans-serif")
     .style("font-size", "11px")
     .style("font-weight", "700")
     .style("fill", "#000");

const applyTickStyle = (sel) =>
  sel.style("font-family", "'Verdana', sans-serif")
     .style("font-size", "10px")
     .style("font-weight", "700")
     .style("fill", "#000");

// Draws a vertical error bar with horizontal caps at yUpper and yLower
function drawErrorBar(g, midX, capWidth, yUpper, yLower) {
  const attrs = { stroke: "#333", "stroke-width": 1.5 };
  const line = (x1, x2, y1, y2) =>
    g.append("line").attr("x1", x1).attr("x2", x2).attr("y1", y1).attr("y2", y2).attr("stroke", attrs.stroke).attr("stroke-width", attrs["stroke-width"]);

  line(midX, midX, yUpper, yLower);                                    // vertical bar
  line(midX - capWidth / 2, midX + capWidth / 2, yUpper, yUpper);     // top cap
  line(midX - capWidth / 2, midX + capWidth / 2, yLower, yLower);     // bottom cap
}

export default function EISupportSummary({ data }) {
  const containerRef = useRef();
  const svgRef = useRef();
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
    if (!svgRef.current || !data || data.length === 0) return;
    d3.select(svgRef.current).selectAll("*").remove(); // clean up old svg

    const { width, height } = dims;
    const margin = { top: 20, right: 30, bottom: 60, left: 55 };

    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height);

    const candidates = data[0]?.candidates?.map(c => c.candidate) || [];
    const groups = data.map(d => d.group);

    const x0 = d3.scaleBand().domain(groups).range([margin.left, width - margin.right]).padding(0.3);
    const x1 = d3.scaleBand().domain(candidates).range([0, x0.bandwidth()]).padding(0.1);
    const y  = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);

    const g = svg.append("g");

    for (const groupData of data) {
      for (let ci = 0; ci < groupData.candidates.length; ci++) {
        const cand = groupData.candidates[ci];
        const barX = x0(groupData.group) + x1(cand.candidate);
        const barW = x1.bandwidth();
        const midX = barX + barW / 2;

        // Bar
        g.append("rect")
          .attr("x", barX).attr("width", barW)
          .attr("y", y(cand.support)).attr("height", y(0) - y(cand.support))
          .attr("fill", CANDIDATE_COLORS[ci] || "#888")
          .attr("rx", 2);

        // Error bar
        drawErrorBar(g, midX, barW * 0.4, y(cand.ci_upper), y(cand.ci_lower));

        // Value label above the error bar
        g.append("text")
          .attr("x", midX).attr("y", Math.min(y(cand.support), y(cand.ci_upper)) - 10)
          .attr("text-anchor", "middle")
          .style("font-family", "'Verdana', sans-serif")
          .style("font-size", "13px")
          .style("font-weight", "700")
          .style("fill", "#111")
          .text(`${cand.support}%`);
      }
    }

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x0).tickSize(0))
      .call(g => g.select(".domain").attr("stroke", "#ccc"))
      .selectAll("text").call(applyLabelStyle);

    // Y axis
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`).tickSize(-width + margin.left + margin.right))
      .call(g => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll(".tick line").attr("stroke", "#f0f0f0");
        g.selectAll(".tick text").call(applyTickStyle);
      });

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2)).attr("y", 14)
      .attr("text-anchor", "middle")
      .call(applyLabelStyle)
      .text("Estimated Support (%)");

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${margin.left + 10}, ${height - 18})`);
    candidates.forEach((cand, i) => {
      const lg = legend.append("g").attr("transform", `translate(${i * 160}, 0)`);
      lg.append("rect").attr("width", 12).attr("height", 12).attr("fill", CANDIDATE_COLORS[i] || "#888");
      lg.append("text").attr("x", 16).attr("y", 10)
        .style("font-family", "'Verdana', sans-serif").style("font-size", "10px").style("fill", "#555")
        .text(CANDIDATE_TO_PARTY[cand] || cand);
    });
  }, [data, dims]);

  if (!data || data.length === 0) {
    return <div className="placeholder-card">No EI summary data available</div>;
  }

  return (
    <div ref={containerRef} className="ei-support-container">
      <svg ref={svgRef} />
    </div>
  );
}
