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
  breathe: `// Slow inhale/exhale between tint1 and tint2
return function(i, x, y, z, t, audio, out) {
  const phase = (t * audio.speed) / 6;
  const u = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const k = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + 1.2));
  out[0] = (audio.tint1[0]*(1-u) + audio.tint2[0]*u) * k;
  out[1] = (audio.tint1[1]*(1-u) + audio.tint2[1]*u) * k;
  out[2] = (audio.tint1[2]*(1-u) + audio.tint2[2]*u) * k;
};`,
  plasma: `// Demoscene plasma — sum of sines across 3D, lerps tint1↔tint2
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
  out[0] = (audio.tint1[0]*(1-u) + audio.tint2[0]*u) * k;
  out[1] = (audio.tint1[1]*(1-u) + audio.tint2[1]*u) * k;
  out[2] = (audio.tint1[2]*(1-u) + audio.tint2[2]*u) * k;
};`,
  aurora: `// Aurora curtain — vertical gradient with horizontal noise drift
return function(i, x, y, z, t, audio, out) {
  const T = t * audio.speed * 0.4;
  const drift = Math.sin(x*0.6*audio.scale + T)*0.5 + Math.sin(y*0.4*audio.scale - T*0.7)*0.5;
  const zNorm = z / 5;
  const u = Math.max(0, Math.min(1, zNorm*0.7 + 0.15 + drift*0.25));
  const veil = 0.35 + 0.65 * Math.max(0, Math.sin(zNorm*3.14 + drift*1.5 + T*0.6));
  out[0] = (audio.tint1[0]*(1-u) + audio.tint2[0]*u) * veil;
  out[1] = (audio.tint1[1]*(1-u) + audio.tint2[1]*u) * veil;
  out[2] = (audio.tint1[2]*(1-u) + audio.tint2[2]*u) * veil;
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
  fireflies: `// 32 drifting fireflies; each pixel sums inverse-distance brightness (uses tint1)
const N = 32;
const fx = new Float32Array(N), fy = new Float32Array(N), fz = new Float32Array(N);
const fphase = new Float32Array(N), ffreq = new Float32Array(N);
for (let k = 0; k < N; k++) {
  fx[k] = Math.sin(k*12.9898)*4;
  fy[k] = Math.cos(k*78.233)*4;
  fz[k] = 0.5 + ((k*0.21)%1)*4.0;
  fphase[k] = (k*1.7) % (Math.PI*2);
  ffreq[k] = 0.6 + ((k*0.37)%1)*1.4;
}
return function(i, x, y, z, t, audio, out) {
  const T = t * audio.speed;
  let acc = 0;
  for (let k = 0; k < N; k++) {
    const px = fx[k] + Math.sin(T*0.31 + k)*0.6;
    const py = fy[k] + Math.cos(T*0.27 + k*1.7)*0.6;
    const pz = fz[k] + Math.sin(T*0.18 + k*0.9)*0.4;
    const dx = x-px, dy = y-py, dz = z-pz;
    const d2 = dx*dx + dy*dy + dz*dz;
    const blink = 0.55 + 0.45*Math.sin(T*ffreq[k] + fphase[k]);
    acc += blink / (1 + d2*4);
  }
  const I = Math.min(1.4, acc);
  out[0] = audio.tint1[0]*I;
  out[1] = audio.tint1[1]*I;
  out[2] = audio.tint1[2]*I;
};`,
  waveform3d: `// Audio waveform as a 3D band across X
