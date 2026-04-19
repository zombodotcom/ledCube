import type { PatternFn } from '../types';

export const sineWave: PatternFn = (_i, x, y, z, t, audio, out) => {
  const u = (x * 0.8 + y * 0.3) * audio.scale;
  const band = Math.sin(u - t * audio.speed * 2) * 1.2 + 2.5;
  const d = Math.abs(z - band);
  const lit = Math.max(0, 1 - d * 1.2);
  out[0] = audio.tint1[0] * lit;
  out[1] = audio.tint1[1] * lit;
  out[2] = audio.tint1[2] * lit;
};
