import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../../core/config';
import { P, hex } from '../../core/palette';
import { FONT, FONT_TITLE } from '../../core/fonts';
import { IrisDialog } from '../../iris/IrisDialog';
import { Audio } from '../../audio/AudioManager';
import { makeMissions, Mission, Rule, TestRow, runTests, moveRule, cycle, shadowedBy, cloneRules, PROTOS, DESTS } from './logic';

// FIREWALL ARCHITECT — il pannello della porta blindata. Niente terminale: cartellini di regole
// da riordinare e cambiare, spie dei requisiti, registro di prova ("quale regola ha deciso").
// ↑↓ scegli · INVIO prendi/posa · A azione · P protocollo · D destinazione · SPAZIO prova · H aiuto
const X0 = 18, Y0 = 34, RW = 372, RH = 196, QX = 400, QW = VIEW_W - QX - 18;

interface GuideStep {
  text: string;
  hl?: string;
  done?: (event: string) => boolean;
  after?: () => void;
  quiz?: { answer: 's' | 'n'; right: string[]; wrong: string[] };
}

export class FirewallScene extends Phaser.Scene {
  private missions: Mission[] = [];
  private mi = 0;
  private rules: Rule[] = [];
  private sel = 0;
  private grabbed = false;
  private tested = false;
  private last: TestRow[] = [];
  private hintLevel = 0;
  private wrong = 0;
  private guideStep = 0;
  private guided = false;
  private quiz?: GuideStep;
  private iris!: IrisDialog;
  private header!: Phaser.GameObjects.Text;
  private board!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private guideBox!: Phaser.GameObjects.Text;
  private hl!: Phaser.GameObjects.Graphics;
  private busy = false;
  private done = false;

  constructor() { super('firewall'); }

  init(data: { mission?: number }) {
    this.missions = makeMissions();
    this.mi = data?.mission ?? 0;
    this.done = false;
  }

  create() {
    const g = this.add.graphics();
    g.fillStyle(0x05080c).fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle(P.metal0).fillRect(4, 4, VIEW_W - 8, VIEW_H - 8);
    g.fillStyle(0x0d0b0a).fillRect(10, 26, VIEW_W - 20, VIEW_H - 36);
    this.header = this.add.text(X0, 10, '', { fontFamily: FONT_TITLE, fontSize: '11px', color: hex(P.lamp2) });
    this.add.text(VIEW_W - 18, 10, 'H aiuto · Esc esci', { fontFamily: FONT, fontSize: '14px', color: hex(P.metal2) }).setOrigin(1, 0);
    this.board = this.add.graphics();
    this.hl = this.add.graphics().setDepth(200);
    this.guideBox = this.add.text(X0, 300, '', { fontFamily: FONT, fontSize: '15px', color: hex(P.lamp2), wordWrap: { width: VIEW_W - 36 }, lineSpacing: -2 });
    const s = this.add.graphics().setDepth(5000);
    for (let y = 26; y < VIEW_H - 10; y += 2) s.fillStyle(0x000000, 0.12).fillRect(10, y, VIEW_W - 20, 1);
    this.iris = new IrisDialog(this);
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.cameras.main.fadeIn(500, 0, 0, 0);
    Audio.boot();
    this.startMission();
  }

  private get m() { return this.missions[this.mi]; }

  private startMission() {
    this.rules = cloneRules(this.m.rules);
    this.sel = 0; this.grabbed = false; this.tested = false; this.last = [];
    this.hintLevel = 0; this.wrong = 0; this.guideStep = 0;
    this.header.setText(`FIREWALL ARCHITECT · ${this.mi + 1}/${this.missions.length} · ${this.m.title}`);
    this.draw();
    this.busy = true;
    this.time.delayedCall(400, () => this.iris.say(this.m.brief, () => { this.busy = false; this.guide(); }));
  }

