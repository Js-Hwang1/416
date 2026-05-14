import React, { useEffect, useMemo, useRef, useState } from "react";
import Pagination from "../ui/Pagination";

const PAGE_SIZE = 10;

// Map "black"/"hispanic"/"asian" → "Black"/"Hispanic"/"Asian" (the keys used
// in enactedDistrictEi.districts[].groups).
const TITLE_CASE = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;

const DistrictTable = ({
  rows, selectedDistrict, onSelectDistrict,
  enactedDistrictEi, stateId, minorityGroups, effectivenessThresholdKey = "t60",
}) => {
  const [page, setPage] = useState(0);
  const [effGroup, setEffGroup] = useState(null);
  const wrapperRef = useRef(null);
  const rowRefs = useRef(new Map());

  // Auto-pick the first feasible group when minorityGroups loads
  useEffect(() => {
    if (effGroup) return;
    if (minorityGroups?.length) setEffGroup(minorityGroups[0].key);
  }, [minorityGroups, effGroup]);

  // Index per-district EI data by district number (string keys from JSON).
  const districtEi = useMemo(() => {
    const map = new Map();
    for (const dd of (enactedDistrictEi?.districts || [])) {
      const dn = typeof dd.district === "number" ? dd.district : parseInt(dd.district, 10);
      if (Number.isFinite(dn)) map.set(dn, dd);
    }
    return map;
  }, [enactedDistrictEi]);

  const showEffectiveness = effGroup && districtEi.size > 0;

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    if (selectedDistrict === null) return;
    const rowIndex = rows.findIndex(
      (r) => Number.parseInt(r.districtNumber, 10) === selectedDistrict
    );
    if (rowIndex !== -1) setPage(Math.floor(rowIndex / PAGE_SIZE));

    const wrapper = wrapperRef.current;
    const row = rowRefs.current.get(selectedDistrict);
    if (!wrapper || !row) return;
    const rowTop = row.offsetTop;
    const rowBottom = rowTop + row.offsetHeight;
    const visibleTop = wrapper.scrollTop;
    const visibleBottom = visibleTop + wrapper.clientHeight;
    if (rowTop < visibleTop) {
      wrapper.scrollTo({ top: rowTop, behavior: "smooth" });
    } else if (rowBottom > visibleBottom) {
      wrapper.scrollTo({ top: rowBottom - wrapper.clientHeight, behavior: "smooth" });
    }
  }, [selectedDistrict, rows]);

  return (
    <div className="district-table-wrapper" ref={wrapperRef}>
      {showEffectiveness && (
        <div className="chart-controls" style={{ marginBottom: 6 }}>
          <span className="chart-controls-label">Effectiveness for:</span>
          {(minorityGroups || []).map((g) => (
            <button
              key={g.key}
              type="button"
              className={`demo-group-btn${effGroup === g.key ? " active" : ""}`}
              onClick={() => setEffGroup(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
      <table className="district-table" aria-label="Congressional representation table">
        <thead>
          <tr>
            <th>#</th>
            <th>Representative</th>
            <th>Party</th>
            <th>Race</th>
            <th>Vote Margin %</th>
            {showEffectiveness && <th>EI Score</th>}
            {showEffectiveness && <th>Effective</th>}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const districtNumber = Number.parseInt(row.districtNumber, 10);
            const isSelected = selectedDistrict === districtNumber;
            const dd = districtEi.get(districtNumber);
            const gInfo = dd?.groups?.[TITLE_CASE(effGroup)];
            const score = gInfo?.score;
            const eff = gInfo?.effective_at?.[effectivenessThresholdKey];
            return (
              <tr
                key={row.districtNumber}
                ref={(el) => {
                  if (el) rowRefs.current.set(districtNumber, el);
                  else rowRefs.current.delete(districtNumber);
                }}
                className={`district-row-clickable${isSelected ? " district-row-selected" : ""}`}
                onClick={() => onSelectDistrict((prev) => prev === districtNumber ? null : districtNumber)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectDistrict((prev) => prev === districtNumber ? null : districtNumber);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Select district ${row.districtNumber}`}
              >
                <td>{row.districtNumber}</td>
                <td>{row.representative}</td>
                <td>
                  <span className={`party-badge party-${row.party?.toLowerCase()}`}>
                    {row.party === "Democrat" ? "D" : row.party === "Republican" ? "R" : row.party}
                  </span>
                </td>
                <td>{row.racialEthnicGroup}</td>
                <td>{row.voteMargin}</td>
                {showEffectiveness && <td>{score == null ? "—" : score.toFixed(2)}</td>}
                {showEffectiveness && (
                  <td style={{ fontWeight: 700, color: eff ? "#16a34a" : "#888" }}>
                    {eff == null ? "—" : eff ? "Yes" : "No"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
};

export default DistrictTable;
