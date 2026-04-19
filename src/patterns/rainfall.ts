import type { PatternFn } from '../types';

export const rainfall: PatternFn = (_i, x, y, z, t, audio, out) => {
  const speed = (2 + audio.energy * 6) * audio.speed;
  const raw = (z - t * speed + x * 0.3 + y * 0.21) / 1.2;
  const phase = (raw - Math.floor(raw)) * 1.2;
  const drop = phase < 0.08 ? (0.08 - phase) / 0.08 : 0;
  out[0] = drop * audio.tint1[0];
  out[1] = drop * audio.tint1[1];
  out[2] = drop * audio.tint1[2];
};
