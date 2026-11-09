# Live Weather acquisition continuity

> Historical implementation notes. See the [current lighting model](../../README.md#global-lighting-and-dmx).

Investigated main `21736b5` (Phase 1 and Phase 2 present). The linked Codex
conversation was unavailable: this session exposes no `read_thread` tool.
Evidence below comes from the checked-out source and controlled tests.

## Trace and diagnosis

| Stage | Automatic | Live Weather (`natural`) |
| --- | --- | --- |
| Input | schedule + real Date | same real Date + provider snapshot |
| Normalization | validated schedule | Open-Meteo percent/radiation/wind normalization, nullable gaps |
| Interpolation | continuous scheduled progress | smoothstep hourly bracket + weighted current observation |
| Environment | fixed-epoch environmentTime | same epoch + continuousWeather and integrated forecast wind |
| Procedural variation | seeded coherent field/caustics | same engine, coverage/thickness variation, forecast wind |
| Real controller | schedule result | environmental target followed by runtime brightness safety |
| Spatial lighting | LightingEngine → LightField | same, with coverage, opacity, radiation balance and scattering |
| Final Canvas | setLighting → LightingPass → aquarium materials | identical renderer path |

The reproducible defect is acquisition discontinuity, not random rendering.
The live controller previously replaced the entire environmental target on
provider publication. `limitRealChange` slews **brightness only**. It scales the
new ambient/direct shape immediately; it does not transition cloud openings,
transmission floor, scattering, white balance, caustic strength or background.
Existing wind anchoring preserves position on valid-to-valid provider refresh,
but does not cover forecast expiry/fallback/return: those switch to/from a
fixed-epoch fallback wind and can teleport the cloud field.

Controlled reproduction at equatorial 2026-06-21 noon, identical wind, cloud
20% → 90%, same timestamp: after the existing safety limiter, brightness stays
0.7542031699, but the final engine's sampled cloud opening jumps from
0.9191551605 to 0.0872228518. RGB changes from
(0.787299, 0.804212, 0.757007) to (0.810539, 0.827218, 0.791573).
Automatic has no provider acquisition replacement and therefore avoids this
path. This establishes abrupt refresh behavior; it does not establish an
independent, perpetual frame-to-frame defect with unchanged provider data.

Other investigated candidates: no React (vanilla modules), random values are
scenery initialization only, fixed engine seeds survive setLighting, weather
provider snapshots persist, and setLighting neither restarts the animation
clock nor schedules an additional RAF. Preview owns its renderer/clock and does
not feed real output. Hourly/current boundaries, missing fields, timestamps,
midnight and preview evaluation order already have continuous-domain tests.
Cloud masks are deterministic cached samples, not randomly regenerated textures.
No conflicting second lighting calculation or stochastic final Canvas pass was
found. Continuous parameters were previously tested mostly below the live
controller, leaving the acquisition boundary uncovered.

## Correction

`createLiveEnvironmentEvaluator` owns only live acquisition continuity, before
existing runtime safety. At a changed acquisition it evaluates the previous and
new targets at the same absolute time, computes visual-shape differences, and
removes those differences over 60 seconds with smoothstep. Ambient/direct shape
is normalized by target brightness, so runtime brightness slew and protected
darkness retain authority. Genuine ongoing forecast and procedural variation
continue during that minute. Interrupted updates start from the current visual
state. Identical payload values (including recreated objects and fetchedAt-only
changes) do not restart a transition.

Cloud displacement receives a persistent positional correction at acquisition
and fallback boundaries, rather than a fading correction that would move the
pattern back to an unrelated origin. Seeds, cloud topology, animation loops,
Automatic, manual, preview, UI and safety policies are unchanged. Configuration
changes intentionally retain their prior behavior. Preview remains pure and
history independent; it does not receive live acquisition history.

The environmental record and weather diagnostics describe the target weather;
the preset's visual fields describe the acquisition transition. This is artistic
lighting, not a reconstructed satellite image or calibrated hardware output.

## Verification

New unit regressions inspect final RGB and cloud-opening samples for repeated
evaluation, identical/changed/interrupted refreshes, sampling-rate independence,
missing fields, missing/returning data, forecast expiry and current-observation
expiry. Existing environment regressions cover forecast boundaries, midnight,
playback speeds, forward/backward scrubbing and frame-clock independence.

The new Chromium `live-weather` suite drives the real controller and actual
AquariumRenderer. Repeated evaluation, identical refresh, changed acquisition,
mid-transition identical refresh, missing/returning data and preview scrub replay
all give exactly zero pixel difference at the update instant. At +16 ms mean
RGBA difference is 0.0001740/255, maximum 1. Changed weather after one minute
produces mean difference 3.007, maximum 18: responsiveness is preserved. Rapid
mode switching checks stable procedural displacement and repeated output;
existing safety startup/darkness behavior still applies on mode entry.

`npm test` passed all 20 unit tests and all eight Chromium suites;
`git diff --check` passed.

AquaOS has no production compilation/build command: production is the static
repository. Full `npm test` serves it under `/AquaOS/` and covers production
relative paths. Physical Safari, real devices and the originally affected
browser/API history remain unverified. No deployment is performed by this fix.
