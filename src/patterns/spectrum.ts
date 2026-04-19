import type { PatternFn } from '../types';

export const spectrum: PatternFn = (_i, x, _y, z, _t, audio, out) => {
  const band = Math.floor(((x + 4) / 8) * audio.fft.length);
  const b = Math.max(0, Math.min(audio.fft.length - 1, band));
  const mag = audio.fft[b];
  const hFrac = Math.max(0, Math.min(1, z / 5));
  const lit = hFrac < mag ? 1 : 0;
  const u = b / audio.fft.length;
  out[0] = lit * (audio.tint1[0] * (1 - u) + audio.tint2[0] * u);
  out[1] = lit * (audio.tint1[1] * (1 - u) + audio.tint2[1] * u);
  out[2] = lit * (audio.tint1[2] * (1 - u) + audio.tint2[2] * u);
};
