import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

const tmp: [number, number, number] = [0, 0, 0];

export const waveform3d: PatternFn = (_i, x, y, z, t, audio, out) => {
  // Blank when silent — no baseline stripe
  if (audio.energy < 0.015) return;

  const wf = audio.waveform;
  const n = wf.length;
  const xNorm = Math.max(0, Math.min(1, (x + 4) / 8));
  const idx = Math.min(n - 1, Math.floor(xNorm * n));
  const sample = wf[idx];

  // Main band + mirrored second band so it has visual depth
  const drift = Math.sin(t * audio.speed * 0.8) * 0.25;
  const bandA = 2.5 + sample * 2.2 + drift;
  const bandB = 2.5 - sample * 1.4 - drift * 0.6;
  const dA = Math.abs(z - bandA);
  const dB = Math.abs(z - bandB);
  const litA = Math.max(0, 1 - dA * 1.8);
  const litB = Math.max(0, 1 - dB * 2.4) * 0.55;
  const lit = Math.max(litA, litB);
  if (lit <= 0) return;

  // Palette u driven by x position + depth-into-cube to get horizontal color gradient
  const yNorm = Math.max(0, Math.min(1, (y + 4) / 8));
  const u = (xNorm * 0.7 + yNorm * 0.3 + sample * 0.15 + 1) % 1;
  paletteLerp(audio.paletteStops, u, tmp);
  const k = lit * Math.min(1.2, audio.energy * 2);
  out[0] = tmp[0] * k;
  out[1] = tmp[1] * k;
  out[2] = tmp[2] * k;
};
