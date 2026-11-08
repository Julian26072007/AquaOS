# Continuous dynamic weather (Phase 2)

Phase 1 is present: `evaluateEnvironment` evaluates absolute simulation time,
shared by live and preview. Rendering uses the fixed-epoch `environmentTime`,
not elapsed frames, playback speed or date-local time. Existing unit tests
cover scrubbing, speed independence, midnight and forecast boundary continuity.
The missing wind connection was corrected without replacing that architecture.

`weather.js` retains provider values; `weather-environment.js` derives a single
continuous `environment` on the Natural result and preset. `natural.js` combines
it with astronomy and the bounded photoperiod; `effects.js` uses its cloud motion
and coverage in the existing seeded cloud mask. LightField and aquarium material,
water and floor passes consume the resulting RGB/direct/diffuse values.
Manual presets and ordinary Automatic scheduling retain their behavior.

## Inputs, units and provenance

Open-Meteo current/hourly cloud cover and hourly low/mid/high cover are percent.
Rain and precipitation are mm per provider interval (current and hourly intervals
may differ); snowfall is cm per interval. Wind is explicitly requested in m/s,
direction meteorological degrees FROM. Hourly direct/diffuse/shortwave radiation
is horizontal W/m², not direct-normal irradiance. New hourly visibility is metres.
These are weather-provider model estimates/forecasts, not aquarium sensors.
Missing snow/visibility remain null in the raw record and older caches work.
`estimatedFields` identifies gap-filled/fallback inputs. Weather descriptions are
labels; they do not choose lighting presets. The pre-existing interpolated WMO
storm severity remains a bounded extra dimming request, never a flash.

Derived coverage, opacity, direct/diffuse illumination, rain/snow intensity,
haze and variability are 0–1. Optical depth is dimensionless, bounded 0–3.
Wind retains m/s and degrees. Rain uses 8 mm/interval and snow 2 cm/interval as
full intensity reference values; these are artistic normalization references,
not calibrated precipitation rates. Raw inputs remain available for diagnostics.
`environment.provenance` distinguishes provider-backed and estimated/procedural
parameters. Cloud optical depth is estimated from total/layer cover. Haze is an
estimate from visibility (20 km reference), otherwise from cloud/rain/snow.
Missing radiation retains the existing cloud-squared diffuse estimate.

## Timeline and lighting

A fixed seeded continuous lattice noise modulates coverage by at most 5.5
percentage points times 4c(1-c). Clear/overcast therefore remain restrained;
partly cloudy skies vary most. Thickness evolves on 25-minute scales, coverage
on 15 minutes, rain on 7 minutes and snow on 20 minutes. No per-frame randomness,
category switch, midnight reseed or daily event schedule is used.

Forecast wind endpoint velocities are integrated analytically with smoothstep
interpolation, rather than multiplying current wind by absolute time. The
provider carries a cached trajectory anchor across refreshes, preserving cloud
position at acquisition. Direction changes turn the existing field and stronger
wind advects it faster; wind never multiplies brightness. With no forecast, a
constant estimated/override wind uses a fixed epoch. Opposing forecast winds
can temporarily cancel, a conservative approximation to a gradual turn.
The optional normalized `shimmerEnergy` output is reserved for future work.

Cloud coverage shifts the threshold of the existing two-scale coherent field,
changing the distribution of shadowed regions. Optical thickness controls
transmission. Zero coverage removes shadows; overcast becomes broadly uniform.
The 40×24 cached mask and 96×48 LightField remain in use. Only direct light is
shadowed, with the existing safety floor; diffuse sky light remains present.
Radiation supplies the direct/diffuse balance. Haze and snow transfer a bounded
part of direct energy to diffuse illumination and snow cools the white mix.
Neither precipitation parameter zeros sunlight. No sparkle, lightning, rainbow,
new mode selectors or water-shimmer rendering is added.

Physical-output mapping/gates, output channel bounds, real-time slew limits,
maximum brightness, darkness and photoperiod rules are unchanged. Preview stays
isolated. This is artistic aquarium illumination, not calibrated radiometry.

## Validation and limits

`continuous-weather.test.cjs` compares final renderer samples for clear, partly
cloudy, overcast, sun/rain, heavy rain and sun/snow at the same simulated midday.
It checks finite bounded channels, contrast, motion, determinism, frame-clock
independence, wind speed/direction, forecast boundaries and refresh anchors.
Existing environment tests exercise playback speeds, scrubbing, date rollover,
forecast/category transitions and safety. Browser weather tests compare actual
Canvas pixels and write `/tmp/aquaos-controlled-{0,50,100}.png` and boundary frames.

The production artifact is the static repository; there is no build command or
compilation stage. Run `npm test` for the full unit and browser checks.

Limitations: cloud shapes are procedural, not reconstructed from satellite data;
forecast wind interpolation integrates endpoint vectors, not atmospheric flow.
Live observation wind is reported but cloud advection uses the smoother hourly
wind timeline. Refresh anchoring preserves position; changed forecast velocity
can change its derivative. Current precipitation intervals differ from hourly
intervals; normalization intentionally stays conservative. Missing snow assumes
no snow, marked estimated. The existing cloud lattice eventually repeats. Physical
Safari/device performance and calibrated LED hardware remain unverified.

Verified in this change: all six unit files and all seven Chromium browser suites
passed. After the final precipitation fallback change, units and the affected
weather-rendering, weather-scattering and Natural browser suites passed again.
At fixed midday the Canvas RGB pixel means were 48.17 (clear), 41.86 (partly
cloudy), and 38.46 (overcast), on the same seeded scene; overcast field radiance
was uniform at 0.6468, while partly cloudy ranged 0.6586–0.6985. Natural renderer
CPU submission measured about 5.9 ms median / 8.9 ms p95 in the final affected-suite
run, not a physical-device performance guarantee. A live Open-Meteo request
verified snowfall, visibility and radiation availability/units on 2026-11-08.
