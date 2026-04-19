import type { PatternFn } from '../types';

export const pulseTint: PatternFn = (_i, x, y, z, t, audio, out) => {
  const cz = 2.5;
  const d = Math.sqrt(x * x + y * y + (z - cz) * (z - cz)) * audio.scale;
  const wave = Math.sin(d * 1.4 - t * audio.speed * 3 + (audio.bass || 0) * 6);
  const intensity = Math.max(0, wave) * (0.25 + 0.75 * (audio.bass || 0.1));
  const bassW = Math.min(1, (audio.bass || 0) * 2);
  const cR = audio.tint1[0] * (1 - bassW) + audio.tint2[0] * bassW;
  const cG = audio.tint1[1] * (1 - bassW) + audio.tint2[1] * bassW;
  const cB = audio.tint1[2] * (1 - bassW) + audio.tint2[2] * bassW;
  out[0] = cR * intensity;
  out[1] = cG * intensity;
  out[2] = cB * intensity;
};
