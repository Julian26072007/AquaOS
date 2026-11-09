# AquaOS contributor guide

AquaOS is a static, mobile-first aquarium lighting simulator: vanilla ES modules,
Canvas 2D and CSS. Serve the repository root; there is no application build step.
Node/npm and Playwright are development tools only. Start with the files below
that match the task; the fuller file inventory is in README.md.

## Task map and module boundaries

| Task | Start here | Validation |
| --- | --- | --- |
| Layout/accessibility/settings UI | `index.html`, `styles.css`, `js/app.js` | browser; schedule/natural UI when affected |
| Aquarium artwork/animation | `js/renderer.js`, `js/scenery.js`, `js/timing.js` | browser + lighting |
| Global lighting/materials | `js/lighting.js`, `js/environment.js`, `js/effects.js` | unit + lighting |
| Preset definitions | `js/presets.js` | browser + lighting |
| Schedule/preview | `js/schedule.js`, `js/controllers.js` | unit + schedule |
| Natural weather/astronomy/safety | `js/natural.js`, `js/weather.js`, `js/astronomy.js`, `js/safety.js` | unit + natural |
| Persistence | `js/state.js` | unit + browser + affected mode UI |
| Future output mapping | `js/hardware*.js`, `js/device-plan.js` | unit |
| Test tooling | `package.json`, `scripts/test-browser.mjs`, `tests/` | unit + affected browser suites |

`app.js` wires the UI. Controllers own independent real and preview clocks.
Domain modules stay usable without the DOM. The renderer consumes the shared
five-channel output. See README.md, docs/automatic-cycle.md and
docs/natural-mode.md. Do not edit vendored SunCalc without a specific reason.

## Conventions and preservation rules

- Follow local vanilla JS style, relative `.js` imports and explicit exports.
  Prefer small pure functions and injected clocks/storage/fetch for domain logic.
- Preserve the existing UI, colors, artwork, nine presets, responsive layout,
  touch targets, keyboard access, dialog focus and reduced-motion behavior.
- Keep every lighting effect global across Red, Green, Blue, Warm White and Cool White.
- Preserve manual mode, automatic scheduling, Natural Mode, weather fallback,
  astronomy, persistence migration and blocked/corrupt storage behavior.
- Preview owns its controller and renderer. It must never persist settings or
  feed real output. Evaluate weather from simulation time, with an independent
  decorative scene clock.
  Future hardware gates must continue rejecting preview sources; no device
  communication exists today. Preserve safety limits and darkness budgets.
- Keep assets relative for case-sensitive GitHub Pages `/AquaOS/` hosting.
  Do not add a framework, production dependencies or a build step casually.
- Avoid unrelated formatting, generated screenshots, mass file reads and
  speculative optimizations. Keep meaningful tests when reorganizing them.

## Commands and efficient workflow

1. Read this guide; choose relevant modules and inspect only those initially.
2. Make a short implementation plan, then implement the smallest focused change.
3. Run focused checks while developing:
   - `npm run test:unit` (Node 22+, no install/server/browser required).
   - `node --test tests/unit/schedule.test.cjs` or `natural.test.cjs` for one domain.
   - `npm run test:browser -- schedule` (or `browser`, `lighting`, `natural`, `live-weather`;
     multiple names supported). Installs: `npm ci`, then
     `npx playwright install chromium` if system Chromium is unavailable.
4. Run `npm test` for significant/shared changes. It runs unit checks once and
   all browser suites once, with an automatic temporary HTTP server. Do not run
   a build or reinstall dependencies when the lockfile has not changed.
5. Review the diff and summarize behavior, validation and remaining limitations.

Run the site with `python3 -m http.server 8000`; open http://localhost:8000.
`CHROMIUM_PATH` overrides browser selection; `TEST_URL` uses an existing server
(include its project path and trailing slash). See `docs/development.md` for
setup, suite coverage, timings and deployment limitations.
