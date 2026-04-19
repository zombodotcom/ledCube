# LED Cube Sim

Browser-based 3D simulator for a hanging-strip LED cube installation. Renders up to ~200k WS2815 pixels, runs audio-reactive JS patterns, and overlays electrical analysis (voltage drop, brownout heatmap).

## Stack

TypeScript + Vite + Three.js. No React, no state libs. Patterns are plain JS functions compiled at runtime.

## Run

```
npm install
npm run dev
```

Opens at `http://localhost:5173`. Default scene: 24×24 grid, strip lengths sampled from [3m, 4m, 5m], 60 LED/m (~62k pixels).

## Build order the code follows

1. `src/geometry.ts` — strip defs → pixel map (positions, indices).
2. `src/scene.ts` — Three.js `Points` with per-vertex color buffer, shader point material, OrbitControls.
3. `src/patterns/` — 4 built-in patterns + `compilePattern(source)` for the live editor.
4. `src/audio.ts` — Web Audio `AnalyserNode`, 64 log-spaced bands (40 Hz – 16 kHz), onset-based beat detection.
5. `src/electrical.ts` — per-strip voltage drop model with configurable injection points; 10 Hz heatmap.
6. `src/ui.ts` / `src/export.ts` — controls panel, pixel map / E1.31 / Markdown power report export.

## Pattern signature

```js
// Paste into the in-app editor. `audio` has fft, energy, bass, mid, treble, beat, time.
return function(i, x, y, z, t, audio, out) {
  out[0] = 0.5 + 0.5 * Math.sin(t + x);
  out[1] = audio.bass;
  out[2] = 0;
};
```

## Perf notes

- 172k pixels at 60fps requires moving pattern eval to the GPU (vertex shader + audio texture uniform). The JS path works up to ~60–80k before dropping below 30fps on mid-range hardware.
- If you need more: replace the per-pixel JS loop in `main.ts` with a shader that samples position attribute and reads FFT from a `DataTexture` uniform.

## E1.31 output

Browsers can't send raw UDP. The export gives you a universe/channel allocation (170 pixels/universe). Feed that into a host-side bridge (LedFx, xLights, or a tiny Node script) that receives UDP sACN and forwards to your controllers.

## Tests

```
npm test
```

Covers geometry generation (pixel count, positions) and the electrical voltage-drop chain.
