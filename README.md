Group Tigers!  

We'll be performing analysis on states: 
1. Massachusetts (Non-preclearance State)
2. Texas (Preclearance State)

Tech Stack: React, D3, MapLibre GL, Spring Boot, MongoDB, Python

### Prerequisites

- **Java 21** (check with `java -version`)
- **Node.js / npm** (check with `node -v`)
- **MongoDB** running locally on port 27017 (check with `mongosh --eval "db.runCommand({ping:1})"`)
- **Python 3** with `pymongo` (`pip install pymongo`)

### First-Time Setup

1. **Populate the database** (only needed once):
   ```
   cd server/database
   python populate_database.py
   ```
   To reset and re-populate: `python populate_database.py --drop`

2. **Generate vector tiles** (only needed once, requires [tippecanoe](https://github.com/felt/tippecanoe)):
   ```
   brew install tippecanoe
   cd server/database
   ./generate_tiles.sh
   ```

3. **Install frontend dependencies** (only needed once):
   ```
   cd client
   npm install
   ```

### Running the App

Open two terminals:

**Terminal 1 — Server** (Spring Boot on http://localhost:8080):
```
cd server
./gradlew bootRun
```
Wait for `Started RedistrictingApplication in X.XX seconds` before opening the client.

**Terminal 2 — Client** (React on http://localhost:3000):
```
cd client
npm start
```

Open http://localhost:3000 in your browser.

Group Member Roles:
Karen Zhao - Database
Kevin Darby - Frontend 
Junsung Hwang - Backend (Server)

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

