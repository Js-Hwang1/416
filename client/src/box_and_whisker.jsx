import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

export default function BoxPlotChart({ districts }) {
  const svgRef = useRef();
  const [selectedGroup, setSelectedGroup] = useState("Hispanic");
  
  // Available minority groups (would come from props in real app)
  const minorityGroups = ["Hispanic", "Black", "Asian", "Native American"];

  useEffect(() => {
    if (!districts || districts.length === 0) return;

    const width = 1000;
    const height = 500;
    const marginTop = 40;
    const marginRight = 40;
    const marginBottom = 60;
    const marginLeft = 70;

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "auto")
      .style("font", "12px sans-serif");

    // X scale (district index)
    const x = d3
      .scaleBand()
      .domain(districts.map(d => d.district))
      .range([marginLeft, width - marginRight])
      .padding(0.4);

    // Y scale (percentage values)
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
      .attr("stroke", "black");

    // Box (Q1 to Q3)
    g.selectAll(".box")
      .data(districts)
      .join("rect")
      .attr("x", d => x(d.district))
      .attr("width", x.bandwidth())
      .attr("y", d => y(d.hqr))
      .attr("height", d => y(d.lqr) - y(d.hqr))
      .attr("fill", "#d9d9d9")
      .attr("stroke", "black");

    // Median line
    g.selectAll(".median")
      .data(districts)
      .join("line")
      .attr("x1", d => x(d.district))
      .attr("x2", d => x(d.district) + x.bandwidth())
      .attr("y1", d => y(d.median))
      .attr("y2", d => y(d.median))
      .attr("stroke", "black")
      .attr("stroke-width", 2);

    // X Axis
    svg
      .append("g")
      .attr(
        "transform",
        `translate(0,${height - marginBottom})`
      )
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("font-family", "'Inter', sans-serif")
      .style("font-size", "11px");
    
    // X Axis label
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .style("font-family", "'Inter', sans-serif")
      .style("font-size", "13px")
      .style("font-weight", "600")
      .style("fill", "#333")
      .text("Districts");

    // Y Axis
    svg
      .append("g")
      .attr(
        "transform",
        `translate(${marginLeft},0)`
      )
      .call(d3.axisLeft(y).ticks(8))
      .selectAll("text")
      .style("font-family", "'Inter', sans-serif")
      .style("font-size", "11px");
    
    // Y Axis label
    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .style("font-family", "'Inter', sans-serif")
      .style("font-size", "13px")
      .style("font-weight", "600")
      .style("fill", "#333")
      .text("Minority Group Percentage");

  }, [districts]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ 
        marginBottom: "20px", 
        padding: "16px", 
        background: "#f7f8fa", 
        border: "1px solid #e0e0e0",
        borderRadius: "2px"
      }}>
        <div style={{ 
          fontFamily: "'Inter', sans-serif", 
          fontSize: "0.75rem", 
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "1px",
          color: "#333",
          marginBottom: "12px"
        }}>
          Select Minority Group:
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {minorityGroups.map(group => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              style={{
                padding: "8px 16px",
                background: selectedGroup === group ? "#1a1a1a" : "#fff",
                color: selectedGroup === group ? "#fff" : "#333",
                border: "1px solid #ccc",
                borderColor: selectedGroup === group ? "#1a1a1a" : "#ccc",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.8rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                if (selectedGroup !== group) {
                  e.target.style.borderColor = "#888";
                }
              }}
              onMouseLeave={(e) => {
                if (selectedGroup !== group) {
                  e.target.style.borderColor = "#ccc";
                }
              }}
            >
              {group}
            </button>
          ))}
        </div>
        <div style={{
          marginTop: "12px",
          fontFamily: "'Inter', sans-serif",
          fontSize: "0.75rem",
          color: "#666"
        }}>
          Currently viewing: <strong>{selectedGroup}</strong> distribution across ensemble plans
        </div>
      </div>
      <div style={{ 
        background: "#fff", 
        padding: "30px 20px", 
        border: "1px solid #e0e0e0",
        display: "flex",
        justifyContent: "center"
      }}>
        <svg ref={svgRef} />
      </div>
    </div>
  );
}
