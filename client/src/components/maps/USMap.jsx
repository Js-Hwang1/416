
import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import * as topojson from "topojson-client";

export default function USMap() {
  const svgRef = useRef();

  useEffect(() => {
    const width = 975;
    const height = 610;

    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
      .then(us => {

        const svg = d3.select(svgRef.current)
          .attr("viewBox", [0, 0, width, height])
          .style("width", "100%")
          .style("height", "auto")
          .style("display", "block")
          .on("click", reset);

        svg.selectAll("*").remove();

        const zoom = d3.zoom()
          .scaleExtent([1, 8])
          .on("zoom", zoomed);

        const projection = d3.geoAlbersUsa();
        const path = d3.geoPath().projection(projection);

        // Fit map properly inside SVG with padding
        projection.fitExtent(
          [[20, 20], [width - 20, height - 20]],
          topojson.feature(us, us.objects.states)
        );

        const g = svg.append("g");

        const states = g.append("g")
          .attr("fill", "#444")
          .attr("cursor", "pointer")
          .selectAll("path")
          .data(topojson.feature(us, us.objects.states).features)
          .join("path")
          .attr("d", path)
          .on("click", clicked);

        states.append("title")
          .text(d => d.properties.name);

        g.append("path")
          .attr("fill", "none")
          .attr("stroke", "white")
          .attr("stroke-linejoin", "round")
          .attr("d", path(
            topojson.mesh(us, us.objects.states, (a, b) => a !== b)
          ));

        svg.call(zoom);

        function reset() {
          states.transition().style("fill", null);
          svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity
          );
        }

        function clicked(event, d) {
          const [[x0, y0], [x1, y1]] = path.bounds(d);
          event.stopPropagation();

          states.transition().style("fill", null);
          d3.select(event.currentTarget)
            .transition()
            .style("fill", "red");

          svg.transition().duration(750).call(
            zoom.transform,
            d3.zoomIdentity
              .translate(width / 2, height / 2)
              .scale(Math.min(8, 0.9 / Math.max(
                (x1 - x0) / width,
                (y1 - y0) / height
              )))
              .translate(-(x0 + x1) / 2, -(y0 + y1) / 2)
          );
        }

        function zoomed(event) {
          const { transform } = event;
          g.attr("transform", transform);
          g.attr("stroke-width", 1 / transform.k);
        }

      });

  }, []);

  return <svg ref={svgRef}></svg>;
}
