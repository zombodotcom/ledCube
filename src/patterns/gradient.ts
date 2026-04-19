import type { PatternFn } from '../types';

export const gradient: PatternFn = (_i, _x, _y, z, t, audio, out) => {
  const shift = t * audio.speed * 0.3;
  const u = Math.max(0, Math.min(1, (z / 5) * audio.scale + shift - Math.floor((z / 5) * audio.scale + shift)));
  const k = 0.6 + 0.4 * (audio.energy || 0.3);
  out[0] = (audio.tint1[0] * (1 - u) + audio.tint2[0] * u) * k;
  out[1] = (audio.tint1[1] * (1 - u) + audio.tint2[1] * u) * k;
  out[2] = (audio.tint1[2] * (1 - u) + audio.tint2[2] * u) * k;
};