return function(i, x, y, z, t, audio, out) {
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
  out[0] = (audio.tint1[0]*(1-mix) + audio.tint2[0]*mix) * k;
  out[1] = (audio.tint1[1]*(1-mix) + audio.tint2[1]*mix) * k;
  out[2] = (audio.tint1[2]*(1-mix) + audio.tint2[2]*mix) * k;
};`,
  vuMeter: `// Bottom-to-top VU bars — left=bass, mid=mid, right=treble
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
  out[0] = (audio.tint1[0]*(1-u) + audio.tint2[0]*u) * k;
  out[1] = (audio.tint1[1]*(1-u) + audio.tint2[1]*u) * k;
  out[2] = (audio.tint1[2]*(1-u) + audio.tint2[2]*u) * k;
};`,
  frequencyRings: `// Concentric rings from the center — radius picks FFT band
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
  const tintMix = Math.min(1, mag * 1.5);
  const k = shell * (0.4 + 0.6 * mag);
  out[0] = (audio.tint1[0]*(1-tintMix) + audio.tint2[0]*tintMix) * k;
  out[1] = (audio.tint1[1]*(1-tintMix) + audio.tint2[1]*tintMix) * k;
  out[2] = (audio.tint1[2]*(1-tintMix) + audio.tint2[2]*tintMix) * k;
};`,
  golSimple: `// Classic single-species Conway. Quick reseed on die-out or stagnation.
let cells, next, birthT, deathT, lastTick = -1, popHistory = [];
function fillRandom(t) {
  for (let k = 0; k < cells.length; k++) {
    cells[k] = Math.random() < 0.28 ? 1 : 0;
    if (cells[k]) birthT[k] = t;
  }
}
return function(i, x, y, z, t, audio, out, ctx) {
  if (!ctx) { out[0]=audio.tint1[0]*0.05; out[1]=audio.tint1[1]*0.05; out[2]=audio.tint1[2]*0.05; return; }
  const N = ctx.pixelCount;
  if (!cells || cells.length !== N) {
    cells = new Uint8Array(N); next = new Uint8Array(N);
    birthT = new Float32Array(N); deathT = new Float32Array(N);
    fillRandom(t); lastTick = t; popHistory = [];
  }
  const tickInterval = 0.28 / Math.max(0.2, audio.speed);
  if (i === 0 && t - lastTick >= tickInterval) {
    let alive = 0;
    for (let k = 0; k < N; k++) {
      const ns = ctx.grid.neighborsOf(k);
      let live = 0;
      for (let n = 0; n < ns.length; n++) live += cells[ns[n]];
      const was = cells[k];
      let now = 0;
      if (was === 1 && (live === 2 || live === 3)) now = 1;
      else if (was === 0 && live === 3) now = 1;
      next[k] = now;
      if (now) alive++;
      if (was && !now) deathT[k] = t;
      if (!was && now) birthT[k] = t;
    }
    const tmp = cells; cells = next; next = tmp;
    lastTick = t;
    popHistory.push(alive);
    if (popHistory.length > 16) popHistory.shift();
    let sd = Infinity;
    if (popHistory.length >= 10) {
      const m = popHistory.reduce((s,v)=>s+v,0) / popHistory.length;
      let v = 0; for (const x of popHistory) v += (x-m)*(x-m);
      sd = Math.sqrt(v / popHistory.length);
    }
    if (alive < N * 0.008 || sd < 1.0) { fillRandom(t); popHistory.length = 0; }
  }
  if (cells[i]) {
    const age = Math.min(1, (t - birthT[i]) / 0.4);
    const k = 0.45 + 0.55 * age;
    out[0] = audio.tint1[0]*k; out[1] = audio.tint1[1]*k; out[2] = audio.tint1[2]*k;
  } else {
    const age = t - deathT[i];
    if (age < 0.45 && deathT[i] > 0) {
      const k = (1 - age/0.45) * 0.3;
      out[0] = audio.tint2[0]*k; out[1] = audio.tint2[1]*k; out[2] = audio.tint2[2]*k;
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
  golSimple:   { name: "Conway (classic)",       category: 'generative', description: 'Single-species Conway. Quick reseed when it dies out.', fn: golSimple,   source: SOURCES.golSimple },
  gameOfLife:  { name: "Conway (multi-species)", category: 'generative', description: '8 species compete via Conway rules. Dominance triggers a split + reshuffle.', fn: gameOfLife, source: SOURCES.gameOfLife },
  rainfall:    { name: 'Rainfall',               category: 'generative', description: 'Drops fall top-to-bottom; speed follows audio energy.', fn: rainfall,    source: SOURCES.rainfall },
  sineWave:    { name: 'Sine wave',              category: 'generative', description: 'Traveling sine-band — no audio needed.',                fn: sineWave,    source: SOURCES.sineWave },

  // ─── Audio-reactive ───
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
