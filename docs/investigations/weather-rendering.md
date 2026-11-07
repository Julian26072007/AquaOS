# Weather rendering investigation (2026-11-07)

Current finding: overall weather dimming worked, but cloud-opening scattering was
practically invisible. See the follow-up below for the isolated root cause,
correction and matched pixel evidence. The initial investigation is retained to
distinguish whole-image dimming from shaft visibility.

## Evidence before implementation

Investigated main b056230, including prior fixes a9c85d1 and 551f0c8.
The referenced Codex task could not be read: no read_thread tool is exposed in
this session. Prior implementation history here comes from Git and repository
documentation, not the referenced conversation.

The reported loss of weather influence is **not reproduced** in this revision.
No failing lighting function has been established, so no lighting-model change
is justified. Previous attempts cannot be declared ineffective from the current
code: their changes are already present and the renderer responds.

Trace: Open-Meteo cloud_cover -> weatherRow.cloud (0–100) -> weatherAt selected
absolute preview epoch -> calculateNaturalLighting weatherFactor and radiation
split -> constrainTarget -> preview.snapshot().preset -> renderPreview /
AquariumRenderer.setLighting -> LightingPass.prepare -> LightingEngine.state /
sample -> LightField.update -> multiply water pass and material colors -> Canvas.
Automatic schedule mode has no weather input by design; Natural preview does.
Preview owns a copied forecast and does not use current observations. Out-of-range
or expired forecasts use explicitly estimated weather. Real output smoothing and
slew safety do not run on the preview path. No CSS opacity, blend or filter applies
to the preview canvas. Canvas multiply is followed by a bounded scattering pass.

A new browser experiment, run before production changes, uses parsed forecasts,
the preview controller and actual AquariumRenderer at 2026-06-21 12:00 UTC,
latitude/longitude 0, identical seeded scenery, reduced motion, default safety,
354×280 canvas. Only cloud_cover changes; radiation is absent, not fabricated.

| Cloud % | Target | Attenuation | Renderer direct | Renderer diffuse | Field RGB mean min/max | Canvas RGB mean |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | .8 | 1 | .544 | .352 | .80469 / .87065 | 48.1573 |
| 50 | .7 | .875 | .357 | .4235 | .66192 / .74324 | 42.0488 |
| 100 | .6 | .75 | 0 | .66 | .64680 / .64680 | 38.4626 |

Both cloudy images change 100% of pixels versus clear. Overcast absolute RGB
channel difference averages 9.6946 (0–255). Captures:
/tmp/aquaos-controlled-{0,50,100}.png. Clear/overcast images were visually inspected.

The existing developer panel rounds normalized light values to one decimal,
omits forecast timestamps, attenuation, final brightness, renderer inputs and
field range. It cannot diagnose a discrepancy between computed and drawn values.
Smallest evidenced correction: extend that opt-in panel and add an actual pixel
regression, leaving the lighting engine and production UI unchanged.

## Deployment check

The public Pages natural.js SHA-256 was identical to main before changes:
e68356a72c8b8e06e67ce9c064c3af67d237457f29797c5d2f4dd244a6b5f877.
Response last-modified 2026-11-07 22:39:06 UTC, cache-control max-age=600,
age=0, x-cache=MISS. This does not establish the state of the user's browser cache.
No cache-busting change is justified. Diagnostic/test changes in this working
checkout have not been published.

## Implemented diagnostics and verification

- `weatherAt` retains the original forecast bracket timestamps, raw endpoint
  cloud coverage and interpolation fraction. Missing values remain null; fixtures
  and estimated weather do not acquire fabricated forecast timestamps.
- `renderWeatherDiagnostics` displays these inputs, the selected absolute time,
  attenuation, final constrained brightness, the prepared renderer's cloud,
  direct/diffuse values and blend, plus RGB-mean field min/max. Normalized values
  use four decimals instead of hiding differences through one-decimal rounding.
- `tests/weather-rendering.cjs` is part of the standard browser suite. It compares
  actual canvas pixels as well as forecast/controller/renderer/field values.
- A unit regression checks selected date/time, interpolation provenance, missing
  radiation and nighttime. Existing tests check both preview hardware rejection
  and real controller/storage isolation.

`npm test` passed: 6 unit tests and all 6 Chromium browser suites (browser,
lighting, field, schedule, natural, weather-rendering). Fixed-time rendered
measurements are identical before and after diagnostic changes. Natural renderer
p95 was 15.8 ms in this environment. `git diff --check` passed.

All 25 deployed HTML/CSS/JS files (including vendored SunCalc) matched HEAD when
checked, not just natural.js; results were saved to /tmp/aquaos-pages-check.json.
A real Vienna API response confirmed cloud_cover percent and direct/diffuse
radiation W/m². Its current cloud_cover was 0; parsed/interpolated forecast cloud
was also 0 at the sampled nighttime instant. This is pipeline evidence, not a
claim that the user's reported cloudy event was reproduced.

Remaining: obtain the affected location/date/time/mode and browser state. The
existing clear/cloudy difference is safety bounded, and no requested visual
threshold was supplied. Physical Safari and the user's cached browser remain
unverified. No claim is made that the originally reported bug is fixed. No new
lighting effect, artwork change, safety change or cache-busting was introduced.

## Follow-up: invisible cloud-opening scattering

The user clarified that the missing response meant visible light shafts, rather
than overall weather dimming. A matched on/off render now isolates that pass.
At fixed midday, the old cloudy pass changed RGB channels by only 0.3646 levels
on average (0–255), peak 1.3333, with upper-column contrast 0.2679. The earlier
whole-image weather comparison did not test shaft visibility.

Exact cause: `LightingPass.applyWater` used `LightField.transmission` after
`cloudTransmissionFloor` had compressed the original cloud contrast. Under the
cloudy fixture that floor is 0.82733. Combined with `shaftStrength` capped at
0.018 and 8-bit alpha quantization, the result was a nearly uniform, barely
visible wash. Weather parsing and preview wiring were not the cause.

The smallest correction preserves original `cloudOpening` as one additional
channel in the same engine/field, leaving all material transmission, RGB output,
safety budgets and hardware channels intact. The existing scattering pass reads
that channel and uses a calibrated maximum strength of 0.22, still modulated by
coverage, precipitation, actual direct illumination and optical-depth falloff.
No extra beam geometry, independent noise, cones or spotlights are introduced.
Clear 0%, full overcast, night and diffuse-only conditions do not create shafts.

With the same cloudy scene, the corrected pass contributes mean 1.9535 levels,
peak 14, and upper-column contrast 8.4107. Partly cloudy gives mean 5.3814,
peak 23.6667 and contrast 10.2887. Overcast and night both give exactly zero.
Before/after and enabled/disabled screenshots were inspected at 354×280.
Screenshots are in /tmp/aquaos-scattering-*.png; generated images stay out of Git.

`weather-scattering` now compares actual matched canvas pixels, tests spatial
contrast and depth fade, bounds peak intensity, and checks zero contribution at
night and overcast. A unit test verifies the original cloud openings survive a
material transmission floor of one. This supersedes the earlier conclusion that
no visual change was justified, following the clarified visibility requirement.

Final validation: `npm test` passed all 7 unit tests and all 7 Chromium suites.
Natural renderer p95 was 10.1 ms in this run. The original artwork, presets,
schedule, runtime darkness policies and preview/hardware gates remain covered.
