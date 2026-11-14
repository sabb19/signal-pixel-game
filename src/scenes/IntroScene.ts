import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { P, hex } from '../core/palette';
import { FONT, FONT_TITLE } from '../core/fonts';
import { charDelay } from '../core/settings';
import { Audio } from '../audio/AudioManager';

// Cutscene d'apertura (sceneggiatura: docs/NARRATIVE_BIBLE.md §7). Voce di Myra, in prima persona.
// Regia: dissolvenze incrociate, camera continua con leggero movimento "a mano", grana della pellicola,
// vignettatura, neve su due piani, e INSERTI animati dentro le tavole (il messaggio che compare sul telefono,
// il cerchio a matita che si disegna sulla mappa, la spia che lampeggia nel corridoio).
// E / Spazio / INVIO: avanti · Esc: salta.
type Fx = 'snow' | 'static' | 'radio' | 'phone' | 'map' | 'torch' | 'redlight' | 'dusk';
interface Shot {
  key: string;
  lines: string[];
  from: { x: number; y: number; s: number };
  to: { x: number; y: number; s: number };
  fx?: Fx[];
  sound?: 'wind';
}

const SHOTS: Shot[] = [
  {
    key: 'c1_radio', fx: ['radio'],
    from: { x: 0.5, y: 0.5, s: 1.04 }, to: { x: 0.3, y: 0.56, s: 1.22 },
    lines: [
      'Da noi la radio restava accesa tutta la notte. Finché parlava, qualcuno da qualche parte era ancora lì.',
      '«…attacchi informatici alle reti di comunicazione. Intere regioni isolate…»',
      'In guerra non cadono solo le case. Cadono anche le voci.',
    ],
  },
  {
    key: 'c7_crowd', fx: ['snow'],
    from: { x: 0.42, y: 0.55, s: 1.08 }, to: { x: 0.6, y: 0.5, s: 1.22 },
    lines: [
      'Il giorno dell\'evacuazione la stazione dei treni era un mare di persone.',
      'Le ho lasciato la mano per un secondo. Un secondo solo.',
    ],
  },
  {
    key: 'c2_phone', fx: ['snow', 'phone'],
    from: { x: 0.5, y: 0.4, s: 1.1 }, to: { x: 0.48, y: 0.5, s: 1.35 },
    lines: [
      'Quando mi sono girata, non c\'era più.',
      'Il suo ultimo messaggio è arrivato alle 4:12. Poi la rete è morta.',
      '«Se ci perdiamo, cerca un segnale. Io ascolterò.»',
    ],
  },
  {
    key: 'c3_map', fx: ['map'],
    from: { x: 0.45, y: 0.6, s: 1.05 }, to: { x: 0.58, y: 0.38, s: 1.3 },
    lines: [
      'Mio padre era tecnico in una stazione satellitare in montagna. Diceva che da lassù si parla con tutto il mondo.',
      'La stazione si è spenta la prima notte di guerra. Anche lui non è più tornato.',
    ],
  },
  {
    key: 'c2_dish', fx: ['snow', 'static'], sound: 'wind',
    from: { x: 0.55, y: 0.58, s: 1.14 }, to: { x: 0.42, y: 0.4, s: 1.02 },
    lines: [
      'I centri di accoglienza ascoltano ancora la radio.',
      'Se riesco a trasmettere da lassù, lei mi sentirà.',
    ],
  },
  {
    key: 'c5_journey', fx: ['snow', 'dusk'], sound: 'wind',
    from: { x: 0.35, y: 0.62, s: 1.2 }, to: { x: 0.55, y: 0.45, s: 1.04 },
    lines: [
      'Tre giorni di cammino. Sirene lontane, fili della corrente a terra, nessuna voce.',
      'Ogni sera accendevo il telefono. Nessun servizio. Ogni sera.',
    ],
  },
  {
    key: 'c4_refuge', fx: ['snow', 'torch'], sound: 'wind',
    from: { x: 0.28, y: 0.62, s: 1.18 }, to: { x: 0.5, y: 0.48, s: 1.02 },
    lines: [
      'Non so niente di reti. Non so da dove si comincia.',
      'So solo che non posso restare ferma ad aspettare.',
    ],
  },
  {
    key: 'c6_inside', fx: ['torch', 'redlight'],
    from: { x: 0.4, y: 0.55, s: 1.05 }, to: { x: 0.55, y: 0.35, s: 1.25 },
    lines: [
      'Dentro, tutto era rimasto fermo a quella notte.',
      'E nel buio, qualcosa teneva la stazione in silenzio.',
    ],
  },
];

