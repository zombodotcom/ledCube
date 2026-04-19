import { describe, it, expect } from 'vitest';
import { builtinPatterns, compilePattern } from './index';
import type { AudioFrame } from '../types';

function makeAudio(opts: Partial<AudioFrame> = {}): AudioFrame {
  const fft = new Float32Array(64);
  for (let i = 0; i < fft.length; i++) fft[i] = 0.3 + 0.2 * Math.sin(i * 0.3);
  const waveform = new Float32Array(256);
  for (let i = 0; i < waveform.length; i++) waveform[i] = Math.sin(i * 0.1);
  return {
    fft,
    waveform,
    energy: 0.4,
    bass: 0.5,
    mid: 0.3,
    treble: 0.2,
    beat: false,
    time: 1.234,
    tint1: [1, 0.3, 0.8],
    tint2: [0.2, 0.8, 1],
    speed: 1,
    scale: 1,
    ...opts,
  };
}

const COORDS: Array<[number, number, number]> = (() => {
  const list: Array<[number, number, number]> = [];
  for (let ix = -3; ix <= 3; ix++) {
    for (let iy = -3; iy <= 3; iy++) {
      for (let iz = 0; iz < 5; iz++) {
        list.push([ix * 0.6, iy * 0.6, iz + 0.5]);
      }
    }
  }
  return list;
})();

describe('builtin patterns', () => {
  for (const [key, entry] of Object.entries(builtinPatterns)) {
    describe(key, () => {
      it('produces finite output in [0, 1.5] for varied inputs', () => {
        const out: [number, number, number] = [0, 0, 0];
        const audio = makeAudio();
        for (let t = 0; t < 5; t += 0.37) {
          for (let i = 0; i < COORDS.length; i++) {
            const [x, y, z] = COORDS[i];
            out[0] = out[1] = out[2] = 0;
            entry.fn(i, x, y, z, t, audio, out);
            for (const v of out) {
              expect(Number.isFinite(v)).toBe(true);
              expect(v).toBeGreaterThanOrEqual(-0.01);
              expect(v).toBeLessThanOrEqual(1.51);
            }
          }
        }
      });

      it('produces non-zero output for at least one sample frame', () => {
        const out: [number, number, number] = [0, 0, 0];
        const audio = makeAudio({ beat: true });
        let anyLit = false;
        for (let t = 0; t < 3; t += 0.25) {
          for (let i = 0; i < COORDS.length; i++) {
            const [x, y, z] = COORDS[i];
            out[0] = out[1] = out[2] = 0;
            entry.fn(i, x, y, z, t, audio, out);
            if (out[0] + out[1] + out[2] > 0.01) {
              anyLit = true;
              break;
            }
          }
          if (anyLit) break;
        }
        expect(anyLit).toBe(true);
      });
    });
  }
});

describe('compilePattern', () => {
  it('compiles every built-in source string', () => {
    for (const [key, entry] of Object.entries(builtinPatterns)) {
      const fn = compilePattern(entry.source);
      expect(typeof fn).toBe('function');
      const out: [number, number, number] = [0, 0, 0];
      fn(0, 0, 0, 2.5, 0.5, makeAudio(), out);
      for (const v of out) {
        expect(Number.isFinite(v)).toBe(true);
      }
      expect(key).toBeTruthy();
    }
  });

  it('compiled output approximately matches the bundled fn for a known input', () => {
    const audio = makeAudio();
    const out1: [number, number, number] = [0, 0, 0];
    const out2: [number, number, number] = [0, 0, 0];
    for (const entry of Object.values(builtinPatterns)) {
      const compiled = compilePattern(entry.source);
      out1[0] = out1[1] = out1[2] = 0;
      out2[0] = out2[1] = out2[2] = 0;
      entry.fn(0, 1, 1, 2.5, 1.0, audio, out1);
      compiled(0, 1, 1, 2.5, 1.0, audio, out2);
      for (let i = 0; i < 3; i++) {
        expect(out2[i]).toBeCloseTo(out1[i], 4);
      }
    }
  });

  it('throws for source without return function', () => {
    expect(() => compilePattern('const x = 1;')).toThrow();
  });

  it('throws for syntactically invalid source', () => {
    expect(() => compilePattern('return function( { not js }')).toThrow();
  });
});

describe('tint responsiveness', () => {
  it('solidTint respects tint1 color', () => {
    const out: [number, number, number] = [0, 0, 0];
    const red = makeAudio({ tint1: [1, 0, 0], bass: 0 });
    const green = makeAudio({ tint1: [0, 1, 0], bass: 0 });
    builtinPatterns.solidTint.fn(0, 0, 0, 0, 0.5, red, out);
    const redOut = out.slice() as [number, number, number];
    out[0] = out[1] = out[2] = 0;
    builtinPatterns.solidTint.fn(0, 0, 0, 0, 0.5, green, out);
    expect(redOut[0]).toBeGreaterThan(0);
    expect(redOut[1]).toBeCloseTo(0);
    expect(out[1]).toBeGreaterThan(0);
    expect(out[0]).toBeCloseTo(0);
  });

  it('gradient interpolates between tint1 and tint2 along z', () => {
    const out: [number, number, number] = [0, 0, 0];
    const audio = makeAudio({ tint1: [1, 0, 0], tint2: [0, 0, 1], speed: 0, scale: 1 });
    builtinPatterns.gradient.fn(0, 0, 0, 0, 0, audio, out);
    expect(out[0]).toBeGreaterThan(out[2]);
    out[0] = out[1] = out[2] = 0;
    builtinPatterns.gradient.fn(0, 0, 0, 4.9, 0, audio, out);
    expect(out[2]).toBeGreaterThan(out[0]);
  });
});
