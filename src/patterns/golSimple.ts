import type { PatternFn } from '../types';

// Classic Conway B3/S23 but each cell carries a continuous hue.
// New cells inherit the average hue of their 3 live parents (with a small
// random mutation). Surviving cells drift slowly. Result: emergent color
// territories that blend and evolve across the LED grid.

interface SimpleGolState {
  cells: Uint8Array;
  next: Uint8Array;
  hue: Float32Array;
  nextHue: Float32Array;
  birthT: Float32Array;
  deathT: Float32Array;
  lastTick: number;
  popHistory: number[];
}

function reseed(st: SimpleGolState, N: number, t: number) {
  for (let k = 0; k < N; k++) {
    if (Math.random() < 0.28) {
      st.cells[k] = 1;
      st.hue[k] = Math.random();
      st.birthT[k] = t;
    } else {
      st.cells[k] = 0;
      st.deathT[k] = 0;
    }
  }
  st.popHistory.length = 0;
  st.lastTick = t;
}

function hslToRgb(h: number, s: number, l: number, out: [number, number, number]) {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  out[0] = f(0);
  out[1] = f(8);
  out[2] = f(4);
}

export const golSimple: PatternFn = (i, _x, _y, _z, t, audio, out, ctx) => {
  if (!ctx) {
    out[0] = audio.tint1[0] * 0.05;
    out[1] = audio.tint1[1] * 0.05;
    out[2] = audio.tint1[2] * 0.05;
    return;
  }
  const N = ctx.pixelCount;
  let st = ctx.state.gol as SimpleGolState | undefined;
  if (!st || st.cells.length !== N) {
    st = {
      cells: new Uint8Array(N),
      next: new Uint8Array(N),
      hue: new Float32Array(N),
      nextHue: new Float32Array(N),
      birthT: new Float32Array(N).fill(t),
      deathT: new Float32Array(N),
      lastTick: t,
      popHistory: [],
    };
    reseed(st, N, t);
    ctx.state.gol = st;
  }

  const tickInterval = 0.28 / Math.max(0.2, audio.speed);
  if (i === 0 && t - st.lastTick >= tickInterval) {
    let alive = 0;
    for (let k = 0; k < N; k++) {
      const ns = ctx.grid.neighborsOf(k);
      let live = 0;
      // Circular mean for hue averaging
      let cx = 0, cy = 0;
      for (let n = 0; n < ns.length; n++) {
        if (st.cells[ns[n]]) {
          live++;
          const h = st.hue[ns[n]] * Math.PI * 2;
          cx += Math.cos(h);
          cy += Math.sin(h);
        }
      }
      const was = st.cells[k];
      let now: 0 | 1 = 0;
      let newHue = st.hue[k];
      if (was === 1 && (live === 2 || live === 3)) {
        now = 1;
        // Slow drift while alive
        newHue = (st.hue[k] + (Math.random() - 0.5) * 0.01 + 1) % 1;
      } else if (was === 0 && live === 3) {
        now = 1;
        // Inherit circular-mean of parents + small mutation
        const meanH = Math.atan2(cy, cx) / (Math.PI * 2);
        newHue = (meanH + (Math.random() - 0.5) * 0.04 + 1) % 1;
      }
      st.next[k] = now;
      st.nextHue[k] = newHue;
      if (now) alive++;
      if (was && !now) st.deathT[k] = t;
      if (!was && now) st.birthT[k] = t;
    }
    const tc = st.cells, th = st.hue;
    st.cells = st.next;
    st.hue = st.nextHue;
    st.next = tc;
    st.nextHue = th;
    st.lastTick = t;
    st.popHistory.push(alive);
    if (st.popHistory.length > 16) st.popHistory.shift();
    let sd = Infinity;
    if (st.popHistory.length >= 10) {
      const m = st.popHistory.reduce((s, v) => s + v, 0) / st.popHistory.length;
      let v = 0;
      for (const x of st.popHistory) v += (x - m) * (x - m);
      sd = Math.sqrt(v / st.popHistory.length);
    }
    if (alive < N * 0.008 || sd < 1.0) {
      reseed(st, N, t);
    }
  }

  if (st.cells[i]) {
    const age = Math.min(1, (t - st.birthT[i]) / 0.4);
    const k = 0.5 + 0.5 * age;
    hslToRgb(st.hue[i], 0.9, 0.55, out);
    out[0] *= k;
    out[1] *= k;
    out[2] *= k;
  } else {
    const age = t - st.deathT[i];
    if (age < 0.35 && st.deathT[i] > 0) {
      const k = (1 - age / 0.35) * 0.18;
      out[0] = k;
      out[1] = k;
      out[2] = k;
    }
  }
};
