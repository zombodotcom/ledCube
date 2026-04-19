import type { ElectricalConfig } from './electrical';
import type { LayoutConfig, SynthKind } from './types';

export interface UICallbacks {
  onLayoutChange(cfg: LayoutConfig): void;
  onPatternChange(key: string): void;
  onOpenEditor(): void;
  onPointSize(size: number): void;
  onShowWires(show: boolean): void;
  onBrightness(b: number): void;
  onAudioFile(file: File): void;
  onAudioMic(): void;
  onAudioSynth(opts: { kind: SynthKind; freq: number; monitor: number }): void;
  onSynthFreq(freq: number): void;
  onSynthMonitor(g: number): void;
  onAudioStop(): void;
  onBeatSensitivity(mul: number): void;
  onTint1(c: [number, number, number]): void;
  onTint2(c: [number, number, number]): void;
  onSpeed(s: number): void;
  onScale(s: number): void;
  onElectricalToggle(on: boolean): void;
  onElectricalChange(cfg: ElectricalConfig): void;
  onExportPixelMap(): void;
  onExportE131(): void;
  onExportPowerReport(): void;
}

export interface UIHandles {
  el: HTMLElement;
  setCount(n: number, meters: number, estAmps: number): void;
}

export interface UIInitialState {
  tint1: [number, number, number];
  tint2: [number, number, number];
  speed: number;
  scale: number;
}

