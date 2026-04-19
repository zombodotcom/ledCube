import type { PatternFn } from '../types';

export const bassPulse: PatternFn = (_i, x, y, z, t, audio, out) => {
  const cz = 2.5;
  const d = Math.sqrt(x * x + y * y + (z - cz) * (z - cz));
  const wave = Math.sin(d * 1.5 - t * audio.speed * 4 + audio.bass * 6);
  const intensity = Math.max(0, wave) * (0.3 + 0.7 * audio.bass);
  out[0] = intensity * (audio.tint1[0] + 0.1 * audio.treble);
  out[1] = intensity * audio.tint1[1];
  out[2] = intensity * audio.tint1[2];
};
