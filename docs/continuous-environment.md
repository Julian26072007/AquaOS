# Phase 1: continuous lighting foundation

## Pipeline

The real controller samples the wall clock; the independent preview controller
owns its simulation date/time. Both call `environment.js`. Natural evaluation
uses `weatherAt` (Open-Meteo normalized hourly/current data), astronomy and the
bounded Natural lighting plan. Automatic evaluation retains the schedule model.
The resulting preset carries absolute `environmentTime` into `LightingEngine`,
the spatial `LightField`, and the Canvas material/scattering passes.

The real controller still applies runtime darkness/episode protection and slew.
Future `prepareRealHardwareOutput` separately limits physical channels using real
timestamps and rejects preview output. There is no device communication.

## Causes and changes

- Hourly numeric weather already used bounded smoothstep. However, the discrete
  weather code imposed an instantaneous storm brightness penalty at the interval
  midpoint. An interpolated storm weight now controls lighting; codes remain
  labels, never interpolated WMO numbers.
- Missing samples inherited a value from the active interval, so crossing the
  missing observation could select a different value. Gaps now resolve to the
  same nearest valid observation before interpolation; wholly absent fields keep
  their established null/fallback semantics.
- Current observations previously replaced forecast values inside a hard
  30-minute window. Their influence now has a smooth, compact envelope.
- The radiation model switched abruptly at 1 W/m². A smooth confidence envelope
  over 0–10 W/m² blends into the existing cloud approximation near darkness.
- Renderer wind integration depended on prior frames, weather changes and sample
  order. Lighting patterns now use fixed seeded noise and absolute coordinates.
  Weather changes optical thickness/coverage without replacing pattern identity.
  Cloud geometry remains present through night; darkness controls its energy.
- Daylight redistribution emerges faster than the brightness ramp; tint and
  white balance retain the schedule's separate warm dawn/dusk envelope. Twilight
  tint, direct/diffuse energy, shafts and caustics now join continuously.
- Zoned time retains milliseconds. Natural playback advances an absolute epoch,
  including midnight and DST, and updates the existing date input. 3600x is
  accepted by the controller without adding a UI mode.
- Scrubbing paints immediately, bypassing real-output slew. Schedule and Natural
  targets carry their own procedural time, independent of renderer uptime.

Pattern time is `(epoch - 2020-01-01 UTC) / 360000` seconds. This deliberately
slow simulation-time rate replaces independent wall-clock cloud motion for
timeline lighting, as required for reproducible scrubbing. Playback speed changes
how quickly timestamps are visited, never the result at a timestamp. Decorative
fish/particle motion remains on the renderer's existing animation clock.

## Validation and limits

`tests/unit/environment.test.cjs` compares actual interpolated final field channels
for deterministic replay, different renderer clocks, weather/hour/midpoint/solar
and midnight boundaries, ranges, missing samples, current observation envelopes,
all supported speeds, reverse scrubbing and date rollover. Existing domain,
safety, hardware mapping and UI suites remain in place. `weather-rendering.cjs`
compares rendered pixels 100 ms before/after three changing weather boundaries
and writes review frames to `/tmp/aquaos-boundary-*.png`.

There is no production build: the repository root is the deployed static site.
No new modes, events, dependencies or weather effects were added.

Changing configuration, choosing a manual weather fixture, receiving a different
forecast dataset, or entering/leaving unavailable/stale forecast coverage can
still change targets immediately. These are changes of input, not interpolation
within a fixed forecast. Hardware retains its independent safety/slew layer.
Wind metadata is retained, but wind-driven advection is deferred: multiplying
absolute time by changing wind recreates jumps, while frame integration breaks
scrubbing. A future wind-aware model needs a deterministic forecast-time integral.
Noise seeds remain constructor inputs to `LightingEngine`; defaults are unchanged.
