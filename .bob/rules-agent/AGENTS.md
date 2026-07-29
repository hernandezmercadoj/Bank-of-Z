# AGENTS.md — Agent Mode (Coding)

This file provides guidance to agents when writing or modifying code in this repository.

## Critical Coding Rules

### Git — MANDATORY
- **Always use `git commit -s`**. DCO sign-off is enforced. PRs with unsigned commits are rejected.

### z/OS Connect API operations
- `operation.yaml` contains only two fields: `version: "1.0"` and `zasset: "<PROGRAM>"`. Nothing else.
- Operation directories use **percent-encoded path names** (e.g., `%2Faccounts%2F%7BaccountId%7D/get/`). Match this exact encoding when adding new endpoints.
- `response_mapping.yaml` uses JSONata expressions against `$zosAssetResponse.commarea."<COMMAREA-FIELD>"`.
- `zosAsset.yaml` for CICS programs must include `ccsid: "037"` and `connectionRef: "bankzCicsConnection"`.
- IMS assets use `connectionRef: "imsConn"` and the appropriate IMS z/OS Connect asset type.

### COBOL (`src/base/`)
- Line 1 must have `CBL CICS('SP,EDF,DLI')` for CICS programs, and/or `CBL SQL` for DB2 programs.
- `END-IF`, `END-EVALUATE`, `END-READ`, `END-CALL`, `END-SEARCH` are **required** (ZCodeScan HIGH rule).
- All `EXEC SQL` blocks must check SQLCODE immediately after (ZCodeScan HIGH rule).
- No `SELECT *` in embedded SQL (ZCodeScan HIGH rule).
- Inline PERFORM bodies must stay under 30 lines; nested IFs under 6 levels deep.
- Copybooks for CICS programs go in `src/base/cics/copy/`; for IMS in `src/base/ims/copy/`.

### IBTRAN special rules (DO NOT CHANGE)
- Compiled with `NODYNAM,PGMNAME(LONGMIXED),NOEXP,NORENT,MAP,OBJECT,APOST,XREF`.
- Linked with `DYNAM(DLL),CASE(MIXED)` — produces a DLL for the IMS Java bridge.
- Link-edit stream includes `INCLUDE RESLIB(DFSLI000)` and `/usr/lpp/IBM/cobol/igyv6r5/lib/igzcjava.x`.

### IMS batch COBOL programs
- Link-edit stream must include `INCLUDE RESLIB(CBLTDLI)` and `ENTRY DLITCBL`.
- Affected programs: IBACSUM, IBGCUDAT, IBLOGIN1, IBLOGOUT, IBSCUDAT, LOADACCT, LOADCUSA, LOADCUST, LOADHIST, LOADTSTA.

### PL/I IMS programs (`src/base/ims/pli/`)
- Link-edit stream requires `ENTRY CEESTART` and `INCLUDE RESLIB(DFSLI000)`.

### Frontend (`src/frontend/`)
- **Zero dependencies** — do not add npm packages or introduce a build step.
- `config.js` uses ES module syntax (`export const`); consumed via `<script type="module">`.
- API proxy in `server.js` routes `/api/`, `/ims/`, `/customers`, `/accounts` to `API_BASE_URL`.
- Do not change the default sort code `987654` in `config.js` without coordinating with DB2 data.

### DBB Groovy scripts (`.setup/build/groovy/`)
- Scripts extend `@groovy.transform.BaseScript com.ibm.dbb.groovy.TaskScript baseScript`.
- Do **not** call `context.setVariable()` on a `LinkedHashSet` BUILD_LIST from Groovy — modify the set in-place (`buildList.add(...)`).
- The `buildMap.addOutput()` path and the `buildList.add()` path must be **identical** (the relative marker path, not the output file path).

### openapi.yaml
- Must be file-tag-neutral (untagged) before DBB runs the zOSConnect task. The pipeline does `chtag -r src/api/src/main/api/openapi.yaml` automatically — do not add a binary tag to this file.
