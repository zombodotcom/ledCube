import type { PatternFn } from '../types';

interface SimpleGolState {
  cells: Uint8Array;
  next: Uint8Array;
  birthT: Float32Array;
  deathT: Float32Array;
  lastTick: number;
  popHistory: number[];
  resetAt: number;
}

function fillRandom(cells: Uint8Array, birthT: Float32Array, t: number) {
  for (let k = 0; k < cells.length; k++) {
    cells[k] = Math.random() < 0.28 ? 1 : 0;
    if (cells[k]) birthT[k] = t;
  }
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
      birthT: new Float32Array(N).fill(t),
      deathT: new Float32Array(N),
      lastTick: t,
      popHistory: [],
      resetAt: 0,
    };
    fillRandom(st.cells, st.birthT, t);
    ctx.state.gol = st;
  }

  const tickInterval = 0.28 / Math.max(0.2, audio.speed);
  if (i === 0 && t - st.lastTick >= tickInterval) {
    let alive = 0;
    for (let k = 0; k < N; k++) {
      const ns = ctx.grid.neighborsOf(k);
      let live = 0;
      for (let n = 0; n < ns.length; n++) live += st.cells[ns[n]];
      const was = st.cells[k];
      let now: 0 | 1 = 0;
      if (was === 1 && (live === 2 || live === 3)) now = 1;
      else if (was === 0 && live === 3) now = 1;
      st.next[k] = now;
      if (now) alive++;
      if (was && !now) st.deathT[k] = t;
      if (!was && now) st.birthT[k] = t;
    }
    const tmp = st.cells;
    st.cells = st.next;
    st.next = tmp;
    st.lastTick = t;
    st.popHistory.push(alive);
    if (st.popHistory.length > 16) st.popHistory.shift();
    // Quick reseed: low population or variance stagnant → wipe and start fresh
    let sd = Infinity;
    if (st.popHistory.length >= 10) {
      const m = st.popHistory.reduce((s, v) => s + v, 0) / st.popHistory.length;
      let v = 0;
      for (const x of st.popHistory) v += (x - m) * (x - m);
      sd = Math.sqrt(v / st.popHistory.length);
    }
    if (alive < N * 0.008 || sd < 1.0) {
      fillRandom(st.cells, st.birthT, t);
      st.popHistory.length = 0;
      st.resetAt = t;
    }
  }

  if (st.cells[i]) {
    const age = Math.min(1, (t - st.birthT[i]) / 0.4);
    const k = 0.45 + 0.55 * age;
    out[0] = audio.tint1[0] * k;
    out[1] = audio.tint1[1] * k;
    out[2] = audio.tint1[2] * k;
  } else {
    const age = t - st.deathT[i];
    if (age < 0.45 && st.deathT[i] > 0) {
      const k = (1 - age / 0.45) * 0.3;
      out[0] = audio.tint2[0] * k;
      out[1] = audio.tint2[1] * k;
      out[2] = audio.tint2[2] * k;
    }
  }
};
