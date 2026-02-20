// DistrictService.java
//
// Business logic for district plan operations.
//
// Annotations:
//   @Service
//
// Responsibilities:
//   - Fetch district data from DistrictRepository
//   - Filter districts by plan type (enacted vs proposed)
//   - Compute per-district metrics (partisan lean, demographic breakdown)
//   - Convert District model -> DistrictPlanDTO
//
// Injects: DistrictRepository
