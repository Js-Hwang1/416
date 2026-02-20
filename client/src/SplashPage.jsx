import React, { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as d3 from "d3";
import * as topojson from "topojson-client";

const FOCUS_STATES = {
  48: { name: "Texas", slug: "texas" },
  25: { name: "Massachusetts", slug: "massachusetts" },
};

export default function SplashPage() {
  const svgRef = useRef();
  const overlayRef = useRef();
  const navigateRef = useRef();
  const zoomingRef = useRef(false);
  const navigate = useNavigate();
  navigateRef.current = navigate;

  useEffect(() => {
    const width = 975;
    const height = 610;

    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(
      (us) => {
        const svg = d3
          .select(svgRef.current)
          .attr("viewBox", [-60, -30, width + 120, height + 60])
          .style("width", "100%")
          .style("height", "100%")
          .style("display", "block");

        svg.selectAll("*").remove();

        const projection = d3.geoAlbersUsa();
        const path = d3.geoPath().projection(projection);

        projection.fitExtent(
          [
            [20, 20],
            [width - 20, height - 20],
          ],
          topojson.feature(us, us.objects.states)
        );

        // D3 zoom behavior
        const zoom = d3
          .zoom()
          .scaleExtent([1, 200])
          .on("zoom", function (event) {
            g.attr("transform", event.transform);
            g.attr("stroke-width", 1 / event.transform.k);
          });

        svg.call(zoom);
        // Disable manual zoom/pan — only programmatic zoom on click
        svg.on(".zoom", null);

        const g = svg.append("g");

        const states = g
          .append("g")
          .selectAll("path")
          .data(topojson.feature(us, us.objects.states).features)
          .join("path")
          .attr("d", path)
          .attr("fill", (d) => {
            if (FOCUS_STATES[parseInt(d.id)]) return "#999";
            return "#ccc";
          })
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.8)
          .attr("cursor", (d) =>
            FOCUS_STATES[parseInt(d.id)] ? "pointer" : "default"
          )
          .on("mouseenter", function (event, d) {
            if (FOCUS_STATES[parseInt(d.id)] && !zoomingRef.current) {
              d3.select(this)
                .transition()
                .duration(200)
                .attr("fill", "#777")
                .attr("stroke", "#888")
                .attr("stroke-width", 1.5);
            }
          })
          .on("mouseleave", function (event, d) {
            if (FOCUS_STATES[parseInt(d.id)] && !zoomingRef.current) {
              d3.select(this)
                .transition()
                .duration(200)
                .attr("fill", "#999")
                .attr("stroke", "#fff")
                .attr("stroke-width", 0.8);
            }
          })
          .on("click", function (event, d) {
            const id = parseInt(d.id);
            if (!FOCUS_STATES[id] || zoomingRef.current) return;

            zoomingRef.current = true;
            event.stopPropagation();

            const focusState = FOCUS_STATES[id];
            const [[x0, y0], [x1, y1]] = path.bounds(d);
            const cx = (x0 + x1) / 2;
            const cy = (y0 + y1) / 2;

            // Fade non-focus states
            states
              .filter((s) => s.id !== d.id)
              .transition()
              .duration(600)
              .attr("fill-opacity", 0.1);

            // Zoom deep — 5x past "fit" so the state's grey overflows the viewport
            const fitScale =
              0.95 / Math.max((x1 - x0) / width, (y1 - y0) / height);
            const deepScale = fitScale * 5;
            const tx = width / 2 - deepScale * cx;
            const ty = height / 2 - deepScale * cy;
            const transform = d3.zoomIdentity
              .translate(tx, ty)
              .scale(deepScale);

            // Animate zoom using D3 zoom
            svg
              .transition()
              .duration(2200)
              .ease(d3.easeCubicIn)
              .call(zoom.transform, transform)
              .on("end", () => {
                navigateRef.current(`/state/${focusState.slug}`);
              });

            // Match overlay to state fill color so transition is invisible
            d3.select(overlayRef.current)
              .style("background", "#999")
              .style("opacity", 0)
              .style("pointer-events", "all")
              .transition()
              .delay(1600)
              .duration(600)
              .style("opacity", 1);
          })
          .append("title")
          .text((d) => d.properties.name);

        // State borders
        g.append("path")
          .attr("fill", "none")
          .attr("stroke", "#fff")
          .attr("stroke-linejoin", "round")
          .attr("stroke-width", 0.5)
          .attr(
            "d",
            path(topojson.mesh(us, us.objects.states, (a, b) => a !== b))
          );
      }
    );
  }, []);

  return (
    <div className="splash-page">
      <div className="map-container">
        <svg ref={svgRef}></svg>
        <div ref={overlayRef} className="zoom-overlay"></div>
      </div>
    </div>
  );
}
