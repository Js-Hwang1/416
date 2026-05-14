import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

// GUI-21: For each feasible racial/ethnic group (x-axis), draw two
// side-by-side box-and-whisker plots — one per ensemble (race-blind vs
// VRA-constrained) — of the per-plan minority-effective district count.
// Y-axis: number of effective districts. Inputs are the histograms we
// already serve in minorityBarsByVariant: per group's effective field,
// raceBlindData and vraData, each shaped [{count, freq}, ...].

const GROUP_DISPLAY = { Black: "Black", Hispanic: "Latino", Asian: "Asian" };

const RB = { fill: "rgba(70,160,100,0.55)", stroke: "rgba(40,120,60,1)", label: "Race-Blind" };
const VRA = { fill: "rgba(120,140,210,0.55)", stroke: "rgba(60,80,180,1)", label: "VRA-Constrained" };

const MARGIN = { top: 20, right: 30, bottom: 50, left: 60 };

// Compute (min, q1, median, q3, max) from a histogram [{count, freq}].
function fiveNum(hist) {
  if (!hist || !hist.length) return null;
  const sorted = [...hist].sort((a, b) => a.count - b.count);
  const total = sorted.reduce((s, r) => s + (r.freq || 0), 0);
  if (total === 0) return null;
  // Quantile interpolation: build the CDF and find counts at 25%, 50%, 75%.
  const qAt = (pct) => {
    const target = pct * total;
    let cum = 0;
    for (let i = 0; i < sorted.length; i++) {
      cum += sorted[i].freq;
      if (cum >= target) return sorted[i].count;
    }
    return sorted[sorted.length - 1].count;
  };
  return {
    min: sorted[0].count,
    lqr: qAt(0.25),
    median: qAt(0.5),
    hqr: qAt(0.75),
    max: sorted[sorted.length - 1].count,
  };
}

