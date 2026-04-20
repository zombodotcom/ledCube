import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const plasma: PatternFn = (_i, x, y, z, t, audio, out) => {
  const s = audio.scale;
  const T = t * audio.speed * 0.8;
  const a = Math.sin(x * s * 0.9 + T);
  const b = Math.sin(y * s * 1.1 - T * 1.3);
  const c = Math.sin((x + y + z) * s * 0.4 + T * 0.7);
  const d = Math.sin(Math.sqrt(x * x + y * y + (z - 2.5) * (z - 2.5)) * s * 0.6 - T);
  const v = (a + b + c + d) * 0.25;
  const u = 0.5 + 0.5 * v;
  const k = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(v * 3.14));
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * k;
  out[1] = tmp[1] * k;
  out[2] = tmp[2] * k;
};
