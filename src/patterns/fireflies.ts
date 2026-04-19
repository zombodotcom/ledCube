import type { PatternFn } from '../types';

const N = 32;
const fx = new Float32Array(N);
const fy = new Float32Array(N);
const fz = new Float32Array(N);
const fphase = new Float32Array(N);
const ffreq = new Float32Array(N);
let inited = false;

function init() {
  for (let k = 0; k < N; k++) {
    fx[k] = Math.sin(k * 12.9898) * 4;
    fy[k] = Math.cos(k * 78.233) * 4;
    fz[k] = 0.5 + ((k * 0.21) % 1) * 4.0;
    fphase[k] = (k * 1.7) % (Math.PI * 2);
    ffreq[k] = 0.6 + ((k * 0.37) % 1) * 1.4;
  }
  inited = true;
}

export const fireflies: PatternFn = (_i, x, y, z, t, audio, out) => {
  if (!inited) init();
  const T = t * audio.speed;
  let acc = 0;
  for (let k = 0; k < N; k++) {
    const px = fx[k] + Math.sin(T * 0.31 + k) * 0.6;
    const py = fy[k] + Math.cos(T * 0.27 + k * 1.7) * 0.6;
    const pz = fz[k] + Math.sin(T * 0.18 + k * 0.9) * 0.4;
    const dx = x - px;
    const dy = y - py;
    const dz = z - pz;
    const d2 = dx * dx + dy * dy + dz * dz;
    const blink = 0.55 + 0.45 * Math.sin(T * ffreq[k] + fphase[k]);
    acc += blink / (1 + d2 * 4);
  }
  const I = Math.min(1.4, acc);
  out[0] = audio.tint1[0] * I;
  out[1] = audio.tint1[1] * I;
  out[2] = audio.tint1[2] * I;
};
