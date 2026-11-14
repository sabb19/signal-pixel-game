import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { FONT_MONO, FONT_UI } from '../core/fonts';
import { IrisDialog } from '../iris/IrisDialog';
import { Audio } from '../audio/AudioManager';
import { Net, Device, dev, ifaceOf, isHost, linkUp, Leg, prefixOf, intToIp, netOf } from './model';
import { CliState, runRouter, runPc, prompt, CliOut, showRoute } from './cli';
import { makeLevel, Level, Difficulty, LEVELS } from './levels';
import { recordStars, addXp, earnBadge, BADGES } from './progress';
import { pickAttack, Attack } from './attacks';

// IRIS TRACER — interfaccia ispirata a Cisco Packet Tracer:
// barra dei menu, area di lavoro "Logica" chiara con griglia, pannello Attività (obiettivi),
// barra in basso con i dispositivi, la guida/gli eventi e le schede Tempo reale / Simulazione.
// Clic su un dispositivo → finestra con schede Fisico · Config · CLI (router) o Desktop (PC).

const C = {
  bar: 0xe4e7eb, bar2: 0xf3f4f6, line: 0xc4c9d0, text: '#1f2933', dim: '#5f6b7a', blue: 0x1e6fb8, blueT: '#1e6fb8',
  ws: 0xfbfcfd, grid: 0xe9edf1, ok: 0x2fa84f, okT: '#1f8a3e', warn: 0xe0a030, bad: 0xd23a3a, badT: '#c62828',
  title: 0x2c3e50, cliBg: 0xffffff, cmdBg: 0x111418,
};
const WS = { x: 0, y: 30, w: VIEW_W, h: 250 };          // area di lavoro
const OX = 20, OY = 92;                                   // origine coordinate dispositivi
const WIN = { x: 150, y: 36, w: 482, h: 240 };           // finestra del dispositivo
const ROWS = 13;

type Tab = 'fisico' | 'config' | 'cli';
interface Term { st: CliState; lines: { t: string; c: string }[]; typed: string; history: string[]; hi: number }

export class TracerScene extends Phaser.Scene {
  private levelId = '1.1';
  private diff: Difficulty = 'studente';
  private lv!: Level;
  private net!: Net;
  private sel?: string;
  private tab: Tab = 'cli';
  private terms: Record<string, Term> = {};
  private sim = false;
  private busy = false;
  private won = false;
  private pinged = new Set<string>();
  private hintsUsed = 0;
  private hintLevel = 0;
  private guideStep = 0;
  private startTime = 0;
  private simLog: { at: string; type: string; info: string }[] = [];
  private iris!: IrisDialog;
  private topo!: Phaser.GameObjects.Graphics;
  private topoTexts: Phaser.GameObjects.Text[] = [];
  private zones: Phaser.GameObjects.Zone[] = [];
  private act!: Phaser.GameObjects.Container;
  private bottomText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private modeBtns: Phaser.GameObjects.Text[] = [];
  private ring!: Phaser.GameObjects.Graphics;
  private win?: Phaser.GameObjects.Container;
  private winRows: Phaser.GameObjects.Text[] = [];
  private tut?: Phaser.GameObjects.Container;
  // --- gioco: salute della rete, attacchi di SILENCE, punti e serie
  private health = 100;
  private xp = 0;
  private streak = 0;
  private attack?: { a: Attack; at: number };
  private attacksDone = 0;
  private nextAttackAt = 0;
  private lost = false;
  private prevMet: boolean[] = [];
  private hud!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;
  private alert?: Phaser.GameObjects.Container;

  constructor() { super('tracer'); }

  init(data: { level?: string; diff?: Difficulty }) {
    this.levelId = data?.level ?? '1.1';
    this.diff = data?.diff ?? 'studente';
  }

  private t(x: number, y: number, s: string, color = C.text, size = 9, bold = false, mono = false) {
    return this.add.text(x, y, s, { fontFamily: mono ? FONT_MONO : FONT_UI, fontSize: `${size}px`, color, fontStyle: bold ? '700' : '400' });
  }

