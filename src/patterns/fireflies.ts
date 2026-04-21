import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const N = 32;
const fx = new Float32Array(N);
const fy = new Float32Array(N);
const fz = new Float32Array(N);
const fphase = new Float32Array(N);
const ffreq = new Float32Array(N);
const fhue = new Float32Array(N);
let inited = false;

// Per-frame caches — computed once at i=0, read per pixel thereafter
const cacheX = new Float32Array(N);
const cacheY = new Float32Array(N);
const cacheZ = new Float32Array(N);
const cacheR = new Float32Array(N);
const cacheG = new Float32Array(N);
const cacheB = new Float32Array(N);
let cachedT = -1;

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

export const fireflies: PatternFn = (i, x, y, z, t, audio, out) => {
  if (!inited) init();
  // Rebuild the per-firefly cache only on the first pixel of each frame
  if (i === 0 || cachedT !== t) {
    const T = t * audio.speed;
    for (let k = 0; k < N; k++) {
      cacheX[k] = fx[k] + Math.sin(T * 0.31 + k) * 0.6;
      cacheY[k] = fy[k] + Math.cos(T * 0.27 + k * 1.7) * 0.6;
      cacheZ[k] = fz[k] + Math.sin(T * 0.18 + k * 0.9) * 0.4;
      const blink = 0.55 + 0.45 * Math.sin(T * ffreq[k] + fphase[k]);
      paletteLerp(audio.paletteStops, fhue[k], tmp);
      cacheR[k] = tmp[0] * blink;
      cacheG[k] = tmp[1] * blink;
      cacheB[k] = tmp[2] * blink;
    }
    cachedT = t;
  }

  let r = 0, g = 0, b = 0, totalW = 0;
  for (let k = 0; k < N; k++) {
    const dx = x - cacheX[k];
    const dy = y - cacheY[k];
    const dz = z - cacheZ[k];
    const d2 = dx * dx + dy * dy + dz * dz;
    const w = 1 / (1 + d2 * 4);
    if (w < 0.005) continue;
    r += cacheR[k] * w;
    g += cacheG[k] * w;
    b += cacheB[k] * w;
    totalW += w;
  }
  if (totalW < 0.01) return;
  const I = Math.min(1.4, totalW);
  out[0] = (r / totalW) * I;
  out[1] = (g / totalW) * I;
  out[2] = (b / totalW) * I;
};
