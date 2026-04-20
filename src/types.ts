export interface StripDef {
  id: string;
  top: [number, number, number];
  length_m: number;
  led_density: number;
  led_type: 'WS2815' | 'WS2812b';
}

export interface PixelMap {
  strips: StripDef[];
  count: number;
  positions: Float32Array;
  stripIndex: Uint16Array;
  indexInStrip: Uint16Array;
  totalMeters: number;
}

export interface AudioFrame {
  fft: Float32Array;
  waveform: Float32Array;
  energy: number;
  bass: number;
  mid: number;
  treble: number;
  beat: boolean;
  time: number;
  tint1: [number, number, number];
  tint2: [number, number, number];
  speed: number;
  scale: number;
  // 5-stop palette flattened to 15 floats (r,g,b × 5). paletteLerp() samples it.
  paletteStops: Float32Array;
  // 128 booleans (0 or 1) for currently-playing MIDI note numbers (C-1..G9).
  midiNotes: Uint8Array;
}

export type SynthKind =
  | 'sine'
  | 'square'
  | 'sawtooth'
  | 'triangle'
  | 'noise'
  | 'sweep'
  | 'drum'
  | 'chord'
  | 'arpeggio'
  | 'pluck'
  | 'siren'
  | 'fmBell'
  | 'bassDrop';

export type ScaleName = 'major' | 'minor' | 'pentatonic' | 'blues' | 'chromatic';

export const SCALE_STEPS: Record<ScaleName, number[]> = {
  major:       [0, 2, 4, 5, 7, 9, 11],
  minor:       [0, 2, 3, 5, 7, 8, 10],
  pentatonic:  [0, 2, 4, 7, 9],
  blues:       [0, 3, 5, 6, 7, 10],
  chromatic:   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export type PatternCategory = 'ambient' | 'audio' | 'beat' | 'generative' | 'static';

export interface GridIndex {
  stripCount: number;
  stripOf: Uint16Array;
  indexInStrip: Uint16Array;
  ledsPerStrip: Uint16Array;
  stripStart: Uint32Array;
  stripNeighbors: Uint16Array;
  neighborsOf(i: number): number[];
}

export interface PatternCtx {
  pixelCount: number;
  grid: GridIndex;
  state: Record<string, unknown>;
  prevColors: Float32Array;
  dt: number;
}

export type PatternFn = (
  index: number,
  x: number,
  y: number,
  z: number,
  t: number,
  audio: AudioFrame,
  out: [number, number, number],
  ctx?: PatternCtx,
) => void;

export interface LayoutConfig {
  mode: 'uniform' | 'varied' | 'freeform';
  gridN: number;
  spacing_m: number;
  lengths_m: number[];
  density: number;
  seed: number;
  freeformJson?: string;
}
