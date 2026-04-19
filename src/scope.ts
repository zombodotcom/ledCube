import type { AudioFrame } from './types';

export interface Scope {
  root: HTMLElement;
  setVisible(v: boolean): void;
  draw(frame: AudioFrame): void;
}

export function createScope(root: HTMLElement): Scope {
  const waveCanvas = root.querySelector('#scope-wave') as HTMLCanvasElement;
  const fftCanvas = root.querySelector('#scope-fft') as HTMLCanvasElement;
  const wctx = waveCanvas.getContext('2d')!;
  const fctx = fftCanvas.getContext('2d')!;

  const dpr = Math.min(window.devicePixelRatio, 2);
  for (const c of [waveCanvas, fftCanvas]) {
    const cssW = c.clientWidth || 240;
    const cssH = c.clientHeight || 64;
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
  }

  return {
    root,
    setVisible(v: boolean) {
      root.classList.toggle('on', v);
    },
    draw(frame: AudioFrame) {
      const ww = waveCanvas.width;
      const wh = waveCanvas.height;
      wctx.clearRect(0, 0, ww, wh);
      wctx.strokeStyle = '#2a2a31';
      wctx.lineWidth = 1;
      wctx.beginPath();
      wctx.moveTo(0, wh / 2);
      wctx.lineTo(ww, wh / 2);
      wctx.stroke();

      wctx.strokeStyle = frame.beat ? '#fc6' : '#7cf';
      wctx.lineWidth = 1.5 * dpr;
      wctx.beginPath();
      const wf = frame.waveform;
      for (let i = 0; i < wf.length; i++) {
        const x = (i / (wf.length - 1)) * ww;
        const y = wh / 2 - wf[i] * (wh / 2) * 0.9;
        if (i === 0) wctx.moveTo(x, y);
        else wctx.lineTo(x, y);
      }
      wctx.stroke();

      const fw = fftCanvas.width;
      const fh = fftCanvas.height;
      fctx.clearRect(0, 0, fw, fh);
      const bands = frame.fft;
      const gap = Math.max(1, dpr);
      const barW = (fw - (bands.length - 1) * gap) / bands.length;
      for (let i = 0; i < bands.length; i++) {
        const mag = bands[i];
        const h = Math.max(1, mag * fh);
        const hue = i / bands.length;
        const r = Math.floor(255 * (0.5 + 0.5 * Math.sin(6.283 * hue)));
        const g = Math.floor(255 * (0.5 + 0.5 * Math.sin(6.283 * (hue + 0.333))));
        const b = Math.floor(255 * (0.5 + 0.5 * Math.sin(6.283 * (hue + 0.666))));
        fctx.fillStyle = `rgb(${r},${g},${b})`;
        fctx.fillRect(i * (barW + gap), fh - h, barW, h);
      }

      fctx.fillStyle = '#8a8a94';
      fctx.font = `${10 * dpr}px ui-monospace, Menlo, Consolas, monospace`;
      fctx.fillText(`B ${frame.bass.toFixed(2)}  M ${frame.mid.toFixed(2)}  T ${frame.treble.toFixed(2)}`, 4 * dpr, 12 * dpr);
    },
  };
}
