import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { P, hex } from '../core/palette';
import { FONT, FONT_TITLE } from '../core/fonts';
import { loadSave, clearSave } from '../core/save';
import { Audio } from '../audio/AudioManager';

// Schermata del titolo: keyart con lento movimento di camera, neve, logo con onda del segnale.
export class TitleScene extends Phaser.Scene {
  private items: { label: string; action: () => void }[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private sel = 0;
  private started = false;

  constructor() { super('title'); }

  create() {
    this.started = false;
    Audio.setMusic('theme');
    const art = this.add.image(VIEW_W / 2, VIEW_H / 2, 'keyart');
    const base = Math.max(VIEW_W / art.width, VIEW_H / art.height);
    art.setScale(base * 1.02);
    // avvicinamento lentissimo e in una sola direzione: quasi impercettibile
    this.tweens.add({ targets: art, scale: base * 1.08, duration: 60000, ease: 'Sine.out' });
    // la spia rossa in cima all'antenna lampeggia
    const red = this.add.image(VIEW_W * 0.694, VIEW_H * 0.09, 'glow').setScale(0.5).setTint(P.red2).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.tweens.add({ targets: red, alpha: 0.9, duration: 120, yoyo: true, hold: 200, repeat: -1, repeatDelay: 1600 });

    // velo scuro a sinistra per leggere il titolo
    const g = this.add.graphics();
    for (let i = 0; i < 12; i++) g.fillStyle(P.night0, 0.06).fillRect(0, 0, 330 - i * 22, VIEW_H);

    // neve
    this.add.particles(0, 0, 'px', {
      x: { min: -20, max: VIEW_W + 20 }, y: -4, lifespan: 9000,
      speedY: { min: 14, max: 30 }, speedX: { min: -8, max: 4 },
      scale: { min: 1, max: 2 }, alpha: { min: 0.4, max: 0.9 }, tint: P.cream2, frequency: 90,
    });

    // logo
    this.add.text(36, 70, 'SIGNAL', { fontFamily: FONT_TITLE, fontSize: '52px', color: hex(P.cream2), fontStyle: 'bold' })
      .setShadow(0, 0, hex(P.cyan), 12, true, true);
    this.add.text(40, 130, 'Cerca un segnale. Qualcuno ascolterà.', { fontFamily: FONT, fontSize: '16px', color: hex(P.cyan3) });

    const hasSave = !!loadSave();
    this.items = [
      ...(hasSave ? [{ label: 'Continua', action: () => this.go('station') }] : []),
      { label: 'Nuova partita', action: () => { clearSave(); this.go('intro'); } },
      { label: 'Simulatore I.R.I.S.', action: () => this.go('tracerhub') },
      { label: 'Impostazioni', action: () => { Audio.click(); this.scene.pause(); this.scene.launch('settings', { from: 'title' }); } },
    ];
    this.texts = this.items.map((it, i) =>
      this.add.text(44, 200 + i * 24, it.label, { fontFamily: FONT, fontSize: '22px', color: hex(P.cream) }));
    const hint = this.add.text(44, VIEW_H - 34, '↑ ↓ per scegliere · INVIO per confermare', { fontFamily: FONT, fontSize: '14px', color: hex(P.conc) });
    this.tweens.add({ targets: hint, alpha: 0.4, duration: 1200, yoyo: true, repeat: -1 });
    this.add.text(VIEW_W - 8, VIEW_H - 8, 'demo v0.1', { fontFamily: FONT, fontSize: '12px', color: hex(P.metal2) }).setOrigin(1);

    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      Audio.unlock();
      Audio.setMusic('theme');
      if (e.key === 'ArrowUp' || e.key === 'w') this.move(-1);
      else if (e.key === 'ArrowDown' || e.key === 's') this.move(1);
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') this.items[this.sel]?.action();
    });
    this.texts.forEach((t, i) => t.setInteractive({ useHandCursor: true })
      .on('pointerover', () => { this.sel = i; this.refresh(); })
      .on('pointerdown', () => { Audio.unlock(); this.items[i].action(); }));
    this.refresh();
    this.cameras.main.fadeIn(1200, 0, 0, 0);
  }

  private move(d: number) {
    this.sel = (this.sel + d + this.items.length) % this.items.length;
    Audio.click();
    this.refresh();
  }

  private refresh() {
    this.texts.forEach((t, i) => t.setText((i === this.sel ? '> ' : '  ') + this.items[i].label)
      .setColor(hex(i === this.sel ? P.cyan3 : P.cream)));
  }

  private go(scene: string) {
    if (this.started) return;
    this.started = true;
    Audio.confirm();
    this.cameras.main.fadeOut(900, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene));
  }
}
