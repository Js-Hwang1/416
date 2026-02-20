# TODO - Stuff to do After Week 3 (L04)

## GUI Setup
- [ ] Pick a GUI builder tool (e.g., Figma)
- [ ] Build a splash page (with US map)
- [ ] Select client framework (e.g., React)
- [ ] Use Leaflet (or alternate) for including maps in GUI

## Data Acquisition
- [X] Download enacted district plan for Massachusetts
- [X] Download enacted district plan for Texas
- [ ] Integrate MA district plan (as GeoJSON) into GUI map of state
- [ ] Integrate TX district plan (as GeoJSON) into GUI map of state

## Reading / Research
- [X] Read Becker, et al paper ("Computational Redistricting and the Voting Rights Act")
- [ ] Read/run GerryChain (standard ReCom)
- [ ] Read/run modified GerryChain (VRA-constrained ReCom)
- [ ] Read/run PyEI (Ecological Inference)

## Client-Side Visualizations
- [ ] Start using a client-side visualization library (e.g., D3)
- [ ] Build a bubble chart
- [ ] Build a bar chart
- [ ] Build a box & whisker chart

## GUI Requirements

### General GUI

- [X] **GUI-1.** Select state to display (required) — User picks a state via dropdown or clicking on US map; displays ensemble summary table and state map 
- [X] **GUI-2.** Display current district plan when state is selected (required) — Show 2022 Congressional district plan on centered state map at appropriate zoom
- [ ] **GUI-3.** State data summary (required) — Show state population, voter distribution, racial/ethnic group populations, party control, and Congressional representatives by party
- [ ] **GUI-4.** Display demographic heat map by precinct (required) — Monochromatic heat map of selected minority group percentage per precinct with legend
- [ ] **GUI-5.** Display demographic heat map by census block (preferred) — Monochromatic heat map of selected minority group percentage per census block with legend
- [ ] **GUI-6.** Display Congressional representation table (required) — Table with district number, representative, party, racial/ethnic group, and vote margin
- [ ] **GUI-7.** Highlight district (preferred) — Clicking district in table highlights it on the map
- [ ] **GUI-8.** Compare two district plans on the map (preferred) — Compare selected random plan with enacted plan side by side
- [ ] **GUI-9.** Display Gingles analysis results (required) — Scatter plot of precinct-level election results with racial/ethnic group percentage vs party vote share

### Ecological Inference & Analysis

- [ ] **GUI-10.** Display Gingles 2/3 analysis data in tabular display (preferred) — Table with population, region type, minority population, income, and votes per precinct
- [ ] **GUI-11.** Highlight a Gingles 2/3 table row (preferred) — Selecting a dot in scatter plot highlights corresponding precinct in table
- [ ] **GUI-12.** Display candidate results of Ecological Inference (EI) analysis (required) — EI results by racial/language group per candidate with probability curves
- [ ] **GUI-13.** Display EI precinct results in a bar chart (preferred) — Bar chart with peak values and confidence intervals for each category
- [ ] **GUI-14.** Display EI precinct results in choropleth maps (preferred) — One map per candidate colored by support level per precinct
- [ ] **GUI-15.** Display EI KDE results (preferred) — KDE comparing candidate support between two racial/ethnic groups

### Ensemble & Comparison

- [ ] **GUI-16.** Display ensemble splits in a bar chart (required) — Compare race-blind and VRA-constrained ensemble results showing R/D win splits
- [ ] **GUI-17.** Display box & whisker data (required) — Box & whisker plot per ensemble for each racial/ethnic group with enacted plan dots
- [ ] **GUI-18.** Display vote share vs seat share curve (preferred) — Show curve if Gingles test indicates racially polarized voting; disable if not

## GUI Use-Cases
- [ ] GUI-1. Select state to display (required)
- [ ] GUI-2. Display the current district plan when state is selected (required)
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