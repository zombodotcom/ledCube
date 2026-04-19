import { describe, it, expect } from 'vitest';
import { buildPixelMap, defaultLayout, generateStrips } from './geometry';
import type { LayoutConfig } from './types';

describe('geometry', () => {
  it('generates uniform grid correctly', () => {
    const strips = generateStrips({
      mode: 'uniform',
      gridN: 3,
      spacing_m: 0.5,
      lengths_m: [2],
      density: 30,
      seed: 1,
    });
    expect(strips).toHaveLength(9);
    for (const s of strips) {
      expect(s.length_m).toBe(2);
      expect(s.led_density).toBe(30);
    }
  });

  it('centers grid around origin', () => {
    const strips = generateStrips({
      mode: 'uniform',
      gridN: 2,
      spacing_m: 1,
      lengths_m: [1],
      density: 10,
      seed: 0,
    });
    const xs = strips.map((s) => s.top[0]);
    expect(Math.min(...xs)).toBeCloseTo(-0.5);
    expect(Math.max(...xs)).toBeCloseTo(0.5);
  });

  it('buildPixelMap returns correct pixel count', () => {
    const strips = generateStrips({
      mode: 'uniform',
      gridN: 2,
      spacing_m: 1,
      lengths_m: [2],
      density: 60,
      seed: 0,
    });
    const map = buildPixelMap(strips);
    expect(map.count).toBe(4 * 2 * 60);
    expect(map.positions.length).toBe(map.count * 3);
    expect(map.totalMeters).toBe(8);
  });

  it('default layout produces expected pixel density', () => {
    const strips = generateStrips(defaultLayout());
    const map = buildPixelMap(strips);
    expect(strips.length).toBe(576);
    expect(map.count).toBeGreaterThan(100000);
    expect(map.count).toBeLessThan(200000);
  });

  it('positions descend along z within a strip', () => {
    const strips = generateStrips({
      mode: 'uniform', gridN: 1, spacing_m: 1, lengths_m: [2], density: 60, seed: 0,
    });
    const map = buildPixelMap(strips);
    const z0 = map.positions[2];
    const z1 = map.positions[5];
    expect(z0).toBeGreaterThan(z1);
  });

  it('varied mode only picks lengths from the configured list', () => {
    const allowed = new Set([3, 4, 5]);
    const strips = generateStrips({
      mode: 'varied', gridN: 6, spacing_m: 0.3, lengths_m: [3, 4, 5], density: 60, seed: 42,
    });
    for (const s of strips) expect(allowed.has(s.length_m)).toBe(true);
  });

  it('varied mode is seed-deterministic', () => {
    const cfg: LayoutConfig = {
      mode: 'varied', gridN: 4, spacing_m: 0.3, lengths_m: [3, 4, 5], density: 60, seed: 7,
    };
    const a = generateStrips(cfg).map((s) => s.length_m);
    const b = generateStrips(cfg).map((s) => s.length_m);
    expect(a).toEqual(b);
  });

  it('freeform mode parses strips JSON', () => {
    const json = JSON.stringify({
      strips: [
        { id: 'a', top: [0, 0, 5], length_m: 5, led_density: 60, led_type: 'WS2815' },
        { id: 'b', top: [0.3, 0, 4], length_m: 4, led_density: 60, led_type: 'WS2815' },
      ],
    });
    const strips = generateStrips({
      mode: 'freeform', gridN: 0, spacing_m: 0, lengths_m: [], density: 0, seed: 0, freeformJson: json,
    });
    expect(strips).toHaveLength(2);
    expect(strips[0].id).toBe('a');
    expect(strips[1].length_m).toBe(4);
  });

  it('freeform mode returns empty array when no JSON', () => {
    const strips = generateStrips({
      mode: 'freeform', gridN: 0, spacing_m: 0, lengths_m: [], density: 0, seed: 0,
    });
    expect(strips).toHaveLength(0);
  });

  it('defaultLayout returns a valid config', () => {
    const cfg = defaultLayout();
    expect(cfg.gridN).toBeGreaterThan(0);
    expect(cfg.density).toBeGreaterThan(0);
    expect(cfg.lengths_m.length).toBeGreaterThan(0);
  });
});
