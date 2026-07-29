# AGENTS.md — Ask Mode (Documentation & Exploration)

This file provides guidance to agents when answering questions about this repository.

## Non-Obvious Structural Facts

- **`src/` is entirely z/OS mainframe source**, not a web application src folder. Sub-directories: `src/base/` (COBOL/PL/I/ASM), `src/api/` (z/OS Connect Gradle project), `src/frontend/` (vanilla JS).
- **Customer routing is in the UI**, not the backend: the frontend JavaScript decides whether to call `/customers/…` (CICS path) or `/ims/customers/…` (IMS path) based on the customer ID's first character.
- **Operation YAML directories are percent-encoded URL paths**, not descriptive names. `%2F` = `/`, `%7B` = `{`, `%7D` = `}`. So `%2Faccounts%2F%7BaccountId%7D/get/` = `GET /accounts/{accountId}`.
- **`.setup/` is not application source** — it's the CI/CD and environment-setup scaffolding (pipeline scripts, DBB build config, Wazi Deploy config, JCL templates). Do not look here for application logic.
- **`src/api/src/main/zosAssets/`** contains the z/OS backend program descriptors (COMMAREA copybooks, `.dai` data interface files, generated JSON schemas). This is the glue between OpenAPI and COBOL COMMAREAs.
- **`src/base/ims/java/`** is the IMS Java Message Processing (JMP) module — a Java program running inside IMS that handles transaction history. It is not a standalone web service.
- **There are no unit tests that run locally**. Tests are TAZ unit tests that execute on z/OS USS only. The `zapp.yaml` `taz-test` profile defines where to find them.
- **`dbb-app.yaml`** is the application build manifest for IBM Dependency Based Build (DBB). It defines which files compile as COBOL vs PL/I vs Assembler, link-edit streams, and deploy types (LOAD, CICSLOAD, IMSLOAD, PSBLOAD, DBDLOAD, WAR, IMS-JAR, ZOSCONNECT-CONFIG).
- **`zowe.config.json`** configures Zowe CLI profiles for zosmf, ssh, rse, cics, and zOpenDebug. It uses `rejectUnauthorized: false` — self-signed certs are expected in this environment.
- **Deploy types map to z/OS libraries**: CICSLOAD → CICS program library, IMSLOAD → IMS program library, PSBLOAD → IMS PSB library, DBDLOAD → IMS DBD library. This mapping drives Wazi Deploy.
- **Two separate Liberty servers**: z/OS Connect runs on port 9080/9443; the frontend Liberty server runs on port 9081/9444 (see `.setup/config/config.yaml`).
- **Docker Compose** (`docker-compose.yaml`) provides a local simulation: `icr.io/zosconnect/ibm-zcon-designer:3.0.101` + Node.js frontend. It mounts `./src/api` as `/workspace/project`.
