// EnsembleSummaryDTO.java
//
// Response object for ensemble analysis data — powers the D3 charts.
//
// Fields:
//   String ensembleId;
//   String stateId;
//   String algorithm;               — "ReCom" or "VRA-constrained ReCom"
//   int numSamples;
//   List<BoxWhiskerData> districtMetrics;  — one per district, for the box-whisker chart
//
// Inner class:
//   BoxWhiskerData:
//     int districtNumber;
//     double min;
//     double q1;
//     double median;
//     double q3;
//     double max;
//     double enactedValue;          — the enacted plan's value for comparison
