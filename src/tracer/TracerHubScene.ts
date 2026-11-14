import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { FONT_MONO, FONT_UI, FONT_TITLE } from '../core/fonts';
import { Audio } from '../audio/AudioManager';
import { LEVELS, Difficulty } from './levels';
import { loadStars, totalStars, rank, totalXp, badges, sprintBest, BADGES } from './progress';

// SIMULATORE I.R.I.S. — l'hub, come la schermata di selezione missioni di un videogioco:
// profilo del giocatore in alto, missioni a sinistra, difficoltà/sfida lampo/distintivi a destra, GIOCA in basso.
const C = { bg: 0x070d13, panel: 0x0f1a24, line: 0x2c5a72, cyan: 0x3fc7e0, cyanT: '#5fd8ee', gold: 0xf2c14e, goldT: '#f6cf6a', text: '#e6f1f7', dim: '#8aa4b8', lock: '#4a5866' };
const DIFFS: { id: Difficulty; label: string; who: string; color: number }[] = [
  { id: 'studente', label: 'STUDENTE', who: 'Guida passo-passo e comandi suggeriti', color: 0x3ee07a },
  { id: 'junior', label: 'JUNIOR IT', who: 'Solo obiettivi · SILENCE attacca una volta', color: 0xf0b040 },
  { id: 'esperto', label: 'ESPERTO', who: 'Nessun aiuto · guasti nascosti · attacchi a ondate', color: 0xff4d5e },
];
const css = (n: number) => '#' + n.toString(16).padStart(6, '0');

export class TracerHubScene extends Phaser.Scene {
  private sel = 0;
  private d = 0;
  private cards!: Phaser.GameObjects.Graphics;
  private cardTexts: Phaser.GameObjects.Text[][] = [];
  private diffG!: Phaser.GameObjects.Graphics;
  private diffTexts: Phaser.GameObjects.Text[][] = [];
  private wave!: Phaser.GameObjects.Graphics;

  constructor() { super('tracerhub'); }

  private tx(x: number, y: number, s: string, color = C.text, size = 9, font = FONT_UI, bold = false) {
    return this.add.text(x, y, s, { fontFamily: font, fontSize: `${size}px`, color, fontStyle: bold ? '700' : '400' });
  }

