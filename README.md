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
- `js/effects.js`: deterministic lighting samples, independent of rendering and hardware.
- `js/scenery.js`: randomized per-visit aquascape, three plant varieties, rocks, schooling and independent fish, and rising bubbles. Geometry stays stable on resize and preset changes; fish proportions follow the shorter canvas edge.
- `js/renderer.js`: responsive Canvas scene, 30fps cap, DPR capped at 2, hidden-tab suspension and live reduced-motion support. Reduced motion renders a still scene and disables lightning.
- `js/hardware.js`: simulation-only adapter contract. No network commands or real device control.
- `tests/browser.cjs`: browser regression checks (development only).

Presets: Sunny, Clouds, Sunrise, Sunset, Storm, Moonlight, Waves, Rainbow and Sparkle. The selected preset persists on this browser. The preview is artistic, not a calibrated prediction of physical LED output. Storm uses occasional soft lightning; reduced motion disables flashes and all animation.

## Verification

With the server running and Playwright available:

```sh
node tests/browser.cjs
```

Tests exercise every preset, mobile widths, keyboard input, persistence, invalid/blocked storage, reduced motion, project-path hosting and browser errors. Chromium mobile emulation is useful but does not replace testing on a physical iPhone in Safari.

## Hardware boundary and next steps

Two LED bars are planned, each described as RGB (5 wires), warm white (2 wires) and cold white (2 wires), currently using two LiWeBe 3.0.24 controllers. Voltage, pinout, driver protocol, channel mapping and addressability are **unverified**. Wire counts do not establish compatibility. Do not connect the bars directly to ESP32 GPIO or assume individually addressable LEDs.

A future adapter should implement `connect`, `applyIntent` and `disconnect`, negotiate capabilities, and translate a versioned preset intent only after electrical inspection. Add acknowledgement, connectivity/error state and state reconciliation before showing any physical device as connected. Discovery and local network control are not implemented; HTTPS browser restrictions and ESP32 transport/authentication need a deliberate design.

Future custom preset editing can extend the preset registry with schema-validated local definitions and versioned migrations. Scheduling and weather should produce the same lighting intent through a separate automation service; location requires explicit opt-in. Keep these optional features out of the everyday preset screen. The header settings button opens an accessible placeholder dialog; no device or scheduling controls are implemented yet.

Physical channel aggregation and two-bar mapping belong in the hardware adapter, not the canvas renderer.
