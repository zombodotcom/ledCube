import type { PatternCategory, PatternFn } from '../types';
import { spectrum } from './spectrum';
import { bassPulse } from './bassPulse';
import { rainfall } from './rainfall';
import { beatGrid } from './beatGrid';
import { sineWave } from './sineWave';
import { solidTint } from './solidTint';
import { gradient } from './gradient';
import { stripes } from './stripes';
import { pulseTint } from './pulseTint';
import { breathe } from './breathe';
import { plasma } from './plasma';
import { aurora } from './aurora';
import { embers } from './embers';
import { fireflies } from './fireflies';
import { gameOfLife } from './gameOfLife';
import { golSimple } from './golSimple';
import { waveform3d } from './waveform3d';
import { vuMeter } from './vuMeter';
import { frequencyRings } from './frequencyRings';
import { cubeSpectrogram } from './cubeSpectrogram';
import { pianoRoll } from './pianoRoll';

export interface PatternEntry {
  name: string;
  category: PatternCategory;
  description: string;
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
  gradient: `// Vertical gradient through the full palette, scrolling with speed
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const shift = t * audio.speed * 0.3;
  const raw = (z / 5) * audio.scale + shift;
  const u = raw - Math.floor(raw);
  const k = 0.6 + 0.4 * (audio.energy || 0.3);
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
};`,
  stripes: `// Scrolling palette stripes; each stripe picks a different palette u
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const period = 0.6 / Math.max(0.1, audio.scale);
  const phase = (z - t * audio.speed * 1.5) / period;
  const w = phase - Math.floor(phase);
  const stripeIdx = Math.floor(phase);
  const u = ((stripeIdx * 0.37) % 1 + 1) % 1;
  const edge = Math.min(w, 1 - w) * 2;
  const soft = Math.min(1, edge * 6);
  const k = (0.8 + 0.2 * (audio.bass || 0)) * soft;
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
};`,
  pulseTint: `// Radial wave; palette u driven by bass
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const cz = 2.5;
  const d = Math.sqrt(x*x + y*y + (z-cz)*(z-cz)) * audio.scale;
  const wave = Math.sin(d * 1.4 - t * audio.speed * 3 + (audio.bass||0) * 6);
  const I = Math.max(0, wave) * (0.25 + 0.75 * (audio.bass || 0.1));
  const u = Math.min(1, (audio.bass || 0) * 2);
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*I; out[1] = tmp[1]*I; out[2] = tmp[2]*I;
};`,
  sineWave: `// Traveling sine band; walks through the palette as it moves
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const phase = (x * 0.8 + y * 0.3) * audio.scale;
  const band = Math.sin(phase - t * audio.speed * 2) * 1.2 + 2.5;
  const d = Math.abs(z - band);
  const lit = Math.max(0, 1 - d * 1.2);
  if (lit <= 0) return;
  const xNorm = Math.max(0, Math.min(1, (x + 4) / 8));
  const u = (xNorm + t * audio.speed * 0.1) % 1;
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*lit; out[1] = tmp[1]*lit; out[2] = tmp[2]*lit;
};`,
  spectrum: `// Spectrum columns — x picks FFT band, z is magnitude; colored via palette
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const band = Math.floor(((x + 4) / 8) * audio.fft.length);
  const b = Math.max(0, Math.min(audio.fft.length - 1, band));
  const mag = audio.fft[b];
  const hFrac = Math.max(0, Math.min(1, z / 5));
  if (hFrac >= mag) return;
  const u = b / audio.fft.length;
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]; out[1] = tmp[1]; out[2] = tmp[2];
};`,
  bassPulse: `// Radial wave driven by bass; palette u from radius + bass level
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const cz = 2.5;
  const d = Math.sqrt(x*x + y*y + (z - cz)*(z - cz));
  const wave = Math.sin(d * 1.5 - t * audio.speed * 4 + audio.bass * 6);
  const I = Math.max(0, wave) * (0.3 + 0.7 * audio.bass);
  if (I <= 0) return;
  const u = Math.min(1, d / 6 * 0.6 + audio.bass * 0.6);
  palLerp(audio.paletteStops, u, tmp);
  out[0] = I * (tmp[0] + 0.1 * audio.treble);
  out[1] = I * tmp[1];
  out[2] = I * tmp[2];
};`,
  rainfall: `// Drops fall top-to-bottom; each column gets a stable palette color
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const speed = (2 + audio.energy * 6) * audio.speed;
  const raw = (z - t * speed + x * 0.3 + y * 0.21) / 1.2;
  const phase = (raw - Math.floor(raw)) * 1.2;
  if (phase >= 0.08) return;
  const drop = (0.08 - phase) / 0.08;
  const col = (Math.round(x * 3.3) + Math.round(y * 3.3) * 17) >>> 0;
  const u = ((col * 2654435761) >>> 0) / 0xffffffff;
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*drop; out[1] = tmp[1]*drop; out[2] = tmp[2]*drop;
};`,
  beatGrid: `// Random strips flash on each detected beat; palette-colored
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
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
  if (I <= 0) return;
  const u = ((h >>> 0) % 1000) / 1000;
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*I; out[1] = tmp[1]*I; out[2] = tmp[2]*I;
};`,
  breathe: `// Slow inhale/exhale through the palette
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const phase = (t * audio.speed) / 6;
  const u = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const k = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + 1.2));
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
};`,
  plasma: `// Demoscene plasma — sum of sines across 3D, mapped through palette
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const s = audio.scale;
  const T = t * audio.speed * 0.8;
  const a = Math.sin(x*s*0.9 + T);
  const b = Math.sin(y*s*1.1 - T*1.3);
  const c = Math.sin((x+y+z)*s*0.4 + T*0.7);
  const d = Math.sin(Math.sqrt(x*x + y*y + (z-2.5)*(z-2.5))*s*0.6 - T);
  const v = (a+b+c+d) * 0.25;
  const u = 0.5 + 0.5 * v;
  const k = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(v * 3.14));
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
};`,
  aurora: `// Aurora curtain — vertical gradient through palette, with horizontal noise drift
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const T = t * audio.speed * 0.4;
  const drift = Math.sin(x*0.6*audio.scale + T)*0.5 + Math.sin(y*0.4*audio.scale - T*0.7)*0.5;
  const zNorm = z / 5;
  const u = Math.max(0, Math.min(1, zNorm*0.7 + 0.15 + drift*0.25));
  const veil = 0.35 + 0.65 * Math.max(0, Math.sin(zNorm*3.14 + drift*1.5 + T*0.6));
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*veil; out[1] = tmp[1]*veil; out[2] = tmp[2]*veil;
};`,
  embers: `// Warm ember field — bottom-glowing, flickering upward (uses tint1)
return function(i, x, y, z, t, audio, out) {
  const T = t * audio.speed * 1.2;
  const fall = Math.max(0, 1 - z/5);
  const flicker = Math.sin(x*3.1 + T*2.0)*0.5 + Math.sin(y*2.7 - T*1.6)*0.5 + Math.sin((x+y)*1.8 + T*0.9)*0.5;
  const I = Math.max(0, fall * (0.6 + 0.55 * flicker));
  const warmth = Math.max(0, Math.min(1, I));
  out[0] = audio.tint1[0]*I + 0.2*warmth;
  out[1] = audio.tint1[1]*I*(0.4 + 0.6*fall);
  out[2] = audio.tint1[2]*I*0.3;
};`,
  fireflies: `// 32 drifting fireflies; each firefly has its own stable palette color
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
const N = 32;
const fx = new Float32Array(N), fy = new Float32Array(N), fz = new Float32Array(N);
const fphase = new Float32Array(N), ffreq = new Float32Array(N), fhue = new Float32Array(N);
for (let k = 0; k < N; k++) {
  fx[k] = Math.sin(k*12.9898)*4;
  fy[k] = Math.cos(k*78.233)*4;
  fz[k] = 0.5 + ((k*0.21)%1)*4.0;
  fphase[k] = (k*1.7) % (Math.PI*2);
  ffreq[k] = 0.6 + ((k*0.37)%1)*1.4;
  fhue[k] = ((k * 2654435761) >>> 0) / 0xffffffff;
}
return function(i, x, y, z, t, audio, out) {
  const T = t * audio.speed;
  let r = 0, g = 0, b = 0, totalW = 0;
  for (let k = 0; k < N; k++) {
    const px = fx[k] + Math.sin(T*0.31 + k)*0.6;
    const py = fy[k] + Math.cos(T*0.27 + k*1.7)*0.6;
    const pz = fz[k] + Math.sin(T*0.18 + k*0.9)*0.4;
    const dx = x-px, dy = y-py, dz = z-pz;
    const d2 = dx*dx + dy*dy + dz*dz;
    const blink = 0.55 + 0.45*Math.sin(T*ffreq[k] + fphase[k]);
    const w = blink / (1 + d2*4);
    if (w < 0.005) continue;
    palLerp(audio.paletteStops, fhue[k], tmp);
    r += tmp[0]*w; g += tmp[1]*w; b += tmp[2]*w;
    totalW += w;
  }
  if (totalW < 0.01) return;
  const I = Math.min(1.4, totalW);
  out[0] = (r/totalW) * I;
  out[1] = (g/totalW) * I;
  out[2] = (b/totalW) * I;
};`,
  pianoRoll: `// Synthesia-style piano roll. X = MIDI note (C2..C7), Z column lights
// while a note is held. Recently-played notes leave a short trail at the bottom.
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
const LOW = 36, HIGH = 96, RANGE = HIGH - LOW;
return function(i, x, y, z, t, audio, out, ctx) {
  let st = ctx ? ctx.state.piano : undefined;
  if (ctx && !st) { st = { trail: new Float32Array(128) }; ctx.state.piano = st; }
  if (st && i === 0) {
    for (let n = 0; n < 128; n++) if (audio.midiNotes[n]) st.trail[n] = t;
  }
  const xNorm = Math.max(0, Math.min(1, (x + 4) / 8));
  const noteIdx = LOW + Math.floor(xNorm * RANGE);
  if (noteIdx < 0 || noteIdx >= 128) return;
  const zNorm = z / 5;
  if (audio.midiNotes[noteIdx] === 1) {
    const u = (noteIdx - LOW) / Math.max(1, RANGE);
    palLerp(audio.paletteStops, u, tmp);
    const k = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 10 + noteIdx));
    out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
    return;
  }
  const lastPlay = st ? st.trail[noteIdx] : 0;
  if (lastPlay > 0) {
    const age = t - lastPlay;
    if (age < 1.0 && zNorm < 0.6) {
      const fade = (1 - age / 1.0) * (1 - zNorm / 0.6);
      const u = (noteIdx - LOW) / Math.max(1, RANGE);
      palLerp(audio.paletteStops, u, tmp);
      const k = fade * 0.5;
      out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
      return;
    }
  }
  if (zNorm < 0.12) {
    const isC = noteIdx % 12 === 0;
    const u = (noteIdx - LOW) / Math.max(1, RANGE);
    palLerp(audio.paletteStops, u, tmp);
    const k = isC ? 0.18 : 0.08;
    out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
  }
};`,
  cubeSpectrogram: `// Scrolling 3D spectrogram. X=time (newest right), Y=freq band, Z=magnitude.
// Uses ctx.state to ring-buffer FFT snapshots at ~30 Hz.
function heatmap(v, out) {
  v = Math.max(0, Math.min(1, v));
  if (v < 0.25) { const u=v/0.25; out[0]=0; out[1]=0; out[2]=u*0.7; }
  else if (v < 0.5) { const u=(v-0.25)/0.25; out[0]=0; out[1]=u*0.9; out[2]=0.7+u*0.3; }
  else if (v < 0.75) { const u=(v-0.5)/0.25; out[0]=u; out[1]=0.9; out[2]=1-u; }
  else { const u=(v-0.75)/0.25; out[0]=1; out[1]=0.9-u*0.7; out[2]=0; }
}
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const h = [0,0,0], pc = [0,0,0];
return function(i, x, y, z, t, audio, out, ctx) {
  if (!ctx) { out[0]=audio.tint1[0]*0.05; out[1]=audio.tint1[1]*0.05; out[2]=audio.tint1[2]*0.05; return; }
  let st = ctx.state.spec;
  if (!st) {
    st = { cols: 24, rows: Math.min(audio.fft.length, 24), history: null, head: 0, lastPush: audio.time };
    st.history = new Float32Array(st.cols * st.rows);
    ctx.state.spec = st;
  }
  const tickInterval = 0.033 / Math.max(0.2, audio.speed);
  if (i === 0 && audio.time - st.lastPush >= tickInterval) {
    const bandsPerRow = audio.fft.length / st.rows;
    const base = st.head * st.rows;
    for (let r = 0; r < st.rows; r++) {
      const lo = Math.floor(r * bandsPerRow);
      const hi = Math.max(lo + 1, Math.floor((r + 1) * bandsPerRow));
      let sum = 0, count = 0;
      for (let b = lo; b < hi; b++) { sum += audio.fft[b]; count++; }
      st.history[base + r] = count ? sum / count : 0;
    }
    st.head = (st.head + 1) % st.cols;
    st.lastPush = audio.time;
  }
  const xNorm = Math.max(0, Math.min(1, (x + 4) / 8));
  const yNorm = Math.max(0, Math.min(1, (y + 4) / 8));
  const zNorm = Math.max(0, Math.min(1, z / 5));
  const colOffset = Math.floor(xNorm * st.cols);
  const col = (st.head + colOffset) % st.cols;
  const row = Math.min(st.rows - 1, Math.floor(yNorm * st.rows));
  const mag = st.history[col * st.rows + row];
  if (zNorm > mag) return;
  const relHeight = zNorm / Math.max(0.05, mag);
  const v = relHeight*0.9 + mag*0.1;
  heatmap(v, h);
  palLerp(audio.paletteStops, v, pc);
  const mix = 0.55;
  const k = 0.6 + 0.4 * mag;
  out[0] = (h[0]*(1-mix) + pc[0]*mix) * k;
  out[1] = (h[1]*(1-mix) + pc[1]*mix) * k;
  out[2] = (h[2]*(1-mix) + pc[2]*mix) * k;
};`,
  waveform3d: `// Audio waveform as two 3D bands; blank until sound
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  if (audio.energy < 0.015) return;
  const wf = audio.waveform;
  const n = wf.length;
  const xNorm = Math.max(0, Math.min(1, (x + 4) / 8));
  const idx = Math.min(n - 1, Math.floor(xNorm * n));
  const sample = wf[idx];
  const drift = Math.sin(t * audio.speed * 0.8) * 0.25;
  const bandA = 2.5 + sample * 2.2 + drift;
  const bandB = 2.5 - sample * 1.4 - drift * 0.6;
  const litA = Math.max(0, 1 - Math.abs(z - bandA) * 1.8);
  const litB = Math.max(0, 1 - Math.abs(z - bandB) * 2.4) * 0.55;
  const lit = Math.max(litA, litB);
  if (lit <= 0) return;
  const yNorm = Math.max(0, Math.min(1, (y + 4) / 8));
  const u = (xNorm * 0.7 + yNorm * 0.3 + sample * 0.15 + 1) % 1;
  palLerp(audio.paletteStops, u, tmp);
  const k = lit * Math.min(1.2, audio.energy * 2);
  out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
};`,
  vuMeter: `// Bottom-to-top VU bars; height within bar samples the palette
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const zNorm = z / 5;
  const xNorm = (x + 4) / 8;
  let level;
  if (xNorm < 0.33) level = audio.bass;
  else if (xNorm < 0.66) level = audio.mid;
  else level = audio.treble;
  level = Math.min(1.3, level) * (0.6 + 0.4 * audio.energy);
  if (zNorm >= level) return;
  const u = Math.min(1, zNorm / Math.max(0.1, level));
  const k = 0.7 + 0.3 * Math.sin(t * audio.speed * 4 + xNorm * 6 + y * 2);
  palLerp(audio.paletteStops, u, tmp);
  out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
};`,
  frequencyRings: `// Concentric rings; radius picks FFT band; color from palette
function palLerp(p, u, out) {
  const S = p.length / 3; u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (S - 1), i0 = Math.floor(idx), f = idx - i0, g = 1 - f;
  const a = i0 * 3, b = (i0 + 1) * 3;
  out[0] = p[a]*g + p[b]*f; out[1] = p[a+1]*g + p[b+1]*f; out[2] = p[a+2]*g + p[b+2]*f;
}
const tmp = [0,0,0];
return function(i, x, y, z, t, audio, out) {
  const cz = 2.5;
  const r = Math.sqrt(x*x + y*y + (z - cz)*(z - cz));
  const maxR = 6;
  const u = Math.min(1, r / maxR);
  const idx = Math.min(audio.fft.length - 1, Math.floor(u * audio.fft.length));
  const mag = audio.fft[idx];
  const bandWidth = 0.18;
  const phase = r * audio.scale - t * audio.speed * 2;
  const wave = Math.sin(phase * 2) * 0.5 + 0.5;
  const shell = Math.max(0, 1 - Math.abs(wave - mag) / bandWidth);
  if (shell <= 0) return;
  const palU = (u * 0.7 + Math.min(1, mag * 1.5) * 0.3) % 1;
  palLerp(audio.paletteStops, palU, tmp);
  const k = shell * (0.4 + 0.6 * mag);
  out[0] = tmp[0]*k; out[1] = tmp[1]*k; out[2] = tmp[2]*k;
};`,
  golSimple: `// Conway with a per-cell hue. New cells inherit circular-mean hue from
// their 3 parents + a tiny mutation. Alive cells drift slowly. The colors
// emerge LOCALLY — no fixed palette, blended territories.
let cells, next, hue, nextHue, birthT, deathT, lastTick = -1, popHistory = [];
function hsl(h, s, l, out) {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  out[0] = f(0); out[1] = f(8); out[2] = f(4);
}
function reseed(N, t) {
  for (let k = 0; k < N; k++) {
    if (Math.random() < 0.28) { cells[k] = 1; hue[k] = Math.random(); birthT[k] = t; }
    else { cells[k] = 0; deathT[k] = 0; }
  }
  popHistory.length = 0; lastTick = t;
}
return function(i, x, y, z, t, audio, out, ctx) {
  if (!ctx) { out[0]=audio.tint1[0]*0.05; out[1]=audio.tint1[1]*0.05; out[2]=audio.tint1[2]*0.05; return; }
  const N = ctx.pixelCount;
  if (!cells || cells.length !== N) {
    cells = new Uint8Array(N); next = new Uint8Array(N);
    hue = new Float32Array(N); nextHue = new Float32Array(N);
    birthT = new Float32Array(N); deathT = new Float32Array(N);
    reseed(N, t);
  }
  const tickInterval = 0.28 / Math.max(0.2, audio.speed);
  if (i === 0 && t - lastTick >= tickInterval) {
    let alive = 0;
    for (let k = 0; k < N; k++) {
      const ns = ctx.grid.neighborsOf(k);
      let live = 0, cx = 0, cy = 0;
      for (let n = 0; n < ns.length; n++) {
        if (cells[ns[n]]) {
          live++;
          const h = hue[ns[n]] * Math.PI * 2;
          cx += Math.cos(h); cy += Math.sin(h);
        }
      }
      const was = cells[k];
      let now = 0, newHue = hue[k];
      if (was === 1 && (live === 2 || live === 3)) {
        now = 1;
        newHue = (hue[k] + (Math.random() - 0.5) * 0.01 + 1) % 1;
      } else if (was === 0 && live === 3) {
        now = 1;
        const meanH = Math.atan2(cy, cx) / (Math.PI * 2);
        newHue = (meanH + (Math.random() - 0.5) * 0.04 + 1) % 1;
      }
      next[k] = now;
      nextHue[k] = newHue;
      if (now) alive++;
      if (was && !now) deathT[k] = t;
      if (!was && now) birthT[k] = t;
    }
    const tc = cells, th = hue;
    cells = next; hue = nextHue;
    next = tc; nextHue = th;
    lastTick = t;
    popHistory.push(alive);
    if (popHistory.length > 16) popHistory.shift();
    let sd = Infinity;
    if (popHistory.length >= 10) {
      const m = popHistory.reduce((s,v)=>s+v,0) / popHistory.length;
      let v = 0; for (const x of popHistory) v += (x-m)*(x-m);
      sd = Math.sqrt(v / popHistory.length);
    }
    if (alive < N * 0.008 || sd < 1.0) reseed(N, t);
  }
  if (cells[i]) {
    const age = Math.min(1, (t - birthT[i]) / 0.4);
    const k = 0.5 + 0.5 * age;
    hsl(hue[i], 0.9, 0.55, out);
    out[0] *= k; out[1] *= k; out[2] *= k;
  } else {
    const age = t - deathT[i];
    if (age < 0.35 && deathT[i] > 0) {
      const k = (1 - age/0.35) * 0.18;
      out[0] = k; out[1] = k; out[2] = k;
    }
  }
};`,
  gameOfLife: `// 8-species Immigration Game — Conway with 8 species spread across tint1↔tint2.
// New cells inherit the majority species of 3 live neighbors. When one species
// dominates > 90% for several ticks, flashes then redistributes survivors
// across all species so the ecosystem restarts. Full die-out → freeze + reseed.
const SPC = 8;
let cells, next, birthT, deathT, lastTick = -1, popHistory = [], dominanceTicks = 0;
let phase = 'evolving', phaseSince = 0;
function reseed(N, t) {
  for (let k = 0; k < N; k++) {
    if (Math.random() < 0.22) { cells[k] = 1 + ((Math.random()*SPC)|0); birthT[k] = t; }
    else { cells[k] = 0; deathT[k] = 0; }
  }
  popHistory.length = 0; dominanceTicks = 0; lastTick = t;
  phase = 'evolving'; phaseSince = t;
}
function speciesColor(s, tint1, tint2, out) {
  const u = (s - 1) / Math.max(1, SPC - 1);
  const j = ((s * 2654435761) >>> 0) / 0xffffffff;
  out[0] = tint1[0]*(1-u) + tint2[0]*u;
  out[1] = tint1[1]*(1-u) + tint2[1]*u;
  out[2] = tint1[2]*(1-u) + tint2[2]*u;
  const m = (out[0]+out[1]+out[2])/3;
  const sh = (j-0.5)*0.35;
  out[0] = Math.max(0, Math.min(1, out[0] + sh*(out[0]-m)));
  out[1] = Math.max(0, Math.min(1, out[1] + sh*(out[1]-m)));
  out[2] = Math.max(0, Math.min(1, out[2] + sh*(out[2]-m)));
}
return function(i, x, y, z, t, audio, out, ctx) {
  if (!ctx) { out[0]=audio.tint1[0]*0.05; out[1]=audio.tint1[1]*0.05; out[2]=audio.tint1[2]*0.05; return; }
  const N = ctx.pixelCount;
  if (!cells || cells.length !== N) {
    cells = new Uint8Array(N); next = new Uint8Array(N);
    birthT = new Float32Array(N); deathT = new Float32Array(N);
    reseed(N, t);
  }
  const tickInterval = 0.33 / Math.max(0.2, audio.speed);
  const FREEZE_DURATION = 1.5, SPLIT_FLASH_DURATION = 0.9;

  if (i === 0) {
    if (phase === 'frozen' && t - phaseSince >= FREEZE_DURATION) {
      reseed(N, t);
    } else if (phase === 'splitting' && t - phaseSince >= SPLIT_FLASH_DURATION) {
      for (let k = 0; k < N; k++) {
        if (cells[k]) { cells[k] = 1 + ((Math.random()*SPC)|0); birthT[k] = t; }
      }
      dominanceTicks = 0; popHistory.length = 0; lastTick = t;
      phase = 'evolving'; phaseSince = t;
    } else if (phase === 'evolving' && t - lastTick >= tickInterval) {
      const counts = new Uint32Array(SPC + 1);
      for (let k = 0; k < N; k++) {
        const ns = ctx.grid.neighborsOf(k);
        let live = 0;
        const votes = new Uint8Array(SPC + 1);
        for (let n = 0; n < ns.length; n++) {
          const s = cells[ns[n]];
          if (s) { live++; votes[s]++; }
        }
        const was = cells[k];
        let now = 0;
        if (was !== 0 && (live === 2 || live === 3)) now = was;
        else if (was === 0 && live === 3) {
          let best = 0, bc = 0;
          for (let s = 1; s <= SPC; s++) { if (votes[s] > bc) { bc = votes[s]; best = s; } }
          now = best;
        }
        next[k] = now;
        if (now) counts[now]++;
        if (was && !now) deathT[k] = t;
        if (!was && now) birthT[k] = t;
      }
      const tmp = cells; cells = next; next = tmp;
      lastTick = t;
      let total = 0, dom = 0;
      for (let s = 1; s <= SPC; s++) { total += counts[s]; if (counts[s] > dom) dom = counts[s]; }
      popHistory.push(total);
      if (popHistory.length > 20) popHistory.shift();
      if (total < N * 0.005) { phase = 'frozen'; phaseSince = t; }
      else {
        if (popHistory.length >= 14) {
          let m = 0; for (const v of popHistory) m += v; m /= popHistory.length;
          let v = 0; for (const x of popHistory) v += (x-m)*(x-m);
          const sd = Math.sqrt(v / popHistory.length);
          if (sd < 1.2) { phase = 'frozen'; phaseSince = t; }
        }
        if (total > N * 0.02 && dom / total > 0.9) {
          dominanceTicks++;
          if (dominanceTicks >= 3 && phase === 'evolving') { phase = 'splitting'; phaseSince = t; }
        } else dominanceTicks = 0;
      }
    }
  }

  const species = cells[i];
  if (phase === 'frozen') {
    if (!species) return;
    const pulse = 0.5 + 0.5 * Math.sin((t - phaseSince) * Math.PI * 3.5);
    speciesColor(species, audio.tint1, audio.tint2, out);
    out[0] *= pulse; out[1] *= pulse; out[2] *= pulse;
    return;
  }
  if (phase === 'splitting') {
    if (!species) return;
    const f = Math.min(1, (t - phaseSince) / SPLIT_FLASH_DURATION);
    const flash = 1 - f;
    speciesColor(species, audio.tint1, audio.tint2, out);
    out[0] = out[0]*(0.4 + flash*0.6) + flash*0.3;
    out[1] = out[1]*(0.4 + flash*0.6) + flash*0.3;
    out[2] = out[2]*(0.4 + flash*0.6) + flash*0.3;
    return;
  }
  if (species) {
    const age = Math.min(1, (t - birthT[i]) / 0.5);
    const k = 0.5 + 0.5 * age;
    speciesColor(species, audio.tint1, audio.tint2, out);
    out[0] *= k; out[1] *= k; out[2] *= k;
  } else {
    const age = t - deathT[i];
    if (age < 0.4 && deathT[i] > 0) {
      const k = (1 - age/0.4) * 0.2;
      out[0] = (audio.tint1[0] + audio.tint2[0])*0.5*k;
      out[1] = (audio.tint1[1] + audio.tint2[1])*0.5*k;
      out[2] = (audio.tint1[2] + audio.tint2[2])*0.5*k;
    }
  }
};`,
};

