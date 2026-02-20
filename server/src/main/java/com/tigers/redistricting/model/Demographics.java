// Demographics.java
//
// Embedded subdocument for population demographics (not its own collection).
//
// This is used INSIDE Precinct, District, and State — not stored independently.
// No @Document annotation needed.
//
// Fields:
//   int totalPopulation;
//   int whitePop;
//   int blackPop;
//   int hispanicPop;
//   int asianPop;
//   int nativeAmericanPop;
//   int otherPop;
//   int votingAgePop;            — total VAP (voting age population)
//   int whiteVAP;
//   int blackVAP;
//   int hispanicVAP;
//   int asianVAP;
//
// Source: 2020 Census PL 94-171 tables (P1-P4)
