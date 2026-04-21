import { defaultLayout, generateStrips, buildPixelMap, buildGridIndex } from './geometry';
import { createScene, uploadColors } from './scene';
import { builtinPatterns, compilePattern } from './patterns/index';
import { createAudioEngine } from './audio';
import {
  defaultElectrical,
  simulate,
  voltageToHeatmapColor,
  type ElectricalConfig,
} from './electrical';
import type { AudioFrame, GridIndex, LayoutConfig, PatternCtx, PatternFn, PixelMap } from './types';
import { buildUI, updateStats } from './ui';
import {
  downloadText,
  exportE131Config,
  exportPixelMap,
  exportPowerReport,
} from './export';
import { createScope } from './scope';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
const statsRoot = document.getElementById('stats') as HTMLElement;
const scopeRoot = document.getElementById('scope') as HTMLElement;
const editor = document.getElementById('editor') as HTMLElement;
const editorText = document.getElementById('editor-text') as HTMLTextAreaElement;
const editorApply = document.getElementById('editor-apply') as HTMLButtonElement;
const editorClose = document.getElementById('editor-close') as HTMLButtonElement;
const editorErr = document.getElementById('editor-err') as HTMLElement;

let layout: LayoutConfig = defaultLayout();
let map: PixelMap = buildPixelMap(generateStrips(layout));
let grid: GridIndex = buildGridIndex(map);
let prevColors = new Float32Array(map.count * 3);
const scene = createScene(canvas, map);
const audio = createAudioEngine();

let activePatternKey = 'plasma';
let activePattern: PatternFn = builtinPatterns[activePatternKey].fn;
let activeSource = builtinPatterns[activePatternKey].source;
let patternState: Record<string, unknown> = {};
const scope = createScope(scopeRoot);
let brightnessSlider = 0.55; // raw slider 0..1; effective = slider * slider
let showElectrical = false;
let electrical: ElectricalConfig = defaultElectrical();
let lastElecT = 0;
let lastElecResult = simulate(map, scene.colors, electrical);