export const builtinPatterns: Record<string, PatternEntry> = {
  // ─── Ambient ───
  breathe:    { name: 'Breathe',                category: 'ambient',    description: 'Slow tint1↔tint2 inhale/exhale.',                       fn: breathe,    source: SOURCES.breathe },
  solidTint:  { name: 'Solid tint (breathing)', category: 'ambient',    description: 'Whole cube glows tint1 with bass-reactive brightness.', fn: solidTint,  source: SOURCES.solidTint },
  gradient:   { name: 'Gradient',               category: 'ambient',    description: 'Vertical tint1→tint2 gradient, scrolling.',             fn: gradient,   source: SOURCES.gradient },
  aurora:     { name: 'Aurora',                 category: 'ambient',    description: 'Curtain of light drifting horizontally.',               fn: aurora,     source: SOURCES.aurora },
  embers:     { name: 'Embers',                 category: 'ambient',    description: 'Warm bottom-glow that flickers like coals.',            fn: embers,     source: SOURCES.embers },

  // ─── Generative ───
  plasma:      { name: 'Plasma',                 category: 'generative', description: 'Demoscene plasma — smooth color clouds.',               fn: plasma,      source: SOURCES.plasma },
  fireflies:   { name: 'Fireflies',              category: 'generative', description: '32 drifting points blink and weave through the cube.',  fn: fireflies,   source: SOURCES.fireflies },
  golSimple:   { name: "Conway (colorful)",      category: 'generative', description: 'Every cell has its own hue; children inherit parents\u2019 color.', fn: golSimple, source: SOURCES.golSimple },
  gameOfLife:  { name: "Conway (multi-species)", category: 'generative', description: '8 species compete via Conway rules. Dominance triggers a split + reshuffle.', fn: gameOfLife, source: SOURCES.gameOfLife },
  rainfall:    { name: 'Rainfall',               category: 'generative', description: 'Drops fall top-to-bottom; speed follows audio energy.', fn: rainfall,    source: SOURCES.rainfall },
  sineWave:    { name: 'Sine wave',              category: 'generative', description: 'Traveling sine-band — no audio needed.',                fn: sineWave,    source: SOURCES.sineWave },

  // ─── Audio-reactive ───
  pianoRoll:   { name: 'Piano roll (MIDI)',      category: 'audio',      description: 'Synthesia-style piano roll — needs a MIDI file loaded.',    fn: pianoRoll,   source: SOURCES.pianoRoll },
  cubeSpectrogram: { name: 'Cube spectrogram',   category: 'audio',      description: 'Scrolling FFT history painted on the cube — X=time, Y=freq, Z=magnitude.', fn: cubeSpectrogram, source: SOURCES.cubeSpectrogram },
  waveform3d:  { name: 'Waveform 3D',            category: 'audio',      description: 'Oscilloscope-style audio waveform across the cube.',    fn: waveform3d,  source: SOURCES.waveform3d },
  vuMeter:     { name: 'VU meter',               category: 'audio',      description: 'Bottom-to-top bars — left=bass, mid=mid, right=treble.', fn: vuMeter,    source: SOURCES.vuMeter },
  frequencyRings: { name: 'Frequency rings',     category: 'audio',      description: 'Concentric rings from center; radius picks FFT band.',  fn: frequencyRings, source: SOURCES.frequencyRings },
  spectrum:    { name: 'Spectrum columns',       category: 'audio',      description: 'FFT bands as vertical columns across the cube.',        fn: spectrum,    source: SOURCES.spectrum },
  stripes:     { name: 'Stripes',                category: 'audio',      description: 'Scrolling tint1/tint2 stripes; bass brightens.',        fn: stripes,     source: SOURCES.stripes },
  pulseTint:   { name: 'Pulse',                  category: 'audio',      description: 'Radial wave; bass fades tint1→tint2.',                  fn: pulseTint,   source: SOURCES.pulseTint },

  // ─── Beat ───
  beatGrid:   { name: 'Beat grid',              category: 'beat',       description: 'Random pixels flash on each detected beat.',            fn: beatGrid,   source: SOURCES.beatGrid },
  bassPulse:  { name: 'Bass pulse',             category: 'beat',       description: 'Radial concentric rings driven by bass envelope.',      fn: bassPulse,  source: SOURCES.bassPulse },
};

export function compilePattern(source: string): PatternFn {
  const factory = new Function(source) as () => PatternFn;
  const fn = factory();
  if (typeof fn !== 'function') {
    throw new Error('Pattern source must `return function(...)`');
  }
  return fn;
}