// SILENCE si mostra (capitolo 2) ed epilogo: stesse regole di regia del prologo
const SILENCE: Shot[] = [
  {
    key: 'c8_silence', fx: ['static'],
    from: { x: 0.5, y: 0.45, s: 1.2 }, to: { x: 0.5, y: 0.5, s: 1.04 },
    lines: [
      'Uno dopo l\'altro, tutti gli schermi della sala sono diventati grigi.',
      '«[SILENCE] Trasmissione non autorizzata. Nessuno trasmette.»',
      'Una linea piatta. Senza rabbia, senza fretta. Solo un ordine eseguito.',
      'IRIS tremava, in un angolo dello schermo. E io ho capito che aveva paura. Quindi poteva averne anche lui.',
    ],
  },
];
const EPILOGUE: Shot[] = [
  {
    key: 'c9_mic', fx: [],
    from: { x: 0.4, y: 0.5, s: 1.04 }, to: { x: 0.35, y: 0.5, s: 1.2 },
    lines: [
      '«Qui Myra Kovalenko, stazione di montagna. Cerco Olena Kovalenko.»',
      '«Mamma... sono io.»',
      'Poi solo fruscio. L\'onda di IRIS, ferma accanto a me. «Aspettiamo», ha detto piano.',
      '«...Myra? Myra, sono la mamma. Ti sento.»',
    ],
  },
  {
    key: 'c10_dawn', fx: [],
    from: { x: 0.5, y: 0.45, s: 1.15 }, to: { x: 0.55, y: 0.6, s: 1.02 },
    lines: [
      'All\'alba, giù nelle valli, le luci hanno cominciato a riaccendersi. Una dopo l\'altra.',
      'Altre reti. Altre voci. Altre famiglie che si ritrovavano.',
      'Una rete riparata non è un cavo. Sono persone che tornano a parlarsi.',
    ],
  },
];
const REELS: Record<string, Shot[]> = { prologue: SHOTS, silence: SILENCE, epilogue: EPILOGUE };

export class IntroScene extends Phaser.Scene {
  private idx = -1;
  private line = 0;
  private full = '';
  private shown = 0;
  private acc = 0;
  private caption!: Phaser.GameObjects.Text;
  private layers: Phaser.GameObjects.Container[] = [];
  private shotCam?: Phaser.GameObjects.Container;
  private busy = false;
  private leaving = false;
  private grain!: Phaser.GameObjects.Graphics;
  private t0 = 0;

  constructor() { super('intro'); }

  private reel = 'prologue';
  private shots: Shot[] = SHOTS;
  init(data: { reel?: string }) { this.reel = data?.reel ?? 'prologue'; this.shots = REELS[this.reel] ?? SHOTS; }

  create() {
    this.idx = -1; this.leaving = false; this.layers = [];
    Audio.setMusic('theme');
    const barTop = this.add.rectangle(0, -40, VIEW_W, 40, 0x000000).setOrigin(0).setDepth(10);
    const barBot = this.add.rectangle(0, VIEW_H, VIEW_W, 68, 0x000000).setOrigin(0).setDepth(10);
    this.tweens.add({ targets: barTop, y: 0, duration: 2200, ease: 'Sine.inOut' });
    this.tweens.add({ targets: barBot, y: VIEW_H - 68, duration: 2200, ease: 'Sine.inOut' });
    const v = this.add.graphics().setDepth(9);
    for (let i = 0; i < 16; i++) { v.lineStyle(10, 0x000000, 0.06); v.strokeRect(i * 5, i * 4, VIEW_W - i * 10, VIEW_H - i * 8); }
    this.grain = this.add.graphics().setDepth(9.5);
    try { this.cameras.main.postFX?.addVignette(0.5, 0.5, 0.95, 0.35); } catch { /* solo WebGL */ }
    this.caption = this.add.text(VIEW_W / 2, VIEW_H - 58, '', {
      fontFamily: FONT, fontSize: '18px', color: hex(P.cream2), align: 'center', wordWrap: { width: VIEW_W - 90 }, lineSpacing: -2,
    }).setOrigin(0.5, 0).setDepth(11);
    this.add.text(VIEW_W - 10, 12, 'Esc  salta', { fontFamily: FONT, fontSize: '13px', color: hex(P.metal2) }).setOrigin(1, 0).setDepth(11);

    const kb = this.input.keyboard!;
    kb.on('keydown-ESC', () => this.finish());
    const adv = () => this.advance();
    kb.on('keydown-E', adv); kb.on('keydown-SPACE', adv); kb.on('keydown-ENTER', adv);
    this.input.on('pointerdown', adv);
    this.cameras.main.fadeIn(2000, 0, 0, 0);
    this.time.delayedCall(1200, () => this.nextShot());
  }

