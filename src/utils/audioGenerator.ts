// Бэкенд в encoded_audio отдаёт текстовую заглушку, а не аудио, и не имеет
// эндпоинта для файлов. Поэтому клиент синтезирует короткую мелодию (WAV)
// для каждого трека: длительность берётся из данных трека, мелодия
// детерминирована по id — между сессиями трек звучит одинаково.

const SAMPLE_RATE = 8000;
const NOTE_INTERVAL = 0.5;  // секунд на ноту
const BAR_LENGTH = 2;       // секунд на аккордовый такт

const cache = new Map<string, string>();

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCALE_SEMITONES = [0, 2, 4, 7, 9, 12];

export function generateTrackAudio(trackId: string | number, durationMinutes: number | undefined): string {
  const key = String(trackId);
  const cached = cache.get(key);
  if (cached) return cached;

  const durationSec = Math.min(Math.max(durationMinutes ?? 4, 1) * 60, 600);
  const totalSamples = Math.floor(durationSec * SAMPLE_RATE);
  const rand = mulberry32(hashString(key));

  const baseFreq = 220 * Math.pow(2, (rand() * 12 - 6) / 12);
  const chordCount = 4;
  const chords: number[] = [];
  for (let i = 0; i < chordCount; i++) {
    const semitone = [0, 5, 7, 3, 9, 10][Math.floor(rand() * 6)];
    chords.push(baseFreq * Math.pow(2, semitone / 12));
  }

  const samplesPerBar = Math.floor(BAR_LENGTH * SAMPLE_RATE);
  const samplesPerNote = Math.floor(NOTE_INTERVAL * SAMPLE_RATE);
  const notesPerBar = Math.floor(samplesPerBar / samplesPerNote);

  // Один буфер: WAV-заголовок (44 байта) + PCM-сэмплы.
  // ArrayBuffer внутри Blob — без конфликтов типов Uint8Array/BlobPart.
  const buffer = new ArrayBuffer(44 + totalSamples);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, 1, true);           // моно
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE, true); // byte rate (8-bit mono)
  view.setUint16(32, 1, true);           // block align
  view.setUint16(34, 8, true);           // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, totalSamples, true);

  const samples = new Uint8Array(buffer, 44, totalSamples);

  let t = 0;
  while (t < totalSamples) {
    const barIndex = Math.floor(t / samplesPerBar) % chordCount;
    const root = chords[barIndex];
    const scale = SCALE_SEMITONES.map((s) => root * Math.pow(2, s / 12));

    for (let n = 0; n < notesPerBar && t < totalSamples; n++) {
      const noteFreq = scale[Math.floor(rand() * scale.length)];
      const noteStart = t;

      for (let i = 0; i < samplesPerNote && t < totalSamples; i++, t++) {
        const localT = t - noteStart;
        const p = localT / samplesPerNote;
        const env = p < 0.1 ? p / 0.1 : Math.pow(1 - (p - 0.1) / 0.9, 1.5);

        const melody = Math.sin(2 * Math.PI * noteFreq * (t / SAMPLE_RATE)) * 0.35;
        const harmony = Math.sin(2 * Math.PI * noteFreq * 2 * (t / SAMPLE_RATE)) * 0.08;
        const bass = Math.sin(2 * Math.PI * root * 0.5 * (t / SAMPLE_RATE)) * 0.18;

        const value = (melody + harmony + bass) * env;
        samples[t] = Math.max(0, Math.min(255, Math.round(128 + value * 120)));
      }
    }
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  cache.set(key, url);
  return url;
}
