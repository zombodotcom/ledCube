import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const vuMeter: PatternFn = (_i, x, y, z, t, audio, out) => {
  const zNorm = z / 5;
  const xNorm = (x + 4) / 8;
  let level: number;
  if (xNorm < 0.33) level = audio.bass;
  else if (xNorm < 0.66) level = audio.mid;
  else level = audio.treble;
  level = Math.min(1.3, level) * (0.6 + 0.4 * audio.energy);
  if (zNorm >= level) return;
  const u = Math.min(1, zNorm / Math.max(0.1, level));
  const k = 0.7 + 0.3 * Math.sin(t * audio.speed * 4 + xNorm * 6 + y * 2);
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * k;
  out[1] = tmp[1] * k;
  out[2] = tmp[2] * k;
};
