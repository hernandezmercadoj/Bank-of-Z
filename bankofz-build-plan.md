# Bank of Z — Plan de Compilación Completo

## Resumen

Este plan configura y ejecuta la compilación completa de la aplicación **Bank of Z** usando el
framework **IBM DBB (Dependency Based Build) con zBuilder**. Se modifican los ficheros de
configuración necesarios para establecer el HLQ `ADMINISTRATOR.BANKOFZ`, se verifican las
rutas de datasets para los módulos CICS y IMS, y se documenta el ciclo de vida `full` que
orquesta todos los pasos de compilación en el orden correcto.

**HLQ configurado:** `ADMINISTRATOR.BANKOFZ`

**Artefactos que se producen:**
- 29 módulos CICS COBOL → `ADMINISTRATOR.BANKOFZ.LOADLIB` (deployType: CICSLOAD)
- 10 módulos IMS COBOL  → `IMSV15.{datastore}.PGMLIB`    (deployType: IMSLOAD)
- 1 módulo batch PL/I   → `ADMINISTRATOR.BANKOFZ.LOAD`    (deployType: LOAD)
- 1 módulo IMS PL/I     → `IMSV15.{datastore}.PGMLIB`    (deployType: IMSLOAD)
- 9 mapas BMS          → `ADMINISTRATOR.BANKOFZ.LOADLIB`  (deployType: CICSLOAD/MAPLOAD)
- 8 PSBs IMS           → `IMSV15.{datastore}.PSBLIB`     (deployType: PSBLOAD)
- 9 DBDs IMS           → `IMSV15.{datastore}.DBDLIB`     (deployType: DBDLOAD)
- ~25 DBRMs Db2        → `ADMINISTRATOR.BANKOFZ.DBRM`     (deployType: DBRM)
- 1 JAR IMS Java       → USS `{sandbox_path}/jars`        (deployType: IMS-JAR)
- 1 WAR Frontend       → USS Liberty apps directory        (deployType: WAR)
- 1 WAR z/OS Connect   → USS z/OS Connect apps directory   (deployType: WAR)

---

## Arquitectura del sistema de build

El build se controla desde **dos ficheros YAML** que trabajan juntos:

```
dbb-app.yaml              ← Configuración específica de la aplicación BANKZ
                            (fuentes, opciones de compilador, deployTypes)
.setup/build/dbb-build.yaml ← Ciclos de vida del build + referencia a Languages.yaml
.setup/build/datasets.yaml  ← Referencias a los PDS de compiladores y runtimes
.setup/build/languages/     ← Configuración de cada lenguaje (Cobol.yaml, PLI.yaml, etc.)
```

El ciclo de vida **`full`** ejecuta estas tareas en orden:

```
Start → ScannerInit → MetadataInit → FullAnalysis → Languages
      → VanillaFrontend → ServerXmlPackager → ImsJavaBuilder
      → zOSConnect → Package → Finish
```

El stage `Languages` compila en paralelo: BMS → COBOL → PLI → Assembler → LinkEdit

---

## Sub-Tareas

---

### Sub-Tarea 1 — Configurar el HLQ en datasets.yaml

**Status:** `[ ] pending`

**Intent:**
El fichero `.setup/build/datasets.yaml` define los nombres de los datasets PDS que
zBuilder usará para colocar los objetos compilados (OBJ), los módulos de carga (LOAD),
los mapas BMS (BMS.COPY), y los DBRMs Db2. Actualmente estos nombres se toman de la
variable `${HLQ}` en tiempo de build. Este paso asegura que el HLQ quede fijado a
`ADMINISTRATOR.BANKOFZ` como valor por defecto para builds locales o añadido como
variable de entorno para builds automatizados.

**Expected Outcomes:**
- La variable `HLQ` en el entorno de build resuelve a `ADMINISTRATOR.BANKOFZ`.
- Los datasets de salida tendrán la forma `ADMINISTRATOR.BANKOFZ.LOAD`,
  `ADMINISTRATOR.BANKOFZ.LOADLIB`, `ADMINISTRATOR.BANKOFZ.DBRM`, etc.

**Todo List:**
1. Abrir `.setup/build/datasets.yaml`.
2. Añadir al final del fichero la variable:
   ```yaml
   - name: HLQ
     value: ADMINISTRATOR.BANKOFZ
   ```
3. Verificar que no existe otra definición de `HLQ` en el mismo fichero que pueda
   colisionar.

