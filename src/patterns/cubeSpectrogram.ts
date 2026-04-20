import type { PatternFn } from '../types';

// Scrolling 3D spectrogram.
//   X axis = time (oldest on the left, newest on the right — scrolls each tick)
//   Y axis = frequency band (front = low, back = high)
//   Z axis = magnitude threshold (bar height lit from the bottom)
//   color = intensity ramped black → blue → cyan → yellow → red

interface SpecState {
  cols: number;           // X resolution (# time slots)
  rows: number;           // Y resolution (# freq bands)
  history: Float32Array;  // flat [col * rows + row]
  head: number;           // ring write index
  lastPush: number;
}

function heatmap(v: number, out: [number, number, number]) {
  v = Math.max(0, Math.min(1, v));
  if (v < 0.25) {
    const u = v / 0.25;
    out[0] = 0; out[1] = 0; out[2] = u * 0.7;
  } else if (v < 0.5) {
    const u = (v - 0.25) / 0.25;
    out[0] = 0; out[1] = u * 0.9; out[2] = 0.7 + u * 0.3;
  } else if (v < 0.75) {
    const u = (v - 0.5) / 0.25;
    out[0] = u; out[1] = 0.9; out[2] = 1 - u;
  } else {
    const u = (v - 0.75) / 0.25;
    out[0] = 1; out[1] = 0.9 - u * 0.7; out[2] = 0;
  }
}

export const cubeSpectrogram: PatternFn = (_i, x, y, z, _t, audio, out, ctx) => {
  if (!ctx) {
    out[0] = audio.tint1[0] * 0.05;
    out[1] = audio.tint1[1] * 0.05;
    out[2] = audio.tint1[2] * 0.05;
    return;
  }

  // Infer grid resolution from audio.time + pixel count on first call
  let st = ctx.state.spec as SpecState | undefined;
  if (!st) {
    // Assume layout is roughly square; bands/cols both ~ sqrt(strip count)
    const cols = 24;
    const rows = Math.min(audio.fft.length, 24);
    st = {
      cols,
      rows,
      history: new Float32Array(cols * rows),
      head: 0,
      lastPush: audio.time,
    };
    ctx.state.spec = st;
  }

  // Push current FFT slice into the ring buffer ~30 Hz
  const tickInterval = 0.033 / Math.max(0.2, audio.speed);
  if (_i === 0 && audio.time - st.lastPush >= tickInterval) {
    const bandsPerRow = audio.fft.length / st.rows;
    const base = st.head * st.rows;
    for (let r = 0; r < st.rows; r++) {
      const lo = Math.floor(r * bandsPerRow);
      const hi = Math.max(lo + 1, Math.floor((r + 1) * bandsPerRow));
      let sum = 0, count = 0;
      for (let b = lo; b < hi; b++) { sum += audio.fft[b]; count++; }
      st.history[base + r] = count ? sum / count : 0;
    }
    st.head = (st.head + 1) % st.cols;
    st.lastPush = audio.time;
  }

  // Map pixel coord → (time column, freq row, z threshold)
  const xNorm = Math.max(0, Math.min(1, (x + 4) / 8));
  const yNorm = Math.max(0, Math.min(1, (y + 4) / 8));
  const zNorm = Math.max(0, Math.min(1, z / 5));
  const colOffset = Math.floor(xNorm * st.cols);
  const col = (st.head + colOffset) % st.cols; // xNorm=0 is oldest, 1 is newest
  const row = Math.min(st.rows - 1, Math.floor(yNorm * st.rows));
  const mag = st.history[col * st.rows + row];

  if (zNorm > mag) return;
  // Normalize so the bar's top fades to red and the bottom stays cool
  const relHeight = zNorm / Math.max(0.05, mag);
  heatmap(relHeight * 0.9 + mag * 0.1, out);
  const k = 0.6 + 0.4 * mag;
  out[0] *= k; out[1] *= k; out[2] *= k;
};
