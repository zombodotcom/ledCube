import type { PatternFn } from '../types';

export const solidTint: PatternFn = (_i, _x, _y, _z, t, audio, out) => {
  const breathing = 0.7 + 0.3 * Math.sin(t * audio.speed * 1.2);
  const bass = audio.bass || 0;
  const k = breathing * (1 + bass * 2) * 0.5;
  out[0] = audio.tint1[0] * k;
  out[1] = audio.tint1[1] * k;
  out[2] = audio.tint1[2] * k;
};