**Relevant Context:**
- Fichero a modificar: [`.setup/build/datasets.yaml`](.setup/build/datasets.yaml)
- La variable `${HLQ}` es referenciada en [`dbb-build.yaml`](.setup/build/dbb-build.yaml)
  línea 179 (`${HLQ}.LOAD`) y en [`types_pattern_mapping.yml`](.setup/deploy/types_pattern_mapping.yml)
  en todos los patrones `{{ hlq }}.LOAD`, `{{ hlq }}.LOADLIB`, `{{ hlq }}.DBRM`, etc.

---

### Sub-Tarea 2 — Verificar las rutas de compiladores y runtimes en datasets.yaml

**Status:** `[ ] pending`

**Intent:**
El fichero `datasets.yaml` también define los datasets de los compiladores COBOL, PL/I,
CICS, IMS y Db2. Para que el build funcione con el HLQ `ADMINISTRATOR.BANKOFZ` se necesita
confirmar que los nombres de datasets del entorno z/OS de destino coinciden con los valores
actuales del fichero (que apuntan a los estándares de instalación del lab).

**Expected Outcomes:**
- Todos los datasets de compiladores y runtimes declarados en `datasets.yaml` son
  accesibles desde el sistema z/OS de destino.
- Queda documentado qué datasets corresponden a CICS vs IMS vs Db2.

**Todo List:**
1. Revisar y confirmar los valores de los datasets de compiladores en `datasets.yaml`:
   - COBOL v6.5: `IGY.V6R5M0.SIGYCOMP` (variable `SIGYCOMP`)
   - PL/I v6.2: `PLI.V6R2M0.SIBMZCMP` (variable `IBMZPLI`)
   - Assembler: `ASM.SASMMOD1` (variable `SASMMOD1`)
2. Confirmar los datasets de runtime CICS (necesarios para módulos CICS):
   - `CICSTS63.CICS.SDFHMAC` → macros CICS (`SDFHMAC`)
   - `CICSTS63.CICS.SDFHLOAD` → load library CICS (`SDFHLOAD`)
   - `CICSTS63.CICS.SDFHCOB` → stub CICS para COBOL (`SDFHCOB`)
3. Confirmar los datasets de runtime IMS (necesarios para módulos IMS):
   - `IMSV15.SDFSMAC` → macros IMS (`SDFSMAC`)
   - `IMSV15.SDFSRESL` → RESLIB IMS con CBLTDLI y DFSLI000 (`RESLIB`)
4. Confirmar los datasets de Db2 (necesarios para SQL pre-compilación):
   - `DB2V13.SDSNLOAD` → load library Db2 (`SDSNLOAD`)
   - `DB2V13.SDSNEXIT` → exit library Db2 (`SDSNEXIT`)
5. Si algún nombre no corresponde al entorno real, actualizarlo en `datasets.yaml`.

**Relevant Context:**
- Fichero a revisar: [`.setup/build/datasets.yaml`](.setup/build/datasets.yaml)
- Los datasets CICS son imprescindibles para los 29 programas con `IS_CICS=true`
  (todos los programas bajo `src/base/cics/cobol/`).
- Los datasets IMS (RESLIB) son imprescindibles para los link-edits de IMS que
  incluyen `INCLUDE RESLIB(CBLTDLI)` e `INCLUDE RESLIB(DFSLI000)` — definidos en
  [`dbb-app.yaml`](dbb-app.yaml) líneas 157–181.

---

### Sub-Tarea 3 — Confirmar la correcta clasificación CICS vs IMS en dbb-app.yaml

**Status:** `[ ] pending`

**Intent:**
El fichero `dbb-app.yaml` determina qué programas se compilan como CICS (`IS_CICS=true`),
como IMS (`deployType: IMSLOAD`) y cuáles incluyen SQL (`IS_SQL=true`). Esta sub-tarea
verifica que los patrones de fichero y las condiciones del fichero YAML capturan
correctamente todos los programas de la aplicación sin dejar ninguno sin clasificar.

**Expected Outcomes:**
- Los 29 programas CICS bajo `src/base/cics/cobol/` se compilan con opciones CICS
  y se depositan en `ADMINISTRATOR.BANKOFZ.LOADLIB`.
- Los 10 programas IMS COBOL bajo `src/base/ims/cobol/` se compilan con opciones IMS
  y se depositan en `IMSV15.{datastore}.PGMLIB`.
- Los ~12 programas con `EXEC SQL` reciben la opción `SQL` en compileParms y generan
  DBRMs en `ADMINISTRATOR.BANKOFZ.DBRM`.