  create() {
    this.lv = makeLevel(this.levelId, this.diff);
    this.net = this.lv.net;
    this.sel = undefined; this.terms = {}; this.sim = false; this.busy = false; this.won = false; this.win = undefined; this.tut = undefined;
    this.pinged = new Set(); this.hintsUsed = 0; this.hintLevel = 0; this.guideStep = 0; this.simLog = [];
    this.health = 100; this.xp = 0; this.streak = 0; this.attack = undefined; this.attacksDone = 0; this.lost = false; this.alert = undefined;
    this.nextAttackAt = this.diff === 'esperto' ? 30 : 45;
    const meta = LEVELS.find((l) => l.id === this.levelId)!;

    const g = this.add.graphics();
    // barra dei menu + barra strumenti
    g.fillStyle(C.bar).fillRect(0, 0, VIEW_W, 14).fillStyle(C.bar2).fillRect(0, 14, VIEW_W, 16).lineStyle(1, C.line).lineBetween(0, 30, VIEW_W, 30);
    ['File', 'Modifica', 'Opzioni', 'Vista', 'Strumenti', 'Estensioni', 'Aiuto'].forEach((m, i) => this.t(6 + i * 44, 2, m, C.dim, 8));
    this.t(VIEW_W - 6, 2, `IRIS Tracer · ${meta.id} ${meta.title}`, C.text, 8, true).setOrigin(1, 0);
    const badge = { studente: [C.ok, 'STUDENTE'], junior: [C.warn, 'JUNIOR IT'], esperto: [C.bad, 'ESPERTO'] }[this.diff] as [number, string];
    g.fillStyle(badge[0]).fillRoundedRect(6, 17, 58, 11, 5);
    this.t(35, 18, badge[1], '#ffffff', 7.5, true).setOrigin(0.5, 0);
    this.timerText = this.t(74, 17.5, '', C.text, 8.5, false, true);
    this.tool(140, 'Aiuto (H)', () => this.hint(), this.diff === 'esperto');
    this.tool(196, 'Tutorial', () => this.startTutorial(), false);
    this.tool(246, 'Esci (Esc)', () => this.leave(), false);
    this.hud = this.add.graphics().setDepth(2);
    this.hudText = this.t(304, 17.5, 'RETE', C.text, 8, true);
    this.xpText = this.t(440, 17.5, '', C.blueT, 8.5, true);

    // area di lavoro "Logica"
    g.fillStyle(C.ws).fillRect(WS.x, WS.y, WS.w, WS.h);
    g.lineStyle(1, C.grid);
    for (let x = 0; x < VIEW_W; x += 16) g.lineBetween(x, WS.y, x, WS.y + WS.h);
    for (let y = WS.y; y < WS.y + WS.h; y += 16) g.lineBetween(0, y, VIEW_W, y);
    g.fillStyle(C.bar).fillRoundedRect(4, WS.y + 3, 44, 11, 3);
    this.t(26, WS.y + 4, 'Logica', C.text, 7.5, true).setOrigin(0.5, 0);

    // barra in basso: dispositivi · guida/eventi · modalità
    g.fillStyle(C.bar).fillRect(0, 280, VIEW_W, 80).lineStyle(1, C.line).lineBetween(0, 280, VIEW_W, 280);
    this.drawPalette(g);
    g.fillStyle(0xffffff).fillRoundedRect(112, 285, 420, 70, 4).lineStyle(1, C.line).strokeRoundedRect(112.5, 285.5, 420, 70, 4);
    this.bottomText = this.add.text(118, 289, '', { fontFamily: FONT_UI, fontSize: '9px', color: C.text, wordWrap: { width: 408 }, lineSpacing: 1 });
    this.modeBtns = [this.modeBtn(540, 290, '⏱ Tempo reale', false), this.modeBtn(540, 318, '▶ Simulazione', true)];

    this.topo = this.add.graphics();
    this.ring = this.add.graphics().setDepth(5);
    this.buildActivity();
    this.prevMet = this.lv.objectives.map(() => false);
    this.iris = new IrisDialog(this);

    this.drawTopology();
    this.makeZones();
    this.refreshBottom();
    this.refreshModes();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.busy = true;
    const firstTime = this.diff !== 'esperto' && !localStorage.getItem('signal.tracer.tutorial');
    this.time.delayedCall(300, () => this.iris.say(this.lv.brief, () => {
      this.busy = false;
      if (firstTime) this.startTutorial(); else this.begin();
    }));
  }

  private begin() { if (!this.startTime) this.startTime = this.time.now; this.refreshBottom(); }

