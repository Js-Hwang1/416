// DistrictPlanDTO.java
//
// Response object for district plan data sent to the frontend map.
//
// Fields:
//   String planId;
//   String planType;                — "enacted" or "proposed"
//   String stateId;
//   int totalDistricts;
//   List<DistrictDTO> districts;    — inline district data (boundary + stats) for rendering
//
// Inner class or separate file:
//   DistrictDTO:
//     int districtNumber;
//     Object boundaryGeoJson;       — the polygon for Leaflet to render
//     Demographics demographics;
//     ElectionData electionData;
