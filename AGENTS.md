# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Overview

Bank of Z is a **hybrid z/OS mainframe banking application**. It routes requests based on customer ID prefix: customers starting with `C` go through **CICS** (COBOL + Db2), and customers starting with `I` go through **IMS TM** (COBOL/PL/I + IMS DB). The REST API layer is **z/OS Connect 3.0**, built via Gradle. The frontend is zero-dependency vanilla JS/HTML served by a Node.js proxy.

## Commands

### Frontend (local dev/Docker)
```bash
# Run frontend + z/OS Connect locally via Docker
docker compose up

# Run frontend standalone (from src/frontend/)
cd src/frontend && node server.js          # PORT=3001, API_BASE_URL=http://localhost:9080
```

### z/OS Connect API (Gradle, runs on z/OS USS)
```bash
# Build the z/OS Connect service archive (SAR)
cd src/api && gradle build                 # requires com.ibm.zosconnect.gradle:1.5.1
```

### IMS Java JMP module (Gradle, runs on z/OS USS)
```bash
cd src/base/ims/java && gradle build [-PoutputDir=<path>]
```

### DBB Build (z/OS USS only — not runnable locally)
```bash
# Full build (all sources)
dbb build full --hlq BANKZ.DBB --config dbb-app.yaml

# Impact/pipeline build (changed files only)
dbb build pipeline --hlq BANKZ.DBB --config dbb-app.yaml

# Single file (user build)
dbb build user <file> --hlq BANKZ.DBB --config dbb-app.yaml

# Build script wrapper (from .setup/)
bash .setup/tasks/task-dbb-build.sh [full|pipeline|preview]
```

### Static Analysis (z/OS USS only)
```bash
# ZCodeScan static analysis against COBOL/PL/I in src/base/
# Rules defined in zcodescan/zcodescan-rules.yaml
# max_rc=4 (warnings allowed, errors fail)
bash .setup/tasks/task-zcodescan-static-scan.sh
```

### Pipeline (via Zowe CLI from local machine)
```bash
bash .setup/pipeline-local.sh    # uploads + triggers pipeline-remote.sh on z/OS USS
```

### Unit Tests (z/OS USS — TAZ framework)
```bash
# TAZ unit test profile defined in zapp.yaml under "taz-test"
# Proc library: SYS1.PROCLIB, Load library: BANKZ.V0R1M0.LOAD
# No local test runner — tests run on z/OS only
```

## Git

**ALL commits require DCO sign-off** (enforced on PRs):
```bash
git commit -s -m "message"      # -s is MANDATORY, always
git commit --amend -s --no-edit # fix a forgotten sign-off
```

## Architecture — Non-Obvious Details

- **Customer routing is hardcoded in the UI** (`src/frontend/js/`): customer IDs beginning with `C` call `/customers/…`, IDs beginning with `I` call `/ims/customers/…`.
- **z/OS Connect operations use URL-encoded directory names** under `src/api/src/main/operations/`. Each path segment is percent-encoded (e.g., `%2Faccounts%2F%7BaccountId%7D/get/`).
- **Each API operation links to a zosAsset** via `operation.yaml` (e.g., `zasset: "INQACC"`). The matching zosAsset folder lives in `src/api/src/main/zosAssets/<PROGRAM>/`.
- **CICS programs use CCSID 037** (EBCDIC). The `zosAsset.yaml` for each CICS program declares `ccsid: "037"` and references a `connectionRef` pointing to `bankzCicsConnection`.
- **IMS programs use the `ims-1.0` z/OS Connect feature** and connect via `imsConn` referencing `IMS_DATASTORE`, `IMS_HOST`, `IMS_PORT` env vars.
- **IBTRAN.cbl is special**: compiled with `NODYNAM,PGMNAME(LONGMIXED)` and linked as a DLL (`DYNAM(DLL),CASE(MIXED)`) for the IMS Java bridge — do not change its compile/link parms.
- **IMS batch COBOL programs** (IBACSUM, IBGCUDAT, etc.) require `ENTRY DLITCBL` in their link-edit stream and `INCLUDE RESLIB(CBLTDLI)`.
- **Frontend WAR packaging**: `VanillaFrontend.groovy` strips `package.json`, `server.js`, `README.md`, `.gitignore` before creating the WAR. It also runs `chtag -r assets/images/*` before `jar`.
- **DBB build source directories** are: `Bank-of-Z/src/base`, `Bank-of-Z/src/api/src/main/api`, `Bank-of-Z/src/frontend` (configured in `dbb-app.yaml`).
- **Copybook search path** for COBOL uses `${WORKSPACE}/?path=${APP_DIR_NAME}/src/base/**/*.cpy` (wildcard expansion via DBB).
- **`openapi.yaml` must be untagged** before DBB runs the zOSConnect task: the pipeline script runs `chtag -r src/api/src/main/api/openapi.yaml` before `dbb build`.
- **The frontend's `config.js` hardcodes sort code `987654`** as the default (`config.defaults.sortCode`).

## Code Style

### COBOL (`src/base/`)
- Programs start with `CBL CICS(...)` and/or `CBL SQL` directives on line 1 when applicable.
- Copybooks live in `src/base/cics/copy/` and `src/base/ims/copy/`.
- ZCodeScan enforces: `END-IF`/`END-EVALUATE`/`END-READ` required, max 6 nested IFs, max 30-line inline PERFORMs, no `SELECT *` in SQL, SQLCODE must be checked after every EXEC SQL.
- Condition name prefix rule expects prefix `TEST`.

### PL/I (`src/base/batch/pli/`, `src/base/ims/pli/`)
- IMS PL/I programs must include `ENTRY CEESTART` and `INCLUDE RESLIB(DFSLI000)` in link-edit stream.

### z/OS Connect API (`src/api/`)
- `operation.yaml`: only two fields — `version: "1.0"` and `zasset: "<PROGRAM_NAME>"`.
- `response_mapping.yaml`: maps response YAML files to HTTP status codes with optional JSONata conditions on `$zosAssetResponse`.
- `zosAsset.yaml`: declares `type`, `program`, `transid`, `connectionRef`, and `ccsid` for CICS assets.

### Frontend (`src/frontend/`)
- Zero npm dependencies — no build step, no bundler. Do not add dependencies.
- API calls proxy through `server.js`: URLs starting `/api/`, `/ims/`, `/customers`, `/accounts` are forwarded to `API_BASE_URL` (default `http://localhost:9080`).
- `config.js` uses ES module `export` syntax despite being served as plain HTML — it is loaded via `<script type="module">`.
