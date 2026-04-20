import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const bassPulse: PatternFn = (_i, x, y, z, t, audio, out) => {
  const cz = 2.5;
  const d = Math.sqrt(x * x + y * y + (z - cz) * (z - cz));
  const wave = Math.sin(d * 1.5 - t * audio.speed * 4 + audio.bass * 6);
  const intensity = Math.max(0, wave) * (0.3 + 0.7 * audio.bass);
  if (intensity <= 0) return;
  // Palette u: radial distance blends with bass level so harder hits push further up palette
  const u = Math.min(1, d / 6 * 0.6 + audio.bass * 0.6);
  paletteLerp(audio.paletteStops, u, tmp);
  // Treble adds a subtle red tint lift
  out[0] = intensity * (tmp[0] + 0.1 * audio.treble);
  out[1] = intensity * tmp[1];
  out[2] = intensity * tmp[2];
};
