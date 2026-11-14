import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { P, hex } from '../core/palette';
import { FONT_MONO, FONT_UI } from '../core/fonts';
import { IrisDialog } from '../iris/IrisDialog';
import { Audio } from '../audio/AudioManager';
import { Net, Device, dev, ifaceOf, isHost, linkUp, Leg } from './model';
import { CliState, runRouter, runPc, prompt, CliOut } from './cli';
import { makeLevel, Level, Difficulty, LEVELS } from './levels';
import { recordStars } from './progress';

// IRIS TRACER — banco di lavoro in stile Cisco Packet Tracer.
// Sinistra: la topologia (clic su un dispositivo per aprirlo). Destra: la CLI del dispositivo
// (IOS per i router, prompt dei comandi per i PC). In basso: guida, oppure gli eventi della modalità Simulazione.
const TX = 8, TY = 28, TW = 330, TH = 262;           // area topologia
const OX = TX + 14, OY = TY + 52;                      // origine delle coordinate dei dispositivi
const CX = 346, CY = 28, CW = VIEW_W - CX - 8, CH = 262; // pannello CLI
const ROWS = 15;

interface Term { st: CliState; lines: { t: string; c: number }[]; typed: string; history: string[]; hi: number }

export class TracerScene extends Phaser.Scene {
  private levelId = '1.1';
  private diff: Difficulty = 'studente';
  private lv!: Level;
  private net!: Net;
  private sel?: string;
  private terms: Record<string, Term> = {};
  private sim = false;
  private busy = false;
  private won = false;
  private pinged = new Set<string>();
  private hintsUsed = 0;
  private hintLevel = 0;
  private guideStep = 0;
  private startTime = 0;
  private simLog: string[] = [];
  private iris!: IrisDialog;
  private topo!: Phaser.GameObjects.Graphics;
  private topoTexts: Phaser.GameObjects.Text[] = [];
  private zones: Phaser.GameObjects.Zone[] = [];
  private termRows: Phaser.GameObjects.Text[] = [];
  private termTitle!: Phaser.GameObjects.Text;
  private bottom!: Phaser.GameObjects.Text;
  private objText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private simBtn!: Phaser.GameObjects.Text;
  private ring!: Phaser.GameObjects.Graphics;

  constructor() { super('tracer'); }

  init(data: { level?: string; diff?: Difficulty }) {
    this.levelId = data?.level ?? '1.1';
    this.diff = data?.diff ?? 'studente';
  }

