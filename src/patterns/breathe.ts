import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const breathe: PatternFn = (_i, _x, _y, _z, t, audio, out) => {
  const phase = (t * audio.speed) / 6;
  const u = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const k = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + 1.2));
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * k;
  out[1] = tmp[1] * k;
  out[2] = tmp[2] * k;
};
