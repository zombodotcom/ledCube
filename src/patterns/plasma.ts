import type { PatternFn } from '../types';

export const plasma: PatternFn = (_i, x, y, z, t, audio, out) => {
  const s = audio.scale;
  const T = t * audio.speed * 0.8;
  const a = Math.sin(x * s * 0.9 + T);
  const b = Math.sin(y * s * 1.1 - T * 1.3);
  const c = Math.sin((x + y + z) * s * 0.4 + T * 0.7);
  const d = Math.sin(Math.sqrt(x * x + y * y + (z - 2.5) * (z - 2.5)) * s * 0.6 - T);
  const v = (a + b + c + d) * 0.25;
  const u = 0.5 + 0.5 * v;
  const k = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(v * 3.14));
  out[0] = (audio.tint1[0] * (1 - u) + audio.tint2[0] * u) * k;
  out[1] = (audio.tint1[1] * (1 - u) + audio.tint2[1] * u) * k;
  out[2] = (audio.tint1[2] * (1 - u) + audio.tint2[2] * u) * k;
};
