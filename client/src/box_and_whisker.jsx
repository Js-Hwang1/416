import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

export default function BoxPlotChart({ boxData, enactedData }) {
  const svgRef = useRef();
  const containerRef = useRef();
  const [selectedGroup, setSelectedGroup] = useState("hispanic");
  const [dims, setDims] = useState({ width: 800, height: 400 });

  const GROUP_LABELS = { hispanic: "Hispanic", black: "Black", asian: "Asian" };
  const minorityGroups = ["hispanic", "black", "asian"];

  const districts = boxData?.[selectedGroup] ?? [];

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
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
    if (!districts || districts.length === 0) return;

    const width = dims.width;
    const height = dims.height;
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
        Math.max(0, d3.min(districts, d => d.min) - 2),
        d3.max(districts, d => d.max) + 2
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
      .attr("height", d => Math.max(0, y(d.lqr) - y(d.hqr)))
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

    // Enacted plan dots — use real enacted demographics
    const enactedDistricts = enactedData?.districts;
    let enactedDots = [];
    if (enactedDistricts) {
      const sorted = [...enactedDistricts]
        .map(ed => ({
          district: ed.district,
          pct: ed.groups?.[selectedGroup]?.pct ?? 0,
        }))
        .sort((a, b) => a.pct - b.pct);
      enactedDots = districts.map((d, i) => ({
        district: d.district,
        value: i < sorted.length ? sorted[i].pct : d.median,
      }));
    } else {
      enactedDots = districts.map(d => ({
        district: d.district,
        value: d.median * 1.05,
      }));
    }

    g.selectAll(".enacted-dot")
      .data(enactedDots)
      .join("circle")
      .attr("cx", d => x(d.district) + x.bandwidth() / 2)
      .attr("cy", d => y(d.value))
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
      .style("font-family", "'Verdana', sans-serif")
      .style("font-size", "10px")
      .style("fill", "#666");

    // X Axis label
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 8)
      .attr("text-anchor", "middle")
      .style("font-family", "'Verdana', sans-serif")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", "#888")
      .text("Districts (ordered by increasing % of selected group)");

    // Y Axis
    svg
      .append("g")
      .attr("transform", `translate(${marginLeft},0)`)
      .call(d3.axisLeft(y).ticks(8).tickFormat(d => `${d}%`).tickSize(-width + marginLeft + marginRight))
      .call(g => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll(".tick line").attr("stroke", "#f0f0f0");
        g.selectAll(".tick text")
          .style("font-family", "'Verdana', sans-serif")
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
      .style("font-family", "'Verdana', sans-serif")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", "#888")
      .text(`${GROUP_LABELS[selectedGroup] || selectedGroup} Population %`);

  }, [districts, selectedGroup, enactedData, dims]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="chart-controls">
        <span className="chart-controls-label">Group:</span>
        {minorityGroups.map(group => (
          <button
            key={group}
            className={`chart-control-btn${selectedGroup === group ? " active" : ""}`}
            onClick={() => setSelectedGroup(group)}
          >
            {GROUP_LABELS[group] || group}
          </button>
        ))}
      </div>
      <div className="chart-legend">
        <div className="chart-legend-item">
          <span className="chart-legend-box" style={{ background: "#c8d0da" }}></span>
          IQR (25th-75th)
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
      <div ref={containerRef} style={{ flex: 1, minHeight: 0 }}>
        <svg ref={svgRef} />
      </div>
    </div>
  );
}
