import type { AudioFrame } from './types';

export interface Scope {
  root: HTMLElement;
  setVisible(v: boolean): void;
  draw(frame: AudioFrame): void;
}

export function createScope(root: HTMLElement): Scope {
  const waveCanvas = root.querySelector('#scope-wave') as HTMLCanvasElement;
  const fftCanvas = root.querySelector('#scope-fft') as HTMLCanvasElement;
  const specCanvas = root.querySelector('#scope-spec') as HTMLCanvasElement | null;
  const wctx = waveCanvas.getContext('2d')!;
  const fctx = fftCanvas.getContext('2d')!;
  const sctx = specCanvas ? specCanvas.getContext('2d')! : null;

  const dpr = Math.min(window.devicePixelRatio, 2);
  for (const c of [waveCanvas, fftCanvas, specCanvas].filter(Boolean) as HTMLCanvasElement[]) {
    const cssW = c.clientWidth || 280;
    const cssH = c.clientHeight || 64;
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
  }

  // Spectrogram scroll buffer (offscreen canvas we shift left each frame)
  let specBuf: HTMLCanvasElement | null = null;
  let sbctx: CanvasRenderingContext2D | null = null;
  if (specCanvas && sctx) {
    specBuf = document.createElement('canvas');
    specBuf.width = specCanvas.width;
    specBuf.height = specCanvas.height;
    sbctx = specBuf.getContext('2d')!;
    sbctx.fillStyle = '#07070a';
    sbctx.fillRect(0, 0, specBuf.width, specBuf.height);
  }

  // Color ramp: black → blue → cyan → yellow → red
  function magToColor(m: number, out: [number, number, number]) {
    const v = Math.max(0, Math.min(1, m));
    if (v < 0.25) {
      const u = v / 0.25;
      out[0] = 0; out[1] = 0; out[2] = u * 0.7;
    } else if (v < 0.5) {
      const u = (v - 0.25) / 0.25;
      out[0] = 0; out[1] = u * 0.9; out[2] = 0.7 + u * 0.3;
    } else if (v < 0.75) {
      const u = (v - 0.5) / 0.25;
      out[0] = u; out[1] = 0.9; out[2] = 1 - u;
    } else {
      const u = (v - 0.75) / 0.25;
      out[0] = 1; out[1] = 0.9 - u * 0.7; out[2] = 0;
    }
  }

  const colorOut: [number, number, number] = [0, 0, 0];

  return {
    root,
    setVisible(v: boolean) {
      root.classList.toggle('on', v);
    },
    draw(frame: AudioFrame) {
      // ─── Waveform ───
      const ww = waveCanvas.width;
      const wh = waveCanvas.height;
      wctx.clearRect(0, 0, ww, wh);
      // grid
      wctx.strokeStyle = '#1f1f26';
      wctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (i / 4) * wh;
        wctx.beginPath();
        wctx.moveTo(0, y);
        wctx.lineTo(ww, y);
        wctx.stroke();
      }
      wctx.strokeStyle = '#2a2a31';
      wctx.beginPath();
      wctx.moveTo(0, wh / 2);
      wctx.lineTo(ww, wh / 2);
      wctx.stroke();

      const wf = frame.waveform;
      // Draw glow underlay then sharp line (cheap bloom effect)
      wctx.strokeStyle = frame.beat ? 'rgba(255,200,100,0.35)' : 'rgba(124,224,255,0.35)';
      wctx.lineWidth = 4 * dpr;
      wctx.beginPath();
      for (let i = 0; i < wf.length; i++) {
        const x = (i / (wf.length - 1)) * ww;
        const y = wh / 2 - wf[i] * (wh / 2) * 0.92;
        if (i === 0) wctx.moveTo(x, y);
        else wctx.lineTo(x, y);
      }
      wctx.stroke();
      wctx.strokeStyle = frame.beat ? '#ffcc66' : '#7ce0ff';
      wctx.lineWidth = 1.5 * dpr;
      wctx.beginPath();
      for (let i = 0; i < wf.length; i++) {
        const x = (i / (wf.length - 1)) * ww;
        const y = wh / 2 - wf[i] * (wh / 2) * 0.92;
        if (i === 0) wctx.moveTo(x, y);
        else wctx.lineTo(x, y);
      }
      wctx.stroke();

      // ─── FFT bars ───
      const fw = fftCanvas.width;
      const fh = fftCanvas.height;
      fctx.fillStyle = '#07070a';
      fctx.fillRect(0, 0, fw, fh);
      const bands = frame.fft;
      const gap = Math.max(1, dpr);
      const barW = (fw - (bands.length - 1) * gap) / bands.length;
      for (let i = 0; i < bands.length; i++) {
        const mag = Math.min(1, bands[i]);
        const h = Math.max(1, mag * fh);
        magToColor(mag * 0.85 + 0.15, colorOut);
        const r = (colorOut[0] * 255) | 0;
        const g = (colorOut[1] * 255) | 0;
        const b = (colorOut[2] * 255) | 0;
        fctx.fillStyle = `rgb(${r},${g},${b})`;
        fctx.fillRect(i * (barW + gap), fh - h, barW, h);
      }
      fctx.fillStyle = '#a0a0a8';
      fctx.font = `${10 * dpr}px ui-monospace, Menlo, Consolas, monospace`;
      fctx.fillText(
        `B ${frame.bass.toFixed(2)}  M ${frame.mid.toFixed(2)}  T ${frame.treble.toFixed(2)}`,
        4 * dpr,
        12 * dpr,
      );

      // ─── Scrolling spectrogram ───
      if (specCanvas && sctx && specBuf && sbctx) {
        const sw = specCanvas.width;
        const sh = specCanvas.height;
        const colW = Math.max(1, Math.round(2 * dpr));
        // Shift buffer left by colW
        sbctx.drawImage(specBuf, -colW, 0);
        sbctx.fillStyle = '#07070a';
        sbctx.fillRect(sw - colW, 0, colW, sh);
        // Paint new column from FFT (low freq at bottom)
        const cellH = sh / bands.length;
        for (let i = 0; i < bands.length; i++) {
          const mag = Math.min(1, bands[i]);
          if (mag < 0.02) continue;
          magToColor(mag, colorOut);
          const r = (colorOut[0] * 255) | 0;
          const g = (colorOut[1] * 255) | 0;
          const b = (colorOut[2] * 255) | 0;
          sbctx.fillStyle = `rgb(${r},${g},${b})`;
          const y = sh - (i + 1) * cellH;
          sbctx.fillRect(sw - colW, y, colW, Math.ceil(cellH));
        }
        sctx.drawImage(specBuf, 0, 0);
      }
    },
  };
}
