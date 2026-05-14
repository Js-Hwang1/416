import React, { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

const GROUP_LABELS = { hispanic: "Latino", black: "Black", asian: "Asian" };
const LEGEND_HEIGHT = 36;
const ML = 60, MB = 50, MR = 0, MT = 0, INS = 10;

function partyDots(data, opts) {
  const demDot = Plot.dot(data, { x: d => d.x * 100, y: d => d.y * 100,       fill: "steelblue", ...opts });
  const repDot = Plot.dot(data, { x: d => d.x * 100, y: d => (1 - d.y) * 100, fill: "tomato",    ...opts });
  return [demDot, repDot];
}

function partyLines(data) {
  const shared = { x: d => d.x * 100, strokeWidth: 2.5, curve: "catmull-rom", clip: true };
  const demLine = Plot.line(data, { ...shared, y: d => d.y * 100,         stroke: "steelblue" });
  const repLine = Plot.line(data, { ...shared, y: d => (1 - d.y) * 100,   stroke: "tomato"    });
  return [demLine, repLine];
}

function buildRegressionPoints([a, b, c, d]) {
  const pts = [];
  for (let i = 0; i <= 199; i++) {
    const x = i / 199;
    const y = a + b*x + c*x*x + d*x*x*x;
    pts.push({ x, y });
  }
  return pts;
}

function makePartyPoints(points) {
  const dem = points.map(p => ({ datum: p, party: "dem" }));
  const rep = points.map(p => ({ datum: p, party: "rep" }));
  return [...dem, ...rep];
}

function buildMarks(points, regression, selectedPoint) {
  const dots = partyDots(points, { fillOpacity: 0.18, r: 2.5, clip: true });

  const lines = regression?.length > 0
    ? partyLines(buildRegressionPoints(regression))
    : [];

  const midline = Plot.ruleY([50], {
    stroke: "#999",
    strokeDasharray: "4,4",
    strokeWidth: 1,
  });

  const label = Plot.text([`${points.length.toLocaleString()} precincts`], {
    frameAnchor: "top",
    dy: -5,
    textAnchor: "middle",
    fill: "#555",
    fontSize: 12,
    fontFamily: "Verdana, sans-serif",
  });

  const partyPoints = makePartyPoints(points);
  const pointerLayer = Plot.dot(partyPoints, Plot.pointer({
    x: d => d.datum.x * 100,
    y: d => d.party === "dem" ? d.datum.y * 100 : (1 - d.datum.y) * 100,
    r: 6,
    fill: "transparent",
    stroke: "transparent",
  }));

  const selDem = selectedPoint?.party === "dem" ? [selectedPoint.datum] : [];
  const selRep = selectedPoint?.party === "rep" ? [selectedPoint.datum] : [];
  const selectedDots = [
    Plot.dot(selDem, { x: d => d.x * 100, y: d => d.y * 100,       fill: "steelblue", fillOpacity: 0.9, r: 6, stroke: "#000", strokeWidth: 1.5, clip: true }),
    Plot.dot(selRep, { x: d => d.x * 100, y: d => (1 - d.y) * 100, fill: "tomato",    fillOpacity: 0.9, r: 6, stroke: "#000", strokeWidth: 1.5, clip: true }),
  ];

  return [...dots, ...lines, midline, label, ...selectedDots, pointerLayer];
}

function buildPlotConfig(dims, group, marks, xDomain, yDomain) {
  return {
    width: dims.width,
    height: Math.max(dims.height - LEGEND_HEIGHT, 150),
    inset: INS,
    grid: true,
    marginLeft: ML,
    marginBottom: MB,
    style: { fontFamily: "Verdana, sans-serif", fontSize: "12px", background: "transparent", color: "#000" },
    x: {
      label: `Percent ${GROUP_LABELS[group] ?? group}`,
      tickFormat: d => `${d}%`,
      domain: xDomain,
      labelAnchor: "center",
      labelOffset: 40,
    },
    y: {
      label: "Party Vote Share (%)",
      domain: yDomain,
      labelAnchor: "center",
      labelOffset: 56,
    },
    marks,
  };
}

// pixel offset → data coordinate
function pxToData(offsetX, offsetY, dims, zoom) {
  const plotH = dims.height - LEGEND_HEIGHT;
  const xPx = [ML + INS, dims.width - MR - INS];
  const yPx = [MT + INS, plotH - MB - INS];
  const cx = zoom.x[0] + (offsetX - xPx[0]) / (xPx[1] - xPx[0]) * (zoom.x[1] - zoom.x[0]);
  const cy = zoom.y[1] - (offsetY - yPx[0]) / (yPx[1] - yPx[0]) * (zoom.y[1] - zoom.y[0]);
  return [cx, cy];
}

const DEFAULT_ZOOM = { x: [0, 100], y: [0, 100] };

const GinglesScatterPlot = ({ points, regression, group, onSelectPrecinct, selectedPoint }) => {
  const [containerEl, setContainerEl] = useState(null);
  const [plotEl, setPlotEl] = useState(null);
  const [dims, setDims] = useState({ width: 600, height: 350 });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [isPanning, setIsPanning] = useState(false);

  // Refs so event handlers always see latest values without re-binding
  const dimsRef = useRef(dims);
  const zoomRef = useRef(zoom);
  const panRef = useRef(null);   // { startX, startY, zoom }
  const isDraggingRef = useRef(false);

  useEffect(() => { dimsRef.current = dims; }, [dims]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const isZoomed = zoom.x[0] !== 0 || zoom.x[1] !== 100 || zoom.y[0] !== 0 || zoom.y[1] !== 100;

  // ResizeObserver
  useEffect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDims({ width, height });
      }
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [containerEl]);

  // Wheel zoom + mousedown on plot element
  useEffect(() => {
    if (!plotEl) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.75 : 1.33;
      const z = zoomRef.current;
      const d = dimsRef.current;
      const [cx, cy] = pxToData(e.offsetX, e.offsetY, d, z);

      let nx0 = Math.max(0,   cx - (cx - z.x[0]) * factor);
      let nx1 = Math.min(100, cx + (z.x[1] - cx) * factor);
      if (nx1 - nx0 < 0.5) return; // prevent over-zoom
      let ny0 = Math.max(0,   cy - (cy - z.y[0]) * factor);
      let ny1 = Math.min(100, cy + (z.y[1] - cy) * factor);
      if (ny1 - ny0 < 0.5) return;

      setZoom({ x: [nx0, nx1], y: [ny0, ny1] });
    };

    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      isDraggingRef.current = false;
      panRef.current = { startX: e.clientX, startY: e.clientY, zoom: zoomRef.current };
    };

    const handleDblClick = () => {
      setZoom(DEFAULT_ZOOM);
    };

    plotEl.addEventListener("wheel", handleWheel, { passive: false });
    plotEl.addEventListener("mousedown", handleMouseDown);
    plotEl.addEventListener("dblclick", handleDblClick);
    return () => {
      plotEl.removeEventListener("wheel", handleWheel);
      plotEl.removeEventListener("mousedown", handleMouseDown);
      plotEl.removeEventListener("dblclick", handleDblClick);
    };
  }, [plotEl]);

  // Global mousemove/mouseup for pan
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!panRef.current) return;
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      if (!isDraggingRef.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        setIsPanning(true);
      }

      const d = dimsRef.current;
      const { zoom: oz } = panRef.current;
      const plotH = d.height - LEGEND_HEIGHT;
      const xPxW = d.width - ML - MR - INS * 2;
      const yPxH = plotH - MB - MT - INS * 2;
      const xRange = oz.x[1] - oz.x[0];
      const yRange = oz.y[1] - oz.y[0];
      const ddx = -dx / xPxW * xRange;
      const ddy =  dy / yPxH * yRange;

      let nx0 = oz.x[0] + ddx, nx1 = oz.x[1] + ddx;
      if (nx0 < 0)   { nx0 = 0;           nx1 = xRange; }
      if (nx1 > 100) { nx1 = 100;          nx0 = 100 - xRange; }

      let ny0 = oz.y[0] + ddy, ny1 = oz.y[1] + ddy;
      if (ny0 < 0)   { ny0 = 0;           ny1 = yRange; }
      if (ny1 > 100) { ny1 = 100;          ny0 = 100 - yRange; }

      setZoom({ x: [nx0, nx1], y: [ny0, ny1] });
    };

    const handleMouseUp = () => {
      if (!panRef.current) return;
      panRef.current = null;
      setIsPanning(false);
      // isDraggingRef stays true until next mousedown to suppress the click event
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Plot rendering
  useEffect(() => {
    if (!plotEl || !points?.length) return;
    plotEl.innerHTML = "";
    const marks = buildMarks(points, regression, selectedPoint);
    const svg = Plot.plot(buildPlotConfig(dims, group, marks, zoom.x, zoom.y));

    if (onSelectPrecinct) {
      svg.addEventListener("click", () => {
        if (svg.value && !isDraggingRef.current) onSelectPrecinct(svg.value);
      });
    }

    plotEl.appendChild(svg);
  }, [plotEl, points, regression, group, dims, zoom, selectedPoint, onSelectPrecinct]);

  return (
    <div ref={setContainerEl} className="gingles-scatter-container">
      <div className="gingles-legend">
        <span><span className="gingles-legend-dot gingles-legend-dot--dem" />Dem Vote Share</span>
        <span><span className="gingles-legend-dot gingles-legend-dot--rep" />Rep Vote Share</span>
        {regression?.length > 0 && (
          <span><span className="gingles-legend-line gingles-legend-line--dem" />Regression</span>
        )}
        {isZoomed && (
          <button className="gingles-reset-zoom" onClick={() => setZoom(DEFAULT_ZOOM)}>
            Reset Zoom
          </button>
        )}
      </div>
      <div
        ref={setPlotEl}
        className={`gingles-scatter-clickable${isPanning ? " gingles-scatter-panning" : ""}`}
      />
    </div>
  );
};

export default GinglesScatterPlot;
