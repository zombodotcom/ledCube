import type { PixelMap, StripDef } from './types';

export interface ElectricalConfig {
  vInjection: number;
  rPerMeter: number;
  maxCurrentPerLED: number;
  injectionMode: 'top' | 'top-bottom' | 'every-1m';
  maxInjectionAmps: number;
  brownoutVolts: number;
}

export interface ElectricalResult {
  voltages: Float32Array;
  peakCurrentPerStrip: Float32Array;
  totalCurrent: number;
  brownoutCount: number;
  worstVoltage: number;
  warnings: string[];
}

export const defaultElectrical = (): ElectricalConfig => ({
  vInjection: 12,
  rPerMeter: 0.3,
  maxCurrentPerLED: 0.06,
  injectionMode: 'top',
  maxInjectionAmps: 10,
  brownoutVolts: 9,
});

export function injectionIndices(strip: StripDef, mode: ElectricalConfig['injectionMode']): number[] {
  const n = Math.floor(strip.length_m * strip.led_density);
  if (n <= 0) return [];
  if (mode === 'top') return [0];
  if (mode === 'top-bottom') return [0, n - 1];
  const step = strip.led_density;
  const list: number[] = [];
  for (let i = 0; i < n; i += step) list.push(i);
  if (list[list.length - 1] !== n - 1) list.push(n - 1);
  return list;
}

function simulateStrip(
  currents: Float32Array,
  offset: number,
  count: number,
  injIndicesLocal: number[],
  stepM: number,
  rPerM: number,
  vInj: number,
  out: Float32Array,
): void {
  if (count === 0) return;
  const R = rPerM * stepM;
  const sorted = injIndicesLocal.slice().sort((a, b) => a - b);
  if (sorted.length === 0) {
    for (let i = 0; i < count; i++) out[offset + i] = vInj;
    return;
  }

  for (let r = 0; r < sorted.length; r++) {
    const k = sorted[r];
    const leftBound = r === 0 ? 0 : Math.floor((sorted[r - 1] + k) / 2) + 1;
    const rightBound = r === sorted.length - 1 ? count - 1 : Math.floor((sorted[r + 1] + k) / 2);

    out[offset + k] = vInj;

    let tail = 0;
    for (let i = k + 1; i <= rightBound; i++) tail += currents[offset + i];
    let Vcur = vInj;
    let rem = tail;
    for (let i = k + 1; i <= rightBound; i++) {
      Vcur = Vcur - rem * R;
      out[offset + i] = Vcur;
      rem -= currents[offset + i];
    }

    let tailL = 0;
    for (let i = leftBound; i < k; i++) tailL += currents[offset + i];
    let VcurL = vInj;
    let remL = tailL;
    for (let i = k - 1; i >= leftBound; i--) {
      VcurL = VcurL - remL * R;
      out[offset + i] = VcurL;
      remL -= currents[offset + i];
    }
  }
}

export function computeLedCurrents(colors: Float32Array, iMax: number, out: Float32Array): void {
  const N = out.length;
  for (let i = 0; i < N; i++) {
    const r = colors[i * 3 + 0];
    const g = colors[i * 3 + 1];
    const b = colors[i * 3 + 2];
    out[i] = iMax * ((r + g + b) / 3);
  }
}

export function simulate(
  map: PixelMap,
  colors: Float32Array,
  cfg: ElectricalConfig,
): ElectricalResult {
  const N = map.count;
  const currents = new Float32Array(N);
  computeLedCurrents(colors, cfg.maxCurrentPerLED, currents);

  const voltages = new Float32Array(N);
  const peaks = new Float32Array(map.strips.length);
  const warnings: string[] = [];

  let offset = 0;
  let totalCurrent = 0;
  let brownout = 0;
  let worstV = cfg.vInjection;

  for (let s = 0; s < map.strips.length; s++) {
    const strip = map.strips[s];
    const n = Math.floor(strip.length_m * strip.led_density);
    const step = 1 / strip.led_density;
    const inj = injectionIndices(strip, cfg.injectionMode);
    simulateStrip(currents, offset, n, inj, step, cfg.rPerMeter, cfg.vInjection, voltages);

    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += currents[offset + i];
      const v = voltages[offset + i];
      if (v < cfg.brownoutVolts) brownout++;
      if (v < worstV) worstV = v;
    }
    peaks[s] = sum;
    totalCurrent += sum;
    const perInjection = sum / Math.max(1, inj.length);
    if (perInjection > cfg.maxInjectionAmps) {
      warnings.push(`Strip ${strip.id}: ${perInjection.toFixed(1)}A per injection > ${cfg.maxInjectionAmps}A limit`);
    }
    offset += n;
  }

  return {
    voltages,
    peakCurrentPerStrip: peaks,
    totalCurrent,
    brownoutCount: brownout,
    worstVoltage: worstV,
    warnings,
  };
}

export function voltageToHeatmapColor(v: number, cfg: ElectricalConfig, out: [number, number, number]): void {
  const vHi = cfg.vInjection;
  const vLo = cfg.brownoutVolts;
  if (v < vLo) {
    out[0] = 0; out[1] = 0; out[2] = 0;
    return;
  }
  const t = Math.max(0, Math.min(1, (v - vLo) / (vHi - vLo)));
  out[0] = 1 - t;
  out[1] = t;
  out[2] = 0;
}