export function buildUI(
  root: HTMLElement,
  layout: LayoutConfig,
  patterns: Record<string, { name: string }>,
  activePatternKey: string,
  electrical: ElectricalConfig,
  initial: UIInitialState,
  cb: UICallbacks,
): UIHandles {
  root.innerHTML = '';
  const summary = document.createElement('div');
  summary.className = 'kv';
  summary.innerHTML = `
    <span class="k">Pixels</span><span id="k-count">0</span>
    <span class="k">Total strip</span><span id="k-meters">0 m</span>
    <span class="k">Est. full-white</span><span id="k-amps">0 A</span>
  `;
  root.appendChild(summary);
  root.appendChild(hr());

  root.appendChild(h2('Layout'));
  const modeSel = selectEl(['uniform', 'varied', 'freeform'], layout.mode);
  root.appendChild(row('Mode', modeSel));
  const gridN = numEl(layout.gridN, 1, 40, 1);
  root.appendChild(row('Grid N × N', gridN));
  const spacing = numEl(layout.spacing_m, 0.05, 2, 0.05);
  root.appendChild(row('Spacing (m)', spacing));
  const lengths = inputEl(layout.lengths_m.join(','));
  root.appendChild(row('Lengths (m, csv)', lengths));
  const density = numEl(layout.density, 30, 144, 1);
  root.appendChild(row('LEDs / m', density));
  const seed = numEl(layout.seed, 0, 99999, 1);
  root.appendChild(row('Seed', seed));
  const freeform = document.createElement('textarea');
  freeform.placeholder = '{ "strips": [{ "id": "s0", "top": [0,0,5], "length_m": 5, "led_density": 60, "led_type": "WS2815" }] }';
  freeform.style.display = layout.mode === 'freeform' ? 'block' : 'none';
  freeform.style.width = '100%';
  freeform.style.height = '80px';
  freeform.value = layout.freeformJson ?? '';
  root.appendChild(freeform);
  const applyBtn = button('Rebuild layout', 'primary');
  root.appendChild(applyBtn);

  function gatherLayout(): LayoutConfig {
    const mode = modeSel.value as LayoutConfig['mode'];
    freeform.style.display = mode === 'freeform' ? 'block' : 'none';
    return {
      mode,
      gridN: +gridN.value,
      spacing_m: +spacing.value,
      lengths_m: lengths.value.split(',').map((s) => +s.trim()).filter((n) => n > 0),
      density: +density.value,
      seed: +seed.value,
      freeformJson: mode === 'freeform' ? freeform.value : undefined,
    };
  }
  modeSel.addEventListener('change', () => { freeform.style.display = modeSel.value === 'freeform' ? 'block' : 'none'; });
  applyBtn.addEventListener('click', () => cb.onLayoutChange(gatherLayout()));

  root.appendChild(hr());
  root.appendChild(h2('Pattern'));
  const patSel = selectEl(Object.keys(patterns), activePatternKey);
  for (const opt of Array.from(patSel.options)) opt.textContent = patterns[opt.value].name;
  root.appendChild(row('Pattern', patSel));
  patSel.addEventListener('change', () => cb.onPatternChange(patSel.value));
  const editBtn = button('Edit source…');
  root.appendChild(editBtn);
  editBtn.addEventListener('click', () => cb.onOpenEditor());

  const tint1 = colorEl(rgbToHex(initial.tint1));
  root.appendChild(row('Tint 1', tint1));
  tint1.addEventListener('input', () => cb.onTint1(hexToRgb(tint1.value)));
  const tint2 = colorEl(rgbToHex(initial.tint2));
  root.appendChild(row('Tint 2', tint2));
  tint2.addEventListener('input', () => cb.onTint2(hexToRgb(tint2.value)));
  const paletteRow = document.createElement('div');
  paletteRow.className = 'row';
  for (const [a, b] of PALETTES) {
    const btn = document.createElement('button');
    btn.textContent = ' ';
    btn.title = `${a} / ${b}`;
    btn.style.background = `linear-gradient(90deg, ${a}, ${b})`;
    btn.style.height = '22px';
    btn.style.border = '1px solid var(--border)';
    btn.addEventListener('click', () => {
      tint1.value = a; tint2.value = b;
      cb.onTint1(hexToRgb(a)); cb.onTint2(hexToRgb(b));
    });
    paletteRow.appendChild(btn);
  }
  root.appendChild(paletteRow);

  const speed = rangeEl(initial.speed, 0, 3, 0.05);
  root.appendChild(row('Speed', speed));
  speed.addEventListener('input', () => cb.onSpeed(+speed.value));
  const scale = rangeEl(initial.scale, 0.1, 4, 0.05);
  root.appendChild(row('Scale', scale));
  scale.addEventListener('input', () => cb.onScale(+scale.value));

  const brightness = rangeEl(0.5, 0, 1, 0.01);
  root.appendChild(row('Brightness', brightness));
  brightness.addEventListener('input', () => cb.onBrightness(+brightness.value));

  const pointSize = rangeEl(4.5, 1, 12, 0.1);
  root.appendChild(row('Point size', pointSize));
  pointSize.addEventListener('input', () => cb.onPointSize(+pointSize.value));

  const wires = checkEl(false);
  root.appendChild(row('Show strip wires', wires));
  wires.addEventListener('change', () => cb.onShowWires(wires.checked));

  root.appendChild(hr());
  root.appendChild(h2('Audio source'));

  const synthKind = selectEl(['sine', 'square', 'sawtooth', 'triangle', 'noise', 'sweep', 'drum'], 'drum');
  root.appendChild(row('Synth type', synthKind));
  const synthFreq = numEl(440, 20, 12000, 1);
  root.appendChild(row('Freq (Hz)', synthFreq));
  const synthMon = rangeEl(0, 0, 0.3, 0.005);
  root.appendChild(row('Monitor vol', synthMon));
  const synthRow = document.createElement('div');
  synthRow.className = 'row';
  const synthStart = button('Start synth', 'primary');
  const synthStop = button('Stop');
  synthRow.appendChild(synthStart);
  synthRow.appendChild(synthStop);
  root.appendChild(synthRow);
  synthStart.addEventListener('click', () => cb.onAudioSynth({
    kind: synthKind.value as SynthKind,
    freq: +synthFreq.value,
    monitor: +synthMon.value,
  }));
  synthStop.addEventListener('click', () => cb.onAudioStop());
  synthFreq.addEventListener('input', () => cb.onSynthFreq(+synthFreq.value));
  synthMon.addEventListener('input', () => cb.onSynthMonitor(+synthMon.value));

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*';
  root.appendChild(row('File', fileInput));
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) cb.onAudioFile(f);
  });
  const micBtn = button('Use mic');
  root.appendChild(micBtn);
  micBtn.addEventListener('click', () => cb.onAudioMic());
  const beatSens = rangeEl(1.4, 1.05, 2.5, 0.05);
  root.appendChild(row('Beat sensitivity', beatSens));
  beatSens.addEventListener('input', () => cb.onBeatSensitivity(+beatSens.value));

  root.appendChild(hr());
  root.appendChild(h2('Electrical'));
  const elecOn = checkEl(false);
  root.appendChild(row('Voltage heatmap', elecOn));
  elecOn.addEventListener('change', () => cb.onElectricalToggle(elecOn.checked));

  const vInj = numEl(electrical.vInjection, 3, 24, 0.5);
  root.appendChild(row('V injection', vInj));
  const rPerM = numEl(electrical.rPerMeter, 0.05, 2, 0.01);
  root.appendChild(row('Ω/m (one conductor)', rPerM));
  const iMax = numEl(electrical.maxCurrentPerLED * 1000, 5, 80, 1);
  root.appendChild(row('mA/LED peak', iMax));
  const injMode = selectEl(['top', 'top-bottom', 'every-1m'], electrical.injectionMode);
  root.appendChild(row('Injection', injMode));
  const maxInj = numEl(electrical.maxInjectionAmps, 1, 50, 0.5);
  root.appendChild(row('Max A / injection', maxInj));
  const brownV = numEl(electrical.brownoutVolts, 3, 20, 0.1);
  root.appendChild(row('Brownout V', brownV));

  function gatherElec(): ElectricalConfig {
    return {
      vInjection: +vInj.value,
      rPerMeter: +rPerM.value,
      maxCurrentPerLED: +iMax.value / 1000,
      injectionMode: injMode.value as ElectricalConfig['injectionMode'],
      maxInjectionAmps: +maxInj.value,
      brownoutVolts: +brownV.value,
    };
  }
  for (const n of [vInj, rPerM, iMax, maxInj, brownV]) {
    n.addEventListener('change', () => cb.onElectricalChange(gatherElec()));
  }
  injMode.addEventListener('change', () => cb.onElectricalChange(gatherElec()));

  root.appendChild(hr());
  root.appendChild(h2('Export'));
  const eRow = document.createElement('div');
  eRow.className = 'row';
  const eMap = button('Pixel map');
  const eE131 = button('E1.31 config');
  const ePwr = button('Power report');
  eRow.appendChild(eMap);
  eRow.appendChild(eE131);
  eRow.appendChild(ePwr);
  root.appendChild(eRow);
  eMap.addEventListener('click', () => cb.onExportPixelMap());
  eE131.addEventListener('click', () => cb.onExportE131());
  ePwr.addEventListener('click', () => cb.onExportPowerReport());

  return {
    el: root,
    setCount(n: number, meters: number, estAmps: number) {
      const kc = root.querySelector('#k-count');
      const km = root.querySelector('#k-meters');
      const ka = root.querySelector('#k-amps');
      if (kc) kc.textContent = n.toLocaleString();
      if (km) km.textContent = `${meters.toFixed(1)} m`;
      if (ka) ka.textContent = `${estAmps.toFixed(0)} A`;
    },
  };
}

