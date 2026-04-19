import type { PatternFn } from '../types';

let beatSeed = 0;
let lastBeatTime = -1;

export const beatGrid: PatternFn = (_i, x, y, _z, t, audio, out) => {
  if (audio.beat && audio.time !== lastBeatTime) {
    lastBeatTime = audio.time;
    beatSeed = (audio.time * 1000) | 0;
  }
  const sx = Math.round(x * 100) | 0;
  const sy = Math.round(y * 100) | 0;
  let h = sx ^ (sy * 73856093) ^ (beatSeed * 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  const lit = (h >>> 0) % 4 === 0 ? 1 : 0;
  const age = t - lastBeatTime;
  const intensity = lit && lastBeatTime > 0 && age < 0.35 ? (1 - age / 0.35) * (0.4 + 0.6 * audio.bass) : 0;
  const w = ((h >>> 0) % 1000) / 1000;
  out[0] = intensity * (audio.tint1[0] * (1 - w) + audio.tint2[0] * w);
  out[1] = intensity * (audio.tint1[1] * (1 - w) + audio.tint2[1] * w);
  out[2] = intensity * (audio.tint1[2] * (1 - w) + audio.tint2[2] * w);
};
