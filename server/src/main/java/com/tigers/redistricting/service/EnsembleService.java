// EnsembleService.java
//
// Business logic for GerryChain ensemble results.
//
// Annotations:
//   @Service
//
// Responsibilities:
//   - Fetch ensemble metadata and results from EnsembleRepository
//   - Compute summary statistics for box-whisker plots
//     (min, Q1, median, Q3, max per district metric)
//   - Compare enacted plan against ensemble distribution
//   - Convert Ensemble model -> EnsembleSummaryDTO
//
// Injects: EnsembleRepository
