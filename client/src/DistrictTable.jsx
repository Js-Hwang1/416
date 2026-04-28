import React, { useEffect, useRef, useState } from "react";
import Pagination from "./Pagination";

const PAGE_SIZE = 10;

const DistrictTable = ({ rows, selectedDistrict, onSelectDistrict }) => {
  const [page, setPage] = useState(0);
  const wrapperRef = useRef(null);
  const rowRefs = useRef(new Map());

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
      <table className="district-table" aria-label="Congressional representation table">
        <colgroup>
          <col className="district-col-number" />
          <col className="district-col-representative" />
          <col className="district-col-party" />
          <col className="district-col-racial" />
          <col className="district-col-margin" />
        </colgroup>
        <thead>
          <tr>
            <th>#</th>
            <th>Representative</th>
            <th>Party</th>
            <th>Race</th>
            <th>Vote Margin %</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row) => {
            const districtNumber = Number.parseInt(row.districtNumber, 10);
            const isSelected = selectedDistrict === districtNumber;
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
