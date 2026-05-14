import { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

const GROUP_LABELS = { hispanic: "Latino", black: "Black", asian: "Asian" };

const MARGIN = { top: 20, right: 30, bottom: 50, left: 60 };

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

// Normalize the new shape ({ raceBlind: [...], vra: [...] }) into a list of
// {label, color, districts} series. Falls back to legacy single-series shape
// (plain [...] array) so old data still renders.
function buildSeries(boxDataForGroup) {
  if (!boxDataForGroup) return [];
  if (Array.isArray(boxDataForGroup)) {
    return [{ key: "single", label: "Ensemble", color: "#c8d0da", stroke: "#667", districts: boxDataForGroup }];
  }
  const series = [];
  if (Array.isArray(boxDataForGroup.raceBlind)) {
    series.push({ key: "raceBlind", label: "Race-Blind", color: "rgba(70,160,100,0.55)", stroke: "rgba(40,120,60,1)", districts: boxDataForGroup.raceBlind });
  }
  if (Array.isArray(boxDataForGroup.vra)) {
    series.push({ key: "vra", label: "VRA-Constrained", color: "rgba(120,140,210,0.55)", stroke: "rgba(60,80,180,1)", districts: boxDataForGroup.vra });
  }
  return series;
}

// Computes a y scale whose upper bound lands on a clean tick value just above dataMax
function buildYScale(districts, height) {
  const yMin = Math.max(0, d3.min(districts, d => d.min));
  const dataMax = Math.min(100, d3.max(districts, d => d.max));
  const baseTicks = d3.ticks(yMin, dataMax, 8);
  const tickStep = baseTicks.length > 1
    ? baseTicks[1] - baseTicks[0]
    : Math.max(1, Math.ceil((dataMax - yMin) || 1));
  const lastBaseTick = baseTicks.at(-1) ?? dataMax;
  const provisionalMax = Math.min(100, lastBaseTick >= dataMax ? lastBaseTick : lastBaseTick + tickStep);
  const tickValues = d3.ticks(yMin, provisionalMax, 8);
  const displayMax = tickValues.at(-1) ?? provisionalMax;

  const scale = d3.scaleLinear()
    .domain([yMin, displayMax])
    .range([height - MARGIN.bottom, MARGIN.top]);

  return { scale, tickValues };
}

// Maps enacted plan data onto the sorted district order used by the box plot
function buildEnactedDots(districts, enactedData, selectedGroup) {
  const enactedDistricts = enactedData?.districts;
  if (enactedDistricts) {
    const sorted = [...enactedDistricts]
      .map(ed => ({ district: ed.district, pct: ed.groups?.[selectedGroup]?.pct ?? 0 }))
      .sort((a, b) => a.pct - b.pct);
    return districts.map((d, i) => ({
      district: d.district,
      value: i < sorted.length ? sorted[i].pct : d.median,
    }));
  }
  return districts.map(d => ({ district: d.district, value: d.median * 1.05 }));
}

export default function BoxPlotChart({ boxData, enactedData, selectedGroup = "hispanic" }) {
  const svgRef = useRef();
  const containerRef = useRef();
  const [dims, setDims] = useState({ width: 800, height: 400 });

  const groupData = boxData?.[selectedGroup];
  const series = buildSeries(groupData);
  // Districts used for the y-scale span: union of every series' districts.
  const districts = series.flatMap(s => s.districts);

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
    if (!districts || districts.length === 0) return;

    const { width, height } = dims;
    d3.select(svgRef.current).selectAll("*").remove(); // clean up old svg

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height])
      .style("max-width", "100%")
      .style("height", "auto");

    const districtIds = series[0]?.districts.map(d => d.district) ?? [];
    const x = d3.scaleBand()
      .domain(districtIds)
      .range([MARGIN.left, width - MARGIN.right])
      .padding(0.35);

    const { scale: y, tickValues } = buildYScale(districts, height);
    const enactedDots = buildEnactedDots(series[0]?.districts ?? [], enactedData, selectedGroup);

    const gridLayer = svg.append("g");
    const axisLayer = svg.append("g");
    const plotLayer = svg.append("g");

    // Y grid — drawn first so plot marks render on top
    gridLayer.append("g")
      .attr("transform", `translate(${MARGIN.left},0)`)
      .call(d3.axisLeft(y).tickValues(tickValues).tickFormat(() => "").tickSize(-width + MARGIN.left + MARGIN.right))
      .call(g => {
        g.select(".domain").remove();
        g.selectAll(".tick line").attr("stroke", "#f0f0f0");
        g.selectAll(".tick text").remove();
      });

    // Two-series layout: split each band into sub-slots
    const nSeries = Math.max(1, series.length);
    const slotWidth = x.bandwidth() / nSeries;
    const innerPad = slotWidth * 0.18;

    series.forEach((s, idx) => {
      const seriesGroup = plotLayer.append("g");
      const slotX = (d) => x(d.district) + idx * slotWidth + innerPad / 2;
      const slotW = slotWidth - innerPad;

      seriesGroup.selectAll(".whisker").data(s.districts).join("line")
        .attr("x1", d => slotX(d) + slotW / 2)
        .attr("x2", d => slotX(d) + slotW / 2)
        .attr("y1", d => y(d.min))
        .attr("y2", d => y(d.max))
        .attr("stroke", s.stroke);

      seriesGroup.selectAll(".cap-min").data(s.districts).join("line")
        .attr("x1", d => slotX(d) + slotW * 0.15)
        .attr("x2", d => slotX(d) + slotW * 0.85)
        .attr("y1", d => y(d.min)).attr("y2", d => y(d.min))
        .attr("stroke", s.stroke);

      seriesGroup.selectAll(".cap-max").data(s.districts).join("line")
        .attr("x1", d => slotX(d) + slotW * 0.15)
        .attr("x2", d => slotX(d) + slotW * 0.85)
        .attr("y1", d => y(d.max)).attr("y2", d => y(d.max))
        .attr("stroke", s.stroke);

      seriesGroup.selectAll(".box").data(s.districts).join("rect")
        .attr("x", d => slotX(d))
        .attr("width", slotW)
        .attr("y", d => y(d.hqr))
        .attr("height", d => Math.max(0, y(d.lqr) - y(d.hqr)))
        .attr("fill", s.color)
        .attr("stroke", s.stroke)
        .attr("stroke-width", 0.8);

      seriesGroup.selectAll(".median").data(s.districts).join("line")
        .attr("x1", d => slotX(d))
        .attr("x2", d => slotX(d) + slotW)
        .attr("y1", d => y(d.median)).attr("y2", d => y(d.median))
        .attr("stroke", "#1a1a1a")
        .attr("stroke-width", 1.6);
    });

    // Enacted plan dots — one per district at the center of the band
    plotLayer.selectAll(".enacted-dot").data(enactedDots).join("circle")
      .attr("cx", d => x(d.district) + x.bandwidth() / 2)
      .attr("cy", d => y(d.value))
      .attr("r", 3.5)
      .attr("fill", "#c0392b")
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.8);

    // X axis
    axisLayer.append("g")
      .attr("transform", `translate(0,${height - MARGIN.bottom})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call(g => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll("text").call(applyTickStyle);
      });

    svg.append("text")
      .attr("x", width / 2).attr("y", height - 8)
      .attr("text-anchor", "middle")
      .call(applyLabelStyle)
      .text("Districts (ordered by increasing % of selected group)");

    // Y axis
    axisLayer.append("g")
      .attr("transform", `translate(${MARGIN.left},0)`)
      .call(d3.axisLeft(y).tickValues(tickValues).tickFormat(d => `${d}%`).tickSize(-width + MARGIN.left + MARGIN.right))
      .call(g => {
        g.select(".domain").attr("stroke", "#ccc");
        g.selectAll(".tick line").remove();
        g.selectAll(".tick text").call(applyTickStyle);
      });

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(height / 2)).attr("y", 14)
      .attr("text-anchor", "middle")
      .call(applyLabelStyle)
      .text(`${GROUP_LABELS[selectedGroup] || selectedGroup} Population %`);

  }, [districts, selectedGroup, enactedData, dims]);

  return (
    <div className="box-whisker-container">
      <div className="chart-legend">
        {series.map(s => (
          <div key={s.key} className="chart-legend-item">
            <span className="chart-legend-box" style={{ background: s.color, border: `1px solid ${s.stroke}` }} />
            {s.label}
          </div>
        ))}
        <div className="chart-legend-item">
          <span className="chart-legend-line box-legend-median" />
          Median
        </div>
        <div className="chart-legend-item">
          <span className="chart-legend-line box-legend-whisker" />
          Min / Max
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