  private tool(x: number, label: string, cb: () => void, disabled: boolean) {
    const b = this.t(x, 17.5, label, disabled ? '#a0a8b2' : C.blueT, 8.5, true);
    if (!disabled) b.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.iris.open && !this.tut) cb(); });
    return b;
  }

  private modeBtn(x: number, y: number, label: string, sim: boolean) {
    return this.t(x, y, label, C.text, 9, true).setPadding(6, 5, 6, 5).setFixedSize(92, 24)
      .setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.iris.open && !this.tut && this.sim !== sim) this.toggleSim(); });
  }

  private refreshModes() {
    this.modeBtns.forEach((b, i) => {
      const on = (i === 1) === this.sim;
      b.setBackgroundColor(on ? '#1e6fb8' : '#ffffff').setColor(on ? '#ffffff' : C.text);
    });
  }

  // tavolozza dei dispositivi in basso a sinistra (come in Packet Tracer; qui è informativa)
  private drawPalette(g: Phaser.GameObjects.Graphics) {
    const items: [string, (x: number, y: number) => void][] = [
      ['Router', (x, y) => this.iconRouter(g, x, y, 0.7)], ['Switch', (x, y) => this.iconSwitch(g, x, y, 0.7)],
      ['PC', (x, y) => this.iconPc(g, x, y, true, 0.7)], ['Cavi', (x, y) => { g.lineStyle(2, 0x222222).lineBetween(x - 8, y + 5, x + 8, y - 5); }],
    ];
    items.forEach(([label, draw], i) => {
      const x = 16 + (i % 2) * 46, y = 296 + Math.floor(i / 2) * 32;
      g.fillStyle(0xffffff).fillRoundedRect(x - 14, y - 12, 40, 28, 3).lineStyle(1, C.line).strokeRoundedRect(x - 13.5, y - 11.5, 40, 28, 3);
      draw(x + 6, y - 1);
      this.t(x + 6, y + 8, label, C.dim, 6.5).setOrigin(0.5, 0);
    });
  }

  // --- Icone in stile Packet Tracer
  private iconRouter(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1) {
    g.fillStyle(0x1f5f99).fillEllipse(x, y + 4 * s, 30 * s, 12 * s).fillRect(x - 15 * s, y - 3 * s, 30 * s, 7 * s);
    g.fillStyle(0x3b8fd6).fillEllipse(x, y - 3 * s, 30 * s, 12 * s);
    g.lineStyle(1.5 * s, 0xffffff).lineBetween(x - 8 * s, y - 3 * s, x + 8 * s, y - 3 * s).lineBetween(x, y - 7 * s, x, y + 1 * s);
  }
  private iconSwitch(g: Phaser.GameObjects.Graphics, x: number, y: number, s = 1) {
    g.fillStyle(0x1f5f99).fillRect(x - 17 * s, y - 3 * s, 34 * s, 9 * s).fillStyle(0x3b8fd6).fillRect(x - 17 * s, y - 8 * s, 34 * s, 6 * s);
    g.lineStyle(1.5 * s, 0xffffff).lineBetween(x - 10 * s, y - 5 * s, x + 10 * s, y - 5 * s);
  }
  private iconPc(g: Phaser.GameObjects.Graphics, x: number, y: number, hasIp: boolean, s = 1) {
    g.fillStyle(0xd9d2c3).fillRect(x - 12 * s, y - 11 * s, 24 * s, 17 * s).fillStyle(hasIp ? 0x2b7bbf : 0x37414b).fillRect(x - 10 * s, y - 9 * s, 20 * s, 12 * s);
    g.fillStyle(0xb9b1a2).fillRect(x - 3 * s, y + 6 * s, 6 * s, 3 * s).fillRect(x - 8 * s, y + 9 * s, 16 * s, 2 * s);
  }

  // --- Area di lavoro
  private pos(d: Device) { return { x: OX + d.x * 1.12, y: OY + d.y }; }

  private drawTopology() {
    const g = this.topo.clear();
    this.topoTexts.forEach((t) => t.destroy());
    this.topoTexts = [];
    const lbl = (x: number, y: number, s: string, color = C.text, size = 8.5, bold = false) =>
      this.topoTexts.push(this.t(x, y, s, color, size, bold).setOrigin(0.5, 0));
    for (const l of this.net.links) {
      const A = dev(this.net, l.a[0]), B = dev(this.net, l.b[0]);
      const pa = this.pos(A), pb = this.pos(B);
      const ia = ifaceOf(A, l.a[1])!, ib = ifaceOf(B, l.b[1])!;
      g.lineStyle(1.6, 0x1b1b1b).lineBetween(pa.x, pa.y, pb.x, pb.y);
      const end = (p: { x: number; y: number }, q: { x: number; y: number }, up: boolean, other: boolean, name: string) => {
        const k = 0.22, x = p.x + (q.x - p.x) * k, y = p.y + (q.y - p.y) * k;
        g.fillStyle(up && other ? C.ok : up ? C.warn : C.bad).fillTriangle(x - 4, y + 3, x + 4, y + 3, x, y - 4);
        if (name) lbl(x, y + 4, name, C.dim, 7);
      };
      const nm = (d: Device, n: string) => (isHost(d) ? '' : n.replace('f0/', 'Fa0/').replace(/^g/, 'Gig'));
      end(pa, pb, ia.up, ib.up, nm(A, ia.name));
      end(pb, pa, ib.up, ia.up, nm(B, ib.name));
    }
    for (const d of this.net.devices) {
      const { x, y } = this.pos(d);
      if (d.id === this.sel) g.lineStyle(1, C.blue).strokeRoundedRect(x - 22, y - 16, 44, 32, 3);
      if (isHost(d)) this.iconPc(g, x, y, !!d.ifaces[0].ip);
      else if (d.type === 'switch') this.iconSwitch(g, x, y);
      else this.iconRouter(g, x, y);
      lbl(x, d.type === 'router' ? y - 24 : y + 13, d.hostname, C.text, 9, true);
      if (isHost(d)) lbl(x, y + 24, d.ifaces[0].ip ?? 'senza IP', d.ifaces[0].ip ? C.dim : C.badT, 7.5);
    }
    this.refreshActivity();
  }

  private makeZones() {
    this.zones.forEach((z) => z.destroy());
    this.zones = this.net.devices.map((d) => {
      const { x, y } = this.pos(d);
      return this.add.zone(x, y, 46, 40).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { if (!this.iris.open && !this.won && !this.busy && !this.tut) this.open(d.id); });
    });
  }

  // --- Pannello Attività (obiettivi, come l'Activity Wizard di Packet Tracer)
  private actRows: Phaser.GameObjects.Text[] = [];
  private actBar!: Phaser.GameObjects.Graphics;
  private actPct!: Phaser.GameObjects.Text;
  private buildActivity() {
    const x = VIEW_W - 196, y = WS.y + 6, w = 190, h = 22 + this.lv.objectives.length * 22 + 18;
    this.act = this.add.container(0, 0).setDepth(8);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.08).fillRoundedRect(x + 2, y + 2, w, h, 4);
    g.fillStyle(0xffffff).fillRoundedRect(x, y, w, h, 4).lineStyle(1, C.line).strokeRoundedRect(x + 0.5, y + 0.5, w, h, 4);
    g.fillStyle(C.blue).fillRoundedRect(x, y, w, 16, { tl: 4, tr: 4, bl: 0, br: 0 });
    this.act.add(g);
    this.act.add(this.t(x + 6, y + 3, 'Attività · obiettivi', '#ffffff', 8.5, true));
    this.actRows = this.lv.objectives.map((_, i) => this.add.text(x + 6, y + 21 + i * 22, '', { fontFamily: FONT_UI, fontSize: '8.5px', color: C.text, wordWrap: { width: w - 12 } }));
    this.actRows.forEach((r) => this.act.add(r));
    this.actBar = this.add.graphics();
    this.actPct = this.t(x + w - 6, y + h - 13, '', C.dim, 7.5).setOrigin(1, 0);
    this.act.add([this.actBar, this.actPct]);
    (this.act as unknown as { box: number[] }).box = [x, y, w, h];
  }

  private refreshActivity() {
    if (!this.actRows.length) return;
    const [x, y, w, h] = (this.act as unknown as { box: number[] }).box;
    let done = 0;
    this.lv.objectives.forEach((o, i) => {
      const m = this.met(o); if (m) done++;
      this.actRows[i].setText(`${m ? '✔' : '○'}  ${o.text}`).setColor(m ? C.okT : C.text);
    });
    const pct = Math.round((done / this.lv.objectives.length) * 100);
    this.actBar.clear().fillStyle(C.grid).fillRoundedRect(x + 6, y + h - 12, w - 50, 6, 3).fillStyle(C.ok).fillRoundedRect(x + 6, y + h - 12, Math.max(4, (w - 50) * pct / 100), 6, 3);
    this.actPct.setText(`${pct}%`);
  }

  private met(o: Level['objectives'][number]) {
    return o.check(this.net) && (!o.ping || this.pinged.has(`${o.ping.from}>${o.ping.ip}`));
  }

  // --- Finestra del dispositivo (Fisico · Config · CLI/Desktop)
  private term(id: string): Term {
    if (!this.terms[id]) {
      const d = dev(this.net, id);
      this.terms[id] = { st: { mode: 'user' }, typed: '', history: [], hi: -1, lines: isHost(d)
        ? [{ t: 'Cisco Packet Tracer PC Command Line 1.0', c: '#c8d0d8' }, { t: 'Comandi: ipconfig · ping · tracert', c: '#8a96a3' }]
        : [{ t: `${d.hostname} — Cisco IOS Software (simulato)`, c: C.dim }, { t: 'Premi INVIO per iniziare.  ?  elenca i comandi.', c: C.dim }] };
    }
    return this.terms[id];
  }

  private open(id: string) {
    Audio.click();
    this.sel = id;
    this.tab = 'cli';
    this.term(id);
    this.buildWindow();
    this.drawTopology();
    this.refreshBottom();
  }

  private closeWin() {
    this.win?.destroy(); this.win = undefined; this.winRows = [];
    this.sel = undefined;
    this.drawTopology(); this.refreshBottom();
  }

  private buildWindow() {
    this.win?.destroy();
    const d = dev(this.net, this.sel!);
    const { x, y, w, h } = WIN;
    const c = this.add.container(0, 0).setDepth(20);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.18).fillRoundedRect(x + 3, y + 4, w, h, 5);
    g.fillStyle(0xf6f7f9).fillRoundedRect(x, y, w, h, 5).lineStyle(1, 0x9aa4b0).strokeRoundedRect(x + 0.5, y + 0.5, w, h, 5);
    g.fillStyle(C.title).fillRoundedRect(x, y, w, 16, { tl: 5, tr: 5, bl: 0, br: 0 });
    c.add(g);
    c.add(this.t(x + 8, y + 3, d.hostname, '#ffffff', 9, true));
    // passa a un altro dispositivo senza chiudere (la finestra copre parte della topologia)
    let bx = x + 70;
    c.add(this.t(bx, y + 3.5, 'Apri:', '#9fb3c8', 8));
    bx += 26;
    for (const o of this.net.devices) {
      if (o.type === 'switch') continue;
      const on = o.id === d.id;
      const b2 = this.t(bx, y + 3, o.hostname, on ? '#ffffff' : '#9fd0ff', 8.5, on);
      if (!on) b2.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.busy && !this.iris.open) this.open(o.id); });
      c.add(b2);
      bx += b2.width + 10;
    }
    const close = this.t(x + w - 14, y + 2, '✕', '#ffffff', 10, true).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.closeWin());
    c.add(close);
    const tabs: [Tab, string][] = [['fisico', 'Fisico'], ['config', 'Config'], ['cli', isHost(d) ? 'Desktop' : 'CLI']];
    tabs.forEach(([id, label], i) => {
      const on = this.tab === id;
      const b = this.t(x + 8 + i * 70, y + 20, label, on ? C.text : C.dim, 9, on).setPadding(8, 3, 8, 3).setFixedSize(66, 17)
        .setBackgroundColor(on ? '#ffffff' : '#e4e7eb').setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.tab = id; Audio.click(); this.buildWindow(); });
      c.add(b);
    });
    const body = { x: x + 8, y: y + 40, w: w - 16, h: h - 48 };
    const bg = this.add.graphics();
    const dark = this.tab === 'cli' && isHost(d);
    bg.fillStyle(dark ? C.cmdBg : 0xffffff).fillRect(body.x, body.y, body.w, body.h).lineStyle(1, C.line).strokeRect(body.x + 0.5, body.y + 0.5, body.w, body.h);
    c.add(bg);
    this.winRows = Array.from({ length: ROWS }, (_, i) => this.add.text(body.x + 6, body.y + 4 + i * 14.4, '', { fontFamily: FONT_MONO, fontSize: '9.5px', color: C.text }));
    this.winRows.forEach((r) => c.add(r));
    this.win = c;
    this.refreshWindow();
  }

  private refreshWindow() {
    if (!this.win || !this.sel) return;
    const d = dev(this.net, this.sel);
    let rows: { t: string; c: string }[] = [];
    if (this.tab === 'fisico') {
      rows = [{ t: `${d.hostname} · ${d.type === 'router' ? 'Router Cisco ISR 4331 (simulato)' : d.type === 'switch' ? 'Switch Cisco Catalyst 2960' : 'PC'}`, c: C.text }, { t: '', c: C.text },
        { t: 'Porte:', c: C.dim },
        ...d.ifaces.map((i) => { const p = this.net.links.some((l) => (l.a[0] === d.id && l.a[1] === i.name) || (l.b[0] === d.id && l.b[1] === i.name));
          return { t: `  ${i.up ? '●' : '○'} ${i.name.padEnd(6)} ${p ? 'cavo collegato' : 'libera'}${i.up ? '' : ' · spenta'}`, c: i.up ? C.okT : C.badT }; })];
    } else if (this.tab === 'config') {
      if (isHost(d)) {
        const n = d.ifaces[0];
        rows = [{ t: 'Configurazione IP (FastEthernet0)', c: C.blueT }, { t: '', c: C.text },
          { t: `Indirizzo IP . . . . ${n.ip ?? '—'}`, c: C.text }, { t: `Subnet mask . . . . . ${n.mask ?? '—'}${n.mask ? '  (/' + prefixOf(n.mask) + ')' : ''}`, c: C.text },
          { t: `Gateway predefinito  ${d.gateway ?? '—'}`, c: C.text }, { t: '', c: C.text },
          { t: n.ip && n.mask ? `Rete: ${intToIp(netOf(n.ip, n.mask))}/${prefixOf(n.mask)}` : 'Nessuna rete: il PC non ha indirizzo.', c: C.dim },
          { t: 'Per cambiare: scheda Desktop → ipconfig IP MASCHERA GATEWAY', c: C.dim }];
      } else {
        rows = [{ t: 'Interfacce', c: C.blueT },
          ...d.ifaces.map((i) => ({ t: `  ${i.name.padEnd(6)} ${(i.ip ?? 'senza IP').padEnd(16)} ${(i.mask ? '/' + prefixOf(i.mask) : '').padEnd(4)} ${i.up ? 'accesa' : 'spenta'}`, c: i.up ? C.text : C.badT })),
          { t: '', c: C.text }, { t: 'Tabella di instradamento', c: C.blueT },
          ...showRoute(d).slice(2).map((r) => ({ t: '  ' + r, c: C.text })),
          { t: '', c: C.text }, { t: 'Per cambiare: scheda CLI (enable → configure terminal)', c: C.dim }];
      }
    } else {
      const T = this.term(this.sel);
      const W = 74;
      const wrapped: { t: string; c: string }[] = [];
      for (const l of T.lines) {
        let r = l.t;
        while (r.length > W) { let cut = r.lastIndexOf(' ', W); if (cut < 12) cut = W; wrapped.push({ t: r.slice(0, cut), c: l.c }); r = '  ' + r.slice(cut).trimStart(); }
        wrapped.push({ t: r, c: l.c });
      }
      rows = wrapped.slice(-(ROWS - 1));
      const cursor = Math.floor(this.time.now / 450) % 2 ? '_' : ' ';
      rows.push({ t: `${prompt(d, T.st)}${T.typed}${cursor}`, c: isHost(d) ? '#ffffff' : '#000000' });
    }
    this.winRows.forEach((r, i) => { const v = rows[i]; r.setText(v?.t ?? '').setColor(v?.c ?? C.text); });
  }

  private print(id: string, t: string, kind: 'in' | 'out' | 'ok' | 'err' | 'dim' = 'out') {
    const pc = isHost(dev(this.net, id));
    const col = { in: pc ? '#ffffff' : '#000000', out: pc ? '#d7dde3' : '#1f2933', ok: pc ? '#6fe38a' : C.okT, err: pc ? '#ff7a7a' : C.badT, dim: pc ? '#8a96a3' : C.dim }[kind];
    this.term(id).lines.push({ t, c: col });
  }

  // --- Guida, eventi, aiuti (barra in basso)
  private refreshBottom() {
    if (this.won) return;
    if (this.sim && this.simLog.length) {
      const rows = this.simLog.slice(-4).map((e, i, a) => `${i === a.length - 1 ? '▶' : ' '} ${e.at.padEnd(8)} ${e.type.padEnd(5)} ${e.info}`);
      this.bottomText.setFontFamily(FONT_MONO).setFontSize(8.5).setColor(C.text).setText('Elenco eventi · Dispositivo · Tipo · Decisione\n' + rows.join('\n'));
      return;
    }
    this.bottomText.setFontFamily(FONT_UI).setFontSize(9);
    if (this.diff === 'studente') {
      const s = this.lv.guide[this.guideStep];
      if (s) {
        this.bottomText.setColor(C.text).setText(`GUIDA · passo ${this.guideStep + 1} di ${this.lv.guide.length}\n${s.text}${s.cmd ? '\nNella scheda CLI/Desktop premi  TAB  per scrivere il comando.' : ''}`);
        this.drawRing(s.device); return;
      }
    }
    this.drawRing();
    this.bottomText.setColor(C.dim).setText(this.diff === 'esperto'
      ? 'ESPERTO · nessun aiuto, guasti nascosti. Usa Config, show e la Simulazione per trovarli.'
      : 'Clicca un dispositivo per aprirlo. Aiuto (H) se ti blocchi. In Simulazione vedi ogni pacchetto, tappa per tappa.');
  }

  private drawRing(id?: string) {
    this.tweens.killTweensOf(this.ring);
    this.ring.clear().setAlpha(1);
    if (!id || id === this.sel) return;
    const { x, y } = this.pos(dev(this.net, id));
    this.ring.lineStyle(2, 0xf0a020).strokeCircle(x, y, 24);
    this.tweens.add({ targets: this.ring, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
  }

  private advanceGuide(id: string, raw: string) {
    if (this.diff !== 'studente') return;
    const s = this.lv.guide[this.guideStep];
    if (!s?.cmd || s.device !== id) return;
    const norm = (x: string) => x.toLowerCase().trim().replace(/\s+/g, ' ');
    const want = norm(s.cmd).split(' '), got = norm(raw).split(' ');
    if (got.length === want.length && got.every((w, i) => want[i].startsWith(w) || w === want[i])) { this.guideStep++; this.refreshBottom(); }
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
    this.refreshModes();
    this.refreshBottom();
  }

  // --- Tutorial iniziale (principianti): evidenzia una parte dell'interfaccia alla volta
  private startTutorial() {
    this.closeWin();
    const first = this.net.devices.find((d) => d.type === 'router') ?? this.net.devices[0];
    const p = this.pos(first);
    const [ax, ay, aw, ah] = (this.act as unknown as { box: number[] }).box;
    const steps: { r: number[]; title: string; text: string }[] = [
      { r: [0, WS.y, VIEW_W, WS.h], title: 'L\'area di lavoro', text: 'Qui c\'è la rete da riparare, come nella vista Logica di Packet Tracer. Le spie sui cavi dicono se una porta è accesa (verde) o spenta (rossa).' },
      { r: [ax, ay, aw, ah], title: 'Attività', text: 'Gli obiettivi del livello. Si spuntano da soli quando la rete funziona. La barra mostra il completamento.' },
      { r: [p.x - 26, p.y - 30, 52, 60], title: 'I dispositivi', text: 'Clicca un dispositivo per aprirlo. Il router ha la CLI con i comandi Cisco IOS; il PC ha il Desktop con il prompt dei comandi.' },
      { r: [112, 285, 420, 70], title: 'Guida', text: 'Qui IRIS ti dice il prossimo passo. Nella CLI premi TAB per scrivere il comando suggerito, poi INVIO.' },
      { r: [536, 286, 100, 60], title: 'Tempo reale / Simulazione', text: 'In Simulazione ogni ping viaggia lentamente e qui sotto vedi cosa decide ogni dispositivo: il modo migliore per capire dove si rompe la rete.' },
    ];
    let i = 0;
    const c = this.add.container(0, 0).setDepth(40);
    this.tut = c;
    const show = () => {
      c.removeAll(true);
      if (i >= steps.length) {
        c.destroy(); this.tut = undefined;
        try { localStorage.setItem('signal.tracer.tutorial', '1'); } catch { /* niente */ }
        this.begin(); return;
      }
      const s = steps[i];
      const [x, y, w, h] = s.r;
      const g = this.add.graphics();
      g.fillStyle(0x0b1220, 0.6);
      g.fillRect(0, 0, VIEW_W, y).fillRect(0, y + h, VIEW_W, VIEW_H - y - h).fillRect(0, y, x, h).fillRect(x + w, y, VIEW_W - x - w, h);
      g.lineStyle(2, 0xf0a020).strokeRoundedRect(x, y, w, h, 4);
      const bx = Phaser.Math.Clamp(x + w / 2 - 130, 8, VIEW_W - 268), by = y + h + 8 + 70 < VIEW_H ? y + h + 8 : Math.max(8, y - 78);
      g.fillStyle(0xffffff).fillRoundedRect(bx, by, 260, 70, 5).lineStyle(1, C.line).strokeRoundedRect(bx + 0.5, by + 0.5, 260, 70, 5);
      c.add(g);
      c.add(this.t(bx + 8, by + 6, `${s.title}  ·  ${i + 1}/${steps.length}`, C.blueT, 9.5, true));
      c.add(this.add.text(bx + 8, by + 21, s.text, { fontFamily: FONT_UI, fontSize: '8.5px', color: C.text, wordWrap: { width: 244 }, lineSpacing: 1 }));
      c.add(this.t(bx + 252, by + 58, 'INVIO / clic avanti · Esc salta', C.dim, 7).setOrigin(1, 0));
    };
    this.tutNext = () => { i++; Audio.click(); show(); };
    this.tutSkip = () => { i = steps.length; show(); };
    show();
  }
  private tutNext?: () => void;
  private tutSkip?: () => void;

  // --- Tastiera
  private onKey(e: KeyboardEvent) {
    if (this.iris.open) { if (['e', 'E', ' ', 'Enter'].includes(e.key)) this.iris.advance(); return; }
    if (this.tut) { if (e.key === 'Escape') this.tutSkip?.(); else if (['Enter', ' ', 'e', 'E'].includes(e.key)) this.tutNext?.(); return; }
    if (this.won) { if (e.key === 'Enter') (this.lost ? this.scene.restart({ level: this.levelId, diff: this.diff }) : this.next()); else if (e.key === 'Escape') this.leave(); return; }
    if (this.busy) return;
    if (!this.sel) {
      if (e.key === 'Escape') return this.leave();
      if (e.key === 'h' || e.key === 'H') return this.hint();
      if (e.key === 's' || e.key === 'S') return this.toggleSim();
      return;
    }
    if (e.key === 'Escape') return this.closeWin();
    if (this.tab !== 'cli') { if (e.key === 'Tab') { e.preventDefault(); this.tab = 'cli'; this.buildWindow(); } return; }
    const T = this.term(this.sel);
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = this.lv.guide[this.guideStep];
      if (this.diff === 'studente' && s?.cmd && s.device === this.sel) { T.typed = s.cmd; Audio.type(); }
      return this.refreshWindow();
    }
    if (e.key === 'Enter') { const raw = T.typed; T.typed = ''; return this.exec(this.sel, raw); }
    if (e.key === 'Backspace') { T.typed = T.typed.slice(0, -1); Audio.type(); return this.refreshWindow(); }
    if (e.key === 'ArrowUp') { if (T.history.length) { T.hi = Math.max(0, (T.hi < 0 ? T.history.length : T.hi) - 1); T.typed = T.history[T.hi]; } return this.refreshWindow(); }
    if (e.key.length === 1 && T.typed.length < 70) { T.typed += e.key; Audio.type(); this.refreshWindow(); }
  }

  private exec(id: string, raw: string) {
    const d = dev(this.net, id), T = this.term(id);
    this.print(id, `${prompt(d, T.st)}${raw}`, 'in');
    if (!raw.trim()) return this.refreshWindow();
    T.history.push(raw); T.hi = -1;
    const out: CliOut = isHost(d) ? runPc(this.net, d, raw) : runRouter(this.net, d, T.st, raw);
    out.lines.forEach((l) => this.print(id, l.t, l.kind === 'err' ? 'err' : l.kind === 'ok' ? 'ok' : 'out'));
    if (out.event === 'concept-error') Audio.error();
    const failed = out.lines.some((l) => l.kind === 'err');
    if (failed) this.streak = 0;
    else if (out.event && !out.ping) this.reward(id, 5, false);
    const before = this.guideStep;
    this.advanceGuide(id, raw);
    if (this.guideStep > before) this.reward(id, 10, false);
    this.drawTopology();
    if (out.ping) return this.animatePing(id, out);
    this.refreshWindow();
    this.checkWin();
  }

  // --- Pacchetti
  private animatePing(id: string, out: CliOut) {
    const { dst, result, tracert } = out.ping!;
    this.busy = true;
    this.simLog = [];
    this.print(id, tracert ? `Tracing route to ${dst}:` : `Pinging ${dst} with 32 bytes of data:`);
    this.refreshWindow();
    const done = () => {
      if (tracert) {
        result.go.hops.forEach((h, i) => this.print(id, `  ${i + 1}  ${dev(this.net, h.dev).hostname}: ${h.note}`));
        this.print(id, result.go.ok ? 'Trace complete.' : 'Traccia interrotta.', result.go.ok ? 'ok' : 'err');
      } else if (result.ok) {
        for (let i = 0; i < 4; i++) this.print(id, `Reply from ${dst}: bytes=32 time<1ms TTL=${126 - i % 2}`, 'ok');
        this.print(id, 'Ping statistics: Sent = 4, Received = 4, Lost = 0 (0% loss)', 'ok');
        this.pinged.add(`${out.ping!.from}>${dst}`);
        this.reward(id, 20, true);
        this.badge('primo-ping');
        Audio.confirm();
      } else {
        const leg = result.go.ok ? result.back! : result.go;
        const msg = !result.go.ok && (leg as Extract<Leg, { ok: false }>).reason === 'noroute' ? `Reply from ${dst}: Destination host unreachable.` : 'Request timed out.';
        for (let i = 0; i < 4; i++) this.print(id, msg, 'err');
        this.print(id, 'Ping statistics: Sent = 4, Received = 0, Lost = 4 (100% loss)', 'err');
        if (!this.sim) this.print(id, 'Suggerimento: passa a Simulazione (in basso a destra) per vedere dove si ferma.', 'dim');
        Audio.error();
      }
      this.busy = false;
      this.refreshWindow();
      this.refreshBottom();
      this.checkWin();
    };
    this.animateLeg(result.go, 0x2b7bbf, () => {
      if (!tracert && result.go.ok && result.back) this.animateLeg(result.back, 0xe08a1e, done);
      else done();
    });
  }

  private animateLeg(l: Leg, color: number, cb: () => void) {
    const pts = l.path.map((id) => this.pos(dev(this.net, id)));
    const step = this.sim ? 650 : 140;
    // la busta, come in Packet Tracer
    const env = this.add.container(pts[0].x, pts[0].y - 12).setDepth(25);
    const eg = this.add.graphics().fillStyle(color).fillRect(-6, -4, 12, 8).lineStyle(1, 0xffffff).strokeRect(-6, -4, 12, 8).lineBetween(-6, -4, 0, 1).lineBetween(6, -4, 0, 1);
    env.add(eg);
    const decisions = new Map(l.hops.map((h) => [h.dev, h.note]));
    const note = (devId: string) => {
      const n = decisions.get(devId), d = dev(this.net, devId);
      if (n) this.simLog.push({ at: d.hostname, type: 'ICMP', info: n });
      else if (d.type === 'switch') this.simLog.push({ at: d.hostname, type: 'ICMP', info: 'inoltra la busta sulla porta giusta (livello 2)' });
      if (this.sim) this.refreshBottom();
    };
    note(l.path[0]);
    const go = (i: number) => {
      if (i >= pts.length) {
        if (!l.ok) {
          const end = pts[pts.length - 1];
          const x = this.t(end.x, end.y - 34, '✕', C.badT, 14, true).setOrigin(0.5).setDepth(26);
          this.tweens.add({ targets: x, alpha: 0, delay: this.sim ? 1600 : 700, duration: 400, onComplete: () => x.destroy() });
        }
        this.tweens.add({ targets: env, alpha: 0, scale: 1.8, duration: this.sim ? 500 : 250, onComplete: () => { env.destroy(); cb(); } });
        return;
      }
      this.tweens.add({ targets: env, x: pts[i].x, y: pts[i].y - 12, duration: step, onComplete: () => { note(l.path[i]); go(i + 1); } });
    };
    go(1);
  }

  // --- Vittoria e stelle
  // --- Gioco: punti, serie, distintivi, attacchi
  private reward(devId: string, base: number, big: boolean) {
    this.streak++;
    const mult = this.streak >= 6 ? 3 : this.streak >= 3 ? 2 : 1;
    const pts = base * mult;
    this.xp += pts; addXp(pts);
    if (this.streak === 5) this.badge('serie-5');
    const p = this.pos(dev(this.net, devId));
    this.popup(p.x, p.y - 30, `+${pts}${mult > 1 ? ` ×${mult}` : ''}`, big ? '#1f8a3e' : '#1e6fb8', big ? 12 : 10);
  }

  private popup(x: number, y: number, s: string, color: string, size = 10) {
    const t = this.t(x, y, s, color, size, true).setOrigin(0.5).setDepth(60).setStroke('#ffffff', 3);
    this.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 1100, ease: 'Sine.out', onComplete: () => t.destroy() });
  }

  private badge(id: string) {
    if (!earnBadge(id)) return;
    const b = BADGES[id];
    const c = this.add.container(VIEW_W / 2, WS.y + 18).setDepth(70).setAlpha(0);
    const tx = this.t(0, 0, `🏅 Distintivo: ${b.name} — ${b.desc}`, '#5a3d00', 9, true).setOrigin(0.5);
    const g = this.add.graphics().fillStyle(0xffd76a).fillRoundedRect(-tx.width / 2 - 10, -9, tx.width + 20, 18, 9).lineStyle(1, 0xc9962a).strokeRoundedRect(-tx.width / 2 - 10, -9, tx.width + 20, 18, 9);
    c.add([g, tx]);
    Audio.confirm();
    this.tweens.add({ targets: c, alpha: 1, y: WS.y + 26, duration: 300, hold: 2600, yoyo: true, onComplete: () => c.destroy() });
  }

  private objectivesTick() {
    this.lv.objectives.forEach((o, i) => {
      const m = this.met(o);
      if (m && !this.prevMet[i] && this.startTime) {
        const [x, y] = (this.act as unknown as { box: number[] }).box;
        this.xp += 50; addXp(50);
        this.popup(x + 95, y + 30 + i * 22, '+50 obiettivo', '#1f8a3e', 11);
        this.health = Math.min(100, this.health + 10);
      }
      this.prevMet[i] = m;
    });
  }

  private doAttack() {
    const a = pickAttack(this.net);
    this.attacksDone++;
    if (!a) return;
    this.attack = { a, at: this.time.now };
    this.drawTopology();
    this.refreshWindow();
    Audio.error();
    this.cameras.main.shake(350, 0.006);
    const p = this.pos(dev(this.net, a.target));
    const burst = this.add.circle(p.x, p.y, 8, C.bad, 0.5).setDepth(30);
    this.tweens.add({ targets: burst, radius: 46, alpha: 0, duration: 700, onComplete: () => burst.destroy() });
    this.alert?.destroy();
    const msg = `⚠ SILENCE · ${this.diff === 'esperto' ? a.vague : a.desc}`;
    const c = this.add.container(8, WS.y + 18).setDepth(45);
    const tx = this.t(10, 0, msg, '#ffffff', 9, true).setOrigin(0, 0.5);
    const g = this.add.graphics().fillStyle(C.bad).fillRoundedRect(0, -9, tx.width + 20, 18, 4);
    c.add([g, tx]);
    this.tweens.add({ targets: c, alpha: 0.55, duration: 450, yoyo: true, repeat: -1 });
    this.alert = c;
  }

  private attackTick() {
    if (!this.attack) return;
    if (!this.attack.a.fixed(this.net)) return;
    const secs = (this.time.now - this.attack.at) / 1000;
    this.alert?.destroy(); this.alert = undefined;
    const p = this.pos(dev(this.net, this.attack.a.target));
    this.attack = undefined;
    this.health = Math.min(100, this.health + 15);
    this.xp += 40; addXp(40);
    this.popup(p.x, p.y - 34, 'Attacco respinto! +40', '#1f8a3e', 11);
    if (secs < 20) this.badge('contrattacco');
    this.nextAttackAt = (this.time.now - this.startTime) / 1000 + 30;
  }

  private lose() {
    this.lost = true; this.won = true;
    this.closeWin();
    Audio.error();
    const box = this.add.container(VIEW_W / 2, 150).setDepth(50);
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillRoundedRect(-170, -60, 340, 120, 6).lineStyle(1, C.line).strokeRoundedRect(-170, -60, 340, 120, 6);
    g.fillStyle(C.bad).fillRoundedRect(-170, -60, 340, 20, { tl: 6, tr: 6, bl: 0, br: 0 });
    box.add([g, this.t(0, -56, 'SILENCE ha isolato la rete', '#ffffff', 9.5, true).setOrigin(0.5, 0),
      this.add.text(0, -24, 'La salute della rete è arrivata a zero.\nOgni guasto aperto la fa scendere: ripara prima quello che blocca di più.', { fontFamily: FONT_UI, fontSize: '9px', color: C.text, align: 'center' }).setOrigin(0.5, 0),
      this.t(0, 30, 'INVIO riprova · Esc torna a IRIS', C.blueT, 9, true).setOrigin(0.5, 0)]);
  }

  private drawHud() {
    const x = 330, y = 18, w = 100, h = 9;
    const col = this.health > 60 ? C.ok : this.health > 30 ? C.warn : C.bad;
    this.hud.clear().fillStyle(0xd5dae0).fillRoundedRect(x, y, w, h, 4).fillStyle(col).fillRoundedRect(x, y, Math.max(3, w * this.health / 100), h, 4);
    this.xpText.setText(`XP ${this.xp}${this.streak >= 3 ? `   serie ×${this.streak >= 6 ? 3 : 2}` : ''}`);
  }

  private checkWin() {
    this.objectivesTick();
    this.attackTick();
    this.refreshActivity();
    if (this.won || this.attack || !this.lv.objectives.every((o) => this.met(o))) return;
    this.won = true;
    this.alert?.destroy();
    const secs = Math.round((this.time.now - this.startTime) / 1000);
    const healthy = this.health >= 50;
    const stars = 1 + (this.hintsUsed === 0 ? 1 : 0) + (healthy ? 1 : 0);
    if (this.hintsUsed === 0) this.badge('zero-aiuti');
    if (this.diff === 'esperto') this.badge('esperto');
    this.xp += 100 * stars; addXp(100 * stars);
    // onda verde: la rete torna viva, dispositivo dopo dispositivo
    this.net.devices.forEach((d, i) => {
      const p = this.pos(d);
      const c = this.add.circle(p.x, p.y, 6, C.ok, 0.45).setDepth(30);
      this.tweens.add({ targets: c, radius: 40, alpha: 0, delay: i * 120, duration: 700, onComplete: () => c.destroy() });
    });
    recordStars(this.levelId, this.diff, stars);
    this.drawRing();
    this.time.delayedCall(600, () => {
      Audio.power();
      const box = this.add.container(VIEW_W / 2, 150).setDepth(50);
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.2).fillRoundedRect(-178, -73, 360, 150, 6).fillStyle(0xffffff).fillRoundedRect(-180, -75, 360, 150, 6).lineStyle(1, C.line).strokeRoundedRect(-180, -75, 360, 150, 6);
      g.fillStyle(C.ok).fillRoundedRect(-180, -75, 360, 20, { tl: 6, tr: 6, bl: 0, br: 0 });
      const t1 = this.t(0, -71, 'Attività completata · rete funzionante', '#ffffff', 9.5, true).setOrigin(0.5, 0);
      const t2 = this.t(0, -40, '★'.repeat(stars) + '☆'.repeat(3 - stars), '#f0a020', 28, true).setOrigin(0.5, 0);
      const t3 = this.t(0, 4, `★ completato    ${this.hintsUsed === 0 ? '★' : '☆'} senza aiuti    ${healthy ? '★' : '☆'} rete sopra il 50%\nXP guadagnati: ${this.xp} · tempo ${secs}s`, C.text, 8.5).setOrigin(0.5, 0).setAlign('center');
      const hasNext = LEVELS.findIndex((l) => l.id === this.levelId) < LEVELS.length - 1;
      const t4 = this.t(0, 44, `${hasNext ? 'INVIO livello successivo · ' : ''}Esc torna a IRIS`, C.blueT, 9, true).setOrigin(0.5, 0);
      box.add([g, t1, t2, t3, t4]);
      this.bottomText.setText('');
      this.iris.say([`IRIS: ${this.lv.concept}: fatto. ${stars === 3 ? 'Perfetto.' : 'Rigiocalo: la prossima volta la rete sarà diversa.'}`]);
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
    if (this.win && this.tab === 'cli' && !this.iris.open) this.refreshWindow();
    this.drawHud();
    if (this.startTime && !this.won && !this.tut && !this.iris.open) {
      const el = (this.time.now - this.startTime) / 1000;
      const open = this.lv.objectives.filter((o) => !this.met(o)).length / this.lv.objectives.length;
      const decay = ({ studente: 0.25, junior: 0.5, esperto: 0.9 } as const)[this.diff];
      this.health -= (decay * open + (this.attack ? 1.6 : 0)) * dt / 1000;
      if (this.health <= 0) { this.health = 0; this.lose(); }
      const maxAttacks = this.diff === 'junior' ? 1 : this.diff === 'esperto' ? 3 : 0;
      const progressed = this.prevMet.some(Boolean) || el > 60;
      if (!this.attack && !this.busy && this.attacksDone < maxAttacks && el > this.nextAttackAt && progressed) this.doAttack();
      this.attackTick();
    }
    if (this.startTime && !this.won) {
      const s = Math.round((this.time.now - this.startTime) / 1000);
      this.timerText.setText(`⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`).setColor(s > this.lv.parTime ? C.badT : C.text);
    }
  }
}