  create() {
    this.cardTexts = []; this.diffTexts = [];
    const g = this.add.graphics();
    g.fillStyle(C.bg).fillRect(0, 0, VIEW_W, VIEW_H);
    g.lineStyle(1, 0x10202e);
    for (let x = 0; x < VIEW_W; x += 16) g.lineBetween(x, 0, x, VIEW_H);
    for (let y = 0; y < VIEW_H; y += 16) g.lineBetween(0, y, VIEW_W, y);

    // ===== profilo in alto
    g.fillStyle(0x060c12).fillRect(0, 0, VIEW_W, 34).lineStyle(1, C.line).lineBetween(0, 34, VIEW_W, 34);
    g.fillStyle(0x0b1520).fillRoundedRect(6, 4, 30, 26, 3).lineStyle(1, C.cyan, 0.8).strokeRoundedRect(6.5, 4.5, 30, 26, 3);
    this.wave = this.add.graphics();
    this.tx(42, 5, 'SIMULATORE I.R.I.S.', C.cyanT, 10, FONT_TITLE);
    this.tx(42, 19, 'Reti ricostruite dai registri della stazione · ogni partita è diversa', C.dim, 7.5);
    const xp = totalXp(), lvl = Math.floor(xp / 200) + 1, stars = totalStars(), r = rank(stars);
    this.tx(VIEW_W - 220, 5, r.name.toUpperCase(), C.goldT, 8, FONT_TITLE);
    this.tx(VIEW_W - 220, 18, `LV ${lvl}`, C.text, 8, FONT_TITLE);
    g.fillStyle(0x1a2a38).fillRoundedRect(VIEW_W - 180, 20, 90, 6, 3).fillStyle(C.gold).fillRoundedRect(VIEW_W - 180, 20, Math.max(3, (xp % 200) * 0.45), 6, 3);
    this.tx(VIEW_W - 84, 17, `★ ${stars}`, C.goldT, 9, FONT_TITLE);
    this.tx(VIEW_W - 44, 17, `🏅 ${badges().length}`, C.text, 9, FONT_TITLE);
    if (r.next) this.tx(VIEW_W - 84, 5, `prossimo grado ★${r.next}`, C.dim, 6.5);

    // ===== missioni
    this.tx(14, 42, 'CAPITOLO 1 · RETE', C.goldT, 8, FONT_TITLE);
    this.tx(160, 43, 'Packet Tracer · CLI Cisco IOS', C.dim, 7.5);
    this.cards = this.add.graphics();
    LEVELS.forEach((l, i) => {
      const y = 56 + i * 52;
      const row = [
        this.tx(56, y + 8, l.title.toUpperCase(), C.text, 9, FONT_TITLE),
        this.tx(56, y + 23, l.concept, C.dim, 8.5),
        this.tx(34, y + 15, l.id, C.text, 9, FONT_TITLE).setOrigin(0.5, 0),
        this.tx(262, y + 9, '', C.goldT, 8.5, FONT_MONO),
      ];
      this.cardTexts.push(row);
      this.add.zone(12, y, 396, 46).setOrigin(0).setInteractive({ useHandCursor: true })
        .on('pointerover', () => { if (this.sel !== i) { this.sel = i; Audio.click(); this.refresh(); } })
        .on('pointerdown', () => this.start());
    });
    // capitoli bloccati
    ['2 · FILTRO', '3 · INDAGINE', 'FINALE'].forEach((t, i) => {
      const x = 12 + i * 134, y = 216;
      g.fillStyle(0x0b131b).fillRoundedRect(x, y, 128, 40, 4).lineStyle(1, 0x1e2c38).strokeRoundedRect(x + 0.5, y + 0.5, 128, 40, 4);
      this.tx(x + 10, y + 8, '🔒', C.lock, 11);
      this.tx(x + 30, y + 8, t, C.lock, 8, FONT_TITLE);
      this.tx(x + 30, y + 22, ['VLAN · ACL · NAT', 'registri · show · tracce', 'difesa e attacco'][i], C.lock, 7.5);
    });
    this.tx(12, 260, 'Gli altri capitoli si sbloccano nella storia.', C.lock, 7.5);

    // ===== difficoltà
    this.tx(424, 42, 'DIFFICOLTÀ', C.goldT, 8, FONT_TITLE);
    this.diffG = this.add.graphics();
    DIFFS.forEach((D, i) => {
      const y = 56 + i * 34;
      this.diffTexts.push([this.tx(440, y + 5, D.label, css(D.color), 8, FONT_TITLE), this.tx(440, y + 17, D.who, C.dim, 7)]);
      this.add.zone(424, y, 204, 30).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.d = i; Audio.click(); this.refresh(); });
    });

    // ===== sfida lampo
    const sy = 162;
    g.fillStyle(0x1a1408).fillRoundedRect(424, sy, 204, 38, 4).lineStyle(1, C.gold, 0.8).strokeRoundedRect(424.5, sy + 0.5, 204, 38, 4);
    this.tx(434, sy + 6, '⚡ SUBNET SPRINT', C.goldT, 8.5, FONT_TITLE);
    this.tx(434, sy + 21, `60 secondi · record ${sprintBest()}   ·   tasto S`, C.text, 7.5);
    this.add.zone(424, sy, 204, 38).setOrigin(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.go('sprint'));

    // ===== distintivi
    this.tx(424, 208, 'DISTINTIVI', C.goldT, 8, FONT_TITLE);
    const got = badges();
    Object.entries(BADGES).forEach(([id, b], i) => {
      const x = 438 + i * 32, y = 236, on = got.includes(id);
      g.fillStyle(on ? C.gold : 0x16222e).fillCircle(x, y, 11).lineStyle(1, on ? 0xffe39a : 0x2a3a48).strokeCircle(x, y, 11);
      this.tx(x, y - 6, on ? '★' : '?', on ? '#5a3d00' : C.lock, 10, FONT_TITLE).setOrigin(0.5, 0);
      this.add.zone(x, y, 24, 24).setInteractive().on('pointerover', () => this.tip?.setText(`${b.name}: ${on ? b.desc : '???'}`));
    });
    this.tip = this.tx(424, 252, 'passa sopra un distintivo', C.dim, 7);

    // ===== GIOCA
    g.fillStyle(0x060c12).fillRect(0, 290, VIEW_W, 70).lineStyle(1, C.line).lineBetween(0, 290, VIEW_W, 290);
    const play = this.add.graphics();
    const drawPlay = (h: boolean) => play.clear().fillStyle(h ? 0x4fe08a : 0x2fc76a).fillRoundedRect(VIEW_W / 2 - 80, 302, 160, 34, 6).lineStyle(2, 0xb6ffd0, h ? 1 : 0.5).strokeRoundedRect(VIEW_W / 2 - 80, 302, 160, 34, 6);
    drawPlay(false);
    this.tx(VIEW_W / 2, 312, '▶  GIOCA', '#062012', 12, FONT_TITLE).setOrigin(0.5, 0);
    this.add.zone(VIEW_W / 2 - 80, 302, 160, 34).setOrigin(0).setInteractive({ useHandCursor: true })
      .on('pointerover', () => drawPlay(true)).on('pointerout', () => drawPlay(false)).on('pointerdown', () => this.start());
    this.tx(12, 343, '↑↓ missione   ← → difficoltà   INVIO gioca   S sfida lampo   Esc menu', C.dim, 7.5, FONT_MONO);

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') this.sel = (this.sel + LEVELS.length - 1) % LEVELS.length;
      else if (e.key === 'ArrowDown') this.sel = (this.sel + 1) % LEVELS.length;
      else if (e.key === 'ArrowLeft') this.d = (this.d + DIFFS.length - 1) % DIFFS.length;
      else if (e.key === 'ArrowRight') this.d = (this.d + 1) % DIFFS.length;
      else if (e.key === 'Enter' || e.key === ' ') return this.start();
      else if (e.key === 'Escape') return this.go('title');
      else if (e.key === 's' || e.key === 'S') return this.go('sprint');
      else return;
      Audio.click();
      this.refresh();
    });
    this.cameras.main.fadeIn(400, 0, 0, 0);
    Audio.setMusic('station');
    this.refresh();
  }
  private tip?: Phaser.GameObjects.Text;

  private refresh() {
    const s = loadStars();
    const g = this.cards.clear();
    LEVELS.forEach((l, i) => {
      const y = 56 + i * 52, on = i === this.sel;
      g.fillStyle(on ? 0x11283a : C.panel).fillRoundedRect(12, y, 396, 46, 5).lineStyle(on ? 2 : 1, on ? C.cyan : 0x1e3446).strokeRoundedRect(12.5, y + 0.5, 396, 46, 5);
      g.fillStyle(on ? C.cyan : 0x1d3448).fillCircle(34, y + 23, 14);
      this.cardTexts[i][2].setColor(on ? '#062430' : C.text);
      this.cardTexts[i][0].setColor(on ? C.cyanT : C.text);
      // stelle per difficoltà
      const parts = DIFFS.map((D) => { const n = s[`${l.id}:${D.id}`] ?? 0; return '★'.repeat(n) + '☆'.repeat(3 - n); });
      this.cardTexts[i][3].setText(`S ${parts[0]}   J ${parts[1]}   E ${parts[2]}`);
      if (on) g.fillStyle(C.cyan).fillTriangle(404, y + 17, 404, y + 29, 410, y + 23);
    });
    const dg = this.diffG.clear();
    DIFFS.forEach((D, i) => {
      const y = 56 + i * 34, on = i === this.d;
      dg.fillStyle(on ? D.color : C.panel, on ? 0.18 : 1).fillRoundedRect(424, y, 204, 30, 4).lineStyle(on ? 2 : 1, on ? D.color : 0x1e3446).strokeRoundedRect(424.5, y + 0.5, 204, 30, 4);
      dg.fillStyle(on ? D.color : 0x2a3a48).fillCircle(431, y + 15, 3);
      this.diffTexts[i][1].setColor(on ? C.text : C.dim);
    });
  }

  private go(scene: string) {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(scene));
  }

  private start() {
    Audio.confirm();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('tracer', { level: LEVELS[this.sel].id, diff: DIFFS[this.d].id }));
  }

  update() {
    const w = this.wave.clear().lineStyle(1.5, C.cyan).beginPath(), t = this.time.now;
    for (let i = 0; i <= 28; i += 2) { const v = Math.sin(i / 3 + t / 140) * Math.sin(i / 9 + t / 600) * 4; const py = 17 + v; if (i === 0) w.moveTo(7 + i, py); else w.lineTo(7 + i, py); }
    w.strokePath();
  }
}
