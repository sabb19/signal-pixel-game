import Phaser from 'phaser';
import { hiDpi } from './hidpi';
import { VIEW_W, VIEW_H } from '../core/config';
import { FONT_MONO, FONT_UI } from '../core/fonts';
import { Audio } from '../audio/AudioManager';
import { intToIp } from './model';
import { makeQuestion, Q } from './sprint';
import { addXp, earnBadge, recordSprint, sprintBest } from './progress';

// SUBNET SPRINT — sfida lampo di 60 secondi: l'indirizzo è DENTRO o FUORI dalla rete?
// ← / D  dentro   → / F  fuori. Risposta sbagliata: −3 secondi e la spiegazione del perché.
const maskOf = (p: number) => intToIp((0xffffffff << (32 - p)) >>> 0);

export class SprintScene extends Phaser.Scene {
  private q!: Q;
  private score = 0;
  private streak = 0;
  private left = 60;
  private over = false;
  private qText!: Phaser.GameObjects.Text;
  private netText!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private started = false;

  constructor() { super('sprint'); }

  create() {
    hiDpi(this);
    this.score = 0; this.streak = 0; this.left = 60; this.over = false; this.started = false;
    const g = this.add.graphics();
    g.fillStyle(0xf3f4f6).fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle(0x1e6fb8).fillRect(0, 0, VIEW_W, 34);
    this.add.text(16, 9, 'SUBNET SPRINT', { fontFamily: FONT_UI, fontSize: '14px', fontStyle: '700', color: '#ffffff' });
    this.hud = this.add.text(VIEW_W - 16, 11, '', { fontFamily: FONT_MONO, fontSize: '11px', color: '#ffffff' }).setOrigin(1, 0);
    this.bar = this.add.graphics();
    g.fillStyle(0xffffff).fillRoundedRect(70, 70, 500, 150, 8).lineStyle(1, 0xc4c9d0).strokeRoundedRect(70.5, 70.5, 500, 150, 8);
    this.netText = this.add.text(VIEW_W / 2, 88, '', { fontFamily: FONT_MONO, fontSize: '13px', color: '#5f6b7a', align: 'center' }).setOrigin(0.5, 0);
    this.qText = this.add.text(VIEW_W / 2, 128, '', { fontFamily: FONT_MONO, fontSize: '22px', fontStyle: '700', color: '#1f2933' }).setOrigin(0.5, 0);
    this.add.text(VIEW_W / 2, 176, 'è dentro questa rete?', { fontFamily: FONT_UI, fontSize: '11px', color: '#5f6b7a' }).setOrigin(0.5, 0);
    this.button(150, 240, '◀  DENTRO  (D)', '#1f8a3e', true);
    this.button(VIEW_W - 150, 240, 'FUORI  (F)  ▶', '#c62828', false);
    this.info = this.add.text(VIEW_W / 2, 290, 'Più risposte giuste in 60 secondi. Le serie valgono di più.\nUn errore costa 3 secondi.   Premi INVIO per iniziare · Esc esci', { fontFamily: FONT_UI, fontSize: '11.5px', color: '#1f2933', align: 'center' }).setOrigin(0.5, 0);
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.next();
    this.refresh();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  private button(x: number, y: number, label: string, color: string, inside: boolean) {
    this.add.text(x, y, label, { fontFamily: FONT_UI, fontSize: '13px', fontStyle: '700', color: '#ffffff', backgroundColor: color, padding: { x: 18, y: 10 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.answer(inside));
  }

  private next() {
    this.q = makeQuestion();
    this.netText.setText(`rete ${this.q.net}/${this.q.prefix}   (maschera ${maskOf(this.q.prefix)})`);
    this.qText.setText(this.q.ip).setColor('#1f2933');
  }

  private onKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (k === 'escape') return this.scene.start('tracerhub');
    if (this.over) { if (k === 'enter') this.scene.restart(); return; }
    if (!this.started) { if (k === 'enter' || k === ' ') { this.started = true; this.info.setText(''); Audio.click(); } return; }
    if (k === 'arrowleft' || k === 'd') this.answer(true);
    if (k === 'arrowright' || k === 'f') this.answer(false);
  }

  private answer(inside: boolean) {
    if (!this.started || this.over) { if (!this.started) { this.started = true; this.info.setText(''); } return; }
    if (inside === this.q.inside) {
      this.streak++;
      const pts = this.streak >= 8 ? 3 : this.streak >= 4 ? 2 : 1;
      this.score += pts;
      Audio.confirm();
      this.flash('#1f8a3e', `+${pts}`);
      this.info.setText('').setColor('#1f2933');
    } else {
      this.streak = 0;
      this.left = Math.max(0, this.left - 3);
      Audio.error();
      this.cameras.main.shake(200, 0.005);
      this.flash('#c62828', '−3s');
      this.info.setColor('#c62828').setText(`${this.q.ip} è ${this.q.inside ? 'DENTRO' : 'FUORI'}: con /${this.q.prefix} la rete va da ${this.q.first} a ${this.q.last}.`);
    }
    this.next();
  }

  private flash(color: string, s: string) {
    const t = this.add.text(VIEW_W / 2, 120, s, { fontFamily: FONT_UI, fontSize: '20px', fontStyle: '700', color }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: 90, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }

  private end() {
    this.over = true;
    const best = recordSprint(this.score);
    addXp(this.score * 5);
    if (this.score >= 20) earnBadge('sprint-20');
    Audio.power();
    this.qText.setText(`${this.score} punti`).setColor('#1e6fb8');
    this.netText.setText(best ? 'NUOVO RECORD!' : `record: ${sprintBest()}`);
    this.info.setColor('#1f2933').setText(`+${this.score * 5} XP${this.score >= 20 ? '  ·  distintivo Subnet master' : ''}\nINVIO rigioca · Esc torna a IRIS`);
  }

  private refresh() {
    this.hud.setText(`punti ${this.score}   serie ${this.streak}   ⏱ ${Math.ceil(this.left)}s`);
    this.bar.clear().fillStyle(0xd5dae0).fillRect(0, 34, VIEW_W, 4).fillStyle(this.left > 15 ? 0x2fa84f : 0xd23a3a).fillRect(0, 34, VIEW_W * this.left / 60, 4);
  }

  update(_t: number, dt: number) {
    if (this.started && !this.over) {
      this.left -= dt / 1000;
      if (this.left <= 0) { this.left = 0; this.end(); }
    }
    this.refresh();
  }
}