  create() {
    this.lv = makeLevel(this.levelId, this.diff);
    this.net = this.lv.net;
    this.sel = undefined; this.terms = {}; this.sim = false; this.busy = false; this.won = false;
    this.pinged = new Set(); this.hintsUsed = 0; this.hintLevel = 0; this.guideStep = 0; this.simLog = [];

    // estetica "app": pannelli arrotondati, toni ardesia, griglia appena accennata
    const g = this.add.graphics();
    g.fillStyle(0x0d131a).fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle(0x141c25).fillRect(0, 0, VIEW_W, 24).lineStyle(1, 0x243241).lineBetween(0, 24, VIEW_W, 24);
    g.fillStyle(0x121b24).fillRoundedRect(TX, TY, TW, TH, 6).lineStyle(1, 0x2a3a4a).strokeRoundedRect(TX + 0.5, TY + 0.5, TW, TH, 6);
    g.fillStyle(0x1a2633, 1);
    for (let x = TX + 12; x < TX + TW - 4; x += 14) for (let y = TY + 12; y < TY + TH - 4; y += 14) g.fillRect(x, y, 1, 1);
    g.fillStyle(0x0a0f14).fillRoundedRect(CX, CY, CW, CH, 6).lineStyle(1, 0x2a3a4a).strokeRoundedRect(CX + 0.5, CY + 0.5, CW, CH, 6);
    g.fillStyle(0x16202b).fillRect(CX + 1, CY + 1, CW - 2, 17);
    g.fillStyle(0x141c25).fillRoundedRect(TX, 294, VIEW_W - 16, 58, 6).lineStyle(1, 0x2a3a4a).strokeRoundedRect(TX + 0.5, 294.5, VIEW_W - 16, 58, 6);

    const lvMeta = LEVELS.find((l) => l.id === this.levelId)!;
    this.add.text(8, 5, `IRIS TRACER · ${lvMeta.id} ${lvMeta.title.toUpperCase()}`, { fontFamily: FONT_UI, fontStyle: '700', fontSize: '8px', color: hex(P.cyan3) });
    this.add.text(250, 4, this.diff.toUpperCase(), { fontFamily: FONT_MONO, fontSize: '10.5px', color: hex(this.diff === 'studente' ? P.phos : this.diff === 'junior' ? P.lamp2 : P.red2) });
    this.timerText = this.add.text(330, 4, '', { fontFamily: FONT_MONO, fontSize: '10.5px', color: hex(P.cream) });
    this.simBtn = this.button(400, 4, '', () => this.toggleSim());
    if (this.diff !== 'esperto') this.button(520, 4, '[H] aiuto', () => this.hint());
    this.button(588, 4, '[Esc]', () => this.leave());

    this.topo = this.add.graphics();
    this.ring = this.add.graphics().setDepth(5);
    this.objText = this.add.text(TX + 6, TY + 4, '', { fontFamily: FONT_MONO, fontSize: '10px', color: hex(P.cream2), lineSpacing: -3 }).setDepth(6);
    this.termTitle = this.add.text(CX + 6, CY + 3, '', { fontFamily: FONT_MONO, fontSize: '10.5px', color: hex(P.cyan1) });
    this.termRows = Array.from({ length: ROWS }, (_, i) => this.add.text(CX + 6, CY + 20 + i * 15.6, '', { fontFamily: FONT_MONO, fontSize: '10.5px', color: hex(P.cyan3) }));
    this.bottom = this.add.text(TX + 6, 297, '', { fontFamily: FONT_MONO, fontSize: '10.5px', color: hex(P.lamp2), wordWrap: { width: VIEW_W - 30 }, lineSpacing: -3 });
    this.iris = new IrisDialog(this);

    this.drawTopology();
    this.makeZones();
    this.refreshPanel();
    this.refreshBottom();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.busy = true;
    this.time.delayedCall(300, () => this.iris.say(this.lv.brief, () => { this.busy = false; this.startTime = this.time.now; this.refreshBottom(); }));
  }

