import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const pulseTint: PatternFn = (_i, x, y, z, t, audio, out) => {
  const cz = 2.5;
  const d = Math.sqrt(x * x + y * y + (z - cz) * (z - cz)) * audio.scale;
  const wave = Math.sin(d * 1.4 - t * audio.speed * 3 + (audio.bass || 0) * 6);
  const intensity = Math.max(0, wave) * (0.25 + 0.75 * (audio.bass || 0.1));
  const u = Math.min(1, (audio.bass || 0) * 2);
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * intensity;
  out[1] = tmp[1] * intensity;
  out[2] = tmp[2] * intensity;
};
