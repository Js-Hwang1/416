// ElectionData.java
//
// Embedded subdocument for election results (not its own collection).
//
// This is used INSIDE Precinct and District — not stored independently.
// No @Document annotation needed.
//
// Fields:
//   int totalVotes;
//   int democraticVotes;
//   int republicanVotes;
//   int otherVotes;
//   String electionYear;         — "2024", "2020", "2016", etc.
//   String electionType;         — "presidential", "senate", "congressional"
//
// Source: 2024 General Election precinct-level results (Redistricting Data Hub)
