import type { PatternFn } from '../types';
import { paletteLerp } from '../palettes';

// Synthesia-style piano roll. Maps MIDI note range (default C2..C7 = notes 36..96)
// across X+Y plane (uses X primarily). Currently-playing notes fill full Z.
// A short scrolling "trail" below the note (lower Z) shows recently-played notes.

const LOW = 36;   // C2
const HIGH = 96;  // C7
const RANGE = HIGH - LOW;

interface PianoRollState {
  trail: Float32Array;          // per-note recency (last-play time)
  heights: Float32Array;        // per-note velocity for current frame
}

const tmp: [number, number, number] = [0, 0, 0];

export const pianoRoll: PatternFn = (_i, x, _y, z, t, audio, out, ctx) => {
  let st: PianoRollState | undefined = ctx ? (ctx.state.piano as PianoRollState | undefined) : undefined;
  if (ctx && !st) {
    st = { trail: new Float32Array(128), heights: new Float32Array(128) };
    ctx.state.piano = st;
  }
  if (st && _i === 0) {
    for (let n = 0; n < 128; n++) {
      if (audio.midiNotes[n]) st.trail[n] = t;
      st.heights[n] = audio.midiNotes[n] ? 1 : 0;
    }
  }

  const xNorm = Math.max(0, Math.min(1, (x + 4) / 8));
  const noteIdx = LOW + Math.floor(xNorm * RANGE);
  if (noteIdx < 0 || noteIdx >= 128) return;

  const isPlaying = audio.midiNotes[noteIdx] === 1;
  const lastPlay = st ? st.trail[noteIdx] : 0;
  const zNorm = z / 5;

  if (isPlaying) {
    // Current note — full column lit, color by pitch position in palette
    const u = (noteIdx - LOW) / Math.max(1, RANGE);
    paletteLerp(audio.paletteStops, u, tmp);
    const k = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(t * 10 + noteIdx));
    out[0] = tmp[0] * k;
    out[1] = tmp[1] * k;
    out[2] = tmp[2] * k;
    return;
  }

  // Trail fade: note lit low in the column if recently played
  if (lastPlay > 0) {
    const age = t - lastPlay;
    if (age < 1.0 && zNorm < 0.6) {
      const fade = (1 - age / 1.0) * (1 - zNorm / 0.6);
      const u = (noteIdx - LOW) / Math.max(1, RANGE);
      paletteLerp(audio.paletteStops, u, tmp);
      const k = fade * 0.5;
      out[0] = tmp[0] * k;
      out[1] = tmp[1] * k;
      out[2] = tmp[2] * k;
      return;
    }
  }

  // Dim keyboard baseline at the bottom — C notes brighter than others
  if (zNorm < 0.12) {
    const isC = noteIdx % 12 === 0;
    const u = (noteIdx - LOW) / Math.max(1, RANGE);
    paletteLerp(audio.paletteStops, u, tmp);
    const k = isC ? 0.18 : 0.08;
    out[0] = tmp[0] * k;
    out[1] = tmp[1] * k;
    out[2] = tmp[2] * k;
  }
};
