import type { PatternFn } from '../types';

export const aurora: PatternFn = (_i, x, y, z, t, audio, out) => {
  const T = t * audio.speed * 0.4;
  const drift =
    Math.sin(x * 0.6 * audio.scale + T) * 0.5 +
    Math.sin(y * 0.4 * audio.scale - T * 0.7) * 0.5;
  const zNorm = z / 5;
  const u = Math.max(0, Math.min(1, zNorm * 0.7 + 0.15 + drift * 0.25));
  const veil = 0.35 + 0.65 * Math.max(0, Math.sin(zNorm * 3.14 + drift * 1.5 + T * 0.6));
  out[0] = (audio.tint1[0] * (1 - u) + audio.tint2[0] * u) * veil;
  out[1] = (audio.tint1[1] * (1 - u) + audio.tint2[1] * u) * veil;
  out[2] = (audio.tint1[2] * (1 - u) + audio.tint2[2] * u) * veil;
};
