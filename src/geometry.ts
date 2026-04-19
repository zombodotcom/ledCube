import type { LayoutConfig, PixelMap, StripDef } from './types';

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateStrips(cfg: LayoutConfig): StripDef[] {
  if (cfg.mode === 'freeform') {
    if (!cfg.freeformJson) return [];
    const parsed = JSON.parse(cfg.freeformJson) as { strips: StripDef[] };
    return parsed.strips;
  }

  const rng = mulberry32(cfg.seed);
  const strips: StripDef[] = [];
  const offset = ((cfg.gridN - 1) * cfg.spacing_m) / 2;

  for (let gx = 0; gx < cfg.gridN; gx++) {
    for (let gy = 0; gy < cfg.gridN; gy++) {
      const x = gx * cfg.spacing_m - offset;
      const y = gy * cfg.spacing_m - offset;
      const length =
        cfg.mode === 'uniform'
          ? cfg.lengths_m[0]
          : cfg.lengths_m[Math.floor(rng() * cfg.lengths_m.length)];
      strips.push({
        id: `s${gx.toString().padStart(2, '0')}_${gy.toString().padStart(2, '0')}`,
        top: [x, y, length],
        length_m: length,
        led_density: cfg.density,
        led_type: 'WS2815',
      });
    }
  }
  return strips;
}

export function buildPixelMap(strips: StripDef[]): PixelMap {
  let total = 0;
  const ledsPerStrip: number[] = [];
  for (const s of strips) {
    const n = Math.floor(s.length_m * s.led_density);
    ledsPerStrip.push(n);
    total += n;
  }

  const positions = new Float32Array(total * 3);
  const stripIndex = new Uint16Array(total);
  const indexInStrip = new Uint16Array(total);

  let p = 0;
  let totalMeters = 0;
  for (let s = 0; s < strips.length; s++) {
    const strip = strips[s];
    const n = ledsPerStrip[s];
    totalMeters += strip.length_m;
    const step = 1 / strip.led_density;
    for (let i = 0; i < n; i++) {
      positions[p * 3 + 0] = strip.top[0];
      positions[p * 3 + 1] = strip.top[1];
      positions[p * 3 + 2] = strip.top[2] - i * step;
      stripIndex[p] = s;
      indexInStrip[p] = i;
      p++;
    }
  }

  return { strips, count: total, positions, stripIndex, indexInStrip, totalMeters };
}

export function defaultLayout(): LayoutConfig {
  return {
    mode: 'varied',
    gridN: 24,
    spacing_m: 0.3,
    lengths_m: [3, 4, 5],
    density: 60,
    seed: 1337,
  };
}
