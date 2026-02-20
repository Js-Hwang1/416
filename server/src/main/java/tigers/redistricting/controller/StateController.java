// StateController.java
//
// REST controller for state-level data.
//
// Annotations:
//   @RestController
//   @RequestMapping("/api/states")
//
// Endpoints:
//   GET /api/states              — list all available states (MA, TX) with summary info
//   GET /api/states/{stateId}    — get a single state's details (boundary, summary stats)
//
// Injects: StateService
//
// This is the first endpoint the frontend hits on load (splash page with US map).
// Returns lightweight summaries, NOT full GeoJSON boundaries (those come from
// the district/precinct endpoints).
