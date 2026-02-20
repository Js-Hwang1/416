# Server and Mongo Guide (Windows + PowerShell)

## 1) First-time setup (install tools)

```powershell
winget install --id MongoDB.Server -e
winget install --id MongoDB.Shell -e
winget install --id MongoDB.DatabaseTools -e
```

`MongoDB.Shell` gives you `mongosh`.
`MongoDB.DatabaseTools` gives you `mongoimport`.

## 2) Go to the server folder

```powershell
cd C:\Users\kzhao\OneDrive\Desktop\CSE416\416\server
```

## 3) Start MongoDB

```powershell
Get-Service MongoDB
Start-Service MongoDB
```

Useful service commands:

```powershell
Stop-Service MongoDB
Restart-Service MongoDB
```

## 4) Run the Spring Boot server

```powershell
.\gradlew.bat bootRun
```

If port `8080` is busy:

```powershell
.\gradlew.bat bootRun --args="--server.port=8085"
```

## 5) Stop the Spring server

In the terminal running `bootRun`:

```text
Ctrl + C
```

Then type:

```text
Y
```

## 6) Quick API tests

```powershell
Invoke-RestMethod "http://localhost:8080/hello?name=Tiger"
Invoke-RestMethod "http://localhost:8080/mongo-test" | ConvertTo-Json
```

If you used another port, replace `8080`.

## 7) Open Mongo shell

From PowerShell:

```powershell
mongosh "mongodb://localhost:27017/tigers-db"
```

Inside `mongosh`:

```javascript
show dbs
use tigers-db
show collections
db.connection_test.find().pretty()
```

## 8) Run the project data script

Script file:

```text
database/data/clean_data.py
```

Run it:

```powershell
cd C:\Users\kzhao\OneDrive\Desktop\CSE416\416\server
python .\database\data\clean_data.py
```

Generated outputs:

```text
database/data/cleaned/geojson
database/data/cleaned/gerrychain
database/data/cleaned/summary
```

## 9) Import cleaned files into MongoDB

```powershell
cd C:\Users\kzhao\OneDrive\Desktop\CSE416\416\server
mongoimport --uri "mongodb://localhost:27017/tigers-db" --collection ma_districts --drop --file ".\database\data\cleaned\geojson\ma_congressional_districts.geojson"
mongoimport --uri "mongodb://localhost:27017/tigers-db" --collection tx_districts --drop --file ".\database\data\cleaned\geojson\tx_congressional_districts.geojson"
mongoimport --uri "mongodb://localhost:27017/tigers-db" --collection ma_summary --drop --file ".\database\data\cleaned\summary\ma_state_summary.json"
mongoimport --uri "mongodb://localhost:27017/tigers-db" --collection tx_summary --drop --file ".\database\data\cleaned\summary\tx_state_summary.json"
```

## 10) What is a collection?

A database contains collections. A collection contains documents.

Example:

```javascript
db.users.drop()
db.posts.drop()
```

`users` and `posts` are two different collections.

## 11) Your two document examples

The documents you posted can be in either:

- Different collections, or
- The same collection with different fields.

For your current `tigers-db`, those two `_id` values are in the same collection: `connection_test`.

Check this yourself:

```javascript
db.connection_test.findOne({ _id: ObjectId("6998e5e25c4c086639d483a0") })
db.connection_test.findOne({ _id: ObjectId("6998ea54fbbd7ce268cdde9a") })
```

If you want cleaner structure, keep test docs in `connection_test` and GeoJSON docs in a separate collection such as `ma_districts`.

## 12) Common troubleshooting commands

Check port usage:

```powershell
Get-NetTCPConnection -LocalPort 8080 | Select-Object LocalAddress, LocalPort, OwningProcess
```

Find process by PID:

```powershell
Get-Process -Id <PID>
```

Stop process by PID:

```powershell
Stop-Process -Id <PID>
```

Build without running:

```powershell
.\gradlew.bat classes
```

Run tests:

```powershell
.\gradlew.bat test
```
