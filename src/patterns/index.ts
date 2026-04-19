import type { PatternFn } from '../types';
import { spectrum } from './spectrum';
import { bassPulse } from './bassPulse';
import { rainfall } from './rainfall';
import { beatGrid } from './beatGrid';
import { sineWave } from './sineWave';
import { solidTint } from './solidTint';
import { gradient } from './gradient';
import { stripes } from './stripes';
import { pulseTint } from './pulseTint';

export interface PatternEntry {
  name: string;
  fn: PatternFn;
  source: string;
}

const SOURCES = {
  solidTint: `// Whole cube = tint1, breathing + bass-reactive brightness
return function(i, x, y, z, t, audio, out) {
  const breathing = 0.7 + 0.3 * Math.sin(t * audio.speed * 1.2);
  const bass = audio.bass || 0;
  const k = breathing * (1 + bass * 2) * 0.5;
  out[0] = audio.tint1[0] * k;
  out[1] = audio.tint1[1] * k;
  out[2] = audio.tint1[2] * k;
};`,
  gradient: `// Vertical gradient tint1 → tint2, scrolling with speed
return function(i, x, y, z, t, audio, out) {
  const shift = t * audio.speed * 0.3;
  const raw = (z / 5) * audio.scale + shift;
  const u = raw - Math.floor(raw);
  const k = 0.6 + 0.4 * (audio.energy || 0.3);
  out[0] = (audio.tint1[0] * (1 - u) + audio.tint2[0] * u) * k;
  out[1] = (audio.tint1[1] * (1 - u) + audio.tint2[1] * u) * k;
  out[2] = (audio.tint1[2] * (1 - u) + audio.tint2[2] * u) * k;
};`,
  stripes: `// Scrolling tint1/tint2 stripes; scale controls width
return function(i, x, y, z, t, audio, out) {
  const period = 0.6 / Math.max(0.1, audio.scale);
  const phase = (z - t * audio.speed * 1.5) / period;
  const w = phase - Math.floor(phase);
  const use1 = w < 0.5;
  const edge = Math.min(w, 1 - w) * 2;
  const soft = Math.min(1, edge * 6);
  const k = 0.8 + 0.2 * (audio.bass || 0);
  out[0] = (use1 ? audio.tint1[0] : audio.tint2[0]) * soft * k;
  out[1] = (use1 ? audio.tint1[1] : audio.tint2[1]) * soft * k;
  out[2] = (use1 ? audio.tint1[2] : audio.tint2[2]) * soft * k;
};`,
  pulseTint: `// Radial wave from center; bass fades tint1 → tint2
return function(i, x, y, z, t, audio, out) {
  const cz = 2.5;
  const d = Math.sqrt(x*x + y*y + (z-cz)*(z-cz)) * audio.scale;
  const wave = Math.sin(d * 1.4 - t * audio.speed * 3 + (audio.bass||0) * 6);
  const I = Math.max(0, wave) * (0.25 + 0.75 * (audio.bass || 0.1));
  const w = Math.min(1, (audio.bass || 0) * 2);
  out[0] = (audio.tint1[0]*(1-w) + audio.tint2[0]*w) * I;
  out[1] = (audio.tint1[1]*(1-w) + audio.tint2[1]*w) * I;
  out[2] = (audio.tint1[2]*(1-w) + audio.tint2[2]*w) * I;
};`,
  sineWave: `// Traveling sine band at tint1 — no audio needed
return function(i, x, y, z, t, audio, out) {
  const u = (x * 0.8 + y * 0.3) * audio.scale;
  const band = Math.sin(u - t * audio.speed * 2) * 1.2 + 2.5;
  const d = Math.abs(z - band);
  const lit = Math.max(0, 1 - d * 1.2);
  out[0] = audio.tint1[0] * lit;
  out[1] = audio.tint1[1] * lit;
  out[2] = audio.tint1[2] * lit;
};`,
  spectrum: `// Spectrum columns — x picks FFT band, z is magnitude (uses tint1/tint2 as lo/hi color)
return function(i, x, y, z, t, audio, out) {
  const band = Math.floor(((x + 4) / 8) * audio.fft.length);
  const b = Math.max(0, Math.min(audio.fft.length - 1, band));
  const mag = audio.fft[b];
  const hFrac = Math.max(0, Math.min(1, z / 5));
  const lit = hFrac < mag ? 1 : 0;
  const u = b / audio.fft.length;
  out[0] = lit * (audio.tint1[0]*(1-u) + audio.tint2[0]*u);
  out[1] = lit * (audio.tint1[1]*(1-u) + audio.tint2[1]*u);
  out[2] = lit * (audio.tint1[2]*(1-u) + audio.tint2[2]*u);
};`,
  bassPulse: `// Radial wave driven by bass
return function(i, x, y, z, t, audio, out) {
  const cz = 2.5;
  const d = Math.sqrt(x*x + y*y + (z - cz)*(z - cz));
  const wave = Math.sin(d * 1.5 - t * audio.speed * 4 + audio.bass * 6);
  const I = Math.max(0, wave) * (0.3 + 0.7 * audio.bass);
  out[0] = I * (audio.tint1[0] + 0.1 * audio.treble);
  out[1] = I * audio.tint1[1];
  out[2] = I * audio.tint1[2];
};`,
  rainfall: `// Drops fall top-to-bottom, speed from energy
return function(i, x, y, z, t, audio, out) {
  const speed = (2 + audio.energy * 6) * audio.speed;
  const raw = (z - t * speed + x * 0.3 + y * 0.21) / 1.2;
  const phase = (raw - Math.floor(raw)) * 1.2;
  const drop = phase < 0.08 ? (0.08 - phase) / 0.08 : 0;
  out[0] = drop * audio.tint1[0];
  out[1] = drop * audio.tint1[1];
  out[2] = drop * audio.tint1[2];
};`,
  beatGrid: `// Random strips flash on each detected beat
let beatSeed = 0, lastBeatTime = -1;
return function(i, x, y, z, t, audio, out) {
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
  const I = lit && lastBeatTime > 0 && age < 0.35 ? (1 - age/0.35) * (0.4 + 0.6 * audio.bass) : 0;
  const w = ((h >>> 0) % 1000) / 1000;
  out[0] = I * (audio.tint1[0]*(1-w) + audio.tint2[0]*w);
  out[1] = I * (audio.tint1[1]*(1-w) + audio.tint2[1]*w);
  out[2] = I * (audio.tint1[2]*(1-w) + audio.tint2[2]*w);
};`,
};

export const builtinPatterns: Record<string, PatternEntry> = {
  solidTint: { name: 'Solid tint (breathing)', fn: solidTint, source: SOURCES.solidTint },
  gradient: { name: 'Gradient (tint1→tint2)', fn: gradient, source: SOURCES.gradient },
  stripes: { name: 'Stripes', fn: stripes, source: SOURCES.stripes },
  pulseTint: { name: 'Pulse (bass-driven)', fn: pulseTint, source: SOURCES.pulseTint },
  sineWave: { name: 'Sine wave (no audio)', fn: sineWave, source: SOURCES.sineWave },
  spectrum: { name: 'Spectrum columns', fn: spectrum, source: SOURCES.spectrum },
  bassPulse: { name: 'Bass pulse', fn: bassPulse, source: SOURCES.bassPulse },
  rainfall: { name: 'Rainfall', fn: rainfall, source: SOURCES.rainfall },
  beatGrid: { name: 'Beat grid', fn: beatGrid, source: SOURCES.beatGrid },
};

export function compilePattern(source: string): PatternFn {
  const factory = new Function(source) as () => PatternFn;
  const fn = factory();
  if (typeof fn !== 'function') {
    throw new Error('Pattern source must `return function(...)`');
  }
  return fn;
}
