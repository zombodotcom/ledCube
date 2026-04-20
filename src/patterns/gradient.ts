import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const gradient: PatternFn = (_i, _x, _y, z, t, audio, out) => {
  const shift = t * audio.speed * 0.3;
  const raw = (z / 5) * audio.scale + shift;
  const u = raw - Math.floor(raw);
  const k = 0.6 + 0.4 * (audio.energy || 0.3);
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * k;
  out[1] = tmp[1] * k;
  out[2] = tmp[2] * k;
};
