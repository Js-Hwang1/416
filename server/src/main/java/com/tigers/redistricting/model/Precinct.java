// Precinct.java
//
// MongoDB document representing a single precinct (MA) or VTD (TX).
//
// Annotations:
//   @Document(collection = "precincts")
//
// Fields:
//   @Id String id;
//   String stateId;                 — reference to parent State
//   String districtId;              — which congressional district this precinct belongs to
//   String name;                    — precinct/VTD identifier from source data
//   Object boundary;               — GeoJSON geometry (polygon)
//   Demographics demographics;     — embedded: population by race (from Census PL 94-171)
//   ElectionData electionData;      — embedded: vote totals (from 2024 general election)
//   String urbanRuralClass;         — "urban", "suburban", or "rural"
//   double medianHouseholdIncome;   — from ACS B19013 (mapped from tract)