- `IBTRAN.cbl` usa sus parámetros especiales: `PGMNAME(LONGMIXED)`, `NODYNAM`,
  `DYNAM(DLL)`, `CASE(MIXED)` y el linkEditStream con `igzcjava.x`.

**Todo List:**
1. Verificar en `dbb-app.yaml` que el patrón `**/src/base/**/cobol/*.cbl` cubre
   tanto `src/base/cics/cobol/` como `src/base/ims/cobol/`.
2. Confirmar que la condición `${IS_CICS}` se activa para todos los programas bajo
   `src/base/cics/cobol/` (se detecta por la directiva `PROCESS CICS` o `CBL CICS`
   en el propio fuente, que DBB lee automáticamente).
3. Confirmar que el override `forFiles: "**/src/base/ims/cobol/*.cbl"` con
   `deployType: IMSLOAD` cubre los 10 programas IMS COBOL.
4. Confirmar el linkEditStream especial de IBTRAN (líneas 154–160 de `dbb-app.yaml`):
   - `INCLUDE RESLIB(DFSLI000)` — interfaz de lenguaje IMS
   - `INCLUDE '/usr/lpp/IBM/cobol/igyv6r5/lib/igzcjava.x'` — librería Java para COBOL
   - `NAME IBTRAN(R)` — nombre del módulo de salida
5. Confirmar el linkEditStream IMS estándar para los 10 programas IMS COBOL
   (líneas 167–182 de `dbb-app.yaml`): `INCLUDE RESLIB(CBLTDLI)`, `ENTRY DLITCBL`.

**Relevant Context:**
- Fichero a revisar: [`dbb-app.yaml`](dbb-app.yaml) líneas 92–202
- Programas CICS+SQL: BANKDATA, CRECUST, DELACC, DELCUS, CREACC, INQCUST, UPDACC,
  UPDCUST, INQACC, XFRFUN, DBCRFUN, INQACCCU
- Programas CICS-only (sin SQL): ABNDPROC, BNK1CCS, BNK1DCS, BNK1UAC, BNK1CAC,
  BNK1CCA, BNK1CRA, BNK1DAC, BNK1TFN, BNKMENU, GETCOMPY, GETSCODE, CRDTAGY1-5
- Programa especial IMS-Java bridge: IBTRAN (requiere overrides exclusivos)

---

### Sub-Tarea 4 — Verificar configuración de BMS y Assembler (PSB/DBD)

**Status:** `[ ] pending`

**Intent:**
Los mapas BMS (9 fuentes) deben compilarse en dos pasos: primero en modo DSECT para
generar los copybooks (MAPCOPY), y luego en modo MAP para generar los módulos de carga
(MAPLOAD/CICSLOAD). Los PSBs (8) y DBDs (9) IMS se ensamblan con ASMA90 y se depositan
en las librerías dedicadas de IMS.

**Expected Outcomes:**
- Los 9 mapas BMS generan sus copybooks en `ADMINISTRATOR.BANKOFZ.BMS.COPY` y sus
  módulos en `ADMINISTRATOR.BANKOFZ.LOADLIB`.
- Los 8 PSBs IMS se depositan en `IMSV15.{datastore}.PSBLIB`.
- Los 9 DBDs IMS se depositan en `IMSV15.{datastore}.DBDLIB`.

**Todo List:**
1. Verificar en `dbb-app.yaml` (tarea `Assembler`, líneas 339–384) que los patrones
   de fichero distinguen correctamente:
   - `**/src/base/ims/PSB/*.asm` → `deployType: PSBLOAD`
   - `**/src/base/ims/DBD/*.asm` → `deployType: DBDLOAD`
2. Confirmar en [`BMS.yaml`](.setup/build/languages/BMS.yaml) que el paso CopyGen
   usa `SYSPARM(DSECT)` y el paso Compile usa `SYSPARM(MAP)`.
3. Confirmar que los 9 fuentes BMS bajo `src/base/cics/bms/` están cubiertos por
   el patrón `**.bms` de la tarea BMS.
4. Verificar que los ficheros de ensamblador PSB/DBD usan la macro correcta de IMS
   (`IMSV15.SDFSMAC`) para resolver referencias durante el ensamblado.

**Relevant Context:**
- Fuentes BMS: [`src/base/cics/bms/`](src/base/cics/bms/) (9 ficheros `.bms`)
- Fuentes PSB: [`src/base/ims/PSB/`](src/base/ims/PSB/) (8 ficheros `.asm`)
- Fuentes DBD: [`src/base/ims/DBD/`](src/base/ims/DBD/) (9 ficheros `.asm`)
- Config BMS: [`.setup/build/languages/BMS.yaml`](.setup/build/languages/BMS.yaml)

