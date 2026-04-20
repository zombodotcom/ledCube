// Minimal Standard MIDI File (SMF) parser — supports Format 0 and 1.
// Extracts note-on/note-off events with absolute seconds timestamps.
// Ignores controllers, pitch bend, sysex; handles only tempo meta events (0x51).

export interface MidiNote {
  note: number;   // MIDI note number 0..127
  velocity: number; // 0..127
  startSec: number;
  endSec: number;   // may equal startSec if a matching note-off never arrived
  channel: number;  // 0..15
}

export interface ParsedMidi {
  notes: MidiNote[];
  durationSec: number;
}

export function parseMidi(buf: ArrayBuffer): ParsedMidi {
  const view = new DataView(buf);
  let p = 0;

  function readStr(n: number): string {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(view.getUint8(p + i));
    p += n;
    return s;
  }
  function u16() { const v = view.getUint16(p); p += 2; return v; }
  function u32() { const v = view.getUint32(p); p += 4; return v; }

  if (readStr(4) !== 'MThd') throw new Error('Not a MIDI file');
  if (u32() !== 6) throw new Error('Invalid MThd header length');
  const format = u16();
  const trackCount = u16();
  const division = u16();
  if (format > 1) throw new Error('Only MIDI format 0 and 1 supported');
  if (division & 0x8000) throw new Error('SMPTE timecode MIDI not supported');
  const ticksPerQuarter = division;

  // Variable-length quantity
  function vlq(dv: DataView, start: { p: number }): number {
    let r = 0;
    for (let i = 0; i < 4; i++) {
      const b = dv.getUint8(start.p++);
      r = (r << 7) | (b & 0x7f);
      if (!(b & 0x80)) return r;
    }
    return r;
  }

  interface RawEvent { tick: number; type: 'on' | 'off' | 'tempo'; note?: number; velocity?: number; channel?: number; uspq?: number; }
  const events: RawEvent[] = [];

  for (let tr = 0; tr < trackCount; tr++) {
    if (readStr(4) !== 'MTrk') throw new Error('Expected MTrk');
    const len = u32();
    const end = p + len;
    let tick = 0;
    let runningStatus = 0;
    const cursor = { p };
    while (cursor.p < end) {
      tick += vlq(view, cursor);
      let status = view.getUint8(cursor.p);
      if (status < 0x80) {
        status = runningStatus; // running status
      } else {
        cursor.p++;
        runningStatus = status;
      }
      const hi = status & 0xf0;
      const ch = status & 0x0f;
      if (hi === 0x80 || hi === 0x90) {
        const note = view.getUint8(cursor.p++);
        const vel = view.getUint8(cursor.p++);
        if (hi === 0x90 && vel > 0) {
          events.push({ tick, type: 'on', note, velocity: vel, channel: ch });
        } else {
          events.push({ tick, type: 'off', note, velocity: vel, channel: ch });
        }
      } else if (hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
        cursor.p += 2;
      } else if (hi === 0xc0 || hi === 0xd0) {
        cursor.p += 1;
      } else if (status === 0xff) {
        // meta
        const metaType = view.getUint8(cursor.p++);
        const metaLen = vlq(view, cursor);
        if (metaType === 0x51 && metaLen === 3) {
          const b1 = view.getUint8(cursor.p);
          const b2 = view.getUint8(cursor.p + 1);
          const b3 = view.getUint8(cursor.p + 2);
          const uspq = (b1 << 16) | (b2 << 8) | b3;
          events.push({ tick, type: 'tempo', uspq });
        }
        cursor.p += metaLen;
      } else if (status === 0xf0 || status === 0xf7) {
        const sysLen = vlq(view, cursor);
        cursor.p += sysLen;
      } else {
        cursor.p++;
      }
    }
    p = end;
  }

  // Sort by tick (stable)
  events.sort((a, b) => a.tick - b.tick);

  // Convert ticks → seconds with tempo map
  let uspq = 500000; // default 120 BPM
  let lastTick = 0;
  let lastSec = 0;
  function tickToSec(tick: number): number {
    const deltaTicks = tick - lastTick;
    const secPerTick = uspq / 1_000_000 / ticksPerQuarter;
    return lastSec + deltaTicks * secPerTick;
  }

  const openNotes = new Map<number, MidiNote>();
  const notes: MidiNote[] = [];
  let maxEnd = 0;

  for (const ev of events) {
    const sec = tickToSec(ev.tick);
    lastSec = sec;
    lastTick = ev.tick;
    if (ev.type === 'tempo' && ev.uspq) {
      uspq = ev.uspq;
    } else if (ev.type === 'on' && ev.note !== undefined && ev.channel !== undefined) {
      const key = ev.channel * 128 + ev.note;
      // If already open, close it first
      const existing = openNotes.get(key);
      if (existing) {
        existing.endSec = sec;
        notes.push(existing);
        openNotes.delete(key);
      }
      openNotes.set(key, {
        note: ev.note,
        velocity: ev.velocity ?? 64,
        startSec: sec,
        endSec: sec,
        channel: ev.channel,
      });
    } else if (ev.type === 'off' && ev.note !== undefined && ev.channel !== undefined) {
      const key = ev.channel * 128 + ev.note;
      const open = openNotes.get(key);
      if (open) {
        open.endSec = sec;
        notes.push(open);
        openNotes.delete(key);
        if (sec > maxEnd) maxEnd = sec;
      }
    }
  }
  // Close any dangling notes
  for (const note of openNotes.values()) {
    note.endSec = Math.max(lastSec, note.startSec + 0.25);
    notes.push(note);
    if (note.endSec > maxEnd) maxEnd = note.endSec;
  }

  notes.sort((a, b) => a.startSec - b.startSec);
  return { notes, durationSec: maxEnd };
}

// Convert MIDI note number → frequency in Hz (A4 = 69 = 440Hz)
export function midiNoteToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}
