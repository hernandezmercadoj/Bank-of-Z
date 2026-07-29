# AGENTS.md — Plan Mode (Architecture & Design)

This file provides guidance to agents when planning changes to this repository.

## Architectural Constraints

### Request Flow (Non-Negotiable Routing)
```
Frontend JS → /customers/...       → z/OS Connect → CICS COBOL → Db2
Frontend JS → /ims/customers/...   → z/OS Connect → IMS TM COBOL/PL/I → IMS DB + Db2 (history)
```
Customer ID prefix determines the path — `C` prefix = CICS, `I` prefix = IMS. This is enforced in `src/frontend/js/`.

### Adding a New API Endpoint
1. Add the path to `src/api/src/main/api/openapi.yaml`.
2. Create a percent-encoded directory under `src/api/src/main/operations/` matching the path + HTTP method.
3. Add `operation.yaml` (only `version` + `zasset` fields), `request.yaml`, `response_<code>.yaml` files, and `response_mapping.yaml`.
4. Create a corresponding `src/api/src/main/zosAssets/<PROGRAM>/` directory with `zosAsset.yaml`, `providerFiles/COMMAREA.cpy`, `request.dai`, `response.dai`, and let DBB generate the `gen/` files.

### Adding a New COBOL Program
- CICS programs → `src/base/cics/cobol/`, copybooks → `src/base/cics/copy/`.
- IMS programs → `src/base/ims/cobol/`, copybooks → `src/base/ims/copy/`.
- Batch programs → `src/base/batch/`.
- DBB auto-discovers files by glob (`**/src/base/**/cobol/*.cbl`). No registration needed, but deploy type must be verified in `dbb-app.yaml` if special link-edit is required.
- IMS programs needing the CBLTDLI interface must be explicitly listed in the `linkEditStream.forFiles` list in `dbb-app.yaml`.

### Frontend Changes
- The frontend is packaged as a WAR by `VanillaFrontend.groovy` and deployed to the frontend Liberty server. Changes to `src/frontend/` trigger a WAR rebuild on impact/pipeline builds.
- Do not introduce any build tooling, bundlers, or npm dependencies — the WAR packaging (`jar -cvf`) assumes flat file copy.

### IMS Java (JMP) Changes
- Compiled by `ImsJavaBuilder.groovy` via Gradle on z/OS USS. Java 21 required (`src/base/ims/java/build.gradle`).
- Output JAR name is `nazare-ims-jmp-<version>.jar`, deployed with `deployType: IMS-JAR`.
- Dependencies: `com.ibm.db2:jcc`, `com.ibm.ims:udb`, `com.ibm.jzos:ibmjzos` — all must be available in Maven Central on z/OS.

### Secret / Credential Handling
- Pre-commit hook uses `ibm/detect-secrets` with `--fail-on-unaudited`. New secrets must be added to `.secrets.baseline` before committing.
- All credentials (CICS, IMS, Db2, z/OS) are injected via environment variables — never hardcode credentials in any config file.
- `cics.xml` and `ims.xml` use `${CICS_HOST}`, `${CICS_USER}`, `${IMS_HOST}`, etc. as Liberty variable references.

### Build Lifecycle Selection
- `full`: rebuilds everything — use for baseline or after large refactors.
- `pipeline`/`impact`: only changed files + their dependents (via DBB impact analysis) — use for feature branches.
- `user`: single file only, includes TAZ unit test step — use for developer inner loop.
- `merge`: for topic branches being merged back to main — does not run zOSConnect or packaging tasks.
