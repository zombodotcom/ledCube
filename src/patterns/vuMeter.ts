import type { PatternFn } from '../types';

export const vuMeter: PatternFn = (_i, x, y, z, t, audio, out) => {
  // Bottom-to-top level bars. Left half = bass, right half = treble. Middle = mid.
  const zNorm = z / 5;
  const xNorm = (x + 4) / 8;
  let level: number;
  if (xNorm < 0.33) level = audio.bass;
  else if (xNorm < 0.66) level = audio.mid;
  else level = audio.treble;
  level = Math.min(1.3, level) * (0.6 + 0.4 * audio.energy);
  const lit = zNorm < level ? 1 : 0;
  if (!lit) return;
  // Color fades from tint1 (low) to tint2 (peak) as the bar rises
  const u = Math.min(1, zNorm / Math.max(0.1, level));
  const k = 0.7 + 0.3 * Math.sin(t * audio.speed * 4 + xNorm * 6 + y * 2);
  out[0] = (audio.tint1[0] * (1 - u) + audio.tint2[0] * u) * k;
  out[1] = (audio.tint1[1] * (1 - u) + audio.tint2[1] * u) * k;
  out[2] = (audio.tint1[2] * (1 - u) + audio.tint2[2] * u) * k;
};