const ui = buildUI(uiRoot, layout, builtinPatterns, activePatternKey, electrical, {
  tint1: audio.frame.tint1,
  tint2: audio.frame.tint2,
  speed: audio.frame.speed,
  scale: audio.frame.scale,
}, {
  onLayoutChange(cfg) {
    layout = cfg;
    try {
      const strips = generateStrips(layout);
      map = buildPixelMap(strips);
      grid = buildGridIndex(map);
      prevColors = new Float32Array(map.count * 3);
      patternState = {};
      scene.rebuild(map);
      lastElecResult = simulate(map, scene.colors, electrical);
      refreshSummary();
    } catch (e) {
      console.error(e);
      alert('Layout failed: ' + (e as Error).message);
    }
  },
  onPatternChange(key) {
    activePatternKey = key;
    activePattern = builtinPatterns[key].fn;
    activeSource = builtinPatterns[key].source;
    patternState = {};
  },
  onOpenEditor() {
    editorText.value = activeSource;
    editor.classList.add('open');
    editorErr.textContent = '';
  },
  onPointSize(size) {
    scene.setPointSize(size);
  },
  onShowWires(show) {
    scene.setShowWires(show);
  },
  onGlow(on) {
    scene.setGlow(on);
  },
  onGlowStrength(s) {
    scene.setGlowStrength(s);
  },
  onBrightness(b) {
    brightnessSlider = b;
  },
  async onAudioFile(file) {
    try {
      await audio.loadFile(file);
      scope.setVisible(true);
    } catch (e) {
      alert('Audio load failed: ' + (e as Error).message);
    }
  },
  async onAudioMidi(file) {
    try {
      const info = await audio.loadMidi(file);
      scope.setVisible(true);
      if (activePatternKey !== 'pianoRoll') {
        activePatternKey = 'pianoRoll';
        activePattern = builtinPatterns.pianoRoll.fn;
        activeSource = builtinPatterns.pianoRoll.source;
        patternState = {};
        ui.setActivePattern('pianoRoll');
      }
      console.info(`MIDI loaded: ${info.noteCount} notes, ${info.durationSec.toFixed(1)}s`);
    } catch (e) {
      alert('MIDI load failed: ' + (e as Error).message);
    }
  },
  async onAudioMic() {
    try {
      await audio.useMic();
      scope.setVisible(true);
    } catch (e) {
      alert('Mic failed: ' + (e as Error).message);
    }
  },
  async onAudioTabCapture() {
    try {
      await audio.useTabAudio();
      scope.setVisible(true);
    } catch (e) {
      const msg = (e as Error).message || 'failed';
      alert(
        `Tab capture failed: ${msg}\n\n` +
        `In the share dialog:\n` +
        `  1. Pick "Chrome Tab"\n` +
        `  2. Select a tab that's actively playing audio (YouTube, Spotify, etc.)\n` +
        `  3. Tick "Share tab audio" at the bottom\n` +
        `  4. Click Share`
      );
    }
  },
  onYouTubeUrl(url) { openYouTubePlayer(url); },
  async onYouTubeAnalyze(url) {
    const id = extractYouTubeId(url);
    if (!id) {
      alert('Could not parse a YouTube video ID from that URL');
      return;
    }
    const win = window.open(`https://www.youtube.com/watch?v=${id}`, '_blank');
    if (!win) {
      alert('Popup blocked — allow popups for this site, or use Watch here instead.');
      return;
    }
    // Give the user a moment to land on the new tab and press play before the
    // share dialog pops up (helps, and the YouTube tab needs to be reachable).
    await new Promise((r) => setTimeout(r, 1500));
    try {
      await audio.useTabAudio();
      scope.setVisible(true);
    } catch (e) {
      const msg = (e as Error).message || 'failed';
      alert(
        `Tab capture failed: ${msg}\n\n` +
        `In the share dialog:\n` +
        `  1. Pick "Chrome Tab" (not Window/Screen)\n` +
        `  2. Select the YouTube tab\n` +
        `  3. Tick "Share tab audio" at the bottom\n` +
        `  4. Click Share`
      );
    }
  },
  async onAudioSynth(opts) {
    try {
      await audio.useSynth(opts);
      scope.setVisible(true);
    } catch (e) {
      alert('Synth failed: ' + (e as Error).message);
    }
  },
  onSynthFreq(freq) {
    audio.setSynthFreq(freq);
  },
  onSynthMonitor(g) {
    audio.setSynthMonitor(g);
  },
  onAudioStop() {
    audio.stop();
    scope.setVisible(false);
  },
  onTint1(c) { audio.setTint1(c); },
  onTint2(c) { audio.setTint2(c); },
  onPalette(name) { audio.setPalette(name); },
  onSpeed(s) { audio.setSpeed(s); },
  onScale(s) { audio.setScale(s); },
  onAudioSeek(sec) { audio.seek(sec); },
  onAudioLoop(loop) { audio.setLoop(loop); },
  onAudioPlayPause(playing) { audio.setPlaying(playing); },
  onMicGain(gain) { audio.setMicGain(gain); },
  onBeatSensitivity(mul) {
    audio.setBeatSensitivity(mul);
  },
  onElectricalToggle(on) {
    showElectrical = on;
  },
  onElectricalChange(cfg) {
    electrical = cfg;
  },
  onExportPixelMap() {
    downloadText('pixelmap.json', exportPixelMap(map), 'application/json');
  },
  onExportE131() {
    downloadText('e131.json', exportE131Config(map), 'application/json');
  },
  onExportPowerReport() {
    const r = simulate(map, scene.colors, electrical);
    downloadText('power-report.md', exportPowerReport(map, electrical, r), 'text/markdown');
  },
});

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  if (/^[\w-]{11}$/.test(url)) return url;
  return null;
}

let ytPanel: HTMLDivElement | null = null;
function openYouTubePlayer(url: string) {
  const id = extractYouTubeId(url);
  if (!id) {
    alert('Could not parse a YouTube video ID from that URL');
    return;
  }
  if (!ytPanel) {
    ytPanel = document.createElement('div');
    ytPanel.style.cssText =
      'position: fixed; bottom: 12px; right: 12px; width: 320px; height: 200px; ' +
      'background: #000; border: 1px solid #2a2a31; border-radius: 8px; overflow: hidden; z-index: 25; ' +
      'box-shadow: 0 8px 24px rgba(0,0,0,0.5);';
    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText =
      'position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; padding: 0; ' +
      'background: rgba(0,0,0,0.6); color: #fff; border: 1px solid #444; border-radius: 4px; ' +
      'cursor: pointer; z-index: 1; font-size: 14px;';
    close.addEventListener('click', () => {
      ytPanel?.remove();
      ytPanel = null;
    });
    ytPanel.appendChild(close);
    document.body.appendChild(ytPanel);
  }
  const existingIframe = ytPanel.querySelector('iframe');
  if (existingIframe) existingIframe.remove();
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
  iframe.style.cssText = 'width: 100%; height: 100%; border: 0;';
  iframe.allow = 'autoplay; encrypted-media';
  iframe.allowFullscreen = true;
  ytPanel.appendChild(iframe);
}

