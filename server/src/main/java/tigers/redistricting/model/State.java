// State.java
//
// MongoDB document representing a US state (MA or TX).
//
// Annotations:
//   @Document(collection = "states")
//
// Fields:
//   @Id String id;                  — MongoDB ObjectId
//   String name;                    — "Massachusetts" or "Texas"
//   String abbreviation;            — "MA" or "TX"
//   String fipsCode;                — "25" or "48"
//   int totalPopulation;            — from 2020 Census
//   int numCongressionalDistricts;  — 9 (MA) or 38 (TX)
//   Object boundary;               — state outline GeoJSON (or reference to separate collection)
//   Demographics demographics;     — embedded demographic summary
