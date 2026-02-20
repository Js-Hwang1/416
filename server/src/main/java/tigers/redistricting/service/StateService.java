// StateService.java
//
// Business logic for state-level operations.
//
// Annotations:
//   @Service
//
// Responsibilities:
//   - Fetch state data from StateRepository
//   - Convert State model -> StateSummaryDTO for lightweight API responses
//   - Aggregate summary statistics (total population, num districts, etc.)
//
// Injects: StateRepository