function refreshSummary() {
  const estAmps = map.count * electrical.maxCurrentPerLED;
  ui.setCount(map.count, map.totalMeters, estAmps);
}
refreshSummary();

editorClose.addEventListener('click', () => editor.classList.remove('open'));
editorApply.addEventListener('click', applyEditor);
editorText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    applyEditor();
  }
});
function applyEditor() {
  try {
    const fn = compilePattern(editorText.value);
    const test: [number, number, number] = [0, 0, 0];
    const dummyAudio: AudioFrame = {
      fft: new Float32Array(64),
      waveform: new Float32Array(256),
      energy: 0, bass: 0, mid: 0, treble: 0, beat: false, time: 0,
      tint1: [1, 0, 0], tint2: [0, 0, 1], speed: 1, scale: 1,
      paletteStops: new Float32Array([1,0,0, 0.5,0,0.5, 0,0,1, 0.3,0.3,1, 0.6,0.6,1]),
      midiNotes: new Uint8Array(128),
    };
    fn(0, 0, 0, 0, 0, dummyAudio, test);
    activePattern = fn;
    activeSource = editorText.value;
    patternState = {};
    editorErr.textContent = '';
  } catch (e) {
    editorErr.textContent = (e as Error).message;
  }
}

const hmOut: [number, number, number] = [0, 0, 0];
const out: [number, number, number] = [0, 0, 0];

let lastFrameTs = performance.now();
let fps = 0;
let fpsAccum = 0;
let fpsFrames = 0;

function render(nowMs: number) {
  requestAnimationFrame(render);
  const dt = (nowMs - lastFrameTs) / 1000;
  lastFrameTs = nowMs;
  fpsAccum += dt;
  fpsFrames++;
  if (fpsAccum >= 0.5) {
    fps = fpsFrames / fpsAccum;
    fpsAccum = 0;
    fpsFrames = 0;
  }
  const t = nowMs / 1000;
  audio.update(t);
  const frame = audio.frame;

  const pos = map.positions;
  const colors = scene.colors;
  const N = map.count;
  const pattern = activePattern;
  const br = brightnessSlider * brightnessSlider; // perceptual gamma
  if (prevColors.length !== colors.length) prevColors = new Float32Array(colors.length);
  const ctx: PatternCtx = {
    pixelCount: N,
    grid,
    state: patternState,
    prevColors,
    dt,
  };

  for (let i = 0; i < N; i++) {
    const x = pos[i * 3 + 0];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    out[0] = 0; out[1] = 0; out[2] = 0;
    try {
      pattern(i, x, y, z, t, frame, out, ctx);
    } catch {
      out[0] = 1; out[1] = 0; out[2] = 0;
    }
    colors[i * 3 + 0] = Math.max(0, Math.min(1, out[0] * br));
    colors[i * 3 + 1] = Math.max(0, Math.min(1, out[1] * br));
    colors[i * 3 + 2] = Math.max(0, Math.min(1, out[2] * br));
  }
  prevColors.set(colors);

  if (showElectrical && t - lastElecT > 0.1) {
    lastElecResult = simulate(map, colors, electrical);
    lastElecT = t;
    const V = lastElecResult.voltages;
    for (let i = 0; i < N; i++) {
      voltageToHeatmapColor(V[i], electrical, hmOut);
      colors[i * 3 + 0] = hmOut[0];
      colors[i * 3 + 1] = hmOut[1];
      colors[i * 3 + 2] = hmOut[2];
    }
  } else if (showElectrical) {
    const V = lastElecResult.voltages;
    for (let i = 0; i < N; i++) {
      voltageToHeatmapColor(V[i], electrical, hmOut);
      colors[i * 3 + 0] = hmOut[0];
      colors[i * 3 + 1] = hmOut[1];
      colors[i * 3 + 2] = hmOut[2];
    }
  }

  uploadColors(scene);
  scene.controls.update();
  scene.render();

  if (audio.isActive()) scope.draw(frame);
  ui.setAudioStatus(audio.getStatus());

  const estAmps = showElectrical ? lastElecResult.totalCurrent : N * electrical.maxCurrentPerLED * br * 0.1;
  updateStats(
    statsRoot,
    fps,
    N,
    estAmps,
    lastElecResult.worstVoltage,
    lastElecResult.brownoutCount,
    showElectrical,
  );
}
requestAnimationFrame(render);
