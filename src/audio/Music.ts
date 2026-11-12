// Musica generativa: pianoforte malinconico in La minore, lento, con riverbero.
// Due umori: 'theme' (titolo e cutscene, più pieno) e 'station' (gioco, rado e lontano).
// Nessun file audio: tutto sintetizzato con WebAudio.
export type Mood = 'theme' | 'station' | 'off';

const N = (name: string) => {
  const map: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const m = /^([A-G]#?)(\d)$/.exec(name)!;
  return 440 * Math.pow(2, (map[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
};

// Am – F – C – G, poi Am – F – Dm – E (la cadenza sospesa)
const CHORDS = [
  ['A2', 'E3', 'A3', 'C4'], ['F2', 'C3', 'F3', 'A3'], ['C3', 'G3', 'C4', 'E4'], ['G2', 'D3', 'G3', 'B3'],
  ['A2', 'E3', 'A3', 'C4'], ['F2', 'C3', 'F3', 'A3'], ['D3', 'A3', 'D4', 'F4'], ['E2', 'B2', 'E3', 'G#3'],
];
const MELODY = [
  ['E5', 'C5', 'B4', 'A4'], ['A4', 'C5', 'F5', 'E5'], ['E5', 'G5', 'E5', 'D5'], ['D5', 'B4', 'G4', 'B4'],
  ['C5', 'A4', 'E5', 'C5'], ['A4', 'F4', 'A4', 'C5'], ['F5', 'D5', 'A4', 'D5'], ['B4', 'G#4', 'E4', 'B4'],
];

export class Music {
  private out: GainNode;
  private verb: ConvolverNode;
  private timer?: number;
  private bar = 0;
  private next = 0;
  mood: Mood = 'off';

  constructor(private ctx: AudioContext, dest: AudioNode) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.2);
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    const dry = ctx.createGain(); dry.gain.value = 0.7;
    this.out.connect(dry).connect(dest);
    this.out.connect(this.verb).connect(wet).connect(dest);
  }

  private impulse(sec: number) {
    const c = this.ctx, len = c.sampleRate * sec, b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  }

  // Una nota di "pianoforte": attacco rapido, decadimento lungo, armoniche leggere, timbro scurito
  private note(freq: number, t: number, vel: number, len = 4) {
    const c = this.ctx;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400 + vel * 1600;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18 * vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    [[1, 'triangle', 1], [2, 'sine', 0.35], [3, 'sine', 0.08]].forEach(([mul, type, amp]) => {
      const o = c.createOscillator();
      o.type = type as OscillatorType;
      o.frequency.value = freq * (mul as number);
      o.detune.value = (Math.random() - 0.5) * 6;
      const og = c.createGain(); og.gain.value = amp as number;
      o.connect(og).connect(f);
      o.start(t); o.stop(t + len + 0.1);
    });
    f.connect(g).connect(this.out);
  }

  setMood(mood: Mood) {
    if (mood === this.mood) return;
    const c = this.ctx, now = c.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.mood = mood;
    if (mood === 'off') { this.out.gain.linearRampToValueAtTime(0, now + 2.5); return; }
    this.out.gain.linearRampToValueAtTime(mood === 'theme' ? 1 : 0.55, now + 3);
    if (!this.timer) {
      this.next = now + 0.2;
      this.timer = window.setInterval(() => this.schedule(), 200);
    }
  }

  // pianifica in anticipo le battute (lookahead), così il tempo resta regolare
  private schedule() {
    if (this.mood === 'off' && this.out.gain.value < 0.001) { window.clearInterval(this.timer); this.timer = undefined; return; }
    const beat = this.mood === 'station' ? 1.15 : 0.95; // secondi per battito: molto lento
    while (this.next < this.ctx.currentTime + 1.5) {
      const t = this.next, i = this.bar % CHORDS.length, chord = CHORDS[i].map(N);
      // accordo arpeggiato piano, nota grave più lunga
      this.note(chord[0], t, 0.55, 6);
      chord.slice(1).forEach((f, k) => this.note(f, t + 0.12 * (k + 1) + Math.random() * 0.03, 0.32, 4.5));
      // melodia: piena nel tema, poche note nella stazione (lascia spazio al silenzio)
      MELODY[i].forEach((m, k) => {
        const play = this.mood === 'theme' ? !(k === 3 && this.bar % 2 === 0) : (k === 0 && this.bar % 2 === 1);
        if (play) this.note(N(m), t + k * beat + (k ? Math.random() * 0.05 : 0.02), this.mood === 'theme' ? 0.42 : 0.3, 3.5);
      });
      this.bar++;
      this.next += beat * 4;
    }
  }
}
