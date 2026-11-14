import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { P, hex } from '../core/palette';
import { FONT_MONO, FONT_UI } from '../core/fonts';
import { Audio } from '../audio/AudioManager';
import { LEVELS, Difficulty } from './levels';
import { loadStars, totalStars, rank } from './progress';

// SIMULATORE I.R.I.S. — l'hub: i livelli già affrontati si rigiocano con reti sempre nuove
// e tre difficoltà, pensate per tre pubblici: studenti, junior IT, esperti.
const DIFFS: { id: Difficulty; label: string; who: string; color: number }[] = [
  { id: 'studente', label: 'STUDENTE', who: 'Guida passo-passo, comandi suggeriti, metafore.', color: P.phos },
  { id: 'junior', label: 'JUNIOR IT', who: 'Solo obiettivi, aiuti con H, un guasto in più.', color: P.lamp2 },
  { id: 'esperto', label: 'ESPERTO', who: 'Nessun aiuto, guasti nascosti, cronometro.', color: P.red2 },
];

export class TracerHubScene extends Phaser.Scene {
  private sel = 0;
  private d = 0;
  private rows: Phaser.GameObjects.Text[] = [];
  private diffText!: Phaser.GameObjects.Text;
  private whoText!: Phaser.GameObjects.Text;

  constructor() { super('tracerhub'); }

  create() {
    const g = this.add.graphics();
    g.fillStyle(0x0b1013).fillRect(0, 0, VIEW_W, VIEW_H);
    for (let y = 0; y < VIEW_H; y += 2) g.fillStyle(0x000000, 0.15).fillRect(0, y, VIEW_W, 1);
    this.add.text(VIEW_W / 2, 18, 'SIMULATORE  I.R.I.S.', { fontFamily: FONT_UI, fontStyle: '700', fontSize: '13px', color: hex(P.cyan3) }).setOrigin(0.5, 0);
    this.add.text(VIEW_W / 2, 42, 'Reti ricostruite dai registri della stazione. Ogni partita è una rete nuova.', { fontFamily: FONT_MONO, fontSize: '11px', color: hex(P.cream) }).setOrigin(0.5, 0);

    const tot = totalStars(), r = rank(tot);
    this.add.text(24, 70, `GRADO: ${r.name.toUpperCase()}   ★ ${tot}${r.next ? `   (prossimo grado a ★ ${r.next})` : ''}`, { fontFamily: FONT_MONO, fontSize: '11px', color: hex(P.lamp2) });

    g.fillStyle(0x0f1a1e).fillRect(20, 92, VIEW_W - 40, 170).lineStyle(1, P.cyan1).strokeRect(20.5, 92.5, VIEW_W - 40, 170);
    this.add.text(30, 96, 'CAPITOLO 1 · RETE', { fontFamily: FONT_MONO, fontSize: '10px', color: hex(P.cyan1) });
    this.add.text(VIEW_W - 30, 96, 'STUDENTE  JUNIOR  ESPERTO', { fontFamily: FONT_MONO, fontSize: '9.5px', color: hex(P.metal2) }).setOrigin(1, 0);
    this.rows = LEVELS.map((l, i) => this.add.text(30, 116 + i * 30, '', { fontFamily: FONT_MONO, fontSize: '12px', color: hex(P.cream) })
      .setInteractive({ useHandCursor: true }).on('pointerover', () => { this.sel = i; this.refresh(); }).on('pointerdown', () => this.start()));
    const locked = ['2 · FILTRO   (VLAN, ACL, NAT)', '3 · INDAGINE (registri, show, tracce)', 'FINALE · DIFESA E ATTACCO'];
    locked.forEach((t, i) => this.add.text(30, 210 + i * 16, `🔒 ${t}  — si sblocca nella storia`, { fontFamily: FONT_MONO, fontSize: '10px', color: hex(P.metal) }));

    this.diffText = this.add.text(VIEW_W / 2, 276, '', { fontFamily: FONT_MONO, fontSize: '13px', color: hex(P.cream) }).setOrigin(0.5, 0);
    this.whoText = this.add.text(VIEW_W / 2, 298, '', { fontFamily: FONT_MONO, fontSize: '10.5px', color: hex(P.conc) }).setOrigin(0.5, 0);
    this.add.text(VIEW_W / 2, VIEW_H - 22, '↑↓ livello · ← → difficoltà · INVIO gioca · Esc menu', { fontFamily: FONT_MONO, fontSize: '10.5px', color: hex(P.metal2) }).setOrigin(0.5, 0);

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') this.sel = (this.sel + LEVELS.length - 1) % LEVELS.length;
      else if (e.key === 'ArrowDown') this.sel = (this.sel + 1) % LEVELS.length;
      else if (e.key === 'ArrowLeft') this.d = (this.d + DIFFS.length - 1) % DIFFS.length;
      else if (e.key === 'ArrowRight') this.d = (this.d + 1) % DIFFS.length;
      else if (e.key === 'Enter' || e.key === ' ') return this.start();
      else if (e.key === 'Escape') return this.scene.start('title');
      else return;
      Audio.click();
      this.refresh();
    });
    this.cameras.main.fadeIn(400, 0, 0, 0);
    Audio.setMusic('station');
    this.refresh();
  }

  private refresh() {
    const s = loadStars();
    this.rows.forEach((t, i) => {
      const l = LEVELS[i], on = i === this.sel;
      const st = DIFFS.map((d) => { const n = s[`${l.id}:${d.id}`] ?? 0; return '★'.repeat(n) + '☆'.repeat(3 - n); }).join('  ');
      t.setText(`${on ? '>' : ' '} ${l.id}  ${l.title.padEnd(16)} ${l.concept.padEnd(30)} ${st}`).setColor(hex(on ? P.cyan3 : P.cream));
    });
    const D = DIFFS[this.d];
    this.diffText.setText(`◂  ${D.label}  ▸`).setColor(hex(D.color));
    this.whoText.setText(D.who);
  }

  private start() {
    Audio.confirm();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('tracer', { level: LEVELS[this.sel].id, diff: DIFFS[this.d].id }));
  }
}