export default function MinorityEffectivenessBox({ data, numDistricts }) {
  const containerRef = useRef();
  const svgRef = useRef();
  const [dims, setDims] = useState({ width: 700, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        if (width > 0 && height > 0) setDims({ width, height });
      }
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const groupStats = useMemo(() => {
    if (!data) return [];
    const out = [];
    for (const g of Object.keys(GROUP_DISPLAY)) {
      const groupData = data[g];
      if (!groupData) continue;
      const eff = groupData.effective;
      if (!eff) continue;
      const rb = fiveNum(eff.raceBlindData);
      const vra = fiveNum(eff.vraData);
      out.push({
        group: g,
        label: GROUP_DISPLAY[g],
        rb,
        vra,
        enacted: eff.enacted,
      });
    }
    return out;
  }, [data]);

  useEffect(() => {
    if (!svgRef.current || !groupStats.length) return;
    const { width, height } = dims;
    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current).attr("width", width).attr("height", height);

    const x = d3.scaleBand()
      .domain(groupStats.map((g) => g.label))
      .range([MARGIN.left, width - MARGIN.right])
      .padding(0.3);

    const yMax = Math.max(
      numDistricts || 0,
      ...groupStats.flatMap((g) => [g.rb?.max ?? 0, g.vra?.max ?? 0, g.enacted ?? 0])
    );
    const y = d3.scaleLinear()
      .domain([0, Math.max(1, yMax + 1)])
      .range([height - MARGIN.bottom, MARGIN.top]);

    // Gridlines
    svg.append("g")
      .attr("transform", `translate(${MARGIN.left},0)`)
      .call(d3.axisLeft(y).ticks(Math.min(yMax + 1, 12)).tickSize(-width + MARGIN.left + MARGIN.right).tickFormat(""))
      .call((g) => {
        g.select(".domain").remove();
        g.selectAll(".tick line").attr("stroke", "#f0f0f0");
      });

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height - MARGIN.bottom})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((g) => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll(".tick text")
          .style("font-family", "'Verdana', sans-serif")
          .style("font-size", "11px")
          .style("font-weight", "700")
          .style("fill", "#000");
      });

    svg.append("text")
      .attr("x", (width - MARGIN.left - MARGIN.right) / 2 + MARGIN.left)
      .attr("y", height - 8)
      .attr("text-anchor", "middle")
      .style("font-family", "'Verdana', sans-serif")
      .style("font-size", "11px")
      .style("font-weight", "700")
      .style("fill", "#000")
      .text("Racial / Ethnic Group");

    // Y axis
    svg.append("g")
      .attr("transform", `translate(${MARGIN.left},0)`)
      .call(d3.axisLeft(y).ticks(Math.min(yMax + 1, 12)).tickFormat(d3.format("d")))
      .call((g) => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll(".tick text")
          .style("font-family", "'Verdana', sans-serif")
          .style("font-size", "10px")
          .style("font-weight", "700")
          .style("fill", "#000");
      });

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2))
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .style("font-family", "'Verdana', sans-serif")
      .style("font-size", "11px")
      .style("font-weight", "700")
      .style("fill", "#000")
      .text("Number of Minority-Effective Districts");

    // Two slots per group
    const slotW = x.bandwidth() / 2;
    const innerPad = slotW * 0.15;

    const drawBox = (cx, slotWidth, stats, palette) => {
      if (!stats) return;
      const boxX = cx - slotWidth / 2;
      const boxW = slotWidth;
      // Whisker
      svg.append("line")
        .attr("x1", cx).attr("x2", cx)
        .attr("y1", y(stats.min)).attr("y2", y(stats.max))
        .attr("stroke", palette.stroke);
      // Caps
      svg.append("line")
        .attr("x1", cx - boxW * 0.3).attr("x2", cx + boxW * 0.3)
        .attr("y1", y(stats.min)).attr("y2", y(stats.min))
        .attr("stroke", palette.stroke);
      svg.append("line")
        .attr("x1", cx - boxW * 0.3).attr("x2", cx + boxW * 0.3)
        .attr("y1", y(stats.max)).attr("y2", y(stats.max))
        .attr("stroke", palette.stroke);
      // Box
      svg.append("rect")
        .attr("x", boxX).attr("y", y(stats.hqr))
        .attr("width", boxW).attr("height", Math.max(2, y(stats.lqr) - y(stats.hqr)))
        .attr("fill", palette.fill)
        .attr("stroke", palette.stroke)
        .attr("stroke-width", 0.8);
      // Median
      svg.append("line")
        .attr("x1", boxX).attr("x2", boxX + boxW)
        .attr("y1", y(stats.median)).attr("y2", y(stats.median))
        .attr("stroke", "#1a1a1a")
        .attr("stroke-width", 1.8);
    };

    for (const g of groupStats) {
      const bandLeft = x(g.label);
      const cxRb = bandLeft + slotW * 0.5;
      const cxVra = bandLeft + slotW * 1.5;
      drawBox(cxRb, slotW - innerPad, g.rb, RB);
      drawBox(cxVra, slotW - innerPad, g.vra, VRA);

      // Enacted dot — centered across the two slots
      if (typeof g.enacted === "number") {
        const enX = bandLeft + slotW;
        svg.append("circle")
          .attr("cx", enX).attr("cy", y(g.enacted))
          .attr("r", 4.5).attr("fill", "#c0392b")
          .attr("stroke", "#fff").attr("stroke-width", 1.2);
      }
    }
  }, [groupStats, dims, numDistricts]);

  if (!data) return <div className="placeholder-card">Loading effectiveness data…</div>;
  if (!groupStats.length) return <div className="placeholder-card">No effectiveness data available</div>;

  return (
    <div className="box-whisker-container">
      <div className="chart-legend">
        <div className="chart-legend-item">
          <span className="chart-legend-box" style={{ background: RB.fill, border: `1px solid ${RB.stroke}` }} />
          {RB.label}
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-box" style={{ background: VRA.fill, border: `1px solid ${VRA.stroke}` }} />
          {VRA.label}
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-line box-legend-median" />
          Median
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-dot box-legend-enacted" />
          Enacted Plan
        </div>
      </div>
      <div ref={containerRef} className="box-whisker-plot-wrapper">
        <svg ref={svgRef} />
      </div>
    </div>
  );
}
