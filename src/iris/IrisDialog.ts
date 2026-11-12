import Phaser from 'phaser';
import { P, hex } from '../core/palette';
import { VIEW_W, VIEW_H } from '../core/config';
import { FONT } from '../core/fonts';
import { charDelay } from '../core/settings';
import { Audio } from '../audio/AudioManager';

// Riquadro dei dialoghi. Ogni riga dichiara chi parla:
//   "IRIS: ..."  → IRIS, testo fosforo; a sinistra un oscilloscopio la cui onda si muove mentre parla
//   "MYRA: ..."  → Myra ad alta voce, con il suo ritratto
//   "( ... )"    → pensiero di Myra, in corsivo
// IRIS non ha volto: la sua presenza è solo la forma d'onda (docs/NARRATIVE_BIBLE.md §6).
type Speaker = 'iris' | 'myra' | 'thought';

export class IrisDialog {
  private box: Phaser.GameObjects.Container;
  private text: Phaser.GameObjects.Text;
  private label: Phaser.GameObjects.Text;
  private wave: Phaser.GameObjects.Graphics;
  private portrait: Phaser.GameObjects.Image;
  private more: Phaser.GameObjects.Text;
  private queue: string[] = [];
  private full = '';
  private shown = 0;
  private timer = 0;
  private speaker: Speaker = 'iris';
  private onDone?: () => void;
  private glitch = 0;
  open = false;

  constructor(private scene: Phaser.Scene) {
    const w = VIEW_W - 40, h = 74, x = 20, y = VIEW_H - h - 10;
    const g = scene.add.graphics();
    g.fillStyle(P.petrol0, 0.94).fillRect(x, y, w, h);
    g.lineStyle(1, P.metal).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    g.fillStyle(P.metal0).fillRect(x + 6, y + 6, 62, h - 12);      // schermo piccolo
    g.fillStyle(P.night0).fillRect(x + 8, y + 8, 58, h - 16);
    this.wave = scene.add.graphics();
    this.portrait = scene.add.image(x + 37, y + 37, 'player', 'face').setDisplaySize(56, 52).setVisible(false);
    this.label = scene.add.text(x + 78, y + 6, '', { fontFamily: FONT, fontSize: '15px', color: hex(P.cyan3) });
    this.text = scene.add.text(x + 78, y + 22, '', {
      fontFamily: FONT, fontSize: '17px', color: hex(P.cyan3), wordWrap: { width: w - 96 }, lineSpacing: -2,
    });
    this.more = scene.add.text(x + w - 10, y + h - 6, '▼', { fontFamily: FONT, fontSize: '14px', color: hex(P.cream) }).setOrigin(1, 1);
    this.box = scene.add.container(0, 0, [g, this.wave, this.portrait, this.label, this.text, this.more])
      .setScrollFactor(0).setDepth(10000).setVisible(false);
    this.waveRect = { x: x + 8, y: y + 8, w: 58, h: h - 16 };
  }
  private waveRect: { x: number; y: number; w: number; h: number };
  private maxTextH = 48;

  say(lines: string[], onDone?: () => void) {
    this.queue = [...lines];
    this.onDone = onDone;
    this.open = true;
    this.box.setVisible(true);
    this.next();
  }

  private next() {
    const line = this.queue.shift();
    if (line === undefined) {
      this.open = false;
      this.box.setVisible(false);
      const cb = this.onDone; this.onDone = undefined; cb?.();
      return;
    }
    if (line.startsWith('IRIS:')) { this.speaker = 'iris'; this.full = line.slice(5).trim(); }
    else if (line.startsWith('MYRA:')) { this.speaker = 'myra'; this.full = line.slice(5).trim(); }
    else if (line.startsWith('(')) { this.speaker = 'thought'; this.full = line; }
    else { this.speaker = 'iris'; this.full = line; }
    // testo troppo lungo per il riquadro: si divide in pagine a fine frase (o a fine parola)
    this.text.setFontStyle(this.speaker === 'thought' ? 'italic' : 'normal').setText(this.full);
    if (this.text.height > this.maxTextH) {
      const words = this.full.split(' ');
      let cut = words.length - 1;
      for (; cut > 1; cut--) {
        this.text.setText(words.slice(0, cut).join(' '));
        if (this.text.height <= this.maxTextH) break;
      }
      // preferisci tagliare dopo un punto, se c'è
      for (let k = cut; k > cut / 2; k--) if (/[.?!:]$/.test(words[k - 1])) { cut = k; break; }
      const rest = words.slice(cut).join(' ');
      const prefix = this.speaker === 'iris' ? 'IRIS: ' : this.speaker === 'myra' ? 'MYRA: ' : '';
      this.queue.unshift(this.speaker === 'thought' ? `(${rest.replace(/^\(/, '')}` : prefix + rest);
      this.full = words.slice(0, cut).join(' ') + (this.speaker === 'thought' ? ' …)' : ' …');
      if (this.speaker === 'thought') this.full = this.full.replace(/\) …\)$/, ' …)');
    }
    const iris = this.speaker === 'iris';
    this.label.setText(iris ? 'I.R.I.S.' : this.speaker === 'myra' ? 'MYRA' : 'MYRA').setColor(hex(iris ? P.cyan3 : P.lamp2));
    this.text.setColor(hex(iris ? P.cyan3 : P.cream2)).setFontStyle(this.speaker === 'thought' ? 'italic' : 'normal');
    this.portrait.setVisible(!iris);
    this.glitch = iris && this.full.startsWith('...') ? 600 : 0;
    this.shown = 0; this.timer = 0;
    this.text.setText('');
  }

  advance() {
    if (!this.open) return;
    if (this.shown < this.full.length) { this.shown = this.full.length; this.text.setText(this.full); }
    else { Audio.click(); this.next(); }
  }

  update(dt: number) {
    if (!this.open) return;
    const talking = this.shown < this.full.length;
    this.drawWave(talking);
    this.more.setVisible(!talking && Math.floor(this.scene.time.now / 450) % 2 === 0);
    if (!talking) return;
    this.timer += dt;
    const d = charDelay();
    while (this.timer > d && this.shown < this.full.length) {
      this.timer -= d; this.shown++;
      if (this.shown % 3 === 0) Audio.type();
    }
    this.text.setText(this.full.slice(0, this.shown));
  }

  // L'onda di IRIS: piatta quando tace, viva quando parla, spezzata quando è disturbata
  private drawWave(talking: boolean) {
    const g = this.wave.clear();
    if (this.speaker !== 'iris') return;
    const { x, y, w, h } = this.waveRect, t = this.scene.time.now;
    g.lineStyle(1, P.cyan1, 0.6);
    for (let i = 1; i < 4; i++) g.lineBetween(x, y + (h * i) / 4, x + w, y + (h * i) / 4); // griglia
    g.lineStyle(2, P.cyan3, 1);
    g.beginPath();
    const amp = talking ? 10 : 1.5;
    this.glitch = Math.max(0, this.glitch - 16);
    for (let i = 0; i <= w; i += 2) {
      const noise = this.glitch > 0 && Math.random() < 0.3 ? (Math.random() - 0.5) * 18 : 0;
      const v = Math.sin(i / 5 + t / 90) * Math.sin(i / 17 + t / 400) * amp + noise;
      const py = Phaser.Math.Clamp(y + h / 2 + v, y + 2, y + h - 2);
      if (i === 0) g.moveTo(x + i, py); else g.lineTo(x + i, py);
    }
    g.strokePath();
  }
}
