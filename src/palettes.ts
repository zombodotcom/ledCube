// Curated 5-stop palettes inspired by WLED's palette library.
// Each palette is 5 RGB stops in [0..1].

export type PaletteName =
  | 'custom'
  | 'rainbow'
  | 'fire'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'lava'
  | 'party'
  | 'cloud'
  | 'aurora'
  | 'candy'
  | 'redblue'
  | 'cyberpunk'
  | 'pastel';

export type PaletteStops = Array<[number, number, number]>;

export const PALETTES: Record<Exclude<PaletteName, 'custom'>, PaletteStops> = {
  rainbow: [
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0.2],
    [0, 0.5, 1],
    [0.6, 0, 1],
  ],
  fire: [
    [0, 0, 0],
    [0.8, 0.05, 0],
    [1, 0.35, 0],
    [1, 0.85, 0.1],
    [1, 1, 0.7],
  ],
  ocean: [
    [0, 0.05, 0.2],
    [0, 0.25, 0.55],
    [0.1, 0.55, 0.9],
    [0.4, 0.85, 0.95],
    [0.9, 1, 1],
  ],
  sunset: [
    [0.05, 0.02, 0.25],
    [0.55, 0.08, 0.35],
    [1, 0.35, 0.2],
    [1, 0.7, 0.3],
    [1, 0.95, 0.6],
  ],
  forest: [
    [0, 0.08, 0.05],
    [0.05, 0.25, 0.1],
    [0.25, 0.55, 0.2],
    [0.55, 0.75, 0.3],
    [0.9, 0.95, 0.6],
  ],
  lava: [
    [0, 0, 0],
    [0.5, 0, 0],
    [1, 0.15, 0],
    [1, 0.65, 0.05],
    [1, 1, 0.5],
  ],
  party: [
    [0.95, 0.1, 0.55],
    [1, 0.5, 0],
    [0.2, 0.95, 0.4],
    [0, 0.6, 1],
    [0.7, 0.25, 1],
  ],
  cloud: [
    [0.05, 0.1, 0.2],
    [0.35, 0.45, 0.65],
    [0.7, 0.8, 0.95],
    [0.9, 0.95, 1],
    [1, 1, 1],
  ],
  aurora: [
    [0, 0.05, 0.15],
    [0, 0.5, 0.4],
    [0.2, 0.9, 0.6],
    [0.4, 0.3, 0.95],
    [0.7, 0.1, 0.6],
  ],
  candy: [
    [1, 0.15, 0.6],
    [1, 0.55, 0.8],
    [0.85, 0.85, 1],
    [0.5, 0.85, 1],
    [0.2, 0.5, 1],
  ],
  redblue: [
    [0.95, 0.05, 0.15],
    [0.55, 0.02, 0.2],
    [0.1, 0.05, 0.3],
    [0.05, 0.25, 0.75],
    [0.1, 0.5, 1],
  ],
  cyberpunk: [
    [0.05, 0, 0.15],
    [0.95, 0.05, 0.55],
    [1, 0.95, 0.1],
    [0, 0.95, 1],
    [0.55, 0, 0.95],
  ],
  pastel: [
    [1, 0.7, 0.8],
    [1, 0.85, 0.7],
    [0.85, 1, 0.75],
    [0.7, 0.9, 1],
    [0.85, 0.75, 1],
  ],
};

export const PALETTE_NAMES: PaletteName[] = [
  'custom',
  'rainbow',
  'fire',
  'ocean',
  'sunset',
  'forest',
  'lava',
  'party',
  'cloud',
  'aurora',
  'candy',
  'redblue',
  'cyberpunk',
  'pastel',
];

// Flatten a 5-stop palette into a Float32Array(15) for fast per-pixel sampling.
export function paletteToFloat(stops: PaletteStops): Float32Array {
  const out = new Float32Array(stops.length * 3);
  for (let i = 0; i < stops.length; i++) {
    out[i * 3 + 0] = stops[i][0];
    out[i * 3 + 1] = stops[i][1];
    out[i * 3 + 2] = stops[i][2];
  }
  return out;
}

// Sample a flat Float32Array palette (length = 5*3 = 15) at u ∈ [0, 1].
// Interpolates linearly between adjacent stops. Writes to out[].
export function paletteLerp(
  palette: Float32Array,
  u: number,
  out: [number, number, number],
): void {
  const STOPS = palette.length / 3;
  u = u < 0 ? 0 : u > 0.9999 ? 0.9999 : u;
  const idx = u * (STOPS - 1);
  const i0 = Math.floor(idx);
  const i1 = i0 + 1;
  const f = idx - i0;
  const g = 1 - f;
  const a = i0 * 3;
  const b = i1 * 3;
  out[0] = palette[a] * g + palette[b] * f;
  out[1] = palette[a + 1] * g + palette[b + 1] * f;
  out[2] = palette[a + 2] * g + palette[b + 2] * f;
}

// Build a 5-stop palette from two custom colors (tint1 → tint2 linear interp).
export function customPalette(
  tint1: [number, number, number],
  tint2: [number, number, number],
): PaletteStops {
  const mid: [number, number, number] = [
    (tint1[0] + tint2[0]) / 2,
    (tint1[1] + tint2[1]) / 2,
    (tint1[2] + tint2[2]) / 2,
  ];
  return [
    tint1,
    [(tint1[0] + mid[0]) / 2, (tint1[1] + mid[1]) / 2, (tint1[2] + mid[2]) / 2],
    mid,
    [(mid[0] + tint2[0]) / 2, (mid[1] + tint2[1]) / 2, (mid[2] + tint2[2]) / 2],
    tint2,
  ];
}
