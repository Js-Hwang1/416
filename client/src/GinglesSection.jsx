import React, { useEffect, useMemo, useState } from "react";
import GinglesScatterPlot from "./gingles_scatter";
import Pagination from "./Pagination";

const PAGE_SIZE = 10;

function sortIcon(key, sort) {
  if (sort.key !== key) return "";
  return sort.dir === "asc" ? " ▲" : " ▼";
}

const GinglesSection = ({ points, regressionData, group, minorityGroups }) => {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [tableOpen, setTableOpen] = useState(true);

  useEffect(() => {
    setPage(0);
    setSort({ key: null, dir: "asc" });
  }, [group]);

  const sortedPoints = useMemo(() => {
    if (!sort.key) return points;
    const accessor =
      sort.key === "minority" ? (r) => r.x
      : sort.key === "dem" ? (r) => r.y
      : (r) => 1 - r.y;
    return [...points].sort((a, b) => {
      const diff = accessor(a) - accessor(b);
      return sort.dir === "asc" ? diff : -diff;
    });
  }, [points, sort]);

  const totalPages = Math.ceil(sortedPoints.length / PAGE_SIZE);
  const pageRows = sortedPoints.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
    setPage(0);
  };

  const groupLabel = minorityGroups.find((g) => g.key === group)?.label ?? group;

  return (
    <div className="demo-gingles-combined">
      <div className={`demo-gingles-scatter${tableOpen ? "" : " gingles-scatter-full"}`}>
        <GinglesScatterPlot
          points={points}
          regression={regressionData}
          group={group}
        />
      </div>
      <div className="demo-gingles-table">
        <button
          type="button"
          className="gingles-table-toggle"
          onClick={() => setTableOpen((o) => !o)}
        >
          {tableOpen ? "Hide Precinct Table ▼" : "Show Precinct Table ▲"}
        </button>
        {tableOpen && (
          <>
            <table className="district-table" aria-label="Precinct data table">
              <colgroup>
                <col style={{ width: "10%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "30%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th className="sortable-th" onClick={() => toggleSort("minority")}>
                    % {groupLabel}{sortIcon("minority", sort)}
                  </th>
                  <th className="sortable-th" onClick={() => toggleSort("dem")}>
                    Democratic Vote %{sortIcon("dem", sort)}
                  </th>
                  <th className="sortable-th" onClick={() => toggleSort("rep")}>
                    Republican Vote %{sortIcon("rep", sort)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => (
                  <tr key={page * PAGE_SIZE + idx}>
                    <td>{(page * PAGE_SIZE + idx + 1).toLocaleString()}</td>
                    <td>{(Math.min(row.x, 1) * 100).toFixed(1)}%</td>
                    <td>{(Math.min(row.y, 1) * 100).toFixed(1)}%</td>
                    <td>{(Math.min(1 - row.y, 1) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
};

export default GinglesSection;
