import React from "react";
import StateMap from "../maps/StateMap";
import InterestingPlanDropdown from "../ui/InterestingPlanDropdown";

const ComparePlansView = ({
  districtGeoJsonData,
  alternatePlanGeoJsonData,
  cfg,
  selectedDistrict,
  onDistrictSelect,
  reps,
  activePlanParties,
  selectedInterestingPlan,
  planOptions,
  onPlanChange,
  onExitCompare,
}) => {
  const enactedD = reps?.filter((r) => r.party === "Democrat").length ?? 0;
  const enactedR = reps?.filter((r) => r.party === "Republican").length ?? 0;
  const planD = activePlanParties?.filter((r) => r.party === "Democrat").length ?? 0;
  const planR = activePlanParties?.filter((r) => r.party === "Republican").length ?? 0;
  const planLabel = planOptions.find((o) => o.value === selectedInterestingPlan)?.label;

  return (
    <div className="compare-side-by-side">
      <div className="compare-map-col">
        <h2 className="section-title compare-map-title">Enacted</h2>
        <div className="compare-map-wrapper">
          <StateMap
            geojson={districtGeoJsonData}
            cfg={cfg}
            selectedDistrict={selectedDistrict}
            onDistrictSelect={onDistrictSelect}
            districtParties={reps}
          />
        </div>
        <div className="compare-seat-summary">
          <span className="compare-d">D: {enactedD}</span>
          <span className="compare-r">R: {enactedR}</span>
        </div>
      </div>

      <div className="compare-map-col">
        <h2 className="section-title compare-map-title">{planLabel}</h2>
        <div className="compare-map-wrapper">
          <StateMap
            geojson={alternatePlanGeoJsonData || districtGeoJsonData}
            cfg={cfg}
            selectedDistrict={selectedDistrict}
            onDistrictSelect={onDistrictSelect}
            districtParties={activePlanParties}
          />
        </div>
        <div className="compare-seat-summary">
          <span className="compare-d">D: {planD}</span>
          <span className="compare-r">R: {planR}</span>
        </div>
      </div>

      <div className="compare-controls-bar">
        <InterestingPlanDropdown
          options={planOptions}
          value={selectedInterestingPlan}
          onChange={onPlanChange}
        />
        <button
          type="button"
          className="compare-enacted-btn compare-active"
          onClick={onExitCompare}
        >
          Exit Comparison
        </button>
      </div>
    </div>
  );
};

export default ComparePlansView;
