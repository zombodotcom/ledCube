import type { AudioFrame, ScaleName, SynthKind } from './types';
import { SCALE_STEPS } from './types';
import { customPalette, paletteToFloat, PALETTES, type PaletteName } from './palettes';
import { midiNoteToHz, parseMidi, type MidiNote, type ParsedMidi } from './midi';
import {
  aggregateBands,
  computeBandBinRanges,
  shouldBeat,
  splitFreqRegions,
  waveformFromByteTime,
} from './audioMath';

export interface AudioEngine {
  frame: AudioFrame;
  update(tSec: number): void;
  loadFile(file: File): Promise<void>;
  loadMidi(file: File, opts?: { monitor?: number; waveform?: OscillatorType }): Promise<{ durationSec: number; noteCount: number }>;
  useMic(): Promise<void>;
  useSynth(opts: { kind: SynthKind; freq: number; monitor: number; scale?: ScaleName }): Promise<void>;
  stop(): void;
  setBeatSensitivity(mul: number): void;
  setTint1(c: [number, number, number]): void;
  setTint2(c: [number, number, number]): void;
  setPalette(name: PaletteName): void;
  setSpeed(n: number): void;
  setScale(n: number): void;
  setSynthFreq(freq: number): void;
  setSynthMonitor(g: number): void;
  isActive(): boolean;
}

const N_BANDS = 64;
const FFT_SIZE = 2048;

