import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const N = 32;
const fx = new Float32Array(N);
const fy = new Float32Array(N);
const fz = new Float32Array(N);
const fphase = new Float32Array(N);
const ffreq = new Float32Array(N);
const fhue = new Float32Array(N); // stable palette-u per firefly
let inited = false;

function init() {
  for (let k = 0; k < N; k++) {
    fx[k] = Math.sin(k * 12.9898) * 4;
    fy[k] = Math.cos(k * 78.233) * 4;
    fz[k] = 0.5 + ((k * 0.21) % 1) * 4.0;
    fphase[k] = (k * 1.7) % (Math.PI * 2);
    ffreq[k] = 0.6 + ((k * 0.37) % 1) * 1.4;
    fhue[k] = ((k * 2654435761) >>> 0) / 0xffffffff;
  }
  inited = true;
}

const tmp: [number, number, number] = [0, 0, 0];

export const fireflies: PatternFn = (_i, x, y, z, t, audio, out) => {
  if (!inited) init();
  const T = t * audio.speed;
  let r = 0, g = 0, b = 0, totalW = 0;
  for (let k = 0; k < N; k++) {
    const px = fx[k] + Math.sin(T * 0.31 + k) * 0.6;
    const py = fy[k] + Math.cos(T * 0.27 + k * 1.7) * 0.6;
    const pz = fz[k] + Math.sin(T * 0.18 + k * 0.9) * 0.4;
    const dx = x - px;
    const dy = y - py;
    const dz = z - pz;
    const d2 = dx * dx + dy * dy + dz * dz;
    const blink = 0.55 + 0.45 * Math.sin(T * ffreq[k] + fphase[k]);
    const w = blink / (1 + d2 * 4);
    if (w < 0.005) continue;
    paletteLerp(audio.paletteStops, fhue[k], tmp);
    r += tmp[0] * w;
    g += tmp[1] * w;
    b += tmp[2] * w;
    totalW += w;
  }
  if (totalW < 0.01) return;
  const I = Math.min(1.4, totalW);
  // Normalize color (so bright firefly keeps its hue) then scale by intensity
  out[0] = (r / totalW) * I;
  out[1] = (g / totalW) * I;
  out[2] = (b / totalW) * I;
};
