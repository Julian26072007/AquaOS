# AquaOS v0.5

A mobile-first aquarium lighting preview. The compact screen adapts to the available viewport height, keeping the aquarium, active preset and nine controls visible without scrolling on standard phone sizes, including landscape. Promotional copy is removed; preset descriptions remain available to screen readers. Extremely short screens or enlarged text may scroll to keep controls accessible. Select one of nine moods and see its lighting immediately in an animated underwater scene. Vanilla JavaScript, Canvas 2D and CSS; no build step, framework or external fonts. Natural Mode optionally uses Open-Meteo; a small astronomy fallback is bundled locally.

## Run locally

Serve the repository over HTTP (ES modules do not work reliably with `file://`):

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Deploy the repository root through GitHub Pages (Settings → Pages → Deploy from a branch → main → / root). All asset URLs are relative and support the `/AquaOS/` project path.

## Structure

- `index.html`, `styles.css`: accessible single-page UI, responsive layout and safe-area spacing.
- `js/app.js`: preset buttons and UI wiring.
- `js/lighting.js`, `js/presets.js`: normalized output, shared palettes and the nine existing presets.
- `js/schedule.js`, `js/environment.js`, `js/natural.js`: fixed schedules, manual presets and astronomy/weather targets.
- `js/weather.js`, `js/weather-environment.js`, `js/live-environment.js`: forecast interpolation, deterministic cloud variation and live acquisition continuity.
- `js/controllers.js`, `js/state.js`, `js/safety.js`: separate live/preview clocks, persisted settings and Natural safety policy.
- `js/renderer.js`, `js/effects.js`, `js/scenery.js`: Canvas aquarium and uniform display tint from the channel levels.
- `js/hardware-mapping.js`, `js/hardware-output.js`, `js/device-plan.js`: configurable DMX mapping, future output gate and autonomous plan draft.
- `tests/`, `scripts/test-browser.mjs`: domain and browser regressions served under the GitHub Pages project path.

Presets are Sunny, Clouds, Sunrise, Sunset, Storm, Moonlight, Waves, Rainbow and Sparkle. Manual **Channels** opens five sliders. Applying the levels saves a custom manual mix locally. Selecting a preset returns to that preset's palette. Reduced motion freezes fish, plants and bubbles while lighting still follows the selected mode.

## Verification

Use Node 22+ for tests. The fast domain suite needs no dependencies or server:

```sh
npm run test:unit
```

For browser tests, install the locked development dependency once:

```sh
npm ci
npx playwright install chromium # only if system Chromium is unavailable
npm test
```

`npm test` runs the unit suite and all six browser suites, starting and stopping
its own temporary server at a case-sensitive `/AquaOS/` project path. There is no
build step. Run one or more focused browser suites with
`npm run test:browser -- schedule natural`, or one domain with
`node --test tests/unit/schedule.test.cjs`.

`CHROMIUM_PATH` selects an alternate browser executable. `TEST_URL` points to an
existing server instead (include the project path and trailing slash). Direct
`node tests/browser.cjs` commands default to `http://127.0.0.1:8000/`.

See [development and validation](docs/development.md) for suite responsibilities,
measurements and limitations, and [AGENTS.md](AGENTS.md) for the task-to-file map.
Chromium emulation does not replace physical iPhone/Safari testing.

## Automatic cycle and preview

Choose **Automatic** to follow local browser time, or **Manual** to use the existing preset grid. Tapping a preset returns to Manual without changing the schedule. New/legacy installs remain Manual until Automatic is selected. Use the gear button to configure sunrise/sunset starts and durations, daytime brightness and optional very dim moonlight. Default phases are 06:00–09:00 sunrise, 09:00–18:00 daylight, 18:00–21:00 sunset, and night otherwise. Night defaults to off; optional moonlight is capped at 5% conceptual intensity.

**Preview day** opens a simulation sheet with the same aquarium artwork/renderer, a 24-hour slider, Play/Pause, 60×/360×/1440× playback and Now. One full cycle takes 24 minutes, 4 minutes or 1 minute respectively. Scrubbing and playback affect only the preview; global weather variation follows simulation time while the aquarium scene keeps its own animation clock. Preview state is discarded on closing and never saved. The main real-clock controller continues while its covered canvas is suspended.

See [schedule and preview architecture](docs/automatic-cycle.md) for persistence, validation, local-time behavior, tests and the strict future hardware boundary.

## Natural Mode

Choose **Natural** and set the aquarium's city (manual search) or coordinates and IANA timezone in Settings. No GPS permission is used. Natural Mode follows a bounded, astronomy-centered aquarium window rather than copying the outdoor day length. Defaults: a **9-hour total light budget**, 80% maximum requested output, at least 12 hours of protected darkness, at most 25% weather dimming and a 2 percentage-point/minute live brightness change limit. Night defaults to off. Optional astronomical moonlight is extremely dim and reserves time from the same budget; optional pre-dawn twilight is a separate phase.

Unknown Natural output starts at off and ramps gradually; the main status says **Ramping**. At the default limit, reaching 80% from off takes about 40 minutes. The daily preview shows the planned cycle immediately without changing live state. The safety layer may extend requested ramps or reduce peak brightness to fit limits. Manual and fixed Automatic modes remain explicit user-controlled modes; these new policy limits constrain Natural Mode.

Current/forecast weather refreshes every 15 minutes with per-location caching. Offline, recent forecasts are reused for at most 24 hours before neutral estimated weather takes over; astronomy works locally. Natural preview adds an aquarium-date selector and uses forecast interpolation, with estimated weather clearly labeled outside coverage. Global weather and sunlight follow the selected simulation time at every preview speed. **No preview action can reach hardware output.**

Read [Natural Mode architecture, verified API fields and safety policy](docs/natural-mode.md) for limitations and future standalone-controller requirements. Percentages are controller levels, not measured lux or a guarantee of biological equivalence to moonlight.

## Global lighting and DMX

The aquarium wiring groups each color across the two DMX4ALL 90-3503 MaxiRGB dimmers. AquaOS outputs exactly five levels in the range 0–1. Cloud openings, rain, snow, haze, wind and solar elevation change this one mix for the whole tank. The renderer uses the mix to tint the existing aquarium artwork.

| Output | Default DMX slot |
| --- | --- |
| Red | 1 |
| Green | 2 |
| Blue | 3 |
| Warm White | 4 |
| Cool White | 5 |
| Unused | 6 |

`mapDmxChannels` accepts a custom mapping and converts levels into 0–255 slot values. The separate `prepareRealHardwareOutput` gate accepts real Natural Mode samples and enforces brightness, darkness and slew limits with actual timestamps. Its quantized output respects the safety ceiling, so a moonlight limit below one DMX step produces zero. There is no hardware transport. The preview uses an artistic tint with approximate colors. Actual output levels depend on installation calibration.
