import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const aurora: PatternFn = (_i, x, y, z, t, audio, out) => {
  const T = t * audio.speed * 0.4;
  const drift =
    Math.sin(x * 0.6 * audio.scale + T) * 0.5 +
    Math.sin(y * 0.4 * audio.scale - T * 0.7) * 0.5;
  const zNorm = z / 5;
  const u = Math.max(0, Math.min(1, zNorm * 0.7 + 0.15 + drift * 0.25));
  const veil = 0.35 + 0.65 * Math.max(0, Math.sin(zNorm * 3.14 + drift * 1.5 + T * 0.6));
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * veil;
  out[1] = tmp[1] * veil;
  out[2] = tmp[2] * veil;
};