  private button(x: number, y: number, t: string, cb: () => void) {
    return this.add.text(x, y, t, { fontFamily: FONT_MONO, fontSize: '10.5px', color: hex(P.cream2) })
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.iris.open && !this.won) cb(); })
      .on('pointerover', function (this: Phaser.GameObjects.Text) { this.setColor(hex(P.cyan3)); })
      .on('pointerout', function (this: Phaser.GameObjects.Text) { this.setColor(hex(P.cream2)); });
  }

  // --- Topologia
  private pos(d: Device) { return { x: OX + d.x, y: OY + d.y }; }

  private drawTopology() {
    const g = this.topo.clear();
    this.topoTexts.forEach((t) => t.destroy());
    this.topoTexts = [];
    const txt = (x: number, y: number, t: string, c: number, size = 12) =>
      this.topoTexts.push(this.add.text(x, y, t, { fontFamily: FONT_MONO, fontSize: `${Math.round(size * 0.74)}px`, color: hex(c) }).setOrigin(0.5, 0));
    // cavi, con le spie alle estremità come in Packet Tracer
    for (const l of this.net.links) {
      const A = dev(this.net, l.a[0]), B = dev(this.net, l.b[0]);
      const pa = this.pos(A), pb = this.pos(B);
      const ia = ifaceOf(A, l.a[1])!, ib = ifaceOf(B, l.b[1])!;
      g.lineStyle(2, linkUp(this.net, l) ? 0x2b2b2b : 0x2b2b2b).lineBetween(pa.x, pa.y, pb.x, pb.y);
      g.lineStyle(1, 0x5a6266).lineBetween(pa.x, pa.y, pb.x, pb.y);
      const end = (p: { x: number; y: number }, q: { x: number; y: number }, up: boolean, other: boolean, name: string) => {
        const t = 0.24, x = p.x + (q.x - p.x) * t, y = p.y + (q.y - p.y) * t;
        g.fillStyle(up && other ? 0x3ccf5a : up ? 0xe0a030 : 0xd23a3a).fillTriangle(x - 3, y + 3, x + 3, y + 3, x, y - 3);
        if (name !== 'Fa0') txt(x, y + 3, name.replace('f0/', 'Fa0/').replace('g', 'G'), P.metal2, 10);
      };
      end(pa, pb, ia.up, ib.up, ia.name === 'f0' ? 'Fa0' : ia.name);
      end(pb, pa, ib.up, ia.up, ib.name === 'f0' ? 'Fa0' : ib.name);
    }
    // dispositivi
    for (const d of this.net.devices) {
      const { x, y } = this.pos(d);
      const on = d.id === this.sel;
      if (on) g.fillStyle(P.cyan, 0.15).fillRoundedRect(x - 22, y - 18, 44, 36, 4);
      if (d.type === 'pc' || d.type === 'server') {
        g.fillStyle(0xcfd6d8).fillRect(x - 12, y - 11, 24, 17).fillStyle(d.ifaces[0].ip ? 0x2a7fa8 : 0x1a2a30).fillRect(x - 10, y - 9, 20, 12);
        g.fillStyle(0x9aa3a6).fillRect(x - 3, y + 6, 6, 3).fillRect(x - 8, y + 9, 16, 2);
      } else if (d.type === 'switch') {
        g.fillStyle(0x2f6f9a).fillRoundedRect(x - 17, y - 7, 34, 14, 2).lineStyle(1, 0x8fc6e6).strokeRoundedRect(x - 17, y - 7, 34, 14, 2);
        g.lineStyle(1, 0xdff2ff).lineBetween(x - 10, y - 2, x + 10, y - 2).lineBetween(x - 10, y + 2, x + 10, y + 2);
      } else {
        g.fillStyle(0x2f6f9a).fillEllipse(x, y + 4, 30, 12).fillRect(x - 15, y - 4, 30, 8).fillStyle(0x4a95c4).fillEllipse(x, y - 4, 30, 12);
        g.lineStyle(1, 0xdff2ff).lineBetween(x - 7, y - 4, x + 7, y - 4).lineBetween(x, y - 8, x, y);
      }
      txt(x, d.type === 'router' ? y - 26 : y + 13, d.hostname, on ? P.cyan3 : P.cream, 13);
      if (isHost(d)) txt(x, y + 24, d.ifaces[0].ip ?? 'senza IP', d.ifaces[0].ip ? P.conc : P.red2, 11);
    }
    this.drawObjectives();
  }

  private drawObjectives() {
    this.objText.setText(this.lv.objectives.map((o) => `${this.met(o) ? '✔' : '○'} ${o.text}`).join('\n'));
  }

  private met(o: Level['objectives'][number]) {
    return o.check(this.net) && (!o.ping || this.pinged.has(`${o.ping.from}>${o.ping.ip}`));
  }

  private makeZones() {
    this.zones.forEach((z) => z.destroy());
    this.zones = this.net.devices.map((d) => {
      const { x, y } = this.pos(d);
      return this.add.zone(x, y, 46, 40).setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.iris.open && !this.won && !this.busy) this.open(d.id); });
    });
  }

  // --- Pannello del dispositivo
  private term(id: string): Term {
    if (!this.terms[id]) {
      const d = dev(this.net, id);
      this.terms[id] = { st: { mode: 'user' }, typed: '', history: [], hi: -1, lines: isHost(d)
        ? [{ t: 'Packet Tracer PC Command Line 1.0', c: P.metal2 }, { t: 'Comandi: ipconfig · ping · tracert', c: P.metal2 }]
        : [{ t: `${d.hostname} · Cisco IOS (simulato)`, c: P.metal2 }, { t: 'Premi INVIO per iniziare. ?  per i comandi.', c: P.metal2 }] };
    }
    return this.terms[id];
  }

  private open(id: string) {
    Audio.click();
    this.sel = id;
    this.term(id);
    this.drawTopology();
    this.refreshPanel();
    this.refreshBottom();
  }

  private refreshPanel() {
    if (!this.sel) {
      this.termTitle.setText('NESSUN DISPOSITIVO APERTO');
      const tips = ['', 'Clicca su un dispositivo', 'nella topologia per aprirlo.', '',
        'Router  → riga di comando IOS', 'PC      → prompt dei comandi', '',
        'Spie dei cavi:', '  ▲ verde   collegamento attivo', '  ▲ arancio una porta spenta', '  ▲ rossa   porta spenta'];
      this.termRows.forEach((t, i) => t.setText(tips[i] ?? '').setColor(hex(P.conc)));
      return;
    }
    const d = dev(this.net, this.sel), T = this.term(this.sel);
    this.termTitle.setText(`${d.hostname} · ${isHost(d) ? 'Desktop › Prompt dei comandi' : 'CLI'}`);
    const wrapped: { t: string; c: number }[] = [];
    for (const l of T.lines) {
      let r = l.t;
      while (r.length > 46) { let cut = r.lastIndexOf(' ', 46); if (cut < 12) cut = 46; wrapped.push({ t: r.slice(0, cut), c: l.c }); r = '  ' + r.slice(cut).trimStart(); }
      wrapped.push({ t: r, c: l.c });
    }
    const vis = wrapped.slice(-(ROWS - 1));
    const cursor = Math.floor(this.time.now / 450) % 2 ? '_' : ' ';
    this.termRows.forEach((t, i) => {
      if (i < vis.length) t.setText(vis[i].t).setColor(hex(vis[i].c));
      else if (i === vis.length) t.setText(`${prompt(d, T.st)}${T.typed}${cursor}`).setColor(hex(P.cream2));
      else t.setText('');
    });
  }

  private print(id: string, t: string, c: number = P.cyan3) { this.term(id).lines.push({ t, c }); }

  // --- Guida, eventi, aiuti
  private refreshBottom() {
    if (this.won) return;
    if (this.sim && this.simLog.length) { this.bottom.setColor(hex(P.cyan3)).setText('SIMULAZIONE · ' + this.simLog.slice(-3).join('\n')); return; }
    if (this.diff === 'studente') {
      const s = this.lv.guide[this.guideStep];
      if (s) { this.bottom.setColor(hex(P.lamp2)).setText(`PASSO ${this.guideStep + 1}/${this.lv.guide.length} · ${s.text}${s.cmd ? '   [TAB] scrive il comando' : ''}`); this.drawRing(s.device); return; }
    }
    this.drawRing();
    this.bottom.setColor(hex(P.conc)).setText(this.diff === 'esperto'
      ? 'ESPERTO · nessun aiuto. Trova tutti i guasti: la topologia non dice tutto.'
      : 'Obiettivi in alto a sinistra. [H] aiuto · [S] modalità Simulazione · clicca un dispositivo per aprirlo.');
  }

  private drawRing(id?: string) {
    this.tweens.killTweensOf(this.ring);
    this.ring.clear().setAlpha(1);
    if (!id || id === this.sel) return;
    const { x, y } = this.pos(dev(this.net, id));
    this.ring.lineStyle(2, P.lamp2).strokeCircle(x, y, 24);
    this.tweens.add({ targets: this.ring, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
  }

  private advanceGuide(id: string, raw: string) {
    if (this.diff !== 'studente') return;
    const s = this.lv.guide[this.guideStep];
    if (!s?.cmd || s.device !== id) return;
    const norm = (x: string) => x.toLowerCase().trim().replace(/\s+/g, ' ');
    const want = norm(s.cmd).split(' '), got = norm(raw).split(' ');
    const match = got.length === want.length && got.every((w, i) => want[i].startsWith(w) || w === want[i]);
    if (match) { this.guideStep++; this.refreshBottom(); }
  }

  private hint() {
    if (this.diff === 'esperto') return;
    this.hintsUsed++;
    const h = this.lv.hints[Math.min(this.hintLevel, this.lv.hints.length - 1)];
    this.hintLevel++;
    Audio.click();
    this.iris.say([`IRIS: ${h}`]);
  }

  private toggleSim() {
    this.sim = !this.sim;
    Audio.click();
    this.simLog = [];
    this.refreshBottom();
  }

  // --- Tastiera
  private onKey(e: KeyboardEvent) {
    if (this.iris.open) { if (['e', 'E', ' ', 'Enter'].includes(e.key)) this.iris.advance(); return; }
    if (this.won) { if (e.key === 'Enter') this.next(); else if (e.key === 'Escape') this.leave(); return; }
    if (this.busy) return;
    if (!this.sel) {
      if (e.key === 'Escape') return this.leave();
      if (e.key === 'h' || e.key === 'H') return this.hint();
      if (e.key === 's' || e.key === 'S') return this.toggleSim();
      return;
    }
    const T = this.term(this.sel);
    if (e.key === 'Escape') { this.sel = undefined; this.drawTopology(); this.refreshPanel(); this.refreshBottom(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = this.lv.guide[this.guideStep];
      if (this.diff === 'studente' && s?.cmd && s.device === this.sel) { T.typed = s.cmd; Audio.type(); }
      return this.refreshPanel();
    }
    if (e.key === 'Enter') { const raw = T.typed; T.typed = ''; return this.exec(this.sel, raw); }
    if (e.key === 'Backspace') { T.typed = T.typed.slice(0, -1); Audio.type(); return this.refreshPanel(); }
    if (e.key === 'ArrowUp') { if (T.history.length) { T.hi = Math.max(0, (T.hi < 0 ? T.history.length : T.hi) - 1); T.typed = T.history[T.hi]; } return this.refreshPanel(); }
    if (e.key.length === 1 && T.typed.length < 60) { T.typed += e.key; Audio.type(); this.refreshPanel(); }
  }

  private exec(id: string, raw: string) {
    const d = dev(this.net, id), T = this.term(id);
    this.print(id, `${prompt(d, T.st)}${raw}`, P.cream2);
    if (!raw.trim()) return this.refreshPanel();
    T.history.push(raw); T.hi = -1;
    const out: CliOut = isHost(d) ? runPc(this.net, d, raw) : runRouter(this.net, d, T.st, raw);
    out.lines.forEach((l) => this.print(id, l.t, l.kind === 'err' ? P.red2 : l.kind === 'ok' ? P.phos : P.cream));
    if (out.event === 'concept-error') Audio.error();
    this.advanceGuide(id, raw);
    this.drawTopology();
    if (out.ping) return this.animatePing(id, out);
    this.refreshPanel();
    this.checkWin();
  }

  // --- Pacchetti
  private animatePing(id: string, out: CliOut) {
    const { dst, result, tracert } = out.ping!;
    this.busy = true;
    this.simLog = [];
    this.print(id, tracert ? `Tracing route to ${dst}:` : `Pinging ${dst} with 32 bytes of data:`, P.cream);
    this.refreshPanel();
    const done = () => {
      if (tracert) {
        result.go.hops.forEach((h, i) => this.print(id, `  ${i + 1}  ${dev(this.net, h.dev).hostname}: ${h.note}`, P.cream));
        this.print(id, result.go.ok ? 'Trace complete.' : 'Traccia interrotta.', result.go.ok ? P.phos : P.red2);
      } else if (result.ok) {
        for (let i = 0; i < 4; i++) this.print(id, `Reply from ${dst}: bytes=32 time<1ms TTL=${126 - i % 2}`, P.phos);
        this.print(id, 'Ping statistics: Sent = 4, Received = 4, Lost = 0 (0% loss)', P.phos);
        this.pinged.add(`${out.ping!.from}>${dst}`);
        Audio.confirm();
      } else {
        const leg = result.go.ok ? result.back! : result.go;
        const msg = !result.go.ok && (leg as Extract<Leg, { ok: false }>).reason === 'noroute' ? `Reply from ${dst}: Destination host unreachable.` : 'Request timed out.';
        for (let i = 0; i < 4; i++) this.print(id, msg, P.red2);
        this.print(id, 'Ping statistics: Sent = 4, Received = 0, Lost = 4 (100% loss)', P.red2);
        if (!this.sim) this.print(id, 'Suggerimento: attiva la modalità Simulazione [S] per vedere dove si ferma.', P.metal2);
        Audio.error();
      }
      this.busy = false;
      this.refreshPanel();
      this.refreshBottom();
      this.checkWin();
    };
    this.animateLeg(result.go, P.cyan3, () => {
      if (!tracert && result.go.ok && result.back) this.animateLeg(result.back, P.lamp2, done);
      else done();
    });
  }

  private animateLeg(l: Leg, color: number, cb: () => void) {
    const pts = l.path.map((id) => this.pos(dev(this.net, id)));
    const step = this.sim ? 650 : 140;
    const env = this.add.rectangle(pts[0].x, pts[0].y - 10, 10, 7, color).setStrokeStyle(1, 0xffffff).setDepth(20);
    const decisions = new Map(l.hops.map((h) => [h.dev, h.note]));
    const note = (devId: string) => {
      const n = decisions.get(devId);
      const d = dev(this.net, devId);
      if (n) this.simLog.push(`${d.hostname}: ${n}`);
      else if (d.type === 'switch') this.simLog.push(`${d.hostname}: inoltra la busta verso la porta giusta (livello 2)`);
      if (this.sim) this.refreshBottom();
    };
    note(l.path[0]);
    const go = (i: number) => {
      if (i >= pts.length) {
        const ok = l.ok;
        if (!ok) {
          const end = pts[pts.length - 1];
          const x = this.add.text(end.x, end.y - 30, '✕', { fontFamily: FONT_MONO, fontSize: '13px', color: hex(P.red2) }).setOrigin(0.5).setDepth(21);
          this.tweens.add({ targets: x, alpha: 0, delay: this.sim ? 1600 : 700, duration: 400, onComplete: () => x.destroy() });
        }
        env.setFillStyle(ok ? P.phos : P.red);
        this.tweens.add({ targets: env, alpha: 0, scale: 1.8, duration: this.sim ? 500 : 250, onComplete: () => { env.destroy(); cb(); } });
        return;
      }
      this.tweens.add({ targets: env, x: pts[i].x, y: pts[i].y - 10, duration: step, onComplete: () => { note(l.path[i]); go(i + 1); } });
    };
    go(1);
  }

  // --- Vittoria e stelle
  private checkWin() {
    this.drawObjectives();
    if (this.won || !this.lv.objectives.every((o) => this.met(o))) return;
    this.won = true;
    const secs = Math.round((this.time.now - this.startTime) / 1000);
    const stars = 1 + (this.hintsUsed === 0 ? 1 : 0) + (secs <= this.lv.parTime ? 1 : 0);
    recordStars(this.levelId, this.diff, stars);
    this.drawRing();
    this.time.delayedCall(600, () => {
      Audio.power();
      const box = this.add.container(VIEW_W / 2, 150).setDepth(30);
      const bg = this.add.rectangle(0, 0, 360, 150, 0x0b1013, 0.96).setStrokeStyle(1, P.cyan3);
      const t1 = this.add.text(0, -58, 'RETE FUNZIONANTE', { fontFamily: FONT_UI, fontStyle: '700', fontSize: '10px', color: hex(P.phos) }).setOrigin(0.5);
      const t2 = this.add.text(0, -26, '★'.repeat(stars) + '☆'.repeat(3 - stars), { fontFamily: FONT_MONO, fontSize: '30px', color: hex(P.lamp2) }).setOrigin(0.5);
      const t3 = this.add.text(0, 14, `★ completato   ${this.hintsUsed === 0 ? '★' : '☆'} senza aiuti   ${secs <= this.lv.parTime ? '★' : '☆'} entro ${this.lv.parTime}s (${secs}s)`, { fontFamily: FONT_MONO, fontSize: '10px', color: hex(P.cream2) }).setOrigin(0.5);
      const hasNext = LEVELS.findIndex((l) => l.id === this.levelId) < LEVELS.length - 1;
      const t4 = this.add.text(0, 48, `${hasNext ? 'INVIO livello successivo · ' : ''}Esc torna a IRIS`, { fontFamily: FONT_MONO, fontSize: '10.5px', color: hex(P.cyan3) }).setOrigin(0.5);
      box.add([bg, t1, t2, t3, t4]);
      this.bottom.setText('');
      this.iris.say([`IRIS: ${this.lv.concept}: fatto. ${stars === 3 ? 'Perfetto.' : 'Puoi rigiocarlo: ogni volta la rete è diversa.'}`]);
    });
  }

  private next() {
    const i = LEVELS.findIndex((l) => l.id === this.levelId);
    if (i < LEVELS.length - 1) this.scene.restart({ level: LEVELS[i + 1].id, diff: this.diff });
    else this.leave();
  }

  private leave() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('tracerhub'));
  }

  update(_t: number, dt: number) {
    this.iris.update(dt);
    if (this.sel && !this.iris.open) this.refreshPanel();
    this.simBtn.setText(this.sim ? '[S] ▶ Simulazione' : '[S] Tempo reale');
    if (this.startTime && !this.won) {
      const s = Math.round((this.time.now - this.startTime) / 1000);
      this.timerText.setText(`⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`).setColor(hex(s > this.lv.parTime ? P.red2 : P.cream));
    }
  }
}