---

### Sub-Tarea 5 — Verificar las tareas no-COBOL: PLI, ImsJavaBuilder, VanillaFrontend, zOSConnect

**Status:** `[ ] pending`

**Intent:**
La compilación completa incluye componentes en PL/I (batch + IMS), un proyecto Java
con Gradle para el JMP de IMS, el frontend HTML/CSS/JS que se empaqueta en un WAR, y
la especificación OpenAPI para z/OS Connect. Esta sub-tarea verifica que cada uno de
estos componentes tiene su configuración correcta para producir los artefactos esperados
bajo el HLQ `ADMINISTRATOR.BANKOFZ`.

**Expected Outcomes:**
- `BNKSTMT.pli` (batch) compila y su módulo va a `ADMINISTRATOR.BANKOFZ.LOAD`.
- `IBLOGIN.pli` (IMS) compila con `isIMS=true` y su módulo va a `IMSV15.{datastore}.PGMLIB`.
- El JAR IMS Java (`nazare-ims-jmp`) se genera vía Gradle y se empaqueta
  con `deployType: IMS-JAR`.
- El WAR del frontend (`bank-frontend-vanilla.war`) se genera correctamente.
- El WAR de z/OS Connect se genera desde `src/api/src/main/api/openapi.yaml`.

**Todo List:**
1. Revisar en `dbb-app.yaml` la tarea PLI (líneas 210–260):
   - Confirmar `forFiles: "**/src/base/ims/pli/*.pli"` con `isIMS=true` y
     `deployType: IMSLOAD` para `IBLOGIN.pli`.
   - Confirmar `forFiles: "**/src/base/batch/pli/*.pli"` con `deployType: LOAD`
     para `BNKSTMT.pli`.
   - Confirmar los linkEditStreams respectivos (CEESTART + DFSLI000 para IMS;
     CEESTART solo para batch).
2. Revisar en `dbb-app.yaml` la tarea ImsJavaBuilder (líneas 309–319):
   - Confirmar ruta del Gradle: `/usr/local/sandboxes/tools/gradle-9.5.1/bin/gradle`
   - Confirmar `configSources: "src/base/ims/java"` apunta al proyecto Gradle.
3. Revisar la tarea VanillaFrontend (líneas 275–285):
   - Confirmar `vanillaFrontendPath: "src/frontend"` y
     `vanillaWarName: "bank-frontend-vanilla.war"`.
4. Revisar la tarea zOSConnect (líneas 321–331):
   - Confirmar `configSources: "**/src/main/api/openapi.yaml"`.

**Relevant Context:**
- PL/I batch: [`src/base/batch/pli/BNKSTMT.pli`](src/base/batch/pli/BNKSTMT.pli)
- PL/I IMS: [`src/base/ims/pli/IBLOGIN.pli`](src/base/ims/pli/IBLOGIN.pli)
- Java JMP: [`src/base/ims/java/build.gradle`](src/base/ims/java/build.gradle)
- Frontend: [`src/frontend/`](src/frontend/)
- API spec: [`src/api/src/main/api/`](src/api/src/main/api/)

---

### Sub-Tarea 6 — Ejecutar el build completo (`full`) y validar los artefactos

**Status:** `[ ] pending`

**Intent:**
Con todas las configuraciones verificadas, se lanza el ciclo de vida `full` que compila
todos los componentes en el orden correcto y empaqueta los artefactos. La validación
confirma que cada módulo esperado ha sido producido en su dataset o directorio destino.

**Expected Outcomes:**
- El build completa sin errores (`STATUS=0` o `STATUS=2` si hay warnings menores).
- El paquete de artefactos creado contiene los 29 CICS, 10 IMS COBOL, 2 PL/I,
  9 BMS, 8 PSB, 9 DBD, ~25 DBRM, 1 JAR, 2 WAR.
- Los módulos de carga residen en los datasets bajo `ADMINISTRATOR.BANKOFZ.*`.

**Todo List:**
1. Desde el directorio raíz del repositorio en z/OS USS, ejecutar:
   ```bash
   dbb build full
   ```
   Para compilación con debug habilitado (módulos TEST):
   ```bash
   dbb build full --debug
   ```
