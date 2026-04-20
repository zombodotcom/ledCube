import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const stripes: PatternFn = (_i, _x, _y, z, t, audio, out) => {
  const period = 0.6 / Math.max(0.1, audio.scale);
  const phase = (z - t * audio.speed * 1.5) / period;
  const w = phase - Math.floor(phase);
  // Each stripe picks a different palette u so we see multiple palette colors
  const stripeIdx = Math.floor(phase);
  const u = ((stripeIdx * 0.37) % 1 + 1) % 1;
  const edge = Math.min(w, 1 - w) * 2;
  const soft = Math.min(1, edge * 6);
  const k = (0.8 + 0.2 * (audio.bass || 0)) * soft;
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * k;
  out[1] = tmp[1] * k;
  out[2] = tmp[2] * k;
};
