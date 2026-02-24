# TODO - Stuff to do After Week 3 (L04)

## GUI Setup
- [ ] Pick a GUI builder tool (e.g., Figma)
- [X] Build a splash page (with US map)
- [X] Select client framework (e.g., React)
- [X] Use Leaflet (or alternate) for including maps in GUI

## Data Acquisition
- [X] Download enacted district plan for Massachusetts
- [X] Download enacted district plan for Texas
- [X] Integrate MA district plan (as GeoJSON) into GUI map of state
- [X] Integrate TX district plan (as GeoJSON) into GUI map of state

## Reading / Research
- [X] Read Becker, et al paper ("Computational Redistricting and the Voting Rights Act")
- [ ] Read/run GerryChain (standard ReCom)
- [ ] Read/run modified GerryChain (VRA-constrained ReCom)
- [ ] Read/run PyEI (Ecological Inference)

## Client-Side Visualizations
- [X] Start using a client-side visualization library : 
  - D3 : Chart / Data Visualization Library
  - Leaflet : Interactive Map Library
- [ ] Build a bubble chart
- [ ] Build a bar chart
- [X] Build a box & whisker chart

## GUI Use-Cases
- [ ] Design the screen layout according to the defined use cases
  - For each use case, specify the corresponding UI location and controls (e.g., buttons, dropdowns, tabs)
- [ ] Define and select an appropriate color theme for the interface

- [X] GUI-1. Select state to display (required)
  - Location: SplashPage (/), US map + State dropdown
  - Behavior: Clicking a state on the map or selecting from the dropdown navigates to /state/:stateSlug
  - Result: StatePage loads for the selected state with enacted plan and analysis tabs
- [X] GUI-2. Display the current district plan when state is selected (required)
- [ ] GUI-3. State data summary (required)
- [ ] GUI-4. Display demographic heat map by precinct (required)
- [ ] GUI-5. Display demographic heat map by census block (preferred)
- [ ] GUI-6. Display Congressional representation table (required)
- [ ] GUI-7. Highlight district (preferred)
- [ ] GUI-8. Compare two district plans on the map (preferred)
- [ ] GUI-9. Display Gingles analysis results (required)
- [ ] GUI-10. Display the Gingles 2/3 analysis data in a tabular display (preferred) 
- [ ] GUI-11. Highlight a Gingles 2/3 table row (preferred)
- [ ] GUI-12. Display candidate results of Ecological Inference (EI) analysis (required)
- [ ] GUI-13. Display EI precinct results in a bar chart (preferred)
- [ ] GUI-14. Display EI precinct results in a choropleth maps (preferred) 
- [ ] GUI-15. Display EI KDE results (preferred)
- [ ] GUI-16. Display ensemble splits in a bar chart (required)
- [ ] GUI-17. Display box & whisker data (required) (SD)
- [ ] GUI-18. Display vote share vs seat share curve (preferred)
- [ ] GUI-19. Display an “interesting” district plan (preferred) 
- [ ] GUI-20. Reset page (preferred)
  - Location: StatePage
  - Behavior: Reset all StatePage state and navigate to /
  - Result: SplashPage with no state selected