import type { AudioFrame, SynthKind } from './types';
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
  useMic(): Promise<void>;
  useSynth(opts: { kind: SynthKind; freq: number; monitor: number }): Promise<void>;
  stop(): void;
  setBeatSensitivity(mul: number): void;
  setTint1(c: [number, number, number]): void;
  setTint2(c: [number, number, number]): void;
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
  analyser.smoothingTimeConstant = 0.7;

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
  };

  interface SynthState {
    kind: SynthKind;
    nodes: AudioNode[];
    stopFns: Array<() => void>;
    monitorGain: GainNode;
    analyserGain: GainNode;
    oscNode?: OscillatorNode;
    drumInterval?: number;
  }
  let currentSource: AudioNode | null = null;
  let currentHtmlEl: HTMLAudioElement | null = null;
  let micStream: MediaStream | null = null;
  let synth: SynthState | null = null;
  let beatSensitivity = 1.4;

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
      if (synth.drumInterval) window.clearInterval(synth.drumInterval);
      for (const fn of synth.stopFns) { try { fn(); } catch {} }
      for (const n of synth.nodes) { try { n.disconnect(); } catch {} }
      synth = null;
    }
    currentSource = null;
  }

  function buildSynth(kind: SynthKind, freq: number, monitor: number): SynthState {
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
    };

    if (kind === 'noise') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(analyserGain);
      src.connect(monitorGain);
      src.start();
      state.nodes.push(src);
      state.stopFns.push(() => src.stop());
    } else if (kind === 'sweep') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const now = ctx.currentTime;
      const loopDur = 6;
      for (let i = 0; i < 20; i++) {
        osc.frequency.setValueAtTime(60, now + i * loopDur);
        osc.frequency.exponentialRampToValueAtTime(8000, now + i * loopDur + loopDur * 0.5);
        osc.frequency.exponentialRampToValueAtTime(60, now + (i + 1) * loopDur);
      }
      osc.connect(analyserGain);
      osc.connect(monitorGain);
      osc.start();
      state.nodes.push(osc);
      state.oscNode = osc;
      state.stopFns.push(() => osc.stop());
    } else if (kind === 'drum') {
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.value = 55;
      const subGain = ctx.createGain();
      subGain.gain.value = 0;
      sub.connect(subGain);
      subGain.connect(analyserGain);
      subGain.connect(monitorGain);
      sub.start();

      const hatBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const hatData = hatBuf.getChannelData(0);
      for (let i = 0; i < hatData.length; i++) hatData[i] = Math.random() * 2 - 1;
      const hatGain = ctx.createGain();
      hatGain.gain.value = 0;
      hatGain.connect(analyserGain);
      hatGain.connect(monitorGain);

      const BPM = 120;
      const beatSec = 60 / BPM;
      let n = 0;
      const intervalId = window.setInterval(() => {
        const now = ctx.currentTime;
        const step = n % 4;
        if (step === 0 || step === 2) {
          subGain.gain.cancelScheduledValues(now);
          subGain.gain.setValueAtTime(0.8, now);
          subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        }
        if (step === 1 || step === 3) {
          const hat = ctx.createBufferSource();
          hat.buffer = hatBuf;
          hat.connect(hatGain);
          hat.start(now);
          hatGain.gain.cancelScheduledValues(now);
          hatGain.gain.setValueAtTime(0.15, now);
          hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          hat.stop(now + 0.06);
        }
        n++;
      }, beatSec * 1000);

      state.nodes.push(sub, subGain, hatGain);
      state.drumInterval = intervalId;
      state.stopFns.push(() => sub.stop());
    } else {
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
    setTint1(c) { frame.tint1 = c; },
    setTint2(c) { frame.tint2 = c; },
    setSpeed(n) { frame.speed = n; },
    setScale(n) { frame.scale = n; },
    setSynthFreq(freq: number) {
      if (synth?.oscNode && (synth.kind === 'sine' || synth.kind === 'square' || synth.kind === 'sawtooth' || synth.kind === 'triangle')) {
        synth.oscNode.frequency.setTargetAtTime(freq, ctx.currentTime, 0.02);
      }
    },
    setSynthMonitor(g: number) {
      if (synth) synth.monitorGain.gain.setTargetAtTime(g, ctx.currentTime, 0.02);
    },
    isActive() {
      return currentSource !== null || synth !== null;
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
      synth = buildSynth(opts.kind, opts.freq, opts.monitor);
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
      if (!currentSource && !synth) {
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
