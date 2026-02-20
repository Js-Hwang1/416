// DistrictController.java
//
// REST controller for district plan and individual district data.
//
// Annotations:
//   @RestController
//   @RequestMapping("/api/states/{stateId}/districts")
//
// Endpoints:
//   GET /api/states/{stateId}/districts          — get all districts for the enacted plan
//   GET /api/states/{stateId}/districts/{distId} — get one district's detail
//       (boundary GeoJSON, demographics, election results)
//
// Query params (future):
//   ?planType=enacted|proposed  — switch between enacted vs. algorithm-generated plans
//
// Injects: DistrictService