  private nextShot() {
    this.idx++;
    if (this.idx >= this.shots.length) return this.finish();
    const shot = this.shots[this.idx];
    this.busy = true;
    Audio.bed('wind', shot.sound === 'wind', 0.6);

    // la tavola vive in un "carrello" (container) che si muove: gli inserti, figli del carrello, si muovono con lei
    const layer = this.add.container(0, 0).setAlpha(0).setDepth(this.idx);
    const img = this.add.image(0, 0, shot.key);
    const base = Math.max(VIEW_W / img.width, VIEW_H / img.height);
    const cam = this.add.container(0, 0, [img]);
    layer.add(cam);
    const place = (k: { x: number; y: number; s: number }) => {
      const scale = base * k.s, hw = (img.width * scale) / 2, hh = (img.height * scale) / 2;
      return {
        scale,
        x: Phaser.Math.Clamp(VIEW_W / 2 - (k.x - 0.5) * img.width * scale, VIEW_W - hw + 4, hw - 4),
        y: Phaser.Math.Clamp(VIEW_H / 2 - (k.y - 0.5) * img.height * scale, VIEW_H - hh + 4, hh - 4),
      };
    };
    const a = place(shot.from), b = place(shot.to);
    cam.setScale(a.scale).setPosition(a.x, a.y);
    this.tweens.add({ targets: cam, x: b.x, y: b.y, scale: b.scale, duration: 8000 + shot.lines.length * 4500, ease: 'Sine.inOut' });
    this.shotCam = cam;
    this.addFx(shot, layer, cam, img);
    this.layers.push(layer);

    const prev = this.layers.length > 1 ? this.layers[this.layers.length - 2] : undefined;
    this.tweens.add({
      targets: layer, alpha: 1, duration: 1800, ease: 'Sine.inOut',
      onComplete: () => { if (prev) { prev.destroy(); this.layers = this.layers.filter((l) => l !== prev); } },
    });
    this.line = 0;
    this.time.delayedCall(1300, () => { this.busy = false; this.startLine(); });
  }

  // coordinate relative dell'immagine (u, v da 0 a 1) → posizione dentro il carrello
  private at(img: Phaser.GameObjects.Image, u: number, v: number) {
    return { x: (u - 0.5) * img.width, y: (v - 0.5) * img.height };
  }