export function createAudioEngine(): AudioEngine {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.45;

  const rawFreq = new Uint8Array(analyser.frequencyBinCount);
  const rawTime = new Uint8Array(analyser.fftSize);
  const bands = new Float32Array(N_BANDS);
  const WAVEFORM_N = 256;
  const waveform = new Float32Array(WAVEFORM_N);

  const bandBinRanges = computeBandBinRanges(N_BANDS, analyser.frequencyBinCount, ctx.sampleRate, 40, 16000);

  const frame: AudioFrame = {
    fft: bands,
    waveform,
    energy: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    beat: false,
    time: 0,
    tint1: [1, 0.3, 0.8],
    tint2: [0.2, 0.8, 1],
    speed: 1,
    scale: 1,
    paletteStops: paletteToFloat(customPalette([1, 0.3, 0.8], [0.2, 0.8, 1])),
    midiNotes: new Uint8Array(128),
  };
  let currentPalette: PaletteName = 'custom';

  function rebuildCustomPalette() {
    if (currentPalette === 'custom') {
      frame.paletteStops = paletteToFloat(customPalette(frame.tint1, frame.tint2));
    }
  }

  interface SynthState {
    kind: SynthKind;
    nodes: AudioNode[];
    stopFns: Array<() => void>;
    monitorGain: GainNode;
    analyserGain: GainNode;
    oscNode?: OscillatorNode;
    intervals: number[];
  }
  let currentSource: AudioNode | null = null;
  let currentHtmlEl: HTMLAudioElement | null = null;
  let micStream: MediaStream | null = null;
  let synth: SynthState | null = null;
  let beatSensitivity = 1.4;

  interface ActiveMidiNote {
    note: number;
    startSec: number;
    endSec: number;
    osc: OscillatorNode;
    gain: GainNode;
  }
  interface MidiPlayer {
    notes: MidiNote[];
    durationSec: number;
    startCtxTime: number;
    monitorGain: GainNode;
    analyserGain: GainNode;
    outFilter: BiquadFilterNode;
    waveform: OscillatorType;
    nextIdx: number;
    schedulerId: number;
    active: ActiveMidiNote[];
  }
  let midi: MidiPlayer | null = null;

  const bassHistory: number[] = [];
  const HISTORY = 43;
  let refractoryUntil = 0;

  function detach() {
    try {
      if (currentSource) currentSource.disconnect();
    } catch {}
    if (currentHtmlEl) {
      currentHtmlEl.pause();
      currentHtmlEl.src = '';
      currentHtmlEl = null;
    }
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    if (synth) {
      for (const id of synth.intervals) window.clearInterval(id);
      for (const fn of synth.stopFns) { try { fn(); } catch {} }
      for (const n of synth.nodes) { try { n.disconnect(); } catch {} }
      synth = null;
    }
    if (midi) {
      window.clearInterval(midi.schedulerId);
      for (const n of midi.active) {
        try { n.osc.stop(); } catch {}
        try { n.osc.disconnect(); n.gain.disconnect(); } catch {}
      }
      try { midi.outFilter.disconnect(); midi.monitorGain.disconnect(); midi.analyserGain.disconnect(); } catch {}
      midi = null;
    }
    frame.midiNotes.fill(0);
    currentSource = null;
  }

  function makeNoiseBuf(durSec: number): AudioBuffer {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * durSec)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function buildSynth(kind: SynthKind, freq: number, monitor: number, scale: ScaleName): SynthState {
    const analyserGain = ctx.createGain();
    analyserGain.gain.value = 1;
    analyserGain.connect(analyser);
    const monitorGain = ctx.createGain();
    monitorGain.gain.value = monitor;
    monitorGain.connect(ctx.destination);

    const state: SynthState = {
      kind,
      nodes: [analyserGain, monitorGain],
      stopFns: [],
      monitorGain,
      analyserGain,
      intervals: [],
    };

    if (kind === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuf(2);
      src.loop = true;
      src.connect(analyserGain);
      src.connect(monitorGain);
      src.start();
      state.nodes.push(src);
      state.stopFns.push(() => src.stop());
    } else if (kind === 'sweep') {
      // Continuous up-down sweep; refresh ramps periodically so it never stops.
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const loopDur = 4;
      const scheduleNext = () => {
        const now = ctx.currentTime;
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(60, now);
        for (let i = 0; i < 8; i++) {
          osc.frequency.exponentialRampToValueAtTime(8000, now + i * loopDur + loopDur * 0.5);
          osc.frequency.exponentialRampToValueAtTime(60, now + (i + 1) * loopDur);
        }
      };
      scheduleNext();
      osc.connect(analyserGain);
      osc.connect(monitorGain);
      osc.start();
      // Reschedule every 24s so we always have ~32s of ramps queued
      state.intervals.push(window.setInterval(scheduleNext, loopDur * 8 * 1000 - 2000));
      state.nodes.push(osc);
      state.oscNode = osc;
      state.stopFns.push(() => osc.stop());
    } else if (kind === 'drum') {
      // Kick + snare + hi-hat 4/4 pattern at 124 BPM
      const kick = ctx.createOscillator();
      kick.type = 'sine';
      const kickGain = ctx.createGain();
      kickGain.gain.value = 0;
      kick.connect(kickGain);
      kickGain.connect(analyserGain);
      kickGain.connect(monitorGain);
      kick.start();

      const snareNoiseBuf = makeNoiseBuf(0.3);
      const snareBp = ctx.createBiquadFilter();
      snareBp.type = 'bandpass';
      snareBp.frequency.value = 1800;
      snareBp.Q.value = 0.7;
      const snareGain = ctx.createGain();
      snareGain.gain.value = 0;
      snareBp.connect(snareGain);
      snareGain.connect(analyserGain);
      snareGain.connect(monitorGain);

      const hatNoiseBuf = makeNoiseBuf(0.1);
      const hatHp = ctx.createBiquadFilter();
      hatHp.type = 'highpass';
      hatHp.frequency.value = 6000;
      const hatGain = ctx.createGain();
      hatGain.gain.value = 0;
      hatHp.connect(hatGain);
      hatGain.connect(analyserGain);
      hatGain.connect(monitorGain);

      const BPM = 124;
      const stepSec = 60 / BPM / 4; // 16th notes
      let n = 0;
      const intervalId = window.setInterval(() => {
        const now = ctx.currentTime;
        const step = n % 16;
        // Kick on 1, 5, 7, 9 (electronic kick pattern)
        if (step === 0 || step === 4 || step === 8 || step === 12) {
          kick.frequency.cancelScheduledValues(now);
          kick.frequency.setValueAtTime(140, now);
          kick.frequency.exponentialRampToValueAtTime(40, now + 0.18);
          kickGain.gain.cancelScheduledValues(now);
          kickGain.gain.setValueAtTime(0.9, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        }
        // Snare on 5, 13
        if (step === 4 || step === 12) {
          const src = ctx.createBufferSource();
          src.buffer = snareNoiseBuf;
          src.connect(snareBp);
          src.start(now);
          src.stop(now + 0.18);
          snareGain.gain.cancelScheduledValues(now);
          snareGain.gain.setValueAtTime(0.35, now);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        }
        // Hi-hat on every 16th
        const isOpen = step === 14 || step === 6;
        const src = ctx.createBufferSource();
        src.buffer = hatNoiseBuf;
        src.connect(hatHp);
        src.start(now);
        src.stop(now + (isOpen ? 0.12 : 0.04));
        hatGain.gain.cancelScheduledValues(now);
        hatGain.gain.setValueAtTime(isOpen ? 0.18 : 0.10, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + (isOpen ? 0.12 : 0.04));
        n++;
      }, stepSec * 1000);

      state.nodes.push(kick, kickGain, snareBp, snareGain, hatHp, hatGain);
      state.intervals.push(intervalId);
      state.stopFns.push(() => kick.stop());
    } else if (kind === 'chord') {
      // Triad built on root + 3rd + 5th of the chosen scale
      const steps = SCALE_STEPS[scale];
      const third = steps[Math.min(2, steps.length - 1)] ?? 4;
      const fifth = steps[Math.min(4, steps.length - 1)] ?? 7;
      const ratios = [1, Math.pow(2, third / 12), Math.pow(2, fifth / 12)];
      const detune = [-7, 4, -3];
      const oscs: OscillatorNode[] = [];
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 2200;
      filt.Q.value = 0.6;
      filt.connect(analyserGain);
      filt.connect(monitorGain);
      for (let i = 0; i < ratios.length; i++) {
        const o1 = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        o1.type = 'sawtooth';
        o2.type = 'sawtooth';
        o1.frequency.value = freq * ratios[i];
        o2.frequency.value = freq * ratios[i];
        o1.detune.value = detune[i];
        o2.detune.value = -detune[i];
        const g = ctx.createGain();
        g.gain.value = 0.16;
        o1.connect(g); o2.connect(g);
        g.connect(filt);
        o1.start(); o2.start();
        oscs.push(o1, o2);
        state.nodes.push(o1, o2, g);
      }
      // Slow LFO on filter cutoff for movement
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.3;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 800;
      lfo.connect(lfoGain);
      lfoGain.connect(filt.frequency);
      lfo.start();
      state.nodes.push(lfo, lfoGain, filt);
      state.stopFns.push(() => { for (const o of oscs) o.stop(); lfo.stop(); });
    } else if (kind === 'arpeggio') {
      // Up-down arp across 3 octaves on the chosen scale
      const steps = SCALE_STEPS[scale];
      const OCTAVES = 3;
      const notes: number[] = [];
      for (let o = 0; o < OCTAVES; o++) {
        for (const s of steps) notes.push(freq * Math.pow(2, (s + o * 12) / 12));
      }
      // up-down: up then back down, skipping the endpoints on return
      const seq = [...notes, ...notes.slice(1, -1).reverse()];

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 3000;
      filt.Q.value = 0.8;
      const env = ctx.createGain();
      env.gain.value = 0;
      osc.connect(filt);
      filt.connect(env);
      env.connect(analyserGain);
      env.connect(monitorGain);
      osc.start();

      // Slow LFO adds filter motion so the arp doesn't feel static
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.18;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1500;
      lfo.connect(lfoGain);
      lfoGain.connect(filt.frequency);
      lfo.start();

      let step = 0;
      const noteMs = 130;
      const intervalId = window.setInterval(() => {
        const now = ctx.currentTime;
        const f = seq[step % seq.length];
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(f, now);
        env.gain.cancelScheduledValues(now);
        // Short pluck-like envelope, accents on scale root every bar
        const isRoot = step % seq.length === 0;
        env.gain.setValueAtTime(isRoot ? 0.65 : 0.45, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + noteMs / 1000 * 0.8);
        step++;
      }, noteMs);
      state.nodes.push(osc, filt, env, lfo, lfoGain);
      state.intervals.push(intervalId);
      state.oscNode = osc;
      state.stopFns.push(() => { osc.stop(); lfo.stop(); });
    } else if (kind === 'pluck') {
      // Karplus-Strong style pluck via short-decay sawtooth + lowpass
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 1200;
      filt.connect(analyserGain);
      filt.connect(monitorGain);
      let pluckOscs: OscillatorNode[] = [];
      const intervalId = window.setInterval(() => {
        const now = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const f = freq * Math.pow(2, ((Math.random() * 7) | 0) / 12);
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        o.connect(g);
        g.connect(filt);
        o.start(now);
        o.stop(now + 0.65);
        pluckOscs.push(o);
        if (pluckOscs.length > 16) pluckOscs = pluckOscs.slice(-16);
      }, 280);
      state.nodes.push(filt);
      state.intervals.push(intervalId);
      state.stopFns.push(() => { for (const o of pluckOscs) { try { o.stop(); } catch {} } });
    } else if (kind === 'siren') {
      // Fast oscillating pitch — like an emergency siren
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1.3;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.6;
      lfo.connect(lfoGain);
      osc.frequency.value = freq;
      lfoGain.connect(osc.frequency);
      osc.connect(analyserGain);
      osc.connect(monitorGain);
      osc.start();
      lfo.start();
      state.nodes.push(osc, lfo, lfoGain);
      state.oscNode = osc;
      state.stopFns.push(() => { osc.stop(); lfo.stop(); });
    } else if (kind === 'fmBell') {
      // 2-op FM with bell-like envelope re-triggering every 700ms
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = freq;
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = freq * 1.41; // inharmonic ratio for bell
      const modGain = ctx.createGain();
      modGain.gain.value = freq * 4;
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      const env = ctx.createGain();
      env.gain.value = 0;
      carrier.connect(env);
      env.connect(analyserGain);
      env.connect(monitorGain);
      carrier.start();
      mod.start();
      const intervalId = window.setInterval(() => {
        const now = ctx.currentTime;
        env.gain.cancelScheduledValues(now);
        env.gain.setValueAtTime(0.45, now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
        modGain.gain.cancelScheduledValues(now);
        modGain.gain.setValueAtTime(freq * 4, now);
        modGain.gain.exponentialRampToValueAtTime(freq * 0.3, now + 1.5);
      }, 800);
      state.nodes.push(carrier, mod, modGain, env);
      state.intervals.push(intervalId);
      state.oscNode = carrier;
      state.stopFns.push(() => { carrier.stop(); mod.stop(); });
    } else if (kind === 'bassDrop') {
      // Sub bass that periodically drops in pitch with a soft attack
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const sub = ctx.createOscillator();
      sub.type = 'square';
      sub.frequency.value = 0; // gated below
      const subGain = ctx.createGain();
      subGain.gain.value = 0.1;
      sub.connect(subGain);
      const env = ctx.createGain();
      env.gain.value = 0;
      osc.connect(env);
      subGain.connect(env);
      env.connect(analyserGain);
      env.connect(monitorGain);
      osc.start();
      sub.start();
      const intervalId = window.setInterval(() => {
        const now = ctx.currentTime;
        const start = freq * 2;
        const end = freq * 0.5;
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setValueAtTime(start, now);
        osc.frequency.exponentialRampToValueAtTime(end, now + 1.4);
        sub.frequency.cancelScheduledValues(now);
        sub.frequency.setValueAtTime(start * 0.5, now);
        sub.frequency.exponentialRampToValueAtTime(end * 0.5, now + 1.4);
        env.gain.cancelScheduledValues(now);
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.7, now + 0.05);
        env.gain.setValueAtTime(0.7, now + 1.2);
        env.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      }, 1700);
      state.nodes.push(osc, sub, subGain, env);
      state.intervals.push(intervalId);
      state.oscNode = osc;
      state.stopFns.push(() => { osc.stop(); sub.stop(); });
    } else {
      // Plain oscillator: sine, square, sawtooth, triangle
      const osc = ctx.createOscillator();
      osc.type = kind;
      osc.frequency.value = freq;
      osc.connect(analyserGain);
      osc.connect(monitorGain);
      osc.start();
      state.nodes.push(osc);
      state.oscNode = osc;
      state.stopFns.push(() => osc.stop());
    }
    return state;
  }

  const engine: AudioEngine = {
    frame,
    setBeatSensitivity(mul: number) { beatSensitivity = mul; },
    setTint1(c) { frame.tint1 = c; rebuildCustomPalette(); },
    setTint2(c) { frame.tint2 = c; rebuildCustomPalette(); },
    setPalette(name) {
      currentPalette = name;
      if (name === 'custom') rebuildCustomPalette();
      else frame.paletteStops = paletteToFloat(PALETTES[name]);
    },
    setSpeed(n) { frame.speed = n; },
    setScale(n) { frame.scale = n; },
    setSynthFreq(freq: number) {
      if (!synth?.oscNode) return;
      const k = synth.kind;
      if (k === 'sine' || k === 'square' || k === 'sawtooth' || k === 'triangle' || k === 'siren') {
        synth.oscNode.frequency.setTargetAtTime(freq, ctx.currentTime, 0.02);
      }
    },
    setSynthMonitor(g: number) {
      if (synth) synth.monitorGain.gain.setTargetAtTime(g, ctx.currentTime, 0.02);
    },
    isActive() {
      return currentSource !== null || synth !== null || midi !== null;
    },
    async loadFile(file: File) {
      detach();
      if (ctx.state === 'suspended') await ctx.resume();
      const el = new Audio();
      el.src = URL.createObjectURL(file);
      el.crossOrigin = 'anonymous';
      el.loop = true;
      await el.play().catch(() => {});
      const node = ctx.createMediaElementSource(el);
      node.connect(analyser);
      analyser.connect(ctx.destination);
      currentSource = node;
      currentHtmlEl = el;
    },
    async useMic() {
      detach();
      if (ctx.state === 'suspended') await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      micStream = stream;
      const node = ctx.createMediaStreamSource(stream);
      node.connect(analyser);
      currentSource = node;
    },
    async useSynth(opts) {
      detach();
      if (ctx.state === 'suspended') await ctx.resume();
      synth = buildSynth(opts.kind, opts.freq, opts.monitor, opts.scale ?? 'major');
    },
    async loadMidi(file, opts) {
      detach();
      if (ctx.state === 'suspended') await ctx.resume();
      const buf = await file.arrayBuffer();
      const parsed: ParsedMidi = parseMidi(buf);

      const analyserGain = ctx.createGain();
      analyserGain.gain.value = 1;
      analyserGain.connect(analyser);
      const monitorGain = ctx.createGain();
      monitorGain.gain.value = opts?.monitor ?? 0.15;
      monitorGain.connect(ctx.destination);
      const outFilter = ctx.createBiquadFilter();
      outFilter.type = 'lowpass';
      outFilter.frequency.value = 6000;
      outFilter.Q.value = 0.5;
      outFilter.connect(analyserGain);
      outFilter.connect(monitorGain);

      midi = {
        notes: parsed.notes,
        durationSec: parsed.durationSec,
        startCtxTime: ctx.currentTime + 0.2,
        monitorGain,
        analyserGain,
        outFilter,
        waveform: opts?.waveform ?? 'triangle',
        nextIdx: 0,
        schedulerId: 0,
        active: [],
      };

      const schedAhead = 0.25;
      const tick = () => {
        if (!midi) return;
        const nowCtx = ctx.currentTime;
        const elapsed = nowCtx - midi.startCtxTime;
        if (elapsed > midi.durationSec + 1.5) {
          midi.startCtxTime = nowCtx + 0.1;
          midi.nextIdx = 0;
          midi.active = [];
        }
        while (midi.nextIdx < midi.notes.length) {
          const n = midi.notes[midi.nextIdx];
          if (n.startSec > elapsed + schedAhead) break;
          const startAt = midi.startCtxTime + n.startSec;
          const endAt = midi.startCtxTime + Math.max(n.endSec, n.startSec + 0.08);
          const freq = midiNoteToHz(n.note);
          const osc = ctx.createOscillator();
          osc.type = midi.waveform;
          osc.frequency.value = freq;
          const g = ctx.createGain();
          g.gain.value = 0;
          osc.connect(g);
          g.connect(midi.outFilter);
          const vel = Math.min(1, n.velocity / 127) * 0.5;
          g.gain.setValueAtTime(0, startAt);
          g.gain.linearRampToValueAtTime(vel, startAt + 0.008);
          g.gain.setValueAtTime(vel * 0.7, Math.max(startAt + 0.02, endAt - 0.08));
          g.gain.exponentialRampToValueAtTime(0.001, endAt + 0.05);
          osc.start(startAt);
          osc.stop(endAt + 0.1);
          midi.active.push({ note: n.note, startSec: n.startSec, endSec: n.endSec, osc, gain: g });
          midi.nextIdx++;
        }
        frame.midiNotes.fill(0);
        const fresh: ActiveMidiNote[] = [];
        for (const a of midi.active) {
          if (a.endSec < elapsed - 0.1) {
            try { a.osc.disconnect(); a.gain.disconnect(); } catch {}
            continue;
          }
          fresh.push(a);
          if (elapsed >= a.startSec && elapsed <= a.endSec) {
            frame.midiNotes[a.note] = 1;
          }
        }
        midi.active = fresh;
      };
      midi.schedulerId = window.setInterval(tick, 33);
      tick();

      return { durationSec: parsed.durationSec, noteCount: parsed.notes.length };
    },
    stop() {
      detach();
      bands.fill(0);
      waveform.fill(0);
      frame.energy = frame.bass = frame.mid = frame.treble = 0;
      frame.beat = false;
    },
    update(tSec: number) {
      frame.time = tSec;
      if (!currentSource && !synth && !midi) {
        frame.beat = false;
        return;
      }
      analyser.getByteFrequencyData(rawFreq);
      analyser.getByteTimeDomainData(rawTime);
      waveformFromByteTime(rawTime, WAVEFORM_N, waveform);
      frame.energy = aggregateBands(rawFreq, bandBinRanges, bands);
      const regions = splitFreqRegions(bands);
      frame.bass = regions.bass;
      frame.mid = regions.mid;
      frame.treble = regions.treble;

      bassHistory.push(frame.bass);
      if (bassHistory.length > HISTORY) bassHistory.shift();
      const beat = shouldBeat(frame.bass, bassHistory, beatSensitivity, 0.08, tSec, refractoryUntil);
      frame.beat = beat;
      if (beat) refractoryUntil = tSec + 0.2;
    },
  };

  return engine;
}
