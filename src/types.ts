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
}

export type SynthKind = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise' | 'sweep' | 'drum';

export type PatternFn = (
  index: number,
  x: number,
  y: number,
  z: number,
  t: number,
  audio: AudioFrame,
  out: [number, number, number],
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