  // --- Guida (missioni 1 e 2)
  private steps(): GuideStep[] {
    if (this.mi === 0) return [
      { text: 'Proviamo il traffico con queste regole. Premi  SPAZIO.', hl: 'log', done: (e) => e === 'test',
        after: () => this.say(['IRIS: Il registro dice, per ogni pacchetto, quale regola ha deciso.', 'IRIS: La console passa. La telemetria e i nomi no.']) },
      { text: 'Scendi alla regola 2 con  ↓ . Dice TCP, ma la telemetria viaggia in UDP. Premi  P  per cambiare protocollo.', hl: 'r1',
        done: () => this.rules[1].proto === 'UDP' },
      { text: 'La regola 3 blocca i nomi (UDP 53 → DNS). I nomi vanno bloccati?   Premi  S  per sì,  N  per no.', hl: 'r2',
        quiz: { answer: 'n',
          right: ['IRIS: No. Senza nomi la stazione non trova più niente. Quella regola è sbagliata.'],
          wrong: ['IRIS: Guarda i requisiti a destra: la richiesta dei nomi DEVE passare. Riprova.'] } },
      { text: 'Seleziona la regola 3 e premi  A  per farla diventare PERMETTI.', hl: 'r2', done: () => this.rules[2].action === 'PERMETTI' },
      { text: 'Prova di nuovo il traffico:  SPAZIO', hl: 'log', done: (e) => e === 'test-ok' },
    ];
    if (this.mi === 1) return [
      { text: 'Prova il traffico:  SPAZIO', hl: 'log', done: (e) => e === 'test' },
      { text: 'La telemetria è stata decisa dalla regola 1, non dalla 2. Succede perché la 1 sta più in alto?   S / N', hl: 'r0',
        quiz: { answer: 's',
          right: ['IRIS: Sì. La regola 1 blocca TUTTO l\'UDP. Il pacchetto la incontra per prima, e lì si ferma.', 'IRIS: Le regole giuste sotto non vengono nemmeno lette.', 'MYRA: Allora non va tolta. Va spostata.'],
          wrong: ['IRIS: Rileggi il registro: "regola 1". Il pacchetto si ferma alla prima regola che gli corrisponde. Riprova.'] } },
      { text: 'Seleziona la regola 1 e premi  INVIO  per prenderla.', hl: 'r0', done: () => this.grabbed && this.isBroad(this.sel) },
      { text: 'Con  ↓  portala giù, sopra "blocca tutto". Poi  INVIO  per posarla.', hl: 'board',
        done: () => !this.grabbed && this.isBroad(this.rules.length - 2) },
      { text: 'Prova il traffico:  SPAZIO', hl: 'log', done: (e) => e === 'test-ok' },
    ];
    return [];
  }

  private isBroad(i: number) { const r = this.rules[i]; return !!r && !r.locked && r.port === 'tutte'; }

  private guide() {
    const steps = this.steps();
    if (!steps.length) {
      this.guided = false;
      this.highlight('none');
      this.guideBox.setText('VERIFICA · niente guida. Se ti blocchi, premi  H.\n' + this.m.goal);
      return;
    }
    this.guided = true;
    const st = steps[this.guideStep];
    if (!st) { this.highlight('none'); this.guideBox.setText(this.m.goal); return; }
    this.quiz = st.quiz ? st : undefined;
    this.guideBox.setText(`PASSO ${this.guideStep + 1}/${steps.length}   ${st.text}`);
    this.highlight(st.hl ?? 'none');
  }

  private guideAfter(event: string) {
    if (!this.guided) return;
    const st = this.steps()[this.guideStep];
    if (!st || st.quiz || !st.done?.(event)) return;
    this.guideStep++;
    if (st.after) st.after(); else this.time.delayedCall(200, () => this.guide());
  }

  private say(lines: string[]) {
    this.busy = true;
    this.time.delayedCall(250, () => this.iris.say(lines, () => { this.busy = false; this.guide(); }));
  }

  private answerQuiz(yes: boolean) {
    const st = this.quiz!;
    this.quiz = undefined;
    if ((yes ? 's' : 'n') !== st.quiz!.answer) {
      Audio.error(); this.wrong++;
      this.iris.say(st.quiz!.wrong, () => { this.quiz = st; });
      return;
    }
    Audio.confirm();
    this.iris.say(st.quiz!.right, () => { this.guideStep++; this.guide(); });
  }

