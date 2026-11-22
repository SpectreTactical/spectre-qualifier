# Spectre Qualifier – scaffold (22 Nov 2026, build + test only, NOT published)

A separate, offline-first PWA for firearm qualifiers. A qualifier is a **config file**; the engine scores any config.
First config: Federal Air Marshal TPC. FBI pistol / FBI shotgun are **TODO stubs** (no course data, cannot score).

## Files
| File | What |
|---|---|
| `index.html` + `app.js` | the app: Match · Shooters · Score · Results (localStorage `spectreQualifier.v1`) |
| `engine.js` | pure scoring engine (browser + Node): `validate`, `parChecks`, `evaluate`, `stripPii`, `looksPii` |
| `qualifiers/fam-tpc.js` | FAM TPC config (verified) |
| `qualifiers/fbi-pistol.todo.js`, `fbi-shotgun.todo.js` | placeholders, `status:"todo"`, shown disabled |
| `register.html` | shooter registration page (same process as Spectre Scoring) + organiser indemnity view (`&org=1`) |
| `reg-core.js` | registration, opt-in ID/cell (admin-only) and indemnity helpers + in-app dialogs, copied from Spectre Scoring |
| `firebase-config.js` | the ONE swappable Firebase config – project `spectre-qualifier` (refuses the main `spectre-scoring-5ddda` project) |
| `firestore.rules`, `firebase.json` | rules for the qualifier's own project (admins + regs only; everything else denied) |
| `sw.src.js` → `build.sh` → `sw.js` | service worker (cache name = file hash) |
| `indemnity-pdf.js`, `indemnity-form.pdf`, `qrcode.js`, `icons/`, `manifest.webmanifest` | copied from Spectre Scoring |
| `t/` | `test-engine.js` (Node), `test-rules.js` (emulator), `smoke.js` (headless Chrome + emulators, fake data), `run-all.sh` |
| `shots/` | screenshots, A4 results PDF, sample JSON export (fake data) |

## Config schema (v1)
```
{ schema: 1, id, version, status: "verified"|"todo", name, short, source, firearm: "handgun"|"shotgun"|"rifle",
  distance?, target?, totalRounds?, maxPoints?,            // optional; validated against the strings if given
  zones: [ { id, label, points, miss? } ],
  pass:  { minPoints, requireAllWithinPar: true },
  stages: [ { id, n, title, start?, parMode: "stage"|"string", par?,      // "stage": one flag vs stage.par (strings combined)
              strings: [ { id, rounds, desc, par? } ] } ] }               // "string": one flag per string vs string.par
```
Max points = total rounds × best zone. Time equal to par = within par.

## Scoring
Per par check the RO taps **Within par** / **Over par** (optional time; a time that disagrees with the flag is a warning only).
After the last stage: one tally of the whole course (inner / outer / miss, "Rest are misses" button).
PASS = within par on every check AND points ≥ minPoints. FAIL shows why ("Over par on Stage 4 …", "Points short by 5 (130 of 135 needed)").
Hits ≠ total rounds → warning, still scored. Missing flag/tally → INCOMPLETE (printed as DNF). Any over-par → FAIL immediately.

## Corrections (22 Nov 2026)
"Save result" locks a shooter's sheet (read-only). "Correct this result…" → in-app confirm → edit a working copy of any stage
flag / time and the tally → "Save correction" shows the list of changes (and FAIL → PASS if the result changes) → re-scored.
Each correction adds `history: [{ at, changes: [{ what, from, to }], result }]` to that shooter's score; shown on the sheet,
"corrected <time>" on the Results tab and the A4 sheet. History is kept in phone backups, NOT in the archive JSON.
Cancel / leaving the sheet discards an unsaved correction.

## Confirmed defaults
Time exactly on par = within par. One scoring phone, no sync (backup files only). Member numbers are not in the archive export.
No stage diagrams anywhere (paper diagrams are used); configs carry no layout/diagram data.

## Data protection
The scoring phone keeps names, SWPC member no., division/PF/category/class/squad and scores. Import from registration copies only
those fields (never e-mail, ID, cell, or the edit token). Exports run `stripPii` + a `looksPii` scan and refuse to save if one slips in.
The archive JSON also leaves out member numbers. ID/cell live only in `regs/{code}/private/{token}` (opt-in, admins list/read/purge).

## Getting results into the Spectre archive (manual step)
1. Results tab → **Export results (JSON)** → `<match>-results.json` (archive record `{ id, idx, data }`, `kind:"qualifier"`).
2. Send the file to the bot / a publisher. After Gideon approves, the publisher writes `archive/{id}` (idx, createdBy = publisher uid)
   and `archive/{id}/data/main` = `{ v:1, data: JSON.stringify(data) }` in the MAIN project, the same way the results-only records were added.
3. Needs the archive.html with qualifier support (/workspace/spectre-archive-qualifier) live first, otherwise the old page would count
   the qualifier as a club shoot in the standings. Listed with the club shoots, never counted in the season standings.

## Tests
`t/run-all.sh` (Java in /workspace/jdk, firebase-tools in /workspace/fbtools; uses the demo emulator project only).
