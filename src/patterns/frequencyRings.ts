import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const frequencyRings: PatternFn = (_i, x, y, z, t, audio, out) => {
  const cz = 2.5;
  const r = Math.sqrt(x * x + y * y + (z - cz) * (z - cz));
  const maxR = 6;
  const u = Math.min(1, r / maxR);
  const idx = Math.min(audio.fft.length - 1, Math.floor(u * audio.fft.length));
  const mag = audio.fft[idx];
  const bandWidth = 0.18;
  const phase = r * audio.scale - t * audio.speed * 2;
  const wave = Math.sin(phase * 2) * 0.5 + 0.5;
  const shell = Math.max(0, 1 - Math.abs(wave - mag) / bandWidth);
  if (shell <= 0) return;
  // Palette u: blend radius-based (ring identity) + magnitude-based (intensity)
  const palU = (u * 0.7 + Math.min(1, mag * 1.5) * 0.3) % 1;
  paletteLerp(audio.paletteStops, palU, tmp);
  const k = shell * (0.4 + 0.6 * mag);
  out[0] = tmp[0] * k;
  out[1] = tmp[1] * k;
  out[2] = tmp[2] * k;
};
