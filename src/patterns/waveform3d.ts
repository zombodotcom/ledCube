import type { PatternFn } from '../types';

export const waveform3d: PatternFn = (_i, x, _y, z, _t, audio, out) => {
  const wf = audio.waveform;
  const n = wf.length;
  const u = Math.max(0, Math.min(1, (x + 4) / 8));
  const idx = Math.min(n - 1, Math.floor(u * n));
  const sample = wf[idx];
  const band = 2.5 + sample * 2.2;
  const d = Math.abs(z - band);
  const lit = Math.max(0, 1 - d * 1.8);
  const mix = 0.5 + 0.5 * sample;
  const k = lit * (0.5 + 0.5 * audio.energy);
  out[0] = (audio.tint1[0] * (1 - mix) + audio.tint2[0] * mix) * k;
  out[1] = (audio.tint1[1] * (1 - mix) + audio.tint2[1] * mix) * k;
  out[2] = (audio.tint1[2] * (1 - mix) + audio.tint2[2] * mix) * k;
};
