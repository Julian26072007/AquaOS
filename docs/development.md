# Development and validation

AquaOS serves source files directly. `package.json` declares ES modules for Node
and pins Playwright as a development dependency; npm is not required to run or
deploy the site. Node 22+ runs the domain tests without installing packages.

## Commands

```sh
python3 -m http.server 8000                # site at http://localhost:8000/
npm run test:unit                         # no browser, server or install
node --test tests/unit/schedule.test.cjs   # one domain
node --test tests/unit/natural.test.cjs
npm ci                                   # once, or when lockfile changes
npx playwright install chromium           # if no system Chromium is available
npm run test:browser -- schedule natural  # focused UI suites, automatic server
npm run test:browser -- lighting field    # lighting/materials/renderer
npm test                                 # all unit and browser checks, once each
```

Browser selection: `CHROMIUM_PATH`, then `/usr/bin/chromium` when present, then
Playwright's installed Chromium. On a minimal Linux host, Playwright may also
require OS browser libraries (`npx playwright install --with-deps chromium`).

The browser runner starts a loopback server on an unused port under `/AquaOS/`
and closes it on completion/failure. It serves existing files without building,
copying or scanning the repository. Tests run sequentially to avoid distorting
the render-performance assertion. Unknown suite names fail before starting.
Set `TEST_URL` to use an existing server, including its path and trailing slash;
for example `TEST_URL=http://127.0.0.1:8000/ npm run test:browser -- browser`.
Direct `node tests/<suite>.cjs` uses that variable or localhost:8000 at root.
Existing screenshot diagnostics go to `/tmp/aquaos-*.png`; do not commit them.

## Coverage and architecture

| Suite | Responsibility |
| --- | --- |
| `unit/schedule.test.cjs` | Phase/channel continuity, midnight schedules, validation, persistence, real/preview clock and output separation, speeds, night off |
| `unit/natural.test.cjs` | Seasons, polar cases, DST, midnight, safety/darkness/rate limits, moon horizon/phase, weather interpolation/cache/offline/retry/races, preview rejection |
| `browser.cjs` | Nine presets, responsive layout, touch/keyboard, dialog focus, persistence/corrupt/blocked storage, reduced motion, browser/HTTP errors |
| `lighting.cjs` | Deterministic scene snapshots, cloud motion/continuity, caustics, lightning fixtures, animation clock, 30fps rendering budget |
| `field.cjs` | Independent lighting axes, thermal channels, hardware capability mapping, material depth and developer map |
| `schedule.cjs` | Automatic UI/settings, preview play/scrub/speed/Now, persistence isolation and ordinary cloud animation speed |
| `natural.cjs` | Mocked forecast/geocoding UI, no GPS, Natural layouts/persistence and preview isolation |

Read [AGENTS.md](../AGENTS.md) for the task-to-module map. The runtime flow is
`app.js` → store/controllers → schedule or natural/weather/astronomy/safety →
preset → renderer/effects/light-field → scenery. Real and preview controllers
remain independent. Hardware mapping/output gates are pure future contracts,
with no device communication. More details are in the existing mode documents.

Start with relevant files, write a short plan, change only the affected modules,
and run their focused tests. Run `npm test` for shared/significant changes; review
the diff and report validation and limitations. Pure domain checks belong in
`tests/unit/`; DOM/Canvas/platform behavior belongs in browser suites. Avoid
repeating the same assertions in both. Keep browser-specific regressions where
they test a real platform difference.

## Findings and measured changes (2026-11-07)

Baseline: commit `8fe7657`, Node 24.22.1, system Chromium, this cloud workspace.
Numbers are single-run wall times and vary with host load.

- Application files are already focused (largest first-party JS: `app.js`, 121
  lines). Some statements are dense, but file size did not establish a bottleneck.
  UI wiring is centralized; domain controllers/calculations are already separate.
- There was no build pipeline, production npm dependency, repository-wide
  processing step or excessive runtime logging to remove. Vendored SunCalc is
  used by astronomy. Existing screenshots are documentation evidence.
- Rendering already caps frame rate/DPR, suspends hidden canvases and reuses a
  light field. Noise, astronomy and natural plans already cache calculations.
  Baseline rendering p95 was 6.5ms, within the existing 33.4ms assertion. No
  speculative runtime optimization or application reorganization was justified.
- The actionable issue was test coupling/setup: every test required Chromium,
  a separately started server and a workspace-specific lowercase URL; Playwright
  was undeclared. Browser-launch configuration was repeated five times.
- Existing schedule/Natural calculations and assertions were moved unchanged
  into Node tests. Their former combined browser suites took 7.46s (including
  UI); domain checks now take about 0.30s combined without a browser/server.
  This improves the iteration path, not the time spent in actual UI interactions.
- All five original suites took 24.72s; the updated browser suites took 24.30s,
  plus 0.30s for domain checks, excluding npm startup. Full validation remains
  approximately the same speed and preserves meaningful coverage.
- Added locked development setup, shared browser configuration, focused commands,
  an automatic case-sensitive project-path server, ignored dependency/report
  artifacts and concise agent guidance. No framework or build system was added.

## Verification and limits

All original suites passed before changes. The final unit and all five browser
suites passed. The original domain calculations/assertions were mechanically
compared with their extracted counterparts. The deterministic clouds-at-30s
screenshot is byte-for-byte equal before/after; `index.html`, `styles.css`, `js/`
and `dev/` remain unchanged. Rendering p95 was 5.9ms on the final run; that small
variation is not claimed as a runtime improvement.

GitHub Pages remains branch deployment from `main` at `/` with relative assets;
there is no deployment build command to update. The existing deployment for the
baseline commit [succeeded](https://github.com/Julian26072007/AquaOS/actions/runs/42418275851).
Local browser checks exercise `/AquaOS/`, but these changes have not been deployed;
a new hosted deployment must be checked after merge. Weather is mocked in tests,
so provider availability is not established. Chromium emulation does not verify
physical iPhone/Safari behavior. Randomized per-visit scenery prevents arbitrary
full-screen snapshots from being strict visual baselines; the seeded fixture is
the deterministic comparison. The linked Codex task could not be read because
this session does not expose `read_thread`; analysis used the actual repository.
