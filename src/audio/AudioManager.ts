// Audio sintetizzato con WebAudio (nessun file): ronzio degli impianti, vento, suoni di interfaccia.
import { settings, onSettings } from '../core/settings';
import { Music, Mood } from './Music';

// Il browser permette l'audio solo dopo un input dell'utente: unlock() si chiama al primo tasto.
class AudioManager {
  private ctx?: AudioContext;
  private master?: GainNode;
  private beds: Record<string, { gain: GainNode; stop: () => void }> = {};
  private amb?: GainNode;
  private fx?: GainNode;
  private mus?: GainNode;
  private music?: Music;
  private wantMood: Mood = 'off';

  private applyVolumes() {
    if (!this.master || !this.amb || !this.fx) return;
    const s = settings();
    this.master.gain.value = s.master / 10;
    this.amb.gain.value = s.ambience / 10;
    this.fx.gain.value = s.sfx / 10;
    if (this.mus) this.mus.gain.value = s.music / 10;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.amb = this.ctx.createGain(); this.amb.connect(this.master);
      this.fx = this.ctx.createGain(); this.fx.connect(this.master);
      this.mus = this.ctx.createGain(); this.mus.connect(this.master);
      this.music = new Music(this.ctx, this.mus);
      this.applyVolumes();
      onSettings(() => this.applyVolumes());
      this.music.setMood(this.wantMood);
    } catch { /* audio non disponibile */ }
  }

  private noiseBuffer() {
    const c = this.ctx!;
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // Sottofondi continui con dissolvenza: 'hum' (impianti), 'wind' (esterno)
  bed(name: 'hum' | 'wind', on: boolean, level = 1) {
    if (!this.ctx || !this.master) return;
    const c = this.ctx, now = c.currentTime;
    const cur = this.beds[name];
    if (!on) {
      if (cur) { cur.gain.gain.cancelScheduledValues(now); cur.gain.gain.linearRampToValueAtTime(0, now + 1.5); setTimeout(cur.stop, 1600); delete this.beds[name]; }
      return;
    }
    if (cur) { cur.gain.gain.linearRampToValueAtTime((name === 'hum' ? 0.08 : 0.12) * level, now + 1); return; }
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(this.amb!);
    const nodes: AudioScheduledSourceNode[] = [];
    if (name === 'hum') {
      [50, 100, 150].forEach((f, i) => {
        const o = c.createOscillator(); o.frequency.value = f; o.type = 'sine';
        const g = c.createGain(); g.gain.value = [0.5, 0.25, 0.1][i];
        o.connect(g).connect(gain); o.start(); nodes.push(o);
      });
      const n = c.createBufferSource(); n.buffer = this.noiseBuffer(); n.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      const g = c.createGain(); g.gain.value = 0.25;
      n.connect(f).connect(g).connect(gain); n.start(); nodes.push(n);
    } else {
      const n = c.createBufferSource(); n.buffer = this.noiseBuffer(); n.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.15;
      const lg = c.createGain(); lg.gain.value = 300;
      lfo.connect(lg).connect(f.frequency); lfo.start();
      n.connect(f).connect(gain); n.start(); nodes.push(n, lfo);
    }
    gain.gain.linearRampToValueAtTime((name === 'hum' ? 0.08 : 0.12) * level, now + 2);
    this.beds[name] = { gain, stop: () => nodes.forEach((x) => { try { x.stop(); } catch { /* */ } }) };
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slide?: number) {
    if (!this.ctx || !this.master) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(slide, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.fx!); o.start(t); o.stop(t + dur + 0.02);
  }

  // musica: 'theme' (titolo, cutscene), 'station' (gioco), 'off'
  setMusic(mood: Mood) { this.wantMood = mood; this.music?.setMood(mood); }

  click() { this.tone(900, 0.03, 'square', 0.03); }
  type() { this.tone(1400 + Math.random() * 300, 0.015, 'square', 0.012); }
  confirm() { this.tone(660, 0.09, 'triangle', 0.08); setTimeout(() => this.tone(990, 0.14, 'triangle', 0.08), 90); }
  error() { this.tone(220, 0.18, 'sawtooth', 0.05, 160); }
  door() { this.tone(120, 0.5, 'sawtooth', 0.04, 60); }
  power() { this.tone(40, 1.2, 'sawtooth', 0.08, 120); setTimeout(() => this.tone(1800, 0.05, 'square', 0.02), 900); }
  boot() { [0, 120, 240, 600].forEach((d, i) => setTimeout(() => this.tone([440, 550, 660, 880][i], 0.06, 'square', 0.03), d)); }
  step() { this.tone(80 + Math.random() * 20, 0.05, 'triangle', 0.04); }
}

export const Audio = new AudioManager();
