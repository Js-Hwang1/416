import React, { useRef, useEffect, useState } from "react";
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
  const animateToStateRef = useRef(() => {});
  const zoomingRef = useRef(false);
  const [selectedState, setSelectedState] = useState("");
  const navigate = useNavigate();
  navigateRef.current = navigate;

  useEffect(() => {
    const width = 975;
    const height = 610;

    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(
      (us) => {
        const svg = d3
          .select(svgRef.current)
          .attr("viewBox", [0, 0, width, height])
          .style("width", "100%")
          .style("height", "100%")
          .style("display", "block")
          .style("overflow", "visible");

        svg.selectAll("*").remove();

        const projection = d3.geoAlbersUsa();
        const path = d3.geoPath().projection(projection);

        projection.fitExtent(
          [
            [0, 0],
            [width, height],
          ],
          topojson.feature(us, us.objects.states)
        );

        const zoom = d3
          .zoom()
          .scaleExtent([1, 200])
          .on("zoom", function (event) {
            g.attr("transform", event.transform);
            g.attr("stroke-width", 1 / event.transform.k);
          });

        svg.call(zoom);
        svg.on(".zoom", null);

        const g = svg.append("g");
        const stateFeatures = topojson.feature(us, us.objects.states).features;

        const animateToFeature = (feature, statesSelection) => {
          const id = parseInt(feature.id, 10);
          if (!FOCUS_STATES[id] || zoomingRef.current) return;

          zoomingRef.current = true;
          const focusState = FOCUS_STATES[id];
          const [[x0, y0], [x1, y1]] = path.bounds(feature);
          const cx = (x0 + x1) / 2;
          const cy = (y0 + y1) / 2;

          statesSelection
            .filter((s) => s.id !== feature.id)
            .transition()
            .duration(600)
            .attr("fill-opacity", 0.1);

          const fitScale =
            0.95 / Math.max((x1 - x0) / width, (y1 - y0) / height);
          const deepScale = fitScale * 5;
          const tx = width / 2 - deepScale * cx;
          const ty = height / 2 - deepScale * cy;
          const transform = d3.zoomIdentity.translate(tx, ty).scale(deepScale);

          svg
            .transition()
            .duration(2200)
            .ease(d3.easeCubicIn)
            .call(zoom.transform, transform)
            .on("end", () => {
              navigateRef.current(`/state/${focusState.slug}`);
            });

          d3.select(overlayRef.current)
            .style("background", "#999")
            .style("opacity", 0)
            .style("pointer-events", "all")
            .transition()
            .delay(1600)
            .duration(600)
            .style("opacity", 1);
        };

        const states = g
          .append("g")
          .selectAll("path")
          .data(stateFeatures)
          .join("path")
          .attr("d", path)
          .attr("fill", (d) => {
            if (FOCUS_STATES[parseInt(d.id, 10)]) return "#999";
            return "#ccc";
          })
          .attr("stroke", "#fff")
          .attr("stroke-width", 0.8)
          .attr("cursor", (d) =>
            FOCUS_STATES[parseInt(d.id, 10)] ? "pointer" : "default"
          )
          .on("mouseenter", function (_event, d) {
            if (FOCUS_STATES[parseInt(d.id, 10)] && !zoomingRef.current) {
              d3.select(this)
                .transition()
                .duration(200)
                .attr("fill", "#777")
                .attr("stroke", "#888")
                .attr("stroke-width", 1.5);
            }
          })
          .on("mouseleave", function (_event, d) {
            if (FOCUS_STATES[parseInt(d.id, 10)] && !zoomingRef.current) {
              d3.select(this)
                .transition()
                .duration(200)
                .attr("fill", "#999")
                .attr("stroke", "#fff")
                .attr("stroke-width", 0.8);
            }
          })
          .on("click", function (event, d) {
            event.stopPropagation();
            animateToFeature(d, states);
          })
          .append("title")
          .text((d) => d.properties.name);

        animateToStateRef.current = (slug) => {
          const stateFeature = stateFeatures.find((f) => {
            const info = FOCUS_STATES[parseInt(f.id, 10)];
            return info?.slug === slug;
          });
          if (!stateFeature) return;
          animateToFeature(stateFeature, states);
        };

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
      <div className="splash-dropdown-bar">
        <select
          className="splash-state-select"
          value={selectedState}
          onChange={(e) => {
            const slug = e.target.value;
            setSelectedState(slug);
            if (slug) {
              animateToStateRef.current(slug);
            }
          }}
        >
          <option value="" disabled hidden>
            Select State
          </option>
          <option value="texas">Texas</option>
          <option value="massachusetts">Massachusetts</option>
        </select>
      </div>
      <div className="map-container">
        <svg ref={svgRef}></svg>
        <div ref={overlayRef} className="zoom-overlay"></div>
      </div>
    </div>
  );
}
