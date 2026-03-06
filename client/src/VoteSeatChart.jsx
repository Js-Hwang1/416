import React, { useEffect, useRef, useState } from "react";
import * as Plot from "@observablehq/plot";

export default function VoteSeatChart({ data }) {
  const containerRef = useRef();
  const plotRef = useRef();
  const [dims, setDims] = useState({ width: 600, height: 400 });
  const [party, setParty] = useState("democrat");

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
    if (!plotRef.current || !data) return;
    plotRef.current.innerHTML = "";

    const curve = data.curve || [];
    const isDem = party === "democrat";

    /* Flip data for Republican view: vote/seat = 100 - dem values */
    const displayCurve = isDem
      ? curve
      : curve.map(d => ({ vote_share: 100 - d.vote_share, seat_share: 100 - d.seat_share }));

    const curveColor = isDem ? "#2c7bb6" : "#c0392b";
    const partyLabel = isDem ? "Democratic" : "Republican";

    const marks = [
      // Diagonal reference line (proportional representation)
      Plot.line(
        [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        { x: "x", y: "y", stroke: "#ccc", strokeDasharray: "4,4", strokeWidth: 1 }
      ),
      // Vote-seat curve
      Plot.line(displayCurve, {
        x: "vote_share",
        y: "seat_share",
        stroke: curveColor,
        strokeWidth: 2.5,
        curve: "catmull-rom",
      }),
      // 50% reference lines
      Plot.ruleX([50], { stroke: "#ddd", strokeWidth: 1 }),
      Plot.ruleY([50], { stroke: "#ddd", strokeWidth: 1 }),
    ];

    const chartHeight = Math.max(dims.height - 30, 200);

    const plot = Plot.plot({
      width: dims.width,
      height: chartHeight,
      inset: 10,
      grid: true,
      marginLeft: 60,
      marginBottom: 50,
      style: { fontFamily: "Verdana, sans-serif", fontSize: "12px", background: "transparent", color: "#000" },
      x: {
        label: `${partyLabel} Vote Share (%)`,
        domain: [0, 100],
        tickFormat: d => `${d}%`,
        labelAnchor: "center",
        labelOffset: 40,
      },
      y: {
        label: `${partyLabel} Seat Share (%)`,
        domain: [0, 100],
        tickFormat: d => `${d}%`,
        labelAnchor: "center",
        labelOffset: 56,
      },
      marks,
    });

    plotRef.current.appendChild(plot);
  }, [data, dims, party]);

  if (!data) {
    return <div className="placeholder-card">No vote-seat data available</div>;
  }

  return (
    <div ref={containerRef} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", alignItems: "center", marginTop: "12px", marginBottom: "6px", fontSize: "11px", flexShrink: 0 }}>
        <div className="demo-group-btn-group" role="group" style={{ marginRight: 8 }}>
          <button
            type="button"
            className={`demo-group-btn${party === "democrat" ? " active" : ""}`}
            onClick={() => setParty("democrat")}
          >
            Democratic
          </button>
          <button
            type="button"
            className={`demo-group-btn${party === "republican" ? " active" : ""}`}
            onClick={() => setParty("republican")}
          >
            Republican
          </button>
        </div>
        <span><span style={{ display: "inline-block", width: 16, height: 2, background: party === "democrat" ? "#2c7bb6" : "#c0392b", marginRight: 4, verticalAlign: "middle" }} />Vote-Seat Curve</span>
        <span><span style={{ display: "inline-block", width: 16, height: 2, background: "#ccc", marginRight: 4, verticalAlign: "middle", borderBottom: "1px dashed #ccc" }} />Proportional</span>
      </div>
      <div ref={plotRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  );
}
