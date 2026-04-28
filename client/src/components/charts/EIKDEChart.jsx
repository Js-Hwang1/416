import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

const COLOR_MAP = {
  White: "rgba(60, 165, 165, 0.85)",
  Black: "rgba(200, 160, 50, 0.85)",
  Hispanic: "rgba(130, 90, 180, 0.85)",
  Asian: "rgba(120, 170, 100, 0.85)",
};

const FILL_MAP = {
  White: "rgba(60, 165, 165, 0.2)",
  Black: "rgba(200, 160, 50, 0.2)",
  Hispanic: "rgba(130, 90, 180, 0.2)",
  Asian: "rgba(120, 170, 100, 0.2)",
};

const DISPLAY_NAME = { Hispanic: "Latino", White: "White", Black: "Black", Asian: "Asian" };
const displayName = (key) => DISPLAY_NAME[key] || key;

export default function EIKDEChart({ data }) {
  const allGroups = data ? Object.keys(data) : [];
  const [group1, setGroup1] = useState("");
  const [group2, setGroup2] = useState("");
  const containerRef = useRef();
  const svgRef = useRef();
  const [dims, setDims] = useState({ width: 600, height: 400 });

  useEffect(() => {
    if (allGroups.length >= 2 && !group1 && !group2) {
      setGroup1(allGroups[0]);
      setGroup2(allGroups[1]);
    }
  }, [allGroups.length]);

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
    if (!svgRef.current || !data || !group1 || !group2) return;
    d3.select(svgRef.current).selectAll("*").remove();

    const { width, height } = dims;
    const marginTop = 15;
    const marginRight = 20;
    const marginBottom = 50;
    const marginLeft = 55;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    const d1 = data[group1] || [];
    const d2 = data[group2] || [];
    const allY = [...d1.map((d) => d.y), ...d2.map((d) => d.y)];
    const maxY = d3.max(allY) || 1;

    const x = d3
      .scaleLinear()
      .domain([0, 100])
      .range([marginLeft, width - marginRight]);

    const y = d3
      .scaleLinear()
      .domain([0, maxY * 1.1])
      .range([height - marginBottom, marginTop]);

    const area = d3
      .area()
      .x((d) => x(d.x))
      .y0(height - marginBottom)
      .y1((d) => y(d.y))
      .curve(d3.curveBasis);

    const line = d3
      .line()
      .x((d) => x(d.x))
      .y((d) => y(d.y))
      .curve(d3.curveBasis);

    // Draw fills
    if (d1.length) {
      svg.append("path")
        .datum(d1)
        .attr("d", area)
        .attr("fill", FILL_MAP[group1] || "rgba(128,128,128,0.2)");
      svg.append("path")
        .datum(d1)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", COLOR_MAP[group1] || "#888")
        .attr("stroke-width", 2);
    }
    if (d2.length) {
      svg.append("path")
        .datum(d2)
        .attr("d", area)
        .attr("fill", FILL_MAP[group2] || "rgba(128,128,128,0.2)");
      svg.append("path")
        .datum(d2)
        .attr("d", line)
        .attr("fill", "none")
        .attr("stroke", COLOR_MAP[group2] || "#888")
        .attr("stroke-width", 2);
    }

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat((d) => `${d}%`))
      .call((g) => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll(".tick text")
          .style("font-family", "'Verdana', sans-serif")
          .style("font-size", "10px")
          .style("fill", "#000").style("font-weight", "700");
      });

    // X label
    svg
      .append("text")
      .attr("x", (width - marginLeft - marginRight) / 2 + marginLeft)
      .attr("y", height - 8)
      .attr("text-anchor", "middle")
      .style("font-family", "'Verdana', sans-serif")
      .style("font-size", "11px")
      .style("font-weight", "700")
      .style("fill", "#000").style("font-weight", "700")
      .text("% Support for Democratic Candidate");

    // Y Axis
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(
        d3.axisLeft(y).ticks(5)
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

    // Y label
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
      .text("Density");

    // Legend
    const legend = svg.append("g")
      .attr("transform", `translate(${marginLeft + 10}, ${marginTop + 5})`);
    [group1, group2].forEach((grp, i) => {
      const lg = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
      lg.append("rect")
        .attr("width", 14).attr("height", 14)
        .attr("fill", COLOR_MAP[grp] || "#888")
        .attr("rx", 2);
      lg.append("text")
        .attr("x", 20).attr("y", 11)
        .style("font-family", "'Verdana', sans-serif")
        .style("font-size", "11px")
        .style("fill", "#000").style("font-weight", "700")
        .text(displayName(grp));
    });
  }, [data, group1, group2, dims]);

  if (!data || allGroups.length < 2) {
    return <div className="placeholder-card">No KDE data available</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="chart-controls">
        <span className="chart-controls-label">Group 1:</span>
        <select
          className="heatmap-group-select"
          value={group1}
          onChange={(e) => setGroup1(e.target.value)}
        >
          {allGroups.map((g) => (
            <option key={g} value={g}>{displayName(g)}</option>
          ))}
        </select>
        <span className="chart-controls-label" style={{ marginLeft: 16 }}>Group 2:</span>
        <select
          className="heatmap-group-select"
          value={group2}
          onChange={(e) => setGroup2(e.target.value)}
        >
          {allGroups.map((g) => (
            <option key={g} value={g}>{displayName(g)}</option>
          ))}
        </select>
      </div>
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        <svg ref={svgRef} />
      </div>
    </div>
  );
}
