Group Tigers! 

We'll be performing analysis on states: 
1. Massachusetts (Non-preclearance State)
2. Texas (Preclearance State)

Tech Stack:
JS (or TS), D3 (GUI), Java (Server), Python, and etc.

Data Sources:

### Precinct/VTD Shapefiles (MGGG)
1. [MA Precincts (2012-2016)](https://github.com/mggg-states/MA-shapefiles) — Precinct boundaries, 2010 Census demographics (VAP by race), 2012-2018 election results, Congressional/State Senate/State House district assignments
2. [TX VTDs](https://github.com/mggg-states/TX-shapefiles) ([direct download](https://people.csail.mit.edu/ddeford/TX_vtds.zip)) — VTD boundaries, 2010 Census demographics (VAP by race), 2012-2016 election results, Congressional/State Senate/State House district assignments

### 2024 Election Results (Redistricting Data Hub)
3. [MA 2024 General Election Precincts](https://redistrictingdatahub.org/dataset/massachusetts-2024-general-election-precinct-level-results-and-boundaries/) — Precinct-level 2024 Presidential (Harris/Trump), US Senate, Congressional, State Legislature results with boundaries
4. [TX 2024 General Election VTDs](https://redistrictingdatahub.org/dataset/texas-2024-general-election-precinct-level-texas-vtd-results-and-boundaries/) — VTD-level 2024 Presidential, US Senate, Congressional, State Legislature results with boundaries. **Use the `tx_2024_gen_all_tx_vtd` subfolder** (not `cong`)

### 2020 Census PL 94-171 Demographics (Redistricting Data Hub)
5. [MA Census Blocks PL 94-171](https://redistrictingdatahub.org/dataset/massachusetts-block-pl-94171-2020/) — Block-level 2020 Census population by race/ethnicity (P1-P4 tables) with geometry
6. [TX Census Blocks PL 94-171](https://redistrictingdatahub.org/dataset/texas-block-pl-94171-2020/) — Block-level 2020 Census population by race/ethnicity (P1-P4 tables) with geometry

### Congressional District Boundaries (Census TIGER/Line)
7. [MA 118th Congress Districts](https://www2.census.gov/geo/tiger/TIGER2023/CD/tl_2023_25_cd118.zip) — 9 Congressional district boundary polygons (convert to GeoJSON for Leaflet)
8. [TX 118th Congress Districts](https://www2.census.gov/geo/tiger/TIGER2023/CD/tl_2023_48_cd118.zip) — 38 Congressional district boundary polygons (convert to GeoJSON for Leaflet)

### ACS Median Household Income — Table B19013 (Census Bureau)
9. [MA Income by Tract](https://data.census.gov/table/ACSDT5Y2023.B19013?q=B19013&g=040XX00US25$1400000) — ACS 5-year median household income at census tract level
10. [TX Income by Tract](https://data.census.gov/table/ACSDT5Y2023.B19013?q=B19013&g=040XX00US48$1400000) — ACS 5-year median household income at census tract level

### Urban/Rural Classification (Census TIGER/Line)
11. [2020 Urban Areas (National)](https://www2.census.gov/geo/tiger/TIGER2025/UAC20/tl_2025_us_uac20.zip) — Urban area boundary polygons for classifying precincts as urban/rural/suburban