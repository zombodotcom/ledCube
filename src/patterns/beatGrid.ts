import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

let beatSeed = 0;
let lastBeatTime = -1;

const tmp: [number, number, number] = [0, 0, 0];

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
  if (intensity <= 0) return;
  const u = ((h >>> 0) % 1000) / 1000;
  paletteLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0] * intensity;
  out[1] = tmp[1] * intensity;
  out[2] = tmp[2] * intensity;
};
