export function computeBandBinRanges(
  nBands: number,
  binCount: number,
  sampleRate: number,
  loHz: number,
  hiHz: number,
): [number, number][] {
  const nyquist = sampleRate / 2;
  const logLo = Math.log(loHz);
  const logHi = Math.log(hiHz);
  const ranges: [number, number][] = [];
  for (let b = 0; b < nBands; b++) {
    const f0 = Math.exp(logLo + (logHi - logLo) * (b / nBands));
    const f1 = Math.exp(logLo + (logHi - logLo) * ((b + 1) / nBands));
    const bin0 = Math.max(0, Math.floor((f0 / nyquist) * binCount));
    const bin1 = Math.max(bin0 + 1, Math.floor((f1 / nyquist) * binCount));
    ranges.push([bin0, bin1]);
  }
  return ranges;
}

export function aggregateBands(
  raw: Uint8Array,
  ranges: [number, number][],
  out: Float32Array,
): number {
  let total = 0;
  for (let b = 0; b < ranges.length; b++) {
    const [bin0, bin1] = ranges[b];
    let sum = 0;
    for (let k = bin0; k < bin1; k++) sum += raw[k];
    const avg = sum / (bin1 - bin0) / 255;
    out[b] = avg;
    total += avg;
  }
  return total / ranges.length;
}

export function splitFreqRegions(bands: Float32Array): { bass: number; mid: number; treble: number } {
  const n = bands.length;
  let bSum = 0, mSum = 0, tSum = 0, bN = 0, mN = 0, tN = 0;
  for (let b = 0; b < n; b++) {
    if (b < n * 0.15) { bSum += bands[b]; bN++; }
    else if (b < n * 0.55) { mSum += bands[b]; mN++; }
    else { tSum += bands[b]; tN++; }
  }
  return {
    bass: bN ? bSum / bN : 0,
    mid: mN ? mSum / mN : 0,
    treble: tN ? tSum / tN : 0,
  };
}

export function shouldBeat(
  currentBass: number,
  history: number[],
  sensitivity: number,
  floor: number,
  tSec: number,
  refractoryUntil: number,
): boolean {
  if (tSec <= refractoryUntil) return false;
  if (currentBass < floor) return false;
  const avg = history.length ? history.reduce((a, b) => a + b, 0) / history.length : 0;
  return currentBass > avg * sensitivity;
}

export function waveformFromByteTime(rawTime: Uint8Array, nOut: number, out: Float32Array): void {
  const stride = Math.max(1, Math.floor(rawTime.length / nOut));
  for (let i = 0; i < nOut; i++) {
    const src = Math.min(rawTime.length - 1, i * stride);
    out[i] = (rawTime[src] - 128) / 128;
  }
}
