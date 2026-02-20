import { useRef, useEffect } from "react";
import * as d3 from "d3";

export default function BoxPlotChart({ districts }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!districts || districts.length === 0) return;

    const width = 928;
    const height = 600;
    const marginTop = 20;
    const marginRight = 20;
    const marginBottom = 50;
    const marginLeft = 60;

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
      .call(d3.axisBottom(x));
    
    // X Axis label
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)   // position below axis
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .text("Districts");

    // Y Axis
    svg
      .append("g")
      .attr(
        "transform",
        `translate(${marginLeft},0)`
      )
      .call(d3.axisLeft(y));

  }, [districts]);

  return <svg ref={svgRef} />;
}
