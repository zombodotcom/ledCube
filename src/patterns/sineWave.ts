import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const sineWave: PatternFn = (_i, x, y, z, t, audio, out) => {
  const phase = (x * 0.8 + y * 0.3) * audio.scale;
  const band = Math.sin(phase - t * audio.speed * 2) * 1.2 + 2.5;
  const d = Math.abs(z - band);
  const lit = Math.max(0, 1 - d * 1.2);
  if (lit <= 0) return;
  // Palette u from x position so the traveling band walks through the palette
  const xNorm = Math.max(0, Math.min(1, (x + 4) / 8));
  const u = (xNorm + t * audio.speed * 0.1) % 1;
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * lit;
  out[1] = tmp[1] * lit;
  out[2] = tmp[2] * lit;
};
