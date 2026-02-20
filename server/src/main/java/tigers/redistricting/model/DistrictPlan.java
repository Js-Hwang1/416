// DistrictPlan.java
//
// MongoDB document representing a complete district plan (enacted or generated).
//
// Annotations:
//   @Document(collection = "districtPlans")
//
// Fields:
//   @Id String id;
//   String stateId;                 — reference to parent State
//   String planType;                — "enacted" or "proposed" or "ensemble_sample"
//   int totalDistricts;             — number of districts in this plan
//   List<String> districtIds;       — references to District documents in this plan
//   Map<String, Object> metrics;    — plan-level metrics (efficiency gap, mean-median, etc.)
