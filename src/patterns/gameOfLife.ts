import type { PatternFn } from '../types';

// Multi-species Immigration Game: N species compete on Conway's B3/S23 rules.
// A new cell inherits the majority species of its 3 live neighbors
// (ties broken by picking one at random from the neighbor set).
// When any single species dominates > 90% of the living population for
// several ticks, the survivors flash then get redistributed back across
// all N species so competition restarts. Full die-out → freeze + reseed.

const SPECIES_COUNT = 8; // 1..8 (0 = dead)

interface GolState {
  cells: Uint8Array;   // 0 = dead, 1..N = species id
  next: Uint8Array;
  birthT: Float32Array;
  deathT: Float32Array;
  lastTick: number;
  popHistory: number[];
  dominanceTicks: number;
  phase: 'evolving' | 'frozen' | 'splitting';
  phaseSince: number;
}

function reseed(st: GolState, N: number, t: number) {
  for (let k = 0; k < N; k++) {
    if (Math.random() < 0.22) {
      st.cells[k] = 1 + ((Math.random() * SPECIES_COUNT) | 0);
      st.birthT[k] = t;
    } else {
      st.cells[k] = 0;
      st.deathT[k] = 0;
    }
  }
  st.popHistory.length = 0;
  st.dominanceTicks = 0;
  st.lastTick = t;
  st.phase = 'evolving';
  st.phaseSince = t;
}

function speciesToColor(
  s: number,
  tint1: readonly [number, number, number],
  tint2: readonly [number, number, number],
  out: [number, number, number],
) {
  // Spread species across tint1↔tint2 with a small hue offset per species
  // to keep adjacent species visually distinct even when tints are similar.
  const u = (s - 1) / Math.max(1, SPECIES_COUNT - 1);
  const jitter = ((s * 2654435761) >>> 0) / 0xffffffff; // stable per-species 0..1
  out[0] = tint1[0] * (1 - u) + tint2[0] * u;
  out[1] = tint1[1] * (1 - u) + tint2[1] * u;
  out[2] = tint1[2] * (1 - u) + tint2[2] * u;
  // subtle rotation so species aren't pure gradient
  const hueShift = (jitter - 0.5) * 0.35;
  const mean = (out[0] + out[1] + out[2]) / 3;
  out[0] = Math.max(0, Math.min(1, out[0] + hueShift * (out[0] - mean)));
  out[1] = Math.max(0, Math.min(1, out[1] + hueShift * (out[1] - mean)));
  out[2] = Math.max(0, Math.min(1, out[2] + hueShift * (out[2] - mean)));
}