export function updateStats(el: HTMLElement, fps: number, pixels: number, amps: number, worstV: number, brown: number, showElec: boolean) {
  el.innerHTML = `
    <div class="kv">
      <span class="k">FPS</span><span>${fps.toFixed(0)}</span>
      <span class="k">Pixels</span><span>${pixels.toLocaleString()}</span>
      ${showElec ? `
        <span class="k">Draw</span><span class="${amps > 1000 ? 'warn' : ''}">${amps.toFixed(1)} A</span>
        <span class="k">Worst V</span><span class="${worstV < 9 ? 'bad' : worstV < 10.5 ? 'warn' : ''}">${worstV.toFixed(2)} V</span>
        <span class="k">Brownout</span><span class="${brown > 0 ? 'bad' : ''}">${brown}</span>
      ` : ''}
    </div>
  `;
}

const PALETTES: Array<[string, string]> = [
  ['#ff2a6d', '#05d9e8'],
  ['#ff7a00', '#ffd166'],
  ['#00f5a0', '#00d9f5'],
  ['#7b2cbf', '#c77dff'],
  ['#ff006e', '#3a86ff'],
  ['#ffffff', '#4444ff'],
];

function rgbToHex(c: [number, number, number]): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0');
  return `#${to(c[0])}${to(c[1])}${to(c[2])}`;
}
function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function h2(text: string) {
  const el = document.createElement('h2');
  el.textContent = text;
  return el;
}
function hr() {
  return document.createElement('hr');
}
function row(label: string, input: HTMLElement) {
  const l = document.createElement('label');
  const s = document.createElement('span');
  s.textContent = label;
  l.appendChild(s);
  l.appendChild(input);
  return l;
}
function selectEl(opts: string[], value: string) {
  const s = document.createElement('select');
  for (const o of opts) {
    const opt = document.createElement('option');
    opt.value = o;
    opt.textContent = o;
    s.appendChild(opt);
  }
  s.value = value;
  return s;
}
function numEl(value: number, min: number, max: number, step: number) {
  const i = document.createElement('input');
  i.type = 'number';
  i.value = String(value);
  i.min = String(min);
  i.max = String(max);
  i.step = String(step);
  i.style.width = '80px';
  return i;
}
function rangeEl(value: number, min: number, max: number, step: number) {
  const i = document.createElement('input');
  i.type = 'range';
  i.value = String(value);
  i.min = String(min);
  i.max = String(max);
  i.step = String(step);
  return i;
}
function checkEl(value: boolean) {
  const i = document.createElement('input');
  i.type = 'checkbox';
  i.checked = value;
  return i;
}
function inputEl(value: string) {
  const i = document.createElement('input');
  i.type = 'text';
  i.value = value;
  i.style.width = '120px';
  return i;
}
function colorEl(value: string) {
  const i = document.createElement('input');
  i.type = 'color';
  i.value = value;
  i.style.width = '40px';
  i.style.height = '22px';
  i.style.padding = '0';
  i.style.background = 'transparent';
  i.style.border = 'none';
  return i;
}
function button(label: string, cls = ''): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  return b;
}
