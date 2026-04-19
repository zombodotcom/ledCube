import type { PatternFn } from '../types';

export const stripes: PatternFn = (_i, _x, _y, z, t, audio, out) => {
  const period = 0.6 / Math.max(0.1, audio.scale);
  const phase = (z - t * audio.speed * 1.5) / period;
  const w = phase - Math.floor(phase);
  const use1 = w < 0.5;
  const edge = Math.min(w, 1 - w) * 2;
  const soft = Math.min(1, edge * 6);
  const k = 0.8 + 0.2 * (audio.bass || 0);
  const r = (use1 ? audio.tint1[0] : audio.tint2[0]) * soft * k;
  const g = (use1 ? audio.tint1[1] : audio.tint2[1]) * soft * k;
  const b = (use1 ? audio.tint1[2] : audio.tint2[2]) * soft * k;
  out[0] = r; out[1] = g; out[2] = b;
};
