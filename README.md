# AquaOS v0.5

A mobile-first aquarium lighting preview. The compact screen adapts to the available viewport height, keeping the aquarium, active preset and nine controls visible without scrolling on standard phone sizes, including landscape. Promotional copy is removed; preset descriptions remain available to screen readers. Extremely short screens or enlarged text may scroll to keep controls accessible. Select one of nine moods and see its lighting immediately in an animated underwater scene. Vanilla JavaScript, Canvas 2D and CSS; no build step, runtime dependencies, external fonts or services.

## Run locally

Serve the repository over HTTP (ES modules do not work reliably with `file://`):

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Deploy the repository root through GitHub Pages (Settings → Pages → Deploy from a branch → main → / root). All asset URLs are relative and support the `/AquaOS/` project path. Merge the feature PR before Pages serves v0.5.

## Structure

- `index.html`, `styles.css`: accessible single-page UI, responsive layout and safe-area spacing.
- `js/app.js`: preset buttons and UI wiring.
- `js/presets.js`: immutable preset definitions and intent-level effect parameters.
- `js/state.js`: validated selection, subscriptions and versioned local storage; works when storage is blocked.
- `js/effects.js`: reusable lighting state/sampling and a low-resolution illumination/scattering pass applied to all scene materials.
- `js/noise.js`, `js/clouds.js`: cached noise lattice, layered fBm, smooth cloud transmittance and slow coverage variation.
- `js/caustics.js`: independent, warped refractive highlights, attenuated by cloud transmittance.
- `js/timing.js`: timestamp-based visible animation clock and deterministic irregular lightning events.
- `js/scenery.js`: randomized per-visit aquascape, three plant varieties, rocks, schooling and independent fish, and rising bubbles. Geometry stays stable on resize and preset changes; fish proportions follow the shorter canvas edge.
- `js/renderer.js`: responsive Canvas scene, 30fps cap, DPR capped at 2, hidden-tab suspension and live reduced-motion support. Reduced motion renders a still scene and disables lightning.
- `js/hardware.js`: simulation-only adapter contract. No network commands or real device control.
- `tests/browser.cjs`: browser regression checks (development only).

Presets: Sunny, Clouds, Sunrise, Sunset, Storm, Moonlight, Waves, Rainbow and Sparkle. The selected preset persists on this browser. The preview is artistic, not a calibrated prediction of physical LED output. Storm uses occasional soft lightning; reduced motion disables flashes and all animation.

## Verification

With the server running and Playwright available:

```sh
node tests/browser.cjs
node tests/lighting.cjs
```

The default test URL is `http://127.0.0.1:8000/aquaos/` for the workspace parent server. When serving this repository root directly, prefix the commands with `TEST_URL=http://127.0.0.1:8000/`. Set `CHROMIUM_PATH` if Chromium is installed elsewhere.

Tests exercise every preset, mobile widths, keyboard input, persistence, invalid/blocked storage, reduced motion, project-path hosting and browser errors. Chromium mobile emulation is useful but does not replace testing on a physical iPhone in Safari.

## Lighting model

The UI and aquarium artwork are unchanged. A shared 96×64 radiance map modulates the completed scene, so fish, foliage, water and substrate receive the same light. Stable ambient illumination remains under clouds; directional sunlight is attenuated with depth and two large-scale cloud fields. Each field uses three smoothly interpolated noise octaves over cached lattice values. No circles, triangle beams, animated strips or per-frame randomness are used for cloud shadows. Dominant cloud structures cross the tank in approximately 85 seconds; a second layer drifts more slowly, with a slower coverage envelope. The underlying lattice is periodic only over hours of travel.

Independent noise ridges create subtle water caustics. Their energy falls with blocked sunlight. A low-energy scattering pass adds water depth without cones. Sunrise increases asymptotically over about 90 seconds of visible simulation time, sunset decreases over about 100 seconds; both settle without an obvious loop. Storm has irregularly spaced, sometimes paired global flashes. Moonlight stays cool and dim; Rainbow gently cycles color and Sparkle uses low-amplitude highlights. All animation shares elapsed visible time, so dropped frames do not slow cloud travel. Hidden tabs pause the clock; reduced motion produces a still frame and no lightning.

The map and image buffers are reused, samples avoid per-frame object churn, and Canvas interpolates the low-resolution maps to the DPR-capped output. No full-resolution CPU pixel loop is used. See [lighting validation](docs/lighting-validation.md) for time-separated Clouds captures and measured limitations.

## Hardware boundary and next steps

Two LED bars are planned, each described as RGB (5 wires), warm white (2 wires) and cold white (2 wires), currently using two LiWeBe 3.0.24 controllers. Voltage, pinout, driver protocol, channel mapping and addressability are **unverified**. Wire counts do not establish compatibility. Do not connect the bars directly to ESP32 GPIO or assume individually addressable LEDs.

A future adapter should implement `connect`, `applyIntent` and `disconnect`, negotiate capabilities, and translate a versioned preset intent only after electrical inspection. Add acknowledgement, connectivity/error state and state reconciliation before showing any physical device as connected. Discovery and local network control are not implemented; HTTPS browser restrictions and ESP32 transport/authentication need a deliberate design.

Future custom preset editing can extend the preset registry with schema-validated local definitions and versioned migrations. Scheduling and weather should produce the same lighting intent through a separate automation service; location requires explicit opt-in. Keep these optional features out of the everyday preset screen. The header settings button opens an accessible placeholder dialog; no device or scheduling controls are implemented yet.

Physical channel aggregation and two-bar mapping belong in the hardware adapter, not the canvas renderer.
