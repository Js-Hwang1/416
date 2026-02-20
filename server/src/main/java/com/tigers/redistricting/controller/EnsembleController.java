// EnsembleController.java
//
// REST controller for GerryChain ensemble analysis results.
//
// Annotations:
//   @RestController
//   @RequestMapping("/api/ensembles")
//
// Endpoints:
//   GET /api/ensembles?stateId={id}          — list ensemble runs for a state
//   GET /api/ensembles/{ensembleId}          — get ensemble summary
//       (distribution data for box-whisker plots, district comparison metrics)
//   GET /api/ensembles/{ensembleId}/plans    — get sampled district plans from the ensemble
//
// This serves the data that powers the D3 box-whisker and comparison charts.
//
// Injects: EnsembleService
