import type { ElectricalConfig, ElectricalResult } from './electrical';
import type { PixelMap } from './types';

export function exportPixelMap(map: PixelMap): string {
  const records: Array<{ x: number; y: number; z: number; strip_id: string; index: number }> = [];
  let p = 0;
  for (let s = 0; s < map.strips.length; s++) {
    const strip = map.strips[s];
    const n = Math.floor(strip.length_m * strip.led_density);
    for (let i = 0; i < n; i++) {
      records.push({
        x: map.positions[p * 3 + 0],
        y: map.positions[p * 3 + 1],
        z: map.positions[p * 3 + 2],
        strip_id: strip.id,
        index: i,
      });
      p++;
    }
  }
  return JSON.stringify({ pixels: records }, null, 2);
}

export function exportE131Config(map: PixelMap): string {
  const PIXELS_PER_UNIVERSE = 170;
  const universes: Array<{ universe: number; strip_id: string; start: number; count: number }> = [];
  let universe = 1;
  for (const strip of map.strips) {
    const n = Math.floor(strip.length_m * strip.led_density);
    let start = 0;
    while (start < n) {
      const take = Math.min(PIXELS_PER_UNIVERSE, n - start);
      universes.push({ universe, strip_id: strip.id, start, count: take });
      universe++;
      start += take;
    }
  }
  return JSON.stringify({ universes, pixels_per_universe: PIXELS_PER_UNIVERSE, total_universes: universe - 1 }, null, 2);
}

export function exportPowerReport(
  map: PixelMap,
  cfg: ElectricalConfig,
  result: ElectricalResult,
): string {
  const totalW = result.totalCurrent * cfg.vInjection;
  const psuAmps = 29;
  const psuPerPSU = psuAmps * cfg.vInjection;
  const psuCount = Math.ceil(totalW / psuPerPSU);
  const headroomCount = Math.ceil((totalW * 1.3) / psuPerPSU);
  const totalLEDs = map.count;
  const totalMeters = map.totalMeters;
  const avgCurrentPerStrip = result.totalCurrent / map.strips.length;

  let peak = 0;
  for (let i = 0; i < result.peakCurrentPerStrip.length; i++) {
    if (result.peakCurrentPerStrip[i] > peak) peak = result.peakCurrentPerStrip[i];
  }

  const lines: string[] = [
    '# LED Cube Power Budget',
    '',
    `- Total LEDs: **${totalLEDs.toLocaleString()}**`,
    `- Total strip: **${totalMeters.toFixed(1)} m**`,
    `- Strips: **${map.strips.length}**`,
    `- Nominal voltage: **${cfg.vInjection} V**`,
    `- Per-LED peak current (full white): **${(cfg.maxCurrentPerLED * 1000).toFixed(0)} mA**`,
    '',
    '## Under current pattern frame',
    `- Total current: **${result.totalCurrent.toFixed(1)} A** → **${totalW.toFixed(0)} W**`,
    `- Peak strip current: **${peak.toFixed(1)} A**`,
    `- Average strip current: **${avgCurrentPerStrip.toFixed(1)} A**`,
    `- Worst-case voltage seen: **${result.worstVoltage.toFixed(2)} V**`,
    `- Brownout LEDs (<${cfg.brownoutVolts}V): **${result.brownoutCount}**`,
    '',
    '## PSU recommendation (Meanwell LRS-350-12 class, 29A per unit)',
    `- Exact match: **${psuCount}** × LRS-350-12`,
    `- With 30% headroom: **${headroomCount}** × LRS-350-12`,
    '',
    '## Wiring notes',
    `- Injection mode: **${cfg.injectionMode}**`,
    `- Strip copper: ${cfg.rPerMeter} Ω/m/conductor`,
    '- Size injection legs for PEAK current, not average — kick-drum white flashes pull full current briefly.',
    '- At 12V you can run ~15A down 14AWG for the short injection runs (derate as needed).',
    '- Fuse each injection leg at the PSU output (ATO blade, 15-20A typical).',
    '',
    '## Warnings',
    ...(result.warnings.length ? result.warnings.map((w) => `- ${w}`) : ['- None']),
  ];
  return lines.join('\n');
}

export function downloadText(filename: string, contents: string, mime = 'text/plain') {
  const blob = new Blob([contents], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