  private addFx(shot: Shot, layer: Phaser.GameObjects.Container, cam: Phaser.GameObjects.Container, img: Phaser.GameObjects.Image) {
    const fx = shot.fx ?? [];
    if (fx.includes('snow')) {
      layer.add(this.add.particles(0, 0, 'px', {
        x: { min: -20, max: VIEW_W + 40 }, y: -4, lifespan: 12000,
        speedY: { min: 10, max: 22 }, speedX: { min: -10, max: -3 }, scale: 1,
        alpha: { min: 0.3, max: 0.6 }, tint: P.cream2, frequency: 45,
      }));
      layer.add(this.add.particles(0, 0, 'glow', {
        x: { min: -20, max: VIEW_W + 40 }, y: -10, lifespan: 6000,
        speedY: { min: 40, max: 70 }, speedX: { min: -24, max: -8 }, scale: { min: 0.05, max: 0.1 },
        alpha: { min: 0.25, max: 0.5 }, tint: P.cream2, frequency: 220,
      }));
    }
    if (fx.includes('static')) {
      const s = this.add.graphics();
      layer.add(s);
      this.time.addEvent({
        delay: 90, loop: true, callback: () => {
          if (!s.active) return;
          s.clear();
          if (Math.random() < 0.18) {
            const y0 = 30 + Math.random() * 120;
            for (let i = 0; i < 30; i++) s.fillStyle(Math.random() < 0.5 ? P.cyan3 : P.cream, 0.35).fillRect(Math.random() * VIEW_W, y0 + Math.random() * 20, 4 + Math.random() * 30, 1);
          }
        },
      });
    }
    if (fx.includes('radio')) {
      const p = this.at(img, 0.1, 0.62);
      const glow = this.add.image(p.x, p.y, 'glow').setScale(6).setTint(P.lamp).setAlpha(0.12).setBlendMode(Phaser.BlendModes.ADD);
      cam.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.28, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    if (fx.includes('phone')) {
      // inserto: il messaggio della madre compare sullo schermo del telefono
      const p = this.at(img, 0.5, 0.48);
      const glow = this.add.image(p.x, p.y, 'glow').setScale(5, 4).setTint(P.cyan).setAlpha(0.1).setBlendMode(Phaser.BlendModes.ADD);
      const bubble = this.add.graphics();
      bubble.fillStyle(P.cream2, 0.95).fillRoundedRect(p.x - 96, p.y - 44, 192, 78, 10);
      const time = this.add.text(p.x + 88, p.y + 24, '04:12', { fontFamily: FONT, fontSize: '20px', color: hex(P.metal0) }).setOrigin(1, 0.5);
      const msg = this.add.text(p.x - 88, p.y - 40, '', { fontFamily: FONT, fontSize: '25px', color: hex(P.petrol0), wordWrap: { width: 176 }, lineSpacing: -6 });
      const nos = this.add.text(p.x, p.y + 56, 'nessun servizio', { fontFamily: FONT, fontSize: '22px', color: hex(P.red2) }).setOrigin(0.5).setAlpha(0);
      [bubble, time, msg].forEach((o) => o.setAlpha(0));
      cam.add([glow, bubble, time, msg, nos]);
      this.tweens.add({ targets: glow, alpha: 0.22, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      const text = 'Se ci perdiamo, cerca un segnale. Io ascolterò.';
      this.time.delayedCall(5500, () => {
        if (!msg.active) return;
        this.tweens.add({ targets: [bubble, time, msg], alpha: 1, duration: 700 });
        let i = 0;
        this.time.addEvent({ delay: 55, repeat: text.length - 1, callback: () => { if (msg.active) msg.setText(text.slice(0, ++i)); } });
        this.time.delayedCall(4500, () => { if (nos.active) this.tweens.add({ targets: nos, alpha: 1, duration: 500, yoyo: true, repeat: -1, hold: 900 }); });
      });
    }
    if (fx.includes('map')) {
      // inserto: il cerchio a matita si disegna intorno all'antenna sulla mappa
      const c = this.at(img, 0.66, 0.28);
      const pencil = this.add.graphics();
      cam.add(pencil);
      const tp = this.at(img, 0.82, 0.08);
      const torch = this.add.image(tp.x, tp.y, 'glow').setScale(9).setTint(P.lamp2).setAlpha(0.08).setBlendMode(Phaser.BlendModes.ADD);
      cam.add(torch);
      this.tweens.add({ targets: torch, alpha: 0.14, duration: 1800, yoyo: true, repeat: -1 });
      const prog = { t: 0 };
      this.time.delayedCall(3500, () => this.tweens.add({
        targets: prog, t: 1, duration: 3200, ease: 'Sine.inOut',
        onUpdate: () => {
          if (!pencil.active) return;
          pencil.clear().lineStyle(4, 0x2a2a2a, 0.8).beginPath();
          const end = prog.t * Math.PI * 2.15;
          let first = true;
          for (let a = 0; a <= end; a += 0.08) {
            const r = 95 + Math.sin(a * 3) * 6;
            const x = c.x + Math.cos(a - 1.2) * r * 1.25, y = c.y + Math.sin(a - 1.2) * r;
            if (first) { pencil.moveTo(x, y); first = false; } else pencil.lineTo(x, y);
          }
          pencil.strokePath();
        },
      }));
    }
    if (fx.includes('dusk')) {
      const dp = this.at(img, 0.7, 0.32);
      const g = this.add.image(dp.x, dp.y, 'glow').setScale(16, 4).setTint(P.lamp).setAlpha(0.1).setBlendMode(Phaser.BlendModes.ADD);
      cam.add(g);
      this.tweens.add({ targets: g, alpha: 0, duration: 14000 }); // il tramonto si spegne
    }
    if (fx.includes('torch')) {
      const g = this.add.image(VIEW_W * 0.42, VIEW_H * 0.66, 'glow').setScale(4.5, 2.6).setTint(P.lamp2).setAlpha(0.14).setBlendMode(Phaser.BlendModes.ADD);
      layer.add(g);
      this.tweens.add({ targets: g, alpha: { from: 0.1, to: 0.22 }, duration: 120, yoyo: true, repeat: -1, repeatDelay: 2400 });
    }
    if (fx.includes('redlight')) {
      const p = this.at(img, 0.605, 0.075);
      const r = this.add.image(p.x, p.y, 'glow').setScale(1.4).setTint(P.red2).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      cam.add(r);
      this.tweens.add({ targets: r, alpha: 0.9, duration: 160, yoyo: true, hold: 260, repeat: -1, repeatDelay: 1500 });
    }
  }

  private startLine() {
    this.full = this.shots[this.idx].lines[this.line];
    this.shown = 0; this.acc = 0;
    this.caption.setText('').setColor(hex(this.full.startsWith('«') ? P.lamp2 : P.cream2));
    this.caption.y = VIEW_H - 54;
    this.tweens.add({ targets: this.caption, alpha: 1, y: VIEW_H - 58, duration: 600, ease: 'Sine.out' });
  }

  private advance() {
    Audio.unlock();
    if (this.busy || this.leaving) return;
    if (this.shown < this.full.length) { this.shown = this.full.length; this.caption.setText(this.full); return; }
    this.line++;
    if (this.line < this.shots[this.idx].lines.length) {
      this.busy = true;
      this.tweens.add({ targets: this.caption, alpha: 0, duration: 350, onComplete: () => { this.busy = false; this.startLine(); } });
    } else {
      this.tweens.add({ targets: this.caption, alpha: 0, duration: 500 });
      this.nextShot();
    }
  }

  private finish() {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    this.tweens.add({ targets: this.caption, alpha: 0, duration: 400 });
    cam.fadeOut(1600, 0, 0, 0);
    cam.once('camerafadeoutcomplete', () => {
      this.layers.forEach((l) => l.destroy());
      this.layers = [];
      this.shotCam = undefined;
      const t = this.add.text(VIEW_W / 2, VIEW_H / 2 - 20, this.reel === 'silence' ? 'SILENCE' : 'SIGNAL', { fontFamily: FONT_TITLE, fontSize: '40px', color: hex(P.cream2) })
        .setOrigin(0.5).setShadow(0, 0, hex(P.cyan), 10, true, true).setDepth(20).setAlpha(0).setScale(0.96);
      cam.fadeIn(10, 0, 0, 0);
      this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 2400, ease: 'Sine.out' });
      this.time.delayedCall(4400, () => {
        Audio.bed('wind', false);
        this.tweens.add({ targets: t, alpha: 0, duration: 1600, ease: 'Sine.in' });
        this.time.delayedCall(1800, () => this.reel === 'prologue' ? this.scene.start('station', { tutorial: true }) : this.scene.start('title'));
      });
    });
  }

  update(_t: number, dt: number) {
    // camera "a mano": un respiro lentissimo sul carrello attivo
    if (this.shotCam?.active) {
      this.t0 += dt;
      this.shotCam.rotation = Math.sin(this.t0 / 3100) * 0.003;
    }
    // grana della pellicola
    const g = this.grain.clear();
    for (let i = 0; i < 70; i++) g.fillStyle(Math.random() < 0.5 ? 0xffffff : 0x000000, 0.05).fillRect(Math.random() * VIEW_W, Math.random() * VIEW_H, 1, 1);
    if (this.busy || !this.full || this.shown >= this.full.length) return;
    this.acc += dt;
    const d = charDelay() + 10;
    while (this.acc > d && this.shown < this.full.length) {
      this.acc -= d; this.shown++;
      if (this.shown % 4 === 0) Audio.type();
    }
    this.caption.setText(this.full.slice(0, this.shown));
  }
}
