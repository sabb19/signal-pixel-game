import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { P, hex } from '../core/palette';
import { FONT, FONT_TITLE } from '../core/fonts';
import { settings, setSettings, isFullscreen, toggleFullscreen } from '../core/settings';
import { Audio } from '../audio/AudioManager';

// Pannello impostazioni, aperto sopra il titolo o sopra il gioco in pausa.
// ↑ ↓ scegli · ← → cambia · Esc / INVIO su "Indietro" chiude.
type Row = { label: string; value: () => string; change: (d: number) => void; activate?: () => void };

export class SettingsScene extends Phaser.Scene {
  private rows: Row[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private sel = 0;
  private from = 'title';

  constructor() { super('settings'); }

  init(data: { from?: string }) { this.from = data?.from ?? 'title'; this.sel = 0; }

  create() {
    const vol = (k: 'master' | 'ambience' | 'music' | 'sfx') => ({
      value: () => '▮'.repeat(settings()[k]) + '▯'.repeat(10 - settings()[k]),
      change: (d: number) => { setSettings({ [k]: Phaser.Math.Clamp(settings()[k] + d, 0, 10) }); Audio.click(); },
    });
    const speeds = ['Lenta', 'Normale', 'Veloce'];
    this.rows = [
      { label: 'Volume generale', ...vol('master') },
      { label: 'Musica', ...vol('music') },
      { label: 'Ambiente', ...vol('ambience') },
      { label: 'Effetti', ...vol('sfx') },
      {
        label: 'Velocità del testo', value: () => speeds[settings().textSpeed],
        change: (d) => { setSettings({ textSpeed: Phaser.Math.Clamp(settings().textSpeed + d, 0, 2) as 0 | 1 | 2 }); Audio.click(); },
      },
      { label: 'Schermo intero', value: () => (isFullscreen() ? 'Sì' : 'No'), change: () => toggleFullscreen(), activate: () => toggleFullscreen() },
      { label: 'Comandi', value: () => '', change: () => {}, activate: () => this.showControls() },
      { label: 'Indietro', value: () => '', change: () => {}, activate: () => this.close() },
    ];

    this.add.rectangle(0, 0, VIEW_W, VIEW_H, P.night0, 0.88).setOrigin(0);
    const panel = this.add.graphics();
    panel.fillStyle(P.petrol0, 0.95).fillRect(140, 30, 360, 300).lineStyle(1, P.cyan1).strokeRect(140, 30, 360, 300);
    this.add.text(VIEW_W / 2, 42, 'IMPOSTAZIONI', { fontFamily: FONT_TITLE, fontSize: '16px', color: hex(P.cream2) }).setOrigin(0.5, 0);
    this.texts = this.rows.map((_, i) => this.add.text(160, 74 + i * 27, '', { fontFamily: FONT, fontSize: '19px', color: hex(P.cream) })
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => { this.sel = i; this.refresh(); })
      .on('pointerdown', () => { const r = this.rows[i]; if (r.activate) r.activate(); else r.change(1); this.refresh(); }));
    this.add.text(VIEW_W / 2, 314, '↑ ↓ scegli   ← → cambia   Esc indietro', { fontFamily: FONT, fontSize: '14px', color: hex(P.conc) }).setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      const r = this.rows[this.sel];
      if (e.key === 'ArrowUp') this.sel = (this.sel + this.rows.length - 1) % this.rows.length;
      else if (e.key === 'ArrowDown') this.sel = (this.sel + 1) % this.rows.length;
      else if (e.key === 'ArrowLeft') r.change(-1);
      else if (e.key === 'ArrowRight') r.change(1);
      else if (e.key === 'Enter' || e.key === ' ') r.activate?.();
      else if (e.key === 'Escape') return this.close();
      this.refresh();
    });
    document.addEventListener('fullscreenchange', this.onFs);
    this.events.once('shutdown', () => document.removeEventListener('fullscreenchange', this.onFs));
    this.refresh();
  }

  private onFs = () => this.refresh();

  private refresh() {
    this.texts.forEach((t, i) => {
      const r = this.rows[i], on = i === this.sel;
      const v = r.value();
      t.setText(`${on ? '> ' : '  '}${r.label}${v ? '   ' + (on && !r.activate ? '◂ ' + v + ' ▸' : v) : ''}`).setColor(hex(on ? P.cyan3 : P.cream));
    });
  }

  private showControls() {
    const c = this.add.container(0, 0);
    const bg = this.add.rectangle(0, 0, VIEW_W, VIEW_H, P.night0, 0.96).setOrigin(0);
    const t = this.add.text(VIEW_W / 2, 70, [
      'COMANDI', '',
      'W A S D  /  frecce      muoversi',
      'E  /  Spazio            interagire · far avanzare il testo',
      'Esc                     pausa',
      'M                       percorso del segnale',
      'H                       aiuto (nei minigiochi)',
      '', 'premi un tasto per tornare',
    ].join('\n'), { fontFamily: FONT, fontSize: '18px', color: hex(P.cream2), align: 'left' }).setOrigin(0.5, 0);
    c.add([bg, t]);
    this.input.keyboard!.once('keydown', () => c.destroy());
  }

  private close() {
    Audio.click();
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