  private highlight(what: string) {
    this.tweens.killTweensOf(this.hl);
    this.hl.clear().setAlpha(1).lineStyle(2, P.cyan3, 1);
    const m = /^r(\d)$/.exec(what);
    if (m) this.hl.strokeRect(X0 + 2, this.rowY(Number(m[1])) - 2, RW - 4, 26);
    if (what === 'board') this.hl.strokeRect(X0 + 1, Y0 + 1, RW - 2, RH - 2);
    if (what === 'log') this.hl.strokeRect(QX + 1, Y0 + 1, QW - 2, RH + 58);
    if (what !== 'none') this.tweens.add({ targets: this.hl, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
  }

  // --- Comandi
  private onKey(e: KeyboardEvent) {
    if (this.iris.open) { if (['e', 'E', ' ', 'Enter'].includes(e.key)) this.iris.advance(); return; }
    if (this.done || this.busy) return;
    if (e.key === 'Escape') return this.exit(false);
    if (this.quiz && /^[sSnN]$/.test(e.key)) return this.answerQuiz(e.key.toLowerCase() === 's');
    if (this.quiz) return;
    const k = e.key.toLowerCase();
    const r = this.rules[this.sel];
    if (k === 'arrowup' || k === 'arrowdown') {
      const d = k === 'arrowup' ? -1 : 1;
      if (this.grabbed) {
        const j = moveRule(this.rules, this.sel, d as -1 | 1);
        if (j === this.sel) { Audio.error(); if (this.rules[this.sel + d]?.locked) this.flash('"Blocca tutto" resta sempre in fondo.'); }
        else { this.sel = j; Audio.type(); this.invalidate(); }
      } else { this.sel = Phaser.Math.Clamp(this.sel + d, 0, this.rules.length - 1); Audio.click(); }
    } else if (k === 'enter') {
      if (r.locked) { Audio.error(); return this.flash('"Blocca tutto" non si sposta e non si cambia: è la rete di sicurezza.'); }
      this.grabbed = !this.grabbed; Audio.click();
    } else if (k === 'a' || k === 'p' || k === 'd') {
      if (this.grabbed) return;
      if (r.locked) { Audio.error(); return this.flash('"Blocca tutto" non si cambia: è la rete di sicurezza.'); }
      if (k === 'a') r.action = r.action === 'PERMETTI' ? 'BLOCCA' : 'PERMETTI';
      if (k === 'p') r.proto = cycle(PROTOS, r.proto);
      if (k === 'd') r.dst = cycle(DESTS, r.dst);
      Audio.type();
      this.invalidate();
    } else if (k === ' ') { e.preventDefault(); return this.test(); }
    else if (k === 'h') return this.hint();
    else return;
    this.draw();
    this.guideAfter('edit');
  }

  private flashText?: string;
  private flash(t: string) { this.flashText = t; this.draw(); this.time.delayedCall(2200, () => { this.flashText = undefined; this.draw(); }); }
  private invalidate() { this.tested = false; }

  private test() {
    this.last = runTests(this.rules, this.m.reqs);
    this.tested = true;
    this.busy = true;
    // i pacchetti scorrono uno alla volta nel registro
    this.revealed = 0;
    this.draw();
    this.last.forEach((t, i) => this.time.delayedCall(260 * (i + 1), () => { this.revealed = i + 1; t.ok ? Audio.type() : Audio.error(); this.draw(); }));
    this.time.delayedCall(260 * (this.last.length + 1) + 150, () => {
      this.busy = false;
      const allOk = this.last.every((t) => t.ok);
      if (allOk) { Audio.confirm(); this.guideAfter('test-ok'); this.guideAfter('test'); return this.win(); }
      this.guideAfter('test');
      if (this.guided && this.guideStep <= 1) return;
      this.wrong++;
      this.explain(this.last.find((t) => !t.ok)!);
    });
  }
  private revealed = 0;

  private explain(t: TestRow) {
    const name = t.req.packet.label;
    const lines: string[] = [];
    if (t.by < 0) lines.push(`IRIS: "${name}" non corrisponde a nessuna regola: l'ha fermato "blocca tutto". Serve una regola che lo inviti.`);
    else {
      const sh = this.rules.map((_, i) => shadowedBy(this.rules, i)).findIndex((j) => j === t.by);
      lines.push(`IRIS: "${name}" è stato deciso dalla regola ${t.by + 1}: ${t.got}. Doveva essere ${t.req.want}.`);
      if (sh > 0) lines.push(`IRIS: Nota: la regola ${t.by + 1} sta sopra la ${sh + 1} e la copre del tutto. La ${sh + 1} non decide mai niente.`);
      if (t.req.packet.dst === 'NODE-X' && t.got === 'PERMETTI') lines.push('IRIS: Questo è traffico verso NODE-X. Non deve uscire, mai.');
    }
    if (this.wrong >= 3 && !this.guided) lines.push('IRIS: Vuoi un aiuto? Premi H.');
    this.iris.say(lines);
  }

  private hint() {
    const h = this.m.hints[Math.min(this.hintLevel, 2)];
    this.hintLevel = Math.min(this.hintLevel + 1, 3);
    Audio.click();
    this.iris.say([`IRIS: ${h}`]);
  }

  private win() {
    this.done = true;
    this.highlight('none');
    this.guideBox.setText('');
    const wrap: string[][] = [
      ['IRIS: Tutte verdi. Il protocollo giusto, l\'azione giusta.', 'IRIS: Un filtro non è buono o cattivo. È preciso, oppure no.', 'MYRA: Come una lista degli invitati scritta bene.'],
      ['IRIS: L\'ordine conta. La stessa regola, nel posto sbagliato, chiude la porta a tutti.', 'IRIS: Prima le regole precise. Poi quelle larghe. In fondo, blocca tutto.', 'MYRA: Dal particolare al generale. Lo diceva la mia prof di latino.'],
      ['IRIS: Uscita verso NODE-X bloccata. I servizi funzionano ancora. Da sola.', 'IRIS: Nei registri di quella notte, NODE-X chiedeva sempre la stessa cosa: nomi. Porta 53.', 'MYRA: Qualcuno ha toccato i nomi della stazione.', 'IRIS: È il prossimo tratto.'],
    ];
    this.time.delayedCall(500, () => this.iris.say(wrap[this.mi], () => {
      if (this.mi + 1 < this.missions.length) {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => { this.mi++; this.done = false; this.cameras.main.fadeIn(400, 0, 0, 0); this.startMission(); });
      } else this.exit(true);
    }));
  }

  private exit(completed: boolean) {
    this.done = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      this.scene.get('station').events.emit('minigame-closed', { id: 'firewall', completed, mission: this.mi });
      this.scene.resume('station');
    });
  }

  // --- Disegno
  private rowY(i: number) { return Y0 + 30 + i * 30; }

  private draw() {
    const g = this.board.clear();
    this.texts.forEach((t) => t.destroy());
    this.texts = [];
    const txt = (x: number, y: number, t: string, c: number, size = 15, origin = 0) =>
      this.texts.push(this.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color: hex(c) }).setOrigin(origin, 0));

    // pannello delle regole
    g.fillStyle(0x1a1512).fillRect(X0, Y0, RW, RH).lineStyle(1, P.lamp0).strokeRect(X0 + 0.5, Y0 + 0.5, RW, RH);
    txt(X0 + 6, Y0 + 3, 'REGOLE DEL FILTRO · si leggono dall\'alto ↓', P.lamp, 13);
    txt(X0 + 34, Y0 + 16, 'AZIONE      PROTO   PORTA   DESTINAZIONE', P.metal2, 12);
    this.rules.forEach((r, i) => {
      const y = this.rowY(i), on = i === this.sel, lift = on && this.grabbed ? 6 : 0;
      const decidedNow = this.tested && this.last.some((t, k) => k < this.revealed && t.by === i);
      g.fillStyle(r.locked ? 0x221d19 : 0x2c2520).fillRect(X0 + 6 + lift, y, RW - 12, 22);
      g.lineStyle(1, on ? (this.grabbed ? P.cyan3 : P.lamp2) : decidedNow ? P.lamp : P.metal, 1).strokeRect(X0 + 6.5 + lift, y + 0.5, RW - 13, 21);
      g.fillStyle(r.action === 'PERMETTI' ? P.phos : P.red).fillRect(X0 + 10 + lift, y + 4, 4, 14);
      const c = r.locked ? P.metal2 : P.cream2;
      txt(X0 + 18 + lift, y + 3, `${i + 1}`, P.metal2, 15);
      if (r.locked) txt(X0 + 34 + lift, y + 3, 'BLOCCA    tutto il resto            ▣', c, 15);
      else txt(X0 + 34 + lift, y + 3, `${r.action.padEnd(10)}  ${r.proto.padEnd(6)}  ${String(r.port).padEnd(6)}  ${r.dst}`, r.action === 'PERMETTI' ? P.phos : P.red2, 15);
      if (on) txt(X0 + 2 + lift, y + 3, this.grabbed ? '⇕' : '›', this.grabbed ? P.cyan3 : P.lamp2, 15);
    });
    txt(X0 + 6, Y0 + RH - 32, '↑↓ scegli   INVIO prendi/posa   A azione\nP protocollo   D destinazione   SPAZIO prova', P.metal2, 12);

    // requisiti e registro
    g.fillStyle(0x0e1414).fillRect(QX, Y0, QW, RH + 58).lineStyle(1, P.cyan1).strokeRect(QX + 0.5, Y0 + 0.5, QW, RH + 58);
    txt(QX + 6, Y0 + 3, this.tested ? 'REGISTRO DI PROVA' : 'REQUISITI · SPAZIO per provare', P.cyan1, 13);
    this.m.reqs.forEach((q, i) => {
      const y = Y0 + 22 + i * 44;
      const row = this.tested && i < this.revealed ? this.last[i] : undefined;
      const hidden = q.hidden && !this.tested;
      const col = row ? (row.ok ? P.phos : P.red) : P.metal;
      g.fillStyle(col).fillCircle(QX + 12, y + 8, 5);
      txt(QX + 22, y, hidden ? '???  (pacchetto dai registri)' : q.packet.label, hidden ? P.metal2 : P.cream2, 14);
      const what = `${q.packet.proto} ${q.packet.port} → ${q.packet.dst} · deve ${q.want === 'PERMETTI' ? 'passare' : 'essere bloccato'}`;
      txt(QX + 22, y + 13, hidden ? '' : what, P.conc, 12);
      if (row) txt(QX + 22, y + 25, `${row.by < 0 ? 'blocca tutto' : 'regola ' + (row.by + 1)}: ${row.got} ${row.ok ? '✓' : '✗'}`, row.ok ? P.phos : P.red2, 12);
    });
    if (this.flashText) txt(X0, Y0 + RH + 8, this.flashText, P.red2, 14);
  }

  update(_t: number, dt: number) { this.iris.update(dt); }
}
