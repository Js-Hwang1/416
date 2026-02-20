// Ensemble.java
//
// MongoDB document representing a GerryChain ensemble (set of sampled plans).
//
// Annotations:
//   @Document(collection = "ensembles")
//
// Fields:
//   @Id String id;
//   String stateId;                     — reference to parent State
//   String algorithm;                   — "ReCom" or "VRA-constrained ReCom"
//   int numSamples;                     — number of plans sampled (e.g., 5000)
//   int numDistricts;                   — districts per plan
//   Map<String, List<Double>> metrics;  — per-district metric distributions
//       e.g., "democraticVoteShare" -> [list of values across samples per district]
//       Used to generate box-whisker plots comparing enacted vs. ensemble.
//   List<String> samplePlanIds;         — references to DistrictPlan documents (if stored)
