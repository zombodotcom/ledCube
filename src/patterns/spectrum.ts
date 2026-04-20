import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const spectrum: PatternFn = (_i, x, _y, z, _t, audio, out) => {
  const band = Math.floor(((x + 4) / 8) * audio.fft.length);
  const b = Math.max(0, Math.min(audio.fft.length - 1, band));
  const mag = audio.fft[b];
  const hFrac = Math.max(0, Math.min(1, z / 5));
  const lit = hFrac < mag ? 1 : 0;
  if (!lit) return;
  const u = b / audio.fft.length;
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0];
  out[1] = tmp[1];
  out[2] = tmp[2];
};
