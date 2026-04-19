import { describe, it, expect } from 'vitest';
import { buildPixelMap, generateStrips } from './geometry';
import { defaultElectrical, simulate } from './electrical';
import { exportE131Config, exportPixelMap, exportPowerReport } from './export';

function sampleMap() {
  const strips = generateStrips({
    mode: 'uniform',
    gridN: 2,
    spacing_m: 0.3,
    lengths_m: [2],
    density: 60,
    seed: 0,
  });
  return buildPixelMap(strips);
}

describe('exportPixelMap', () => {
  it('returns valid JSON with one record per pixel', () => {
    const map = sampleMap();
    const json = JSON.parse(exportPixelMap(map)) as { pixels: unknown[] };
    expect(Array.isArray(json.pixels)).toBe(true);
    expect(json.pixels.length).toBe(map.count);
  });

  it('each record has x, y, z, strip_id, index', () => {
    const map = sampleMap();
    const json = JSON.parse(exportPixelMap(map)) as {
      pixels: Array<{ x: number; y: number; z: number; strip_id: string; index: number }>;
    };
    const r = json.pixels[0];
    expect(typeof r.x).toBe('number');
    expect(typeof r.y).toBe('number');
    expect(typeof r.z).toBe('number');
    expect(typeof r.strip_id).toBe('string');
    expect(typeof r.index).toBe('number');
  });

  it('strip indices reset to 0 at the start of each strip', () => {
    const map = sampleMap();
    const json = JSON.parse(exportPixelMap(map)) as {
      pixels: Array<{ strip_id: string; index: number }>;
    };
    const byStrip = new Map<string, number[]>();
    for (const r of json.pixels) {
      if (!byStrip.has(r.strip_id)) byStrip.set(r.strip_id, []);
      byStrip.get(r.strip_id)!.push(r.index);
    }
    for (const list of byStrip.values()) {
      expect(list[0]).toBe(0);
      for (let i = 1; i < list.length; i++) expect(list[i]).toBe(i);
    }
  });
});

describe('exportE131Config', () => {
  it('allocates ceil(pixels/170) universes per strip', () => {
    const map = sampleMap();
    const json = JSON.parse(exportE131Config(map)) as {
      universes: Array<{ universe: number; strip_id: string; count: number; start: number }>;
      total_universes: number;
      pixels_per_universe: number;
    };
    expect(json.pixels_per_universe).toBe(170);
    const perStrip = 2 * 60;
    const perStripUniverses = Math.ceil(perStrip / 170);
    expect(json.universes.length).toBe(perStripUniverses * map.strips.length);
    expect(json.total_universes).toBe(json.universes.length);
  });

  it('universe numbers are unique and sequential', () => {
    const map = sampleMap();
    const json = JSON.parse(exportE131Config(map)) as {
      universes: Array<{ universe: number }>;
    };
    const seen = new Set<number>();
    let prev = 0;
    for (const u of json.universes) {
      expect(seen.has(u.universe)).toBe(false);
      seen.add(u.universe);
      expect(u.universe).toBeGreaterThan(prev);
      prev = u.universe;
    }
  });

  it('sum of counts per strip equals pixels in that strip', () => {
    const map = sampleMap();
    const json = JSON.parse(exportE131Config(map)) as {
      universes: Array<{ strip_id: string; count: number }>;
    };
    const byStrip = new Map<string, number>();
    for (const u of json.universes) {
      byStrip.set(u.strip_id, (byStrip.get(u.strip_id) ?? 0) + u.count);
    }
    for (const strip of map.strips) {
      expect(byStrip.get(strip.id)).toBe(Math.floor(strip.length_m * strip.led_density));
    }
  });
});

describe('exportPowerReport', () => {
  it('contains required markdown sections and computed totals', () => {
    const map = sampleMap();
    const cfg = defaultElectrical();
    const colors = new Float32Array(map.count * 3);
    for (let i = 0; i < map.count * 3; i++) colors[i] = 1;
    const result = simulate(map, colors, cfg);
    const md = exportPowerReport(map, cfg, result);
    expect(md).toContain('# LED Cube Power Budget');
    expect(md).toContain('Total LEDs');
    expect(md).toContain('PSU recommendation');
    expect(md).toContain('Wiring notes');
    expect(md).toContain('Warnings');
    expect(md).toContain(map.count.toLocaleString());
  });

  it('notes "None" when no warnings were generated', () => {
    const map = sampleMap();
    const cfg = defaultElectrical();
    const colors = new Float32Array(map.count * 3);
    const result = simulate(map, colors, cfg);
    const md = exportPowerReport(map, cfg, result);
    expect(md).toContain('- None');
  });
});
