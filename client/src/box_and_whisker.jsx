import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

export default function BoxPlotChart({ districts }) {
  const svgRef = useRef();
  const [selectedGroup, setSelectedGroup] = useState("Hispanic");
  
  const minorityGroups = ["Hispanic", "Black", "Asian", "Native American"];

  useEffect(() => {
    if (!districts || districts.length === 0) return;

    const width = 1000;
    const height = 420;
    const marginTop = 20;
    const marginRight = 30;
    const marginBottom = 50;
    const marginLeft = 60;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "auto");

    const x = d3
      .scaleBand()
      .domain(districts.map(d => d.district))
      .range([marginLeft, width - marginRight])
      .padding(0.4);

    const y = d3
      .scaleLinear()
      .domain([
        d3.min(districts, d => d.min),
        d3.max(districts, d => d.max)
      ])
      .nice()
      .range([height - marginBottom, marginTop]);

    const g = svg.append("g");

    // Whiskers (min to max)
    g.selectAll(".whisker")
      .data(districts)
      .join("line")
      .attr("x1", d => x(d.district) + x.bandwidth() / 2)
      .attr("x2", d => x(d.district) + x.bandwidth() / 2)
      .attr("y1", d => y(d.min))
      .attr("y2", d => y(d.max))
      .attr("stroke", "#888");

    // Whisker caps
    g.selectAll(".cap-min")
      .data(districts)
      .join("line")
      .attr("x1", d => x(d.district) + x.bandwidth() * 0.15)
      .attr("x2", d => x(d.district) + x.bandwidth() * 0.85)
      .attr("y1", d => y(d.min))
      .attr("y2", d => y(d.min))
      .attr("stroke", "#888");

    g.selectAll(".cap-max")
      .data(districts)
      .join("line")
      .attr("x1", d => x(d.district) + x.bandwidth() * 0.15)
      .attr("x2", d => x(d.district) + x.bandwidth() * 0.85)
      .attr("y1", d => y(d.max))
      .attr("y2", d => y(d.max))
      .attr("stroke", "#888");

    // Box (Q1 to Q3)
    g.selectAll(".box")
      .data(districts)
      .join("rect")
      .attr("x", d => x(d.district))
      .attr("width", x.bandwidth())
      .attr("y", d => y(d.hqr))
      .attr("height", d => y(d.lqr) - y(d.hqr))
      .attr("fill", "#c8d0da")
      .attr("stroke", "#667")
      .attr("stroke-width", 0.8);

    // Median line
    g.selectAll(".median")
      .data(districts)
      .join("line")
      .attr("x1", d => x(d.district))
      .attr("x2", d => x(d.district) + x.bandwidth())
      .attr("y1", d => y(d.median))
      .attr("y2", d => y(d.median))
      .attr("stroke", "#1a1a1a")
      .attr("stroke-width", 1.8);

    // Enacted plan dots (dummy: use median * 1.05 as placeholder)
    g.selectAll(".enacted-dot")
      .data(districts)
      .join("circle")
      .attr("cx", d => x(d.district) + x.bandwidth() / 2)
      .attr("cy", d => y(d.median * 1.05))
      .attr("r", 3.5)
      .attr("fill", "#c0392b")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.8);

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - marginBottom})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call(g => g.select(".domain").attr("stroke", "#ccc"))
      .selectAll("text")
      .style("font-family", "'Inter', sans-serif")
      .style("font-size", "10px")
      .style("fill", "#666");

    // X Axis label
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 8)
      .attr("text-anchor", "middle")
      .style("font-family", "'Inter', sans-serif")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", "#888")
      .text("Districts (ordered by increasing % of selected group)");

    // Y Axis
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).ticks(8).tickSize(-width + marginLeft + marginRight))
      .call(g => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll(".tick line").attr("stroke", "#f0f0f0");
        g.selectAll(".tick text")
          .style("font-family", "'Inter', sans-serif")
          .style("font-size", "10px")
          .style("fill", "#666");
      });

    // Y Axis label
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 14)
      .attr("text-anchor", "middle")
      .style("font-family", "'Inter', sans-serif")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", "#888")
      .text(`${selectedGroup} Population %`);

  }, [districts, selectedGroup]);

  return (
    <div style={{ width: "100%" }}>
      <div className="chart-controls">
        <span className="chart-controls-label">Group:</span>
        {minorityGroups.map(group => (
          <button
            key={group}
            className={`chart-control-btn${selectedGroup === group ? " active" : ""}`}
            onClick={() => setSelectedGroup(group)}
          >
            {group}
          </button>
        ))}
      </div>
      <div className="chart-legend">
        <div className="chart-legend-item">
          <span className="chart-legend-box" style={{ background: "#c8d0da" }}></span>
          IQR (25th–75th)
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-line" style={{ background: "#1a1a1a" }}></span>
          Median
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-line" style={{ background: "#888" }}></span>
          Min / Max
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-dot" style={{ background: "#c0392b" }}></span>
          Enacted Plan
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg ref={svgRef} />
      </div>
    </div>
  );
}
