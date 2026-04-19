import type { PatternFn } from '../types';

export const frequencyRings: PatternFn = (_i, x, y, z, t, audio, out) => {
  const cz = 2.5;
  const r = Math.sqrt(x * x + y * y + (z - cz) * (z - cz));
  // Map radius to FFT band
  const maxR = 6;
  const u = Math.min(1, r / maxR);
  const idx = Math.min(audio.fft.length - 1, Math.floor(u * audio.fft.length));
  const mag = audio.fft[idx];
  const bandWidth = 0.18;
  const phase = r * audio.scale - t * audio.speed * 2;
  const wave = Math.sin(phase * 2) * 0.5 + 0.5;
  const shell = Math.max(0, 1 - Math.abs(wave - mag) / bandWidth);
  const tintMix = Math.min(1, mag * 1.5);
  const k = shell * (0.4 + 0.6 * mag);
  out[0] = (audio.tint1[0] * (1 - tintMix) + audio.tint2[0] * tintMix) * k;
  out[1] = (audio.tint1[1] * (1 - tintMix) + audio.tint2[1] * tintMix) * k;
  out[2] = (audio.tint1[2] * (1 - tintMix) + audio.tint2[2] * tintMix) * k;
};
