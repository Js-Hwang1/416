// PrecinctController.java
//
// REST controller for precinct/VTD-level data.
//
// Annotations:
//   @RestController
//   @RequestMapping("/api/states/{stateId}/precincts")
//
// Endpoints:
//   GET /api/states/{stateId}/precincts            — get all precincts for a state
//       (WARNING: this is thousands of records — consider pagination or bbox filtering)
//   GET /api/states/{stateId}/precincts/{precinctId} — single precinct detail
//
// Query params (future):
//   ?districtId=5       — filter precincts belonging to a specific district
//   ?bbox=minLng,minLat,maxLng,maxLat — spatial bounding box filter
//
// Injects: PrecinctService
