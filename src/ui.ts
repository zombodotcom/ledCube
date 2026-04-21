import type { ElectricalConfig } from './electrical';
import type { LayoutConfig, PatternCategory, ScaleName, SynthKind } from './types';
import { PALETTES, PALETTE_NAMES, type PaletteName } from './palettes';

export interface UICallbacks {
  onLayoutChange(cfg: LayoutConfig): void;
  onPatternChange(key: string): void;
  onOpenEditor(): void;
  onPointSize(size: number): void;
  onShowWires(show: boolean): void;
  onGlow(on: boolean): void;
  onGlowStrength(s: number): void;
  onBrightness(b: number): void;
  onAudioFile(file: File): void;
  onAudioMidi(file: File): void;
  onAudioMic(): void;
  onAudioTabCapture(): void;
  onYouTubeUrl(url: string): void;
  onYouTubeAnalyze(url: string): void;
  onAudioSynth(opts: { kind: SynthKind; freq: number; monitor: number; scale: ScaleName }): void;
  onSynthFreq(freq: number): void;
  onSynthMonitor(g: number): void;
  onAudioStop(): void;
  onAudioSeek(sec: number): void;
  onAudioLoop(loop: boolean): void;
  onAudioPlayPause(playing: boolean): void;
  onMicGain(gain: number): void;
  onBeatSensitivity(mul: number): void;
  onTint1(c: [number, number, number]): void;
  onTint2(c: [number, number, number]): void;
  onPalette(name: PaletteName): void;
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
  setAudioStatus(s: { kind: string; detail: string; currentSec: number; durationSec: number; loop: boolean }): void;
  setActivePattern(key: string): void;
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
  patterns: Record<string, { name: string; category: PatternCategory; description: string }>,
  activePatternKey: string,
  electrical: ElectricalConfig,
  initial: UIInitialState,
  cb: UICallbacks,
): UIHandles {
  root.innerHTML = '';
  let cur: HTMLElement = root;

  function section(title: string, key: string, defaultOpen: boolean): HTMLElement {
    const d = document.createElement('details');
    d.className = 'section';
    const stored = localStorage.getItem(`sec:${key}`);
    d.open = stored === null ? defaultOpen : stored === 'open';
    const s = document.createElement('summary');
    s.textContent = title;
    d.appendChild(s);
    const body = document.createElement('div');
    body.className = 'section-body';
    d.appendChild(body);
    root.appendChild(d);
    d.addEventListener('toggle', () => {
      localStorage.setItem(`sec:${key}`, d.open ? 'open' : 'closed');
    });
    cur = body;
    return body;
  }

  const summary = document.createElement('div');
  summary.className = 'kv';
  summary.innerHTML = `
    <span class="k">Pixels</span><span id="k-count">0</span>
    <span class="k">Total strip</span><span id="k-meters">0 m</span>
    <span class="k">Est. full-white</span><span id="k-amps">0 A</span>
  `;
  root.appendChild(summary);

  section('Layout', 'layout', false);
  const modeSel = selectEl(['uniform', 'varied', 'freeform'], layout.mode);
  cur.appendChild(row('Mode', modeSel));
  const gridN = numEl(layout.gridN, 1, 40, 1);
  cur.appendChild(row('Grid N × N', gridN));
  const spacing = numEl(layout.spacing_m, 0.05, 2, 0.05);
  cur.appendChild(row('Spacing (m)', spacing));
  const lengths = inputEl(layout.lengths_m.join(','));
  cur.appendChild(row('Lengths (m, csv)', lengths));
  const density = numEl(layout.density, 30, 144, 1);
  cur.appendChild(row('LEDs / m', density));
  const seed = numEl(layout.seed, 0, 99999, 1);
  cur.appendChild(row('Seed', seed));
  const freeform = document.createElement('textarea');
  freeform.placeholder = '{ "strips": [{ "id": "s0", "top": [0,0,5], "length_m": 5, "led_density": 60, "led_type": "WS2815" }] }';
  freeform.style.display = layout.mode === 'freeform' ? 'block' : 'none';
  freeform.style.width = '100%';
  freeform.style.height = '80px';
  freeform.value = layout.freeformJson ?? '';
  cur.appendChild(freeform);
  const applyBtn = button('Rebuild layout', 'primary');
  cur.appendChild(applyBtn);

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

  section('Pattern', 'pattern', true);
  const patListWrap = document.createElement('div');
  patListWrap.className = 'pattern-list';
  cur.appendChild(patListWrap);
  const patButtons = new Map<string, HTMLButtonElement>();

  function rebuildPatternList() {
    patListWrap.innerHTML = '';
    patButtons.clear();
    const byCat = new Map<PatternCategory, Array<[string, { name: string; description: string }]>>();
    for (const [k, e] of Object.entries(patterns)) {
      const arr = byCat.get(e.category) ?? [];
      arr.push([k, e]);
      byCat.set(e.category, arr);
    }
    for (const cat of CATEGORY_ORDER) {
      const items = byCat.get(cat);
      if (!items?.length) continue;
      const label = document.createElement('div');
      label.className = 'pattern-cat';
      label.textContent = CATEGORY_LABEL[cat];
      patListWrap.appendChild(label);
      for (const [key, e] of items) {
        const btn = document.createElement('button');
        btn.className = 'pattern-btn' + (key === activePatternKey ? ' active' : '');
        btn.innerHTML = `<div class="pname">${e.name}</div><div class="pdesc">${e.description}</div>`;
        btn.addEventListener('click', () => {
          setActive(key);
          cb.onPatternChange(key);
        });
        patListWrap.appendChild(btn);
        patButtons.set(key, btn);
      }
    }
  }
  function setActive(key: string) {
    activePatternKey = key;
    for (const [k, b] of patButtons) b.classList.toggle('active', k === key);
  }
  rebuildPatternList();

  const editBtn = button('Edit source…');
  editBtn.style.marginTop = '6px';
  cur.appendChild(editBtn);
  editBtn.addEventListener('click', () => cb.onOpenEditor());

  const tint1 = colorEl(rgbToHex(initial.tint1));
  const tint2 = colorEl(rgbToHex(initial.tint2));
  const customRow = document.createElement('div');
  customRow.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 6px 0; font-size: 12px; color: var(--muted);';
  customRow.innerHTML = '<span>Custom colors</span>';
  customRow.appendChild(tint1);
  customRow.appendChild(tint2);
  cur.appendChild(customRow);
  tint1.addEventListener('input', () => {
    cb.onTint1(hexToRgb(tint1.value));
    paletteSel.value = 'custom';
    cb.onPalette('custom');
    updatePalettePreview('custom', tint1.value, tint2.value);
  });
  tint2.addEventListener('input', () => {
    cb.onTint2(hexToRgb(tint2.value));
    paletteSel.value = 'custom';
    cb.onPalette('custom');
    updatePalettePreview('custom', tint1.value, tint2.value);
  });

  // Palette picker with preview swatches
  const palLabel = document.createElement('label');
  palLabel.innerHTML = '<span>Palette</span>';
  const paletteSel = document.createElement('select');
  for (const name of PALETTE_NAMES) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    paletteSel.appendChild(opt);
  }
  paletteSel.value = 'custom';
  palLabel.appendChild(paletteSel);
  cur.appendChild(palLabel);

  const palPreview = document.createElement('div');
  palPreview.style.cssText = 'height: 18px; border-radius: 4px; border: 1px solid var(--border); margin: 2px 0 6px;';
  cur.appendChild(palPreview);

  // Scrollable grid of all palette thumbnails for quick visual selection
  const palGrid = document.createElement('div');
  palGrid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 8px;';
  for (const name of PALETTE_NAMES) {
    const thumb = document.createElement('button');
    thumb.title = name;
    thumb.style.cssText = 'height: 22px; padding: 0; border: 1px solid var(--border); border-radius: 3px; min-height: 0;';
    thumb.style.background = paletteToCss(name, tint1.value, tint2.value);
    thumb.addEventListener('click', () => {
      paletteSel.value = name;
      cb.onPalette(name);
      updatePalettePreview(name, tint1.value, tint2.value);
    });
    palGrid.appendChild(thumb);
  }
  cur.appendChild(palGrid);

  function updatePalettePreview(name: PaletteName, a: string, b: string) {
    palPreview.style.background = paletteToCss(name, a, b);
  }
  updatePalettePreview('custom', tint1.value, tint2.value);

  paletteSel.addEventListener('change', () => {
    const name = paletteSel.value as PaletteName;
    cb.onPalette(name);
    updatePalettePreview(name, tint1.value, tint2.value);
  });

  const speed = rangeEl(initial.speed, 0, 3, 0.05);
  cur.appendChild(row('Speed', speed));
  speed.addEventListener('input', () => cb.onSpeed(+speed.value));
  const scale = rangeEl(initial.scale, 0.1, 4, 0.05);
  cur.appendChild(row('Scale', scale));
  scale.addEventListener('input', () => cb.onScale(+scale.value));

  // Brightness slider uses linear 0..1 UI but main.ts applies (slider*slider) gamma
  const brightness = rangeEl(0.55, 0, 1, 0.01);
  cur.appendChild(row('Brightness', brightness));
  brightness.addEventListener('input', () => cb.onBrightness(+brightness.value));

  const pointSize = rangeEl(4.5, 1, 12, 0.1);
  cur.appendChild(row('Point size', pointSize));
  pointSize.addEventListener('input', () => cb.onPointSize(+pointSize.value));

  const wires = checkEl(false);
  cur.appendChild(row('Show strip wires', wires));
  wires.addEventListener('change', () => cb.onShowWires(wires.checked));

  const glow = checkEl(false);
  cur.appendChild(row('Glow (bloom)', glow));
  glow.addEventListener('change', () => cb.onGlow(glow.checked));
  const glowStrength = rangeEl(0.9, 0, 2.5, 0.05);
  cur.appendChild(row('Glow strength', glowStrength));
  glowStrength.addEventListener('input', () => cb.onGlowStrength(+glowStrength.value));

  section('Audio source', 'audio', true);

  const statusBadge = document.createElement('div');
  statusBadge.className = 'audio-status';
  statusBadge.innerHTML = '<span class="dot off">◎</span> <span class="label">Stopped</span>';
  cur.appendChild(statusBadge);

  // Timeline (shown for file + midi sources)
  const timelineWrap = document.createElement('div');
  timelineWrap.className = 'timeline-wrap';
  timelineWrap.style.display = 'none';
  const timelineRow = document.createElement('div');
  timelineRow.style.cssText = 'display: flex; align-items: center; gap: 6px; margin: 6px 0;';
  const playBtn = button('⏯');
  playBtn.style.cssText = 'padding: 4px 10px; min-width: 40px;';
  const loopBtn = button('↻');
  loopBtn.style.cssText = 'padding: 4px 10px; min-width: 40px;';
  loopBtn.title = 'Loop';
  const seekSlider = rangeEl(0, 0, 1, 0.001);
  seekSlider.style.flex = '1';
  const timeLabel = document.createElement('span');
  timeLabel.style.cssText = 'font-size: 10px; color: var(--muted); min-width: 72px; text-align: right;';
  timeLabel.textContent = '0:00 / 0:00';
  timelineRow.appendChild(playBtn);
  timelineRow.appendChild(loopBtn);
  timelineRow.appendChild(seekSlider);
  timelineRow.appendChild(timeLabel);
  timelineWrap.appendChild(timelineRow);
  cur.appendChild(timelineWrap);

  let playing = true;
  playBtn.addEventListener('click', () => {
    playing = !playing;
    cb.onAudioPlayPause(playing);
  });
  let loopOn = false;
  loopBtn.addEventListener('click', () => {
    loopOn = !loopOn;
    loopBtn.classList.toggle('primary', loopOn);
    cb.onAudioLoop(loopOn);
  });
  let userDragging = false;
  seekSlider.addEventListener('pointerdown', () => { userDragging = true; });
  seekSlider.addEventListener('pointerup', () => { userDragging = false; });
  seekSlider.addEventListener('change', () => {
    cb.onAudioSeek(+seekSlider.value);
  });

  const synthKind = selectEl(
    ['drum', 'chord', 'arpeggio', 'pluck', 'siren', 'fmBell', 'bassDrop', 'sweep', 'sine', 'square', 'sawtooth', 'triangle', 'noise'],
    'drum',
  );
  cur.appendChild(row('Synth type', synthKind));
  const synthScale = selectEl(['major', 'minor', 'pentatonic', 'blues', 'chromatic'], 'major');
  cur.appendChild(row('Scale', synthScale));
  const synthFreq = numEl(220, 20, 12000, 1);
  cur.appendChild(row('Root / Freq (Hz)', synthFreq));
  const synthMon = rangeEl(0, 0, 0.3, 0.005);
  cur.appendChild(row('Monitor vol', synthMon));
  const synthRow = document.createElement('div');
  synthRow.className = 'row';
  const synthStart = button('Start synth', 'primary');
  const synthStop = button('Stop');
  synthRow.appendChild(synthStart);
  synthRow.appendChild(synthStop);
  cur.appendChild(synthRow);
  synthStart.addEventListener('click', () => cb.onAudioSynth({
    kind: synthKind.value as SynthKind,
    freq: +synthFreq.value,
    monitor: +synthMon.value,
    scale: synthScale.value as ScaleName,
  }));
  synthStop.addEventListener('click', () => cb.onAudioStop());
  synthFreq.addEventListener('input', () => cb.onSynthFreq(+synthFreq.value));
  synthMon.addEventListener('input', () => cb.onSynthMonitor(+synthMon.value));

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*';
  cur.appendChild(row('Audio file', fileInput));
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) cb.onAudioFile(f);
  });
  const midiInput = document.createElement('input');
  midiInput.type = 'file';
  midiInput.accept = '.mid,.midi,audio/midi,audio/x-midi';
  cur.appendChild(row('MIDI file', midiInput));
  midiInput.addEventListener('change', () => {
    const f = midiInput.files?.[0];
    if (f) cb.onAudioMidi(f);
  });
  const micRow = document.createElement('div');
  micRow.className = 'row';
  const micBtn = button('Use mic');
  const tabBtn = button('Capture tab audio');
  tabBtn.title = 'Share a browser tab with "Share tab audio" checked — works with YouTube, Spotify Web, etc.';
  micRow.appendChild(micBtn);
  micRow.appendChild(tabBtn);
  cur.appendChild(micRow);
  micBtn.addEventListener('click', () => cb.onAudioMic());
  tabBtn.addEventListener('click', () => cb.onAudioTabCapture());
  const micGain = rangeEl(3, 0, 15, 0.1);
  cur.appendChild(row('Mic gain', micGain));
  micGain.addEventListener('input', () => cb.onMicGain(+micGain.value));

  // YouTube URL — two modes: inline iframe (watch only), or new tab + analyze
  const ytInput = document.createElement('input');
  ytInput.type = 'text';
  ytInput.placeholder = 'YouTube URL…';
  ytInput.style.cssText = 'width: 100%;';
  cur.appendChild(row('YouTube', ytInput));
  const ytBtnRow = document.createElement('div');
  ytBtnRow.className = 'row';
  const ytInline = button('Watch here');
  ytInline.title = 'Opens in a floating player inside this tab (no audio analysis)';
  const ytAnalyze = button('Open + analyze', 'primary');
  ytAnalyze.title = 'Opens YouTube in a new tab and prompts to share that tab (with audio) for analysis';
  ytBtnRow.appendChild(ytInline);
  ytBtnRow.appendChild(ytAnalyze);
  cur.appendChild(ytBtnRow);
  const ytHint = document.createElement('div');
  ytHint.style.cssText = 'font-size: 10px; color: var(--muted); margin: 4px 2px 6px; line-height: 1.4;';
  ytHint.innerHTML = '<b>Open + analyze</b> opens YouTube in a new tab, then asks you to share it. <b>Tick "Share tab audio"</b> at the bottom of the dialog or no audio will be captured.';
  cur.appendChild(ytHint);
  ytInline.addEventListener('click', () => {
    const v = ytInput.value.trim();
    if (v) cb.onYouTubeUrl(v);
  });
  ytAnalyze.addEventListener('click', () => {
    const v = ytInput.value.trim();
    if (v) cb.onYouTubeAnalyze(v);
  });
  ytInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && ytInput.value.trim()) cb.onYouTubeAnalyze(ytInput.value.trim());
  });
  const beatSens = rangeEl(1.4, 1.05, 2.5, 0.05);
  cur.appendChild(row('Beat sensitivity', beatSens));
  beatSens.addEventListener('input', () => cb.onBeatSensitivity(+beatSens.value));

  section('Electrical', 'electrical', false);
  const elecOn = checkEl(false);
  cur.appendChild(row('Voltage heatmap', elecOn));
  elecOn.addEventListener('change', () => cb.onElectricalToggle(elecOn.checked));

  const vInj = numEl(electrical.vInjection, 3, 24, 0.5);
  cur.appendChild(row('V injection', vInj));
  const rPerM = numEl(electrical.rPerMeter, 0.05, 2, 0.01);
  cur.appendChild(row('Ω/m (one conductor)', rPerM));
  const iMax = numEl(electrical.maxCurrentPerLED * 1000, 5, 80, 1);
  cur.appendChild(row('mA/LED peak', iMax));
  const injMode = selectEl(['top', 'top-bottom', 'every-1m'], electrical.injectionMode);
  cur.appendChild(row('Injection', injMode));
  const maxInj = numEl(electrical.maxInjectionAmps, 1, 50, 0.5);
  cur.appendChild(row('Max A / injection', maxInj));
  const brownV = numEl(electrical.brownoutVolts, 3, 20, 0.1);
  cur.appendChild(row('Brownout V', brownV));

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

  section('Export', 'export', false);
  const eRow = document.createElement('div');
  eRow.className = 'row';
  const eMap = button('Pixel map');
  const eE131 = button('E1.31 config');
  const ePwr = button('Power report');
  eRow.appendChild(eMap);
  eRow.appendChild(eE131);
  eRow.appendChild(ePwr);
  cur.appendChild(eRow);
  eMap.addEventListener('click', () => cb.onExportPixelMap());
  eE131.addEventListener('click', () => cb.onExportE131());
  ePwr.addEventListener('click', () => cb.onExportPowerReport());

  function fmtTime(sec: number): string {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

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
    setAudioStatus(s) {
      const dot = statusBadge.querySelector('.dot') as HTMLElement | null;
      const label = statusBadge.querySelector('.label') as HTMLElement | null;
      if (s.kind === 'none') {
        dot?.classList.add('off');
        dot?.classList.remove('on');
        if (dot) dot.textContent = '◎';
        if (label) label.textContent = 'Stopped';
        timelineWrap.style.display = 'none';
      } else {
        dot?.classList.remove('off');
        dot?.classList.add('on');
        if (dot) dot.textContent = '▶';
        const kindLabel = s.kind.charAt(0).toUpperCase() + s.kind.slice(1);
        if (label) label.textContent = `${kindLabel} · ${s.detail}`;
        const hasTimeline = (s.kind === 'file' || s.kind === 'midi') && s.durationSec > 0;
        timelineWrap.style.display = hasTimeline ? 'block' : 'none';
        if (hasTimeline) {
          if (!userDragging) {
            seekSlider.min = '0';
            seekSlider.max = String(s.durationSec);
            seekSlider.step = '0.01';
            seekSlider.value = String(s.currentSec);
          }
          timeLabel.textContent = `${fmtTime(s.currentSec)} / ${fmtTime(s.durationSec)}`;
          loopBtn.classList.toggle('primary', s.loop);
        }
      }
    },
    setActivePattern(key: string) {
      setActive(key);
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

function paletteToCss(name: PaletteName, tint1Hex: string, tint2Hex: string): string {
  const stops =
    name === 'custom'
      ? [tint1Hex, tint1Hex, tint2Hex, tint2Hex]
      : PALETTES[name].map(([r, g, b]) => `rgb(${(r*255)|0},${(g*255)|0},${(b*255)|0})`);
  const pct = stops.map((c, i) => `${c} ${Math.round(i / (stops.length - 1) * 100)}%`).join(', ');
  return `linear-gradient(90deg, ${pct})`;
}

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
const CATEGORY_LABEL: Record<PatternCategory, string> = {
  ambient: 'Ambient',
  generative: 'Generative',
  audio: 'Audio-reactive',
  beat: 'Beat-driven',
  static: 'Static',
};
const CATEGORY_ORDER: PatternCategory[] = ['ambient', 'generative', 'audio', 'beat', 'static'];
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
