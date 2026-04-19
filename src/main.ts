import { defaultLayout, generateStrips, buildPixelMap } from './geometry';
import { createScene, uploadColors } from './scene';
import { builtinPatterns, compilePattern } from './patterns/index';
import { createAudioEngine } from './audio';
import {
  defaultElectrical,
  simulate,
  voltageToHeatmapColor,
  type ElectricalConfig,
} from './electrical';
import type { AudioFrame, LayoutConfig, PatternFn, PixelMap } from './types';
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
const scene = createScene(canvas, map);
const audio = createAudioEngine();

let activePatternKey = 'pulseTint';
let activePattern: PatternFn = builtinPatterns[activePatternKey].fn;
let activeSource = builtinPatterns[activePatternKey].source;
const scope = createScope(scopeRoot);
let brightness = 0.5;
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
  onBrightness(b) {
    brightness = b;
  },
  async onAudioFile(file) {
    try {
      await audio.loadFile(file);
      scope.setVisible(true);
    } catch (e) {
      alert('Audio load failed: ' + (e as Error).message);
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
  onSpeed(s) { audio.setSpeed(s); },
  onScale(s) { audio.setScale(s); },
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
    };
    fn(0, 0, 0, 0, 0, dummyAudio, test);
    activePattern = fn;
    activeSource = editorText.value;
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
  const br = brightness;

  for (let i = 0; i < N; i++) {
    const x = pos[i * 3 + 0];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    out[0] = 0; out[1] = 0; out[2] = 0;
    try {
      pattern(i, x, y, z, t, frame, out);
    } catch {
      out[0] = 1; out[1] = 0; out[2] = 0;
    }
    colors[i * 3 + 0] = Math.max(0, Math.min(1, out[0] * br));
    colors[i * 3 + 1] = Math.max(0, Math.min(1, out[1] * br));
    colors[i * 3 + 2] = Math.max(0, Math.min(1, out[2] * br));
  }

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
  scene.renderer.render(scene.scene, scene.camera);

  if (audio.isActive()) scope.draw(frame);

  const estAmps = showElectrical ? lastElecResult.totalCurrent : N * electrical.maxCurrentPerLED * brightness * 0.1;
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
