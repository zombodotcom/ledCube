import { describe, it, expect } from 'vitest';
import {
  aggregateBands,
  computeBandBinRanges,
  shouldBeat,
  splitFreqRegions,
  waveformFromByteTime,
} from './audioMath';

describe('computeBandBinRanges', () => {
  it('produces N monotonically increasing ranges', () => {
    const r = computeBandBinRanges(64, 1024, 48000, 40, 16000);
    expect(r.length).toBe(64);
    for (let i = 1; i < r.length; i++) {
      expect(r[i][0]).toBeGreaterThanOrEqual(r[i - 1][0]);
      expect(r[i][1]).toBeGreaterThan(r[i][0]);
    }
  });

  it('covers roughly the requested range', () => {
    const r = computeBandBinRanges(32, 1024, 48000, 40, 16000);
    const binHz = 48000 / 2 / 1024;
    expect(r[0][0] * binHz).toBeLessThanOrEqual(45);
    expect(r[r.length - 1][1] * binHz).toBeGreaterThanOrEqual(15000);
  });

  it('each band has at least 1-bin width even when low resolution', () => {
    const r = computeBandBinRanges(128, 256, 48000, 40, 16000);
    for (const [a, b] of r) expect(b - a).toBeGreaterThanOrEqual(1);
  });
});

describe('aggregateBands', () => {
  it('averages bin energies and normalizes to 0-1', () => {
    const raw = new Uint8Array(16);
    for (let i = 0; i < raw.length; i++) raw[i] = 255;
    const ranges: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16]];
    const out = new Float32Array(4);
    const energy = aggregateBands(raw, ranges, out);
    expect(out[0]).toBeCloseTo(1);
    expect(out[3]).toBeCloseTo(1);
    expect(energy).toBeCloseTo(1);
  });

  it('returns zero for zero input', () => {
    const raw = new Uint8Array(16);
    const ranges: [number, number][] = [[0, 4], [4, 8], [8, 12], [12, 16]];
    const out = new Float32Array(4);
    const energy = aggregateBands(raw, ranges, out);
    expect(energy).toBe(0);
    for (const v of out) expect(v).toBe(0);
  });
});

describe('splitFreqRegions', () => {
  it('all bass bins put energy only in bass', () => {
    const bands = new Float32Array(64);
    for (let i = 0; i < 64; i++) if (i < 64 * 0.15) bands[i] = 1;
    const r = splitFreqRegions(bands);
    expect(r.bass).toBeCloseTo(1);
    expect(r.mid).toBe(0);
    expect(r.treble).toBe(0);
  });

  it('all treble bins put energy only in treble', () => {
    const bands = new Float32Array(64);
    for (let i = 0; i < 64; i++) if (i >= 64 * 0.55) bands[i] = 0.5;
    const r = splitFreqRegions(bands);
    expect(r.bass).toBe(0);
    expect(r.mid).toBe(0);
    expect(r.treble).toBeCloseTo(0.5);
  });
});

describe('shouldBeat', () => {
  it('fires when current exceeds avg * sensitivity', () => {
    const history = [0.1, 0.1, 0.1, 0.1];
    expect(shouldBeat(0.5, history, 1.4, 0.08, 1.0, 0)).toBe(true);
  });
  it('does not fire when under the floor', () => {
    const history = [0.01, 0.01];
    expect(shouldBeat(0.05, history, 1.4, 0.08, 1.0, 0)).toBe(false);
  });
  it('respects refractory period', () => {
    const history = [0.1, 0.1];
    expect(shouldBeat(0.5, history, 1.4, 0.08, 0.5, 0.6)).toBe(false);
  });
  it('does not fire when barely over average', () => {
    const history = [0.3, 0.3, 0.3];
    expect(shouldBeat(0.35, history, 1.4, 0.08, 1.0, 0)).toBe(false);
  });
});

describe('waveformFromByteTime', () => {
  it('maps 0-255 centered at 128 into -1..1', () => {
    const raw = new Uint8Array([0, 128, 255]);
    const out = new Float32Array(3);
    waveformFromByteTime(raw, 3, out);
    expect(out[0]).toBeCloseTo(-1);
    expect(out[1]).toBeCloseTo(0);
    expect(out[2]).toBeCloseTo(0.9921875);
  });
});
