import type { PatternFn } from '../types';

export const embers: PatternFn = (_i, x, y, z, t, audio, out) => {
  const T = t * audio.speed * 1.2;
  const heightFalloff = Math.max(0, 1 - z / 5);
  const flicker =
    Math.sin(x * 3.1 + T * 2.0) * 0.5 +
    Math.sin(y * 2.7 - T * 1.6) * 0.5 +
    Math.sin((x + y) * 1.8 + T * 0.9) * 0.5;
  const intensity = Math.max(0, heightFalloff * (0.6 + 0.55 * flicker));
  const warmth = Math.max(0, Math.min(1, intensity));
  out[0] = audio.tint1[0] * intensity + 0.2 * warmth;
  out[1] = audio.tint1[1] * intensity * (0.4 + 0.6 * heightFalloff);
  out[2] = audio.tint1[2] * intensity * 0.3;
};
