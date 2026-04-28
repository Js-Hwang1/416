import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

const CANDIDATE_COLORS = {
  0: "rgba(100, 170, 160, 0.85)",
  1: "rgba(200, 170, 80, 0.85)",
};

const CANDIDATE_TO_PARTY = {
  "Harris (D)": "Democratic",
  "Trump (R)": "Republican",
};

export default function EISupportSummary({ data }) {
  const containerRef = useRef();
  const svgRef = useRef();
  const [dims, setDims] = useState({ width: 600, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDims({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;
    d3.select(svgRef.current).selectAll("*").remove();

    const { width, height } = dims;
    const marginTop = 20;
    const marginRight = 30;
    const marginBottom = 60;
    const marginLeft = 55;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const candidates = data[0]?.candidates?.map((c) => c.candidate) || [];
    const groups = data.map((d) => d.group);

    const x0 = d3
      .scaleBand()
      .domain(groups)
      .range([marginLeft, width - marginRight])
      .padding(0.3);

    const x1 = d3
      .scaleBand()
      .domain(candidates)
      .range([0, x0.bandwidth()])
      .padding(0.1);

    const y = d3
      .scaleLinear()
      .domain([0, 100])
      .range([height - marginBottom, marginTop]);

    const g = svg.append("g");

    for (const groupData of data) {
      for (let ci = 0; ci < groupData.candidates.length; ci++) {
        const cand = groupData.candidates[ci];
        const barX = x0(groupData.group) + x1(cand.candidate);
        const barW = x1.bandwidth();

        g.append("rect")
          .attr("x", barX)
          .attr("width", barW)
          .attr("y", y(cand.support))
          .attr("height", y(0) - y(cand.support))
          .attr("fill", CANDIDATE_COLORS[ci] || "#888")
          .attr("rx", 2);

        // Error bar
        const mid = barX + barW / 2;
        const capW = barW * 0.4;
        g.append("line")
          .attr("x1", mid).attr("x2", mid)
          .attr("y1", y(cand.ci_upper)).attr("y2", y(cand.ci_lower))
          .attr("stroke", "#333").attr("stroke-width", 1.5);
        g.append("line")
          .attr("x1", mid - capW / 2).attr("x2", mid + capW / 2)
          .attr("y1", y(cand.ci_upper)).attr("y2", y(cand.ci_upper))
          .attr("stroke", "#333").attr("stroke-width", 1.5);
        g.append("line")
          .attr("x1", mid - capW / 2).attr("x2", mid + capW / 2)
          .attr("y1", y(cand.ci_lower)).attr("y2", y(cand.ci_lower))
          .attr("stroke", "#333").attr("stroke-width", 1.5);

        // Value label — position above the error bar cap
        const labelY = Math.min(y(cand.support), y(cand.ci_upper)) - 10;
        g.append("text")
          .attr("x", mid)
          .attr("y", labelY)
          .attr("text-anchor", "middle")
          .style("font-family", "'Verdana', sans-serif")
          .style("font-size", "13px")
          .style("font-weight", "700")
          .style("fill", "#111")
          .text(`${cand.support}%`);
      }
    }

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x0).tickSize(0))
      .call((g) => g.select(".domain").attr("stroke", "#ccc"))
      .selectAll("text")
      .style("font-family", "'Verdana', sans-serif")
      .style("font-size", "11px")
      .style("fill", "#000").style("font-weight", "700");

    // Y Axis
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`)
          .tickSize(-width + marginLeft + marginRight)
      )
      .call((g) => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll(".tick line").attr("stroke", "#f0f0f0");
        g.selectAll(".tick text")
          .style("font-family", "'Verdana', sans-serif")
          .style("font-size", "10px")
          .style("fill", "#000").style("font-weight", "700");
      });

    // Y Axis label
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 14)
      .attr("text-anchor", "middle")
      .style("font-family", "'Verdana', sans-serif")
      .style("font-size", "11px")
      .style("font-weight", "700")
      .style("fill", "#000").style("font-weight", "700")
      .text("Estimated Support (%)");

    // Legend
    const legend = svg
      .append("g")
      .attr("transform", `translate(${marginLeft + 10}, ${height - 18})`);
    candidates.forEach((cand, i) => {
      const lg = legend.append("g").attr("transform", `translate(${i * 160}, 0)`);
      lg.append("rect")
        .attr("width", 12).attr("height", 12)
        .attr("fill", CANDIDATE_COLORS[i] || "#888");
      lg.append("text")
        .attr("x", 16).attr("y", 10)
        .style("font-family", "'Verdana', sans-serif")
        .style("font-size", "10px")
        .style("fill", "#555")
        .text(CANDIDATE_TO_PARTY[cand] || cand);
    });
  }, [data, dims]);

  if (!data || data.length === 0) {
    return <div className="placeholder-card">No EI summary data available</div>;
  }

  return (
    <div ref={containerRef} style={{ width: "100%", flex: 1, minHeight: 0 }}>
      <svg ref={svgRef} />
    </div>
  );
}
