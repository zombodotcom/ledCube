import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const rainfall: PatternFn = (_i, x, y, z, t, audio, out) => {
  const speed = (2 + audio.energy * 6) * audio.speed;
  const raw = (z - t * speed + x * 0.3 + y * 0.21) / 1.2;
  const phase = (raw - Math.floor(raw)) * 1.2;
  if (phase >= 0.08) return;
  const drop = (0.08 - phase) / 0.08;
  // Each drop gets a stable u from its column hash
  const col = (Math.round(x * 3.3) + Math.round(y * 3.3) * 17) >>> 0;
  const u = ((col * 2654435761) >>> 0) / 0xffffffff;
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * drop;
  out[1] = tmp[1] * drop;
  out[2] = tmp[2] * drop;
};
