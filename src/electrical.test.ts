import { describe, it, expect } from 'vitest';
import { buildPixelMap, generateStrips } from './geometry';
import {
  computeLedCurrents,
  defaultElectrical,
  injectionIndices,
  simulate,
  voltageToHeatmapColor,
} from './electrical';

describe('electrical', () => {
  it('returns injection voltage when all LEDs are off', () => {
    const strips = generateStrips({
      mode: 'uniform', gridN: 1, spacing_m: 1, lengths_m: [5], density: 60, seed: 0,
    });
    const map = buildPixelMap(strips);
    const colors = new Float32Array(map.count * 3);
    const result = simulate(map, colors, defaultElectrical());
    expect(result.totalCurrent).toBeCloseTo(0);
    expect(result.brownoutCount).toBe(0);
    expect(result.worstVoltage).toBeCloseTo(12);
  });

  it('shows voltage drop across a hot strip with top-only injection', () => {
    const strips = generateStrips({
      mode: 'uniform', gridN: 1, spacing_m: 1, lengths_m: [5], density: 60, seed: 0,
    });
    const map = buildPixelMap(strips);
    const colors = new Float32Array(map.count * 3);
    for (let i = 0; i < map.count * 3; i++) colors[i] = 1;
    const cfg = defaultElectrical();
    const result = simulate(map, colors, cfg);
    expect(result.voltages[0]).toBeCloseTo(cfg.vInjection);
    expect(result.voltages[1]).toBeLessThan(cfg.vInjection);
    const last = result.voltages[map.count - 1];
    expect(last).toBeLessThan(result.voltages[1]);
  });

  it('top-bottom injection reduces worst-case drop versus top-only', () => {
    const strips = generateStrips({
      mode: 'uniform', gridN: 1, spacing_m: 1, lengths_m: [5], density: 60, seed: 0,
    });
    const map = buildPixelMap(strips);
    const colors = new Float32Array(map.count * 3);
    for (let i = 0; i < map.count * 3; i++) colors[i] = 1;

    const top = simulate(map, colors, { ...defaultElectrical(), injectionMode: 'top' });
    const both = simulate(map, colors, { ...defaultElectrical(), injectionMode: 'top-bottom' });
    expect(both.worstVoltage).toBeGreaterThan(top.worstVoltage);
  });

  it('injection indices match requested mode', () => {
    const strip = { id: 't', top: [0, 0, 5] as [number, number, number], length_m: 5, led_density: 60, led_type: 'WS2815' as const };
    expect(injectionIndices(strip, 'top')).toEqual([0]);
    expect(injectionIndices(strip, 'top-bottom')).toEqual([0, 299]);
    const every = injectionIndices(strip, 'every-1m');
    expect(every[0]).toBe(0);
    expect(every[every.length - 1]).toBe(299);
    expect(every.length).toBeGreaterThan(2);
  });

  it('flags injection overload as a warning', () => {
    const strips = generateStrips({
      mode: 'uniform', gridN: 1, spacing_m: 1, lengths_m: [5], density: 60, seed: 0,
    });
    const map = buildPixelMap(strips);
    const colors = new Float32Array(map.count * 3);
    for (let i = 0; i < map.count * 3; i++) colors[i] = 1;
    const result = simulate(map, colors, { ...defaultElectrical(), maxInjectionAmps: 1 });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/per injection/);
  });

  it('increments brownoutCount when pixels fall below threshold', () => {
    const strips = generateStrips({
      mode: 'uniform', gridN: 1, spacing_m: 1, lengths_m: [5], density: 60, seed: 0,
    });
    const map = buildPixelMap(strips);
    const colors = new Float32Array(map.count * 3);
    for (let i = 0; i < map.count * 3; i++) colors[i] = 1;
    const loose = simulate(map, colors, { ...defaultElectrical(), brownoutVolts: 11.95 });
    expect(loose.brownoutCount).toBeGreaterThan(0);
  });
});

describe('computeLedCurrents', () => {
  it('returns zero for black pixels', () => {
    const colors = new Float32Array(9);
    const out = new Float32Array(3);
    computeLedCurrents(colors, 0.06, out);
    for (const v of out) expect(v).toBe(0);
  });

  it('full-white pixel draws maxCurrentPerLED', () => {
    const colors = new Float32Array([1, 1, 1]);
    const out = new Float32Array(1);
    computeLedCurrents(colors, 0.06, out);
    expect(out[0]).toBeCloseTo(0.06);
  });

  it('half-brightness pure-red draws 1/3 * iMax (since we average 3 channels)', () => {
    const colors = new Float32Array([0.5, 0, 0]);
    const out = new Float32Array(1);
    computeLedCurrents(colors, 0.06, out);
    expect(out[0]).toBeCloseTo(0.06 * 0.5 / 3);
  });
});

describe('voltageToHeatmapColor', () => {
  const cfg = defaultElectrical();

  it('returns black below brownout threshold', () => {
    const out: [number, number, number] = [0, 0, 0];
    voltageToHeatmapColor(cfg.brownoutVolts - 0.1, cfg, out);
    expect(out).toEqual([0, 0, 0]);
  });

  it('returns green at V_injection', () => {
    const out: [number, number, number] = [0, 0, 0];
    voltageToHeatmapColor(cfg.vInjection, cfg, out);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(1);
  });

  it('returns red at brownout threshold', () => {
    const out: [number, number, number] = [0, 0, 0];
    voltageToHeatmapColor(cfg.brownoutVolts, cfg, out);
    expect(out[0]).toBeCloseTo(1);
    expect(out[1]).toBeCloseTo(0);
  });

  it('interpolates red→green monotonically across the range', () => {
    const out1: [number, number, number] = [0, 0, 0];
    const out2: [number, number, number] = [0, 0, 0];
    voltageToHeatmapColor(9.5, cfg, out1);
    voltageToHeatmapColor(11, cfg, out2);
    expect(out2[1]).toBeGreaterThan(out1[1]);
    expect(out2[0]).toBeLessThan(out1[0]);
  });
});
