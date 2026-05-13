import React, { useState, useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";

const DISPLAY_NAME = { Hispanic: "Latino", White: "White", Black: "Black", Asian: "Asian" };
const displayName = (key) => DISPLAY_NAME[key] || key;

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

const PCT_BINS = 101;

// PMF of (X - Y) on integer support [-100,100] assuming independence.
function computeDifference(f1, f2) {
  const a = new Array(PCT_BINS).fill(0);
  const b = new Array(PCT_BINS).fill(0);
  f1.forEach(p => { if (p.x >= 0 && p.x < PCT_BINS) a[p.x] = p.y; });
  f2.forEach(p => { if (p.x >= 0 && p.x < PCT_BINS) b[p.x] = p.y; });
  const sa = a.reduce((s, v) => s + v, 0);
  const sb = b.reduce((s, v) => s + v, 0);
  if (sa > 0) for (let i = 0; i < PCT_BINS; i++) a[i] /= sa;
  if (sb > 0) for (let i = 0; i < PCT_BINS; i++) b[i] /= sb;

  const out = [];
  for (let d = -100; d <= 100; d++) {
    let s = 0;
    for (let y = 0; y < PCT_BINS; y++) {
      const x = d + y;
      if (x >= 0 && x < PCT_BINS) s += a[x] * b[y];
    }
    // Convert to density on x in [-1,1]: bin width 0.01, so density = pmf / 0.01 = pmf * 100
    out.push({ x: d / 100, y: s * 100 });
  }
  return out;
}

// Trapezoidal integral of density from `threshold` to 1.
function probAboveThreshold(diffData, threshold) {
  let s = 0;
  for (let i = 1; i < diffData.length; i++) {
    const a = diffData[i - 1];
    const b = diffData[i];
    if (b.x <= threshold) continue;
    if (a.x < threshold) {
      const t = (threshold - a.x) / (b.x - a.x);
      const yAtT = a.y + (b.y - a.y) * t;
      s += 0.5 * (yAtT + b.y) * (b.x - threshold);
    } else {
      s += 0.5 * (a.y + b.y) * (b.x - a.x);
    }
  }
  return s;
}

export default function EIKDEChart({ data, candidateName = "Democratic Candidate" }) {
  const allGroups = data ? Object.keys(data) : [];
  const [group1, setGroup1] = useState("");
  const [group2, setGroup2] = useState("");
  const [threshold, setThreshold] = useState(0.4);
  const containerRef = useRef();
  const svgRef = useRef();
  const [dims, setDims] = useState({ width: 600, height: 400 });

  useEffect(() => {
    if (allGroups.length >= 2 && !group1 && !group2) {
      setGroup1(allGroups[0]);
      setGroup2(allGroups[1]);
    }
  }, [allGroups.length, group1, group2]);

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
    if (!data || !containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    if (width > 0 && height > 0) setDims({ width, height });
  }, [data]);

  const diffData = useMemo(() => {
    if (!data || !group1 || !group2) return null;
    const d1 = data[group1];
    const d2 = data[group2];
    if (!d1 || !d2) return null;
    return computeDifference(d1, d2);
  }, [data, group1, group2]);

  useEffect(() => {
    if (!svgRef.current || !diffData) return;
    d3.select(svgRef.current).selectAll("*").remove();

    const { width, height } = dims;
    const margin = { top: 35, right: 20, bottom: 50, left: 55 };
    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height);

    const maxY = d3.max(diffData, d => d.y) || 1;
    const x = d3.scaleLinear().domain([-1, 1]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, maxY * 1.1]).range([height - margin.bottom, margin.top]);

    // Shaded "above threshold" region
    svg.append("rect")
       .attr("x", x(threshold))
       .attr("y", margin.top)
       .attr("width", x(1) - x(threshold))
       .attr("height", height - margin.bottom - margin.top)
       .attr("fill", "rgba(180,180,180,0.35)");

    const area = d3.area().x(d => x(d.x)).y0(height - margin.bottom).y1(d => y(d.y)).curve(d3.curveBasis);
    const line = d3.line().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveBasis);

    svg.append("path").datum(diffData).attr("d", area).attr("fill", "rgba(70,130,180,0.45)");
    svg.append("path").datum(diffData).attr("d", line).attr("fill", "none")
       .attr("stroke", "rgba(40,90,140,1)").attr("stroke-width", 2);

    const prob = probAboveThreshold(diffData, threshold);
    svg.append("text")
       .attr("x", x(threshold) + 8)
       .attr("y", margin.top + 25)
       .call(applyTickStyle)
       .text(`Prob (difference > ${threshold.toFixed(2)}) = ${(prob * 100).toFixed(1)}%`);

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickValues([-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1])
                              .tickFormat(d3.format(".2f")))
      .call(g => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll(".tick text").call(applyTickStyle);
      });

    svg.append("text")
      .attr("x", (width - margin.left - margin.right) / 2 + margin.left)
      .attr("y", height - 8)
      .attr("text-anchor", "middle")
      .call(applyLabelStyle)
      .text(`(${displayName(group1)} - ${displayName(group2)}) support for ${candidateName}`);

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-width + margin.left + margin.right))
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
      .text("Density");

    svg.append("text")
      .attr("x", (width - margin.left - margin.right) / 2 + margin.left)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .style("font-family", "'Verdana', sans-serif")
      .style("font-size", "13px")
      .style("font-weight", "700")
      .style("fill", "#000")
      .text(`Polarization KDE for ${candidateName}`);
  }, [diffData, dims, threshold, group1, group2, candidateName]);

  if (!data || allGroups.length < 2) {
    return <div className="placeholder-card">No KDE data available</div>;
  }

  return (
    <div className="ei-kde-container">
      <div className="chart-controls">
        <span className="chart-controls-label">Group 1:</span>
        <select className="heatmap-group-select" value={group1} onChange={e => setGroup1(e.target.value)}>
          {allGroups.map(g => <option key={g} value={g}>{displayName(g)}</option>)}
        </select>
        <span className="chart-controls-label chart-controls-label--spaced">Group 2:</span>
        <select className="heatmap-group-select" value={group2} onChange={e => setGroup2(e.target.value)}>
          {allGroups.map(g => <option key={g} value={g}>{displayName(g)}</option>)}
        </select>
        <span className="chart-controls-label chart-controls-label--spaced">Threshold:</span>
        <select className="heatmap-group-select" value={threshold} onChange={e => setThreshold(Number(e.target.value))}>
          {[0.2, 0.3, 0.4, 0.5, 0.6].map(t => <option key={t} value={t}>{t.toFixed(2)}</option>)}
        </select>
      </div>
      <div ref={containerRef} className="ei-kde-plot-wrapper">
        <svg ref={svgRef} style={{ display: "block" }} />
      </div>
    </div>
  );
}
