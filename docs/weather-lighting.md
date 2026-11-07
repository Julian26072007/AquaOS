# Weather lighting and preview verification

## Data flow and cause

Open-Meteo current/hourly percentages are normalized in `weather.js`. The real
controller interpolates forecast data, prefers fresh current observations and
smooths changes over 60 seconds. `calculateNaturalLighting` combines weather
with the bounded Natural Mode day plan. Its preset reaches `LightingEngine`, the
96 × 48 world-space `LightField`, and the material/water passes of the aquarium.

The data path worked. The old model reduced brightness by only 12% for full
cloud coverage and left direct light unchanged. More importantly,
`minWeatherFactor / weatherFactor` became the cloud transmission floor: about
85% for ordinary clouds and 100% at the safety limit. This erased most moving
shadows. The renderer did consume the parameters; scheduling did not overwrite
them. Ordinary Automatic mode intentionally uses its local schedule without
weather; choose Natural Mode for real-weather lighting.

The revised model dims daylight by up to the configured weather limit, transfers
direct energy into diffuse illumination continuously with coverage, reduces
caustics, and reserves a conservative rendered-light budget before admitting
cloud shadow contrast. Current total coverage anchors density; stale hourly
layer coverage cannot create heavy shadows under a clear current sky. Rain
biases the white mix cooler. Thunderstorm requests stronger dimming but remains
subject to the same safety floor and never enables lightning.

The existing deterministic two-dimensional cloud field and wind integration
remain intact. Low-opacity overhead scattering samples its cloud openings and
fades down through the water. No cone geometry or independent random flicker
is added. Full overcast suppresses shafts and caustics. Night and moonlight do
not receive the daytime diffuse energy transfer.

## Compare conditions

Open `/AquaOS/?devWeather=1` (or `/?devWeather=1` when serving at root), configure
a location, choose Natural Mode and open day preview. Choose a date and scrub to
the middle of its daylight period. The developer weather selector appears only
with this URL flag and only inside Natural preview. Selecting a condition pauses
the simulated clock, keeping date/time fixed while real-time cloud motion
continues. Leave each condition running for 30–60 seconds to inspect movement.

| Selection | Expected appearance |
| --- | --- |
| Clear | Bright, mostly even light, subtle caustics, almost no cloud shadows. |
| Partly cloudy | Most visible broad moving shadow contrast and faint overhead light through openings. |
| Cloudy | Lower overall brightness, broad softer moving shadows, weaker caustics and faint occasional shafts. |
| Overcast | Darker diffuse light, nearly uniform field, no shafts and no caustics. |
| Rain | Dark diffuse light, cooler white mix, very restrained variation and shafts. |
| Thunderstorm | Heavy diffuse cloud cover, capped darkness; no lightning or sudden flashes. |

Default safety permits a maximum 25% weather reduction in target brightness;
therefore storm and overcast can have similar brightness. The floor intentionally
limits dramatic darkness. A stricter weather floor also reduces shadow contrast.
Scrub to night: all overrides must remain dark. Resume Play at any existing
speed to check accelerated sunrise/sunset; cloud motion must not accelerate.
Select Live forecast to restore forecast weather. Closing/reopening preview
clears the override. The ordinary UI is unchanged without the URL flag.

Override fixtures are immutable and held solely inside the independent preview
controller. They cannot write the forecast cache, persisted settings, live
controller or device output. Both hardware gates reject `source: 'preview'`.
No device communication exists in AquaOS today.

## Automated evidence

`npm test` covers domain regressions, all nine presets, rendering, independent
field axes, schedule and Natural UI. `weather-lighting.test.cjs` checks the
Open-Meteo-to-field path, six weather conditions, temporal continuity, nighttime
safety, brightness separation and preview/hardware isolation. The Natural UI
suite exercises developer selection at a fixed time, preview reset and storage
isolation, writing inspection screenshots to `/tmp/aquaos-weather-*.png`.

Chromium timing is a development regression check, not an iPhone performance
measurement. Validate an actual iPhone/iPad in Safari before asserting device
frame rates.

Validation for this change: the complete Chromium suite passed. The Natural
partly-cloudy renderer measured 2.7 ms median / 4.3 ms p95 at a 354 × 280 CSS
pixel canvas. A WebKit launch was attempted after installing the matching
Playwright browser, but the host lacks GTK4, Graphene, HarfBuzz ICU, Manette,
Hyphen and GLES libraries. WebKit and physical Mobile Safari remain unverified.