2. Revisar el log de build. Los mensajes esperados por tipo de módulo:
   - **CICS COBOL**: "Compiling with CICS" debe aparecer; `deployType=CICSLOAD`
   - **IMS COBOL** (excepto IBTRAN): `INCLUDE RESLIB(CBLTDLI)` en link-edit
   - **IBTRAN**: `DYNAM(DLL),CASE(MIXED)` en link-edit parms
   - **BMS**: dos pasos de ensamblado (DSECT + MAP)
   - **PSB/DBD**: ensamblado con `deployType=PSBLOAD` / `DBDLOAD`
3. Tras el build, verificar existencia de los datasets de destino:
   ```
   ADMINISTRATOR.BANKOFZ.LOAD     ← módulos batch
   ADMINISTRATOR.BANKOFZ.LOADLIB  ← módulos CICS + mapas BMS
   ADMINISTRATOR.BANKOFZ.DBRM     ← DBRMs Db2
   ADMINISTRATOR.BANKOFZ.BMS.COPY ← copybooks BMS generados
   IMSV15.{datastore}.PGMLIB      ← módulos IMS
   IMSV15.{datastore}.PSBLIB      ← PSBs IMS
   IMSV15.{datastore}.DBDLIB      ← DBDs IMS
   ```
4. Ejecutar el script de validación de instalación:
   ```bash
   .setup/setup/validate-install.sh
   ```

**Relevant Context:**
- Ciclo de vida completo definido en [`.setup/build/dbb-build.yaml`](.setup/build/dbb-build.yaml)
  líneas 39–53.
- Mappings de destino: [`.setup/deploy/types_pattern_mapping.yml`](.setup/deploy/types_pattern_mapping.yml)
- Script de validación: [`.setup/setup/validate-install.sh`](.setup/setup/validate-install.sh)

---

## Tabla resumen de datasets de salida

| Tipo de módulo | Programas / Fuentes | Deploy Type | Dataset destino |
|---|---|---|---|
| CICS COBOL | 29 programas bajo `cics/cobol/` | CICSLOAD | `ADMINISTRATOR.BANKOFZ.LOADLIB` |
| IMS COBOL | 10 programas bajo `ims/cobol/` | IMSLOAD | `IMSV15.{ds}.PGMLIB` |
| Batch COBOL | — | LOAD | `ADMINISTRATOR.BANKOFZ.LOAD` |
| Batch PL/I | BNKSTMT | LOAD | `ADMINISTRATOR.BANKOFZ.LOAD` |
| IMS PL/I | IBLOGIN | IMSLOAD | `IMSV15.{ds}.PGMLIB` |
| BMS Maps | 9 mapas | CICSLOAD/MAPLOAD | `ADMINISTRATOR.BANKOFZ.LOADLIB` |
| BMS Copybooks | generados desde BMS | MAPCOPY | `ADMINISTRATOR.BANKOFZ.BMS.COPY` |
| PSBs IMS | 8 ficheros `.asm` | PSBLOAD | `IMSV15.{ds}.PSBLIB` |
| DBDs IMS | 9 ficheros `.asm` | DBDLOAD | `IMSV15.{ds}.DBDLIB` |
| DBRMs Db2 | ~25 (programas con SQL) | DBRM | `ADMINISTRATOR.BANKOFZ.DBRM` |
| IMS Java JAR | `ims/java` (Gradle) | IMS-JAR | USS `{sandbox}/jars` |
| Frontend WAR | `src/frontend/` | WAR | USS Liberty apps dir |
| API WAR | `src/api/` (OpenAPI) | WAR | USS z/OS Connect apps dir |

---

## Notas importantes

- **Orden de compilación de BMS primero**: Los mapas BMS generan copybooks (`.cpy`)
  que los programas COBOL referencian con `COPY BNK1MAI.` etc. El stage `BMS` debe
  ejecutarse antes del stage `Cobol` dentro del `Languages` stage. Esto ya está
  garantizado por el orden definido en `Languages.yaml`.

- **Db2 BIND**: La compilación genera los DBRMs pero **no ejecuta el BIND**
  automáticamente. Tras el build se debe ejecutar el JCL de bind correspondiente
  bajo `.setup/jcl/cics/` para que los programas con SQL puedan ejecutarse en el
  entorno CICS/Db2.

- **IMS ACB GEN**: Tras el ensamblado de PSBs y DBDs, IMS requiere un paso adicional
  de `ACBGEN` para generar los Application Control Blocks. Este paso se realiza vía
  los JCLs bajo `.setup/jcl/ims/`.

- **IBTRAN requiere igzcjava.x**: El programa especial IMS-Java bridge necesita que
  el fichero `/usr/lpp/IBM/cobol/igyv6r5/lib/igzcjava.x` exista en el sistema z/OS
  de destino antes de ejecutar el link-edit.
