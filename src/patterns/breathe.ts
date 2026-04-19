import type { PatternFn } from '../types';

export const breathe: PatternFn = (_i, _x, _y, _z, t, audio, out) => {
  const phase = (t * audio.speed) / 6;
  const u = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const k = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + 1.2));
  out[0] = (audio.tint1[0] * (1 - u) + audio.tint2[0] * u) * k;
  out[1] = (audio.tint1[1] * (1 - u) + audio.tint2[1] * u) * k;
  out[2] = (audio.tint1[2] * (1 - u) + audio.tint2[2] * u) * k;
};
