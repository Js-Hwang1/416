// District.java
//
// MongoDB document representing a single congressional district.
//
// Annotations:
//   @Document(collection = "districts")
//
// Fields:
//   @Id String id;
//   String stateId;                 — reference to parent State
//   String planId;                  — reference to parent DistrictPlan
//   int districtNumber;             — e.g., 1-9 for MA, 1-38 for TX
//   Object boundary;               — GeoJSON geometry for this district's shape
//   Demographics demographics;     — embedded: population by race
//   ElectionData electionData;      — embedded: vote totals
//   List<String> precinctIds;       — references to Precinct documents in this district