export const gameOfLife: PatternFn = (i, _x, _y, _z, t, audio, out, ctx) => {
  if (!ctx) {
    out[0] = audio.tint1[0] * 0.05;
    out[1] = audio.tint1[1] * 0.05;
    out[2] = audio.tint1[2] * 0.05;
    return;
  }
  const N = ctx.pixelCount;
  let st = ctx.state.gol as GolState | undefined;
  if (!st || st.cells.length !== N) {
    st = {
      cells: new Uint8Array(N),
      next: new Uint8Array(N),
      birthT: new Float32Array(N),
      deathT: new Float32Array(N),
      lastTick: t,
      popHistory: [],
      dominanceTicks: 0,
      phase: 'evolving',
      phaseSince: t,
    };
    reseed(st, N, t);
    ctx.state.gol = st;
  }

  const tickInterval = 0.33 / Math.max(0.2, audio.speed);
  const FREEZE_DURATION = 1.5;
  const SPLIT_FLASH_DURATION = 0.9;

  // Phase transitions (only at start of frame)
  if (i === 0) {
    if (st.phase === 'frozen' && t - st.phaseSince >= FREEZE_DURATION) {
      reseed(st, N, t);
    } else if (st.phase === 'splitting' && t - st.phaseSince >= SPLIT_FLASH_DURATION) {
      // Redistribute survivors across all species to restore diversity
      for (let k = 0; k < N; k++) {
        if (st.cells[k]) {
          st.cells[k] = 1 + ((Math.random() * SPECIES_COUNT) | 0);
          st.birthT[k] = t;
        }
      }
      st.dominanceTicks = 0;
      st.popHistory.length = 0;
      st.lastTick = t;
      st.phase = 'evolving';
      st.phaseSince = t;
    } else if (st.phase === 'evolving' && t - st.lastTick >= tickInterval) {
      const counts = new Uint32Array(SPECIES_COUNT + 1);
      for (let k = 0; k < N; k++) {
        const ns = ctx.grid.neighborsOf(k);
        // Count live neighbors + track species votes
        let live = 0;
        const votes = new Uint8Array(SPECIES_COUNT + 1);
        for (let n = 0; n < ns.length; n++) {
          const s = st.cells[ns[n]];
          if (s) {
            live++;
            votes[s]++;
          }
        }
        const was = st.cells[k];
        let now = 0;
        if (was !== 0 && (live === 2 || live === 3)) {
          now = was;
        } else if (was === 0 && live === 3) {
          // Pick species with highest vote; ties → pseudorandom
          let best = 0, bestCount = 0;
          for (let s = 1; s <= SPECIES_COUNT; s++) {
            if (votes[s] > bestCount) { bestCount = votes[s]; best = s; }
          }
          now = best;
        }
        st.next[k] = now;
        if (now) counts[now]++;
        if (was && !now) st.deathT[k] = t;
        if (!was && now) st.birthT[k] = t;
      }
      const tmp = st.cells;
      st.cells = st.next;
      st.next = tmp;
      st.lastTick = t;

      let total = 0, dominant = 0;
      for (let s = 1; s <= SPECIES_COUNT; s++) {
        total += counts[s];
        if (counts[s] > dominant) dominant = counts[s];
      }
      st.popHistory.push(total);
      if (st.popHistory.length > 20) st.popHistory.shift();

      if (total < N * 0.005) {
        st.phase = 'frozen';
        st.phaseSince = t;
      } else {
        if (st.popHistory.length >= 14) {
          let m = 0;
          for (const v of st.popHistory) m += v;
          m /= st.popHistory.length;
          let v = 0;
          for (const x of st.popHistory) v += (x - m) * (x - m);
          const sd = Math.sqrt(v / st.popHistory.length);
          if (sd < 1.2) {
            st.phase = 'frozen';
            st.phaseSince = t;
          }
        }
        if (total > N * 0.02 && dominant / total > 0.9) {
          st.dominanceTicks++;
          if (st.dominanceTicks >= 3 && st.phase === 'evolving') {
            st.phase = 'splitting';
            st.phaseSince = t;
          }
        } else {
          st.dominanceTicks = 0;
        }
      }
    }
  }

  // Rendering
  const species = st.cells[i];

  if (st.phase === 'frozen') {
    if (!species) return;
    const pulse = 0.5 + 0.5 * Math.sin((t - st.phaseSince) * Math.PI * 3.5);
    speciesToColor(species, audio.tint1, audio.tint2, out);
    out[0] *= pulse;
    out[1] *= pulse;
    out[2] *= pulse;
    return;
  }

  if (st.phase === 'splitting') {
    if (!species) return;
    const f = Math.min(1, (t - st.phaseSince) / SPLIT_FLASH_DURATION);
    const flash = 1 - f;
    speciesToColor(species, audio.tint1, audio.tint2, out);
    out[0] = out[0] * (0.4 + flash * 0.6) + flash * 0.3;
    out[1] = out[1] * (0.4 + flash * 0.6) + flash * 0.3;
    out[2] = out[2] * (0.4 + flash * 0.6) + flash * 0.3;
    return;
  }

  if (species) {
    const age = Math.min(1, (t - st.birthT[i]) / 0.5);
    const k = 0.5 + 0.5 * age;
    speciesToColor(species, audio.tint1, audio.tint2, out);
    out[0] *= k;
    out[1] *= k;
    out[2] *= k;
  } else {
    const age = t - st.deathT[i];
    if (age < 0.4 && st.deathT[i] > 0) {
      const k = (1 - age / 0.4) * 0.2;
      out[0] = (audio.tint1[0] + audio.tint2[0]) * 0.5 * k;
      out[1] = (audio.tint1[1] + audio.tint2[1]) * 0.5 * k;
      out[2] = (audio.tint1[2] + audio.tint2[2]) * 0.5 * k;
    }
  }
};
