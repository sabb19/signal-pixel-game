import Phaser from 'phaser';
import { gameFrame, panel, Frame, UI } from '../../ui/gameFrame';
import { VIEW_W, VIEW_H } from '../../core/config';
import { P, hex } from '../../core/palette';
import { FONT, FONT_TITLE } from '../../core/fonts';
import { IrisDialog } from '../../iris/IrisDialog';
import { Audio } from '../../audio/AudioManager';
import { prefixOf } from '../netdefender/logic';
import {
  makeMissions, Mission, Net, Router, Leg, cloneNet, ping, trace, checkRoute, addRoute, removeRoute,
  CONSOLE, ANT_IP, NODE_X,
} from './logic';

// PACKET TRACE — il banco di prova del laboratorio. Pannello a fosfori:
// sinistra la tabella del router scelto + il percorso con il pacchetto animato, destra il terminale.
// Ciclo didattico: IRIS spiega → Myra prova → il pacchetto mostra dove si ferma → correzione → verifica (missione 3).
const X0 = 18, Y0 = 34, LW = 214, TX = 244, TW = VIEW_W - TX - 18, TH = 250;

interface GuideStep {
  text: string;
  cmd?: string;
  hl?: string;
  done?: (event: string, arg: string) => boolean;
  after?: () => void;
  quiz?: { answer: 's' | 'n'; right: string[]; wrong: string[] };
}

export class PacketTraceScene extends Phaser.Scene {
  private missions: Mission[] = [];
  private mi = 0;
  private net!: Net;
  private cur = CONSOLE;
  private pinged = false;
  private lines: { t: string; c: number }[] = [];
  private typed = '';
  private history: string[] = [];
  private hi = -1;
  private hintLevel = 0;
  private wrong = 0;
  private guideStep = 0;
  private guided = false;
  private guideCmd?: string;
  private quiz?: GuideStep;
  private iris!: IrisDialog;
  private termRows: Phaser.GameObjects.Text[] = [];
  private cardTitle!: Phaser.GameObjects.Text;
  private cardText!: Phaser.GameObjects.Text;
  private header!: Phaser.GameObjects.Text;
  private goal!: Phaser.GameObjects.Text;
  private guideBox!: Phaser.GameObjects.Text;
  private hl!: Phaser.GameObjects.Graphics;
  private diagram!: Phaser.GameObjects.Graphics;
  private diagramLabels: Phaser.GameObjects.Text[] = [];
  private marks!: Phaser.GameObjects.Graphics;
  private busy = false;
  private done = false;

  constructor() { super('packettrace'); }

  init(data: { mission?: number }) {
    this.missions = makeMissions();
    this.mi = data?.mission ?? 0;
    this.done = false;
  }

  create() {
    this.drawFrame();
    this.header = this.add.text(-500, -500, '');
    this.cardTitle = this.add.text(X0 + 6, Y0 + 3, '', { fontFamily: FONT, fontSize: '13px', color: hex(P.cyan1) });
    this.cardText = this.add.text(X0 + 8, Y0 + 20, '', { fontFamily: FONT, fontSize: '15px', color: hex(P.cream2), lineSpacing: -2 });
    this.diagram = this.add.graphics();
    this.marks = this.add.graphics().setDepth(90);
    this.termRows = Array.from({ length: 17 }, (_, i) => this.add.text(TX + 8, Y0 + 5 + i * 14, '', { fontFamily: FONT, fontSize: '15px', color: hex(P.cyan3) }));
    this.goal = this.add.text(X0, Y0 + TH + 10, '', { fontFamily: FONT, fontSize: '15px', color: hex(P.lamp2), wordWrap: { width: VIEW_W - 36 } });
    this.hl = this.add.graphics().setDepth(200);
    this.guideBox = this.add.text(X0, Y0 + TH + 6, '', { fontFamily: FONT, fontSize: '15px', color: hex(P.lamp2), wordWrap: { width: VIEW_W - 36 }, lineSpacing: -2 }).setVisible(false);
    this.iris = new IrisDialog(this);
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.cameras.main.fadeIn(500, 0, 0, 0);
    Audio.boot();
    this.startMission();
  }

  private frame!: Frame;
  private drawFrame() {
    this.frame = gameFrame(this);
    const g = this.add.graphics();
    panel(this, g, X0, Y0, LW, 112);
    panel(this, g, X0, Y0 + 120, LW, TH - 120, 'BANCO DI PROVA · IL PERCORSO');
    panel(this, g, TX, Y0, TW, TH, '', UI.cyan, 0x070b0f);
  }

  private get m() { return this.missions[this.mi]; }
  private router(name = this.cur) { return this.net.routers.find((r) => r.name === name); }

  private startMission() {
    this.net = cloneNet(this.m.net);
    this.cur = CONSOLE; this.pinged = false;
    this.hintLevel = 0; this.wrong = 0; this.guideStep = 0;
    this.lines = [];
    this.marks.clear();
    this.frame.setTitle(`BANCO DI PROVA · MISSIONE ${this.mi + 1}/${this.missions.length}`, this.m.title);
    this.goal.setText('Obiettivo: ' + this.m.goal);
    this.print('I.R.I.S. banco di prova · rete isolata', P.cyan1);
    this.print('Scrivi  aiuto  per i comandi.', P.cyan1);
    this.refresh();
    this.busy = true;
    this.time.delayedCall(400, () => this.iris.say(this.m.brief, () => { this.busy = false; this.guide(); }));
  }

  // --- Guida passo-passo (missioni 1 e 2). La 3 è la verifica.
  private steps(): GuideStep[] {
    if (this.mi === 0) return [
      { text: 'Seguiamo un pacchetto dalla console all\'antenna. Scrivi  traceroute 10.0.40.5', cmd: 'traceroute 10.0.40.5', hl: 'prompt',
        done: (e) => e === 'trace', after: () => this.say(['IRIS: Guarda il percorso: il pacchetto è passato dalla console a R1. Lì si è fermato.', 'IRIS: R1 non sapeva dove mandarlo. Leggiamo la sua tabella.']) },
      { text: 'Passa al router R1. Scrivi  usa R1', cmd: 'usa R1', hl: 'r1', done: () => this.cur === 'R1' },
      { text: 'Leggi la tabella delle strade di R1:  show ip route', cmd: 'show ip route', hl: 'prompt',
        done: (e) => e === 'show' && this.cur === 'R1', after: () => this.explainTable() },
      { text: 'R1 ha una riga per la rete dell\'antenna, 10.0.40.0?   Premi  S  per sì,  N  per no.', hl: 'table',
        quiz: { answer: 'n',
          right: ['IRIS: Esatto. R1 conosce solo le due reti a cui è attaccato. L\'antenna sta oltre R2.', 'MYRA: Allora devo scrivergli: per l\'antenna, passa da R2.'],
          wrong: ['IRIS: Rileggi le righe: 10.0.10.0 e 10.0.30.0. Nessuna è 10.0.40.0. Riprova.'] } },
      { text: 'Scrivi a R1: per la rete 10.0.40.0 passa da R2 (10.0.30.2).\n  ip route 10.0.40.0 255.255.255.0 10.0.30.2', cmd: 'ip route 10.0.40.0 255.255.255.0 10.0.30.2', hl: 'r2',
        done: (e) => e === 'route-add' && !!this.router('R1')?.routes.some((r) => r.net === '10.0.40.0') },
      { text: 'Ora prova la conversazione completa:  ping 10.0.40.5', cmd: 'ping 10.0.40.5', hl: 'prompt', done: (e) => e === 'ping-ok' },
    ];
    if (this.mi === 1) return [
      { text: 'Prova subito:  ping 10.0.40.5', cmd: 'ping 10.0.40.5', hl: 'prompt', done: (e) => e === 'ping-ok' || e === 'ping-fail' },
      { text: 'Il pacchetto di andata (ciano) è arrivato all\'antenna?   Premi  S  per sì,  N  per no.', hl: 'path',
        quiz: { answer: 's',
          right: ['IRIS: Sì. L\'andata funziona. È la risposta (arancione) che si perde: si ferma su R2.', 'MYRA: Quindi R2 sa andare verso l\'antenna, ma non sa tornare indietro.'],
          wrong: ['IRIS: Guarda il percorso ciano: arriva fino all\'antenna. È il ritorno, quello arancione, a fermarsi. Riprova.'] } },
      { text: 'Passa al router dove si ferma il ritorno:  usa R2', cmd: 'usa R2', hl: 'r2', done: () => this.cur === 'R2' },
      { text: 'Leggi la sua tabella:  show ip route', cmd: 'show ip route', hl: 'prompt', done: (e) => e === 'show' && this.cur === 'R2' },
      { text: 'Scrivi a R2: per la rete della console passa da R1 (10.0.30.1).\n  ip route 10.0.10.0 255.255.255.0 10.0.30.1', cmd: 'ip route 10.0.10.0 255.255.255.0 10.0.30.1', hl: 'r1',
        done: (e) => e === 'route-add' && !!this.router('R2')?.routes.some((r) => r.net === '10.0.10.0') },
      { text: 'Verifica andata e ritorno:  ping 10.0.40.5', cmd: 'ping 10.0.40.5', hl: 'prompt', done: (e) => e === 'ping-ok' },
    ];
    return [];
  }

  private guide() {
    const steps = this.steps();
    if (!steps.length) {
      this.guided = false;
      this.highlight('none');
      this.guideBox.setVisible(true).setText('VERIFICA · niente guida. Se ti blocchi, premi  H  per un aiuto.\n' + this.m.goal);
      this.goal.setVisible(false);
      return;
    }
    this.guided = true;
    const st = steps[this.guideStep];
    if (!st) { this.guideBox.setVisible(false); this.highlight('none'); this.goal.setVisible(true); return; }
    this.guideCmd = st.cmd;
    this.quiz = st.quiz ? st : undefined;
    this.goal.setVisible(false);
    this.guideBox.setVisible(true).setText(`PASSO ${this.guideStep + 1}/${steps.length}   ${st.text}${st.cmd ? '\n[TAB] scrive il comando per te' : ''}`);
    this.highlight(st.hl ?? 'none');
  }

  private guideAfter(event: string, arg = '') {
    if (!this.guided) return;
    const st = this.steps()[this.guideStep];
    if (!st || st.quiz || !st.done?.(event, arg)) return;
    this.guideStep++;
    if (st.after) st.after(); else this.time.delayedCall(250, () => this.guide());
  }

  private say(lines: string[]) {
    this.busy = true;
    this.time.delayedCall(300, () => this.iris.say(lines, () => { this.busy = false; this.guide(); }));
  }

  private explainTable() {
    this.busy = true;
    const parts: [string, string][] = [
      ['table', 'IRIS: Questa è la tabella di R1. Ogni riga dice: "per questa rete, vai di qua".'],
      ['table', 'IRIS: "collegata" vuol dire che R1 ci è attaccato con un cavo: 10.0.10.0 è la rete della console, 10.0.30.0 quella tra R1 e R2.'],
    ];
    const next = (i: number) => {
      if (i >= parts.length) { this.busy = false; this.guide(); return; }
      this.highlight(parts[i][0]);
      this.iris.say([parts[i][1]], () => next(i + 1));
    };
    this.time.delayedCall(300, () => next(0));
  }

  private highlight(what: string) {
    this.tweens.killTweensOf(this.hl);
    this.hl.clear().setAlpha(1).lineStyle(2, P.lamp2, 1);
    const n = this.nodePos();
    if (what === 'table') this.hl.strokeRect(X0 + 3, Y0 + 17, LW - 6, 92);
    if (what === 'prompt') this.hl.strokeRect(TX + 4, Y0 + 4, TW - 8, TH - 8);
    if (what === 'r1') this.hl.strokeRect(n.R1.x - 17, n.R1.y - 13, 34, 44);
    if (what === 'r2') this.hl.strokeRect(n.R2.x - 17, n.R2.y - 13, 34, 44);
    if (what === 'path') this.hl.strokeRect(X0 + 4, n.y - 18, LW - 8, 96);
    if (what !== 'none') this.tweens.add({ targets: this.hl, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
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

  // --- Terminale
  private print(t: string, c: number = P.cyan3) {
    t.split('\n').forEach((x) => this.lines.push({ t: x, c }));
    this.renderTerm();
  }

  private renderTerm() {
    const rows = this.termRows.length;
    const visible = this.wrapped().slice(-(rows - 1));
    const prompt = `MYRA@${this.cur}> ${this.typed}${Math.floor(this.time.now / 450) % 2 ? '_' : ' '}`;
    this.termRows.forEach((t, i) => {
      if (i < visible.length) t.setText(visible[i].t).setColor(hex(visible[i].c));
      else if (i === visible.length) t.setText(prompt).setColor(hex(P.cream2));
      else t.setText('');
    });
  }

  private wrapped() {
    const out: { t: string; c: number }[] = [];
    const W = 54;
    for (const l of this.lines) {
      let rest = l.t;
      while (rest.length > W) {
        let cut = rest.lastIndexOf(' ', W);
        if (cut < 10) cut = W;
        out.push({ t: rest.slice(0, cut), c: l.c });
        rest = '  ' + rest.slice(cut).trimStart();
      }
      out.push({ t: rest, c: l.c });
    }
    return out;
  }

  private onKey(e: KeyboardEvent) {
    if (this.iris.open) { if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') this.iris.advance(); return; }
    if (this.done || this.busy) return;
    if (e.key === 'Escape') return this.exit(false);
    if (this.quiz && /^[sSnN]$/.test(e.key)) return this.answerQuiz(e.key.toLowerCase() === 's');
    if (this.quiz) return;
    if (e.key === 'Tab') { e.preventDefault(); if (this.guided && this.guideCmd) { this.typed = this.guideCmd; Audio.type(); this.renderTerm(); } return; }
    if (e.key === 'Enter') { const cmd = this.typed.trim(); this.typed = ''; if (cmd) this.run(cmd); else this.renderTerm(); return; }
    if (e.key === 'Backspace') { this.typed = this.typed.slice(0, -1); Audio.type(); return this.renderTerm(); }
    if (e.key === 'ArrowUp') { if (this.history.length) { this.hi = Math.max(0, (this.hi < 0 ? this.history.length : this.hi) - 1); this.typed = this.history[this.hi]; } return this.renderTerm(); }
    if ((e.key === 'h' || e.key === 'H') && this.typed === '') return this.hint();
    if (e.key.length === 1 && this.typed.length < 52) { this.typed += e.key; Audio.type(); this.renderTerm(); }
  }

  private run(raw: string) {
    this.history.push(raw); this.hi = -1;
    this.print(`MYRA@${this.cur}> ${raw}`, P.cream2);
    const words = raw.toLowerCase().split(/\s+/);
    const [cmd, ...args] = words;
    switch (cmd) {
      case 'aiuto': case 'help':
        this.print('ping X / traceroute X   dalla console verso X\nusa R1 | R2 | CONSOLE   scegli il dispositivo\nshow ip route           tabella del router\nip route RETE MASCHERA SALTO   aggiungi una strada\nno ip route RETE MASCHERA SALTO   togli una strada\npulisci                 svuota lo schermo', P.cyan1);
        break;
      case 'ping': this.doPing(args[0] ?? '', false); break;
      case 'traceroute': case 'tracert': this.doPing(args[0] ?? '', true); break;
      case 'usa': this.use(args[0] ?? ''); break;
      case 'show': this.show(); break;
      case 'ip': if (args[0] === 'route') this.route(args.slice(1), false); else this.err('Forse: ip route RETE MASCHERA SALTO'); break;
      case 'no': if (args[0] === 'ip' && args[1] === 'route') this.route(args.slice(2), true); else this.err('Forse: no ip route RETE MASCHERA SALTO'); break;
      case 'pulisci': case 'clear': this.lines = []; this.renderTerm(); break;
      default: this.err(`Comando non riconosciuto: ${cmd}. Scrivi  aiuto  per l'elenco.`);
    }
    this.refresh();
  }

  private err(msg: string) { Audio.error(); this.print(msg, P.red2); }

  private use(name: string) {
    const all = [CONSOLE, ...this.net.routers.map((r) => r.name)];
    const n = all.find((x) => x.toLowerCase() === name);
    if (!n) return this.err(`Dispositivi sul banco: ${all.join(', ')}`);
    this.cur = n; Audio.click();
    this.print(`Ora sei su ${n}.`, P.cyan1);
    this.refresh();
    this.guideAfter('usa', n);
  }

  private show() {
    const r = this.router();
    if (!r) return this.err('La console non ha una tabella di strade: manda tutto al suo gateway, R1. Scrivi  usa R1.');
    this.print(`Tabella di ${r.name}:`, P.cream);
    this.tableRows(r).forEach((l) => this.print('  ' + l, P.cream));
    this.guideAfter('show');
  }

  private tableRows(r: Router) {
    const rows = r.ifaces.map((i) => `${netOf(i.ip, i.mask)}/${prefixOf(i.mask)}  collegata`);
    r.routes.forEach((x) => rows.push(`${x.net}/${prefixOf(x.mask)}  via ${x.via}${x.via === NODE_X ? '  ?' : ''}`));
    return rows;
  }

  private route(a: string[], remove: boolean) {
    const r = this.router();
    if (!r) return this.err('Le strade si scrivono sui router. Scrivi prima  usa R1  o  usa R2.');
    if (a.length !== 3) return this.err(`Uso: ${remove ? 'no ' : ''}ip route RETE MASCHERA SALTO  (es. ip route 10.0.40.0 255.255.255.0 10.0.30.2)`);
    const rt = { net: a[0], mask: a[1], via: a[2] };
    if (remove) {
      if (!removeRoute(r, rt.net, rt.mask)) return this.err(`${r.name} non ha una riga ${rt.net} ${rt.mask}. Controlla con  show ip route.`);
      Audio.confirm();
      this.print(`Riga tolta da ${r.name}: ${rt.net}/${prefixOf(rt.mask)}`, P.phos);
      if (rt.net === '0.0.0.0') this.say(['IRIS: Tolta. Quel 10.0.30.99 non è nell\'inventario di nessun router della stazione.', 'IRIS: Qualcuno l\'ha aggiunto a mano. Lo chiamo NODE-X, finché non so chi è.', 'MYRA: Qualcuno ha deviato le strade di proposito.']);
      return this.guideAfter('route-del');
    }
    const c = checkRoute(r, rt);
    if (!c.ok) {
      Audio.error();
      if (c.kind === 'comprensione') {
        this.wrong++;
        this.iris.say([`IRIS: ${c.msg}`, ...(this.wrong >= 3 ? ['IRIS: Vuoi un aiuto? Premi H.'] : [])]);
      } else this.print(c.msg, P.red2);
      return;
    }
    if (this.mi === 1 && r.name === 'R1' && rt.net === '10.0.10.0') {
      this.wrong++;
      Audio.error();
      return this.iris.say(['IRIS: R1 è già attaccato alla rete della console. È R2 che non sa come tornarci.']);
    }
    addRoute(r, rt);
    Audio.confirm();
    this.print(`Strada aggiunta a ${r.name}: ${rt.net}/${prefixOf(rt.mask)} via ${rt.via}`, P.phos);
    this.guideAfter('route-add');
  }

  private doPing(target: string, onlyGo: boolean) {
    if (!target) return this.err(`Uso: ${onlyGo ? 'traceroute' : 'ping'} X   (es. ${onlyGo ? 'traceroute' : 'ping'} ${ANT_IP})`);
    if (this.cur !== CONSOLE) this.print('(si parte sempre dalla console)', P.metal2);
    const p = onlyGo ? { ok: false, go: trace(this.net, CONSOLE, target), back: undefined } : ping(this.net, CONSOLE, target);
    this.busy = true;
    this.marks.clear();
    this.print(`${onlyGo ? 'Traceroute' : 'Ping'} da CONSOLE a ${target}:`, P.cream);
    this.animateLeg(p.go, P.cyan3, () => {
      this.listHops(p.go, 'andata');
      const finish = () => {
        this.busy = false;
        if (onlyGo) { this.guideAfter('trace'); return; }
        if (p.ok) {
          Audio.confirm();
          this.print('Risposta ricevuta: andata e ritorno.', P.phos);
          this.pinged = true;
          this.guideAfter('ping-ok', target);
          this.checkDone();
          if (!this.done && this.mi === 2) this.iris.say(['IRIS: Il ping passa. Ma la riga verso 10.0.30.99 è ancora nella tabella di R1.', 'IRIS: Ogni destinazione che non conosce, R1 la manda ancora lì. Toglila.']);
        } else {
          Audio.error();
          this.print('Nessuna risposta.', P.red2);
          this.explain(p.go.ok ? p.back! : p.go, p.go.ok);
          this.guideAfter('ping-fail', target);
        }
      };
      if (p.go.ok && p.back) this.animateLeg(p.back, P.lamp, () => { this.listHops(p.back!, 'ritorno'); finish(); });
      else finish();
    });
  }

  private listHops(l: Leg, what: string) {
    const route = l.hops.map((h) => h.node).join(' → ');
    this.print(`  ${what}: ${route}${l.ok ? '  ✓' : `  ✗ ${l.hops[l.hops.length - 1].note}`}`, l.ok ? P.phos : P.red2);
  }

  private explain(l: Leg, isBack: boolean) {
    if (l.ok) return;
    const dir = isBack ? 'La risposta' : 'Il pacchetto';
    const msg: Record<string, string> = {
      noroute: `IRIS: ${dir} si è fermato su ${l.at}: nella sua tabella non c'è nessuna riga che porti a destinazione.`,
      nexthop: `IRIS: ${l.at} ha mandato ${dir.toLowerCase()} verso un indirizzo dove non c'è nessun router. Si è perso.`,
      ttl: `IRIS: ${dir} ha girato in tondo tra i router finché il contatore di salti non è arrivato a zero.`,
      nohost: 'IRIS: La strada c\'è, ma a quell\'indirizzo non risponde nessuno.',
      gateway: 'IRIS: La console non riesce nemmeno a raggiungere il suo gateway.',
    };
    this.wrong++;
    this.iris.say([msg[l.reason], ...(this.wrong >= 3 && !this.guided ? ['IRIS: Vuoi un aiuto? Premi H.'] : [])]);
  }

  private hint() {
    const h = this.m.hints[Math.min(this.hintLevel, 2)];
    this.hintLevel = Math.min(this.hintLevel + 1, 3);
    Audio.click();
    this.iris.say([`IRIS: ${h}`]);
  }

  private checkDone() {
    if (this.done || !this.m.done(this.net, this.pinged)) return;
    this.done = true;
    this.guideBox.setVisible(false); this.highlight('none'); this.guided = false;
    const wrap: string[][] = [
      ['IRIS: Il pacchetto è arrivato all\'antenna, e la risposta è tornata.', 'IRIS: Ogni router conosce solo il passo successivo. Nessuno conosce tutta la strada.', 'MYRA: Eppure, un passo alla volta, si arriva.'],
      ['IRIS: Andata e ritorno. Ora la conversazione è completa.', 'IRIS: Una strada che va solo in un senso non serve a parlare con nessuno.', 'MYRA: ...Come una lettera senza indirizzo del mittente.'],
      ['IRIS: Strada ripristinata. Riga sospetta rimossa. Senza aiuto.', 'IRIS: Ho cercato NODE-X nei registri. Compare per la prima volta la notte in cui la stazione si è spenta.', 'MYRA: Non era un guasto. Qualcuno è entrato.', 'IRIS: ...Sì. Credo anche io.'],
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
      this.scene.get('station').events.emit('minigame-closed', { id: 'packettrace', completed, mission: this.mi });
      this.scene.resume('station');
    });
  }

  // --- Pannelli
  private refresh() {
    const r = this.router();
    if (r) {
      this.cardTitle.setText(`TABELLA DELLE STRADE · ${r.name}`);
      this.cardText.setText(this.tableRows(r).join('\n'));
    } else {
      const h = this.net.hosts[0];
      this.cardTitle.setText('CONSOLE');
      this.cardText.setText(`IP        ${h.ip}\nGateway   ${h.gateway} (R1)\n\nNon ha una tabella: affida\ntutto a R1.  usa R1  per vederla.`);
    }
    this.drawDiagram();
    this.renderTerm();
  }

  private nodePos() {
    const y = Y0 + 162, x = X0 + 6;
    const pts: Record<string, { x: number; y: number }> = { CONSOLE: { x: x + 20, y }, R1: { x: x + 72, y }, R2: { x: x + 128, y }, ANTENNA: { x: x + 182, y }, X: { x: x + 100, y: y + 40 } };
    return Object.assign(pts, { y }) as Record<string, { x: number; y: number }> & { y: number };
  }

  private drawDiagram() {
    const g = this.diagram.clear();
    this.diagramLabels.forEach((t) => t.destroy());
    this.diagramLabels = [];
    const n = this.nodePos();
    const label = (x: number, y: number, t: string, c: number, size = 11) =>
      this.diagramLabels.push(this.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color: hex(c) }).setOrigin(0.5, 0));
    g.lineStyle(2, P.metal2).lineBetween(n.CONSOLE.x, n.y, n.ANTENNA.x, n.y);
    label((n.CONSOLE.x + n.R1.x) / 2, n.y - 24, '10.0.10', P.conc, 10);
    label((n.R1.x + n.R2.x) / 2, n.y - 24, '10.0.30', P.conc, 10);
    label((n.R2.x + n.ANTENNA.x) / 2, n.y - 24, '10.0.40', P.conc, 10);
    const node = (k: string, c: number, ip: string, ghost = false) => {
      const p = n[k];
      g.fillStyle(P.night).fillRect(p.x - 13, p.y - 9, 26, 18).lineStyle(1, c, ghost ? 0.6 : 1).strokeRect(p.x - 13, p.y - 9, 26, 18);
      if (k === this.cur) g.lineStyle(1, P.lamp2).strokeRect(p.x - 15, p.y - 11, 30, 22);
      label(p.x, p.y + 11, k === 'X' ? '???' : k, ghost ? P.red2 : P.cream, 11);
      label(p.x, p.y + 21, ip, P.conc, 10);
    };
    // nel 3 la riga sospetta punta a un nodo che non esiste: lo mostriamo come un fantasma
    const r1 = this.router('R1')!;
    if (r1.routes.some((r) => r.via === NODE_X)) {
      g.lineStyle(1, P.red2, 0.8);
      for (let i = 0; i < 6; i++) g.lineBetween(n.R1.x + i * 5, n.y + 30 + i * 3.4, n.R1.x + i * 5 + 3, n.y + 32 + i * 3.4);
      node('X', P.red2, '30.99', true);
    }
    node('CONSOLE', P.cyan3, '.21');
    node('R1', P.lamp, '.1 | .1');
    node('R2', P.lamp, '.2 | .1');
    node('ANTENNA', P.cyan3, '40.5');
    label(X0 + LW / 2, n.y + 72, 'ciano: andata · arancione: ritorno', P.metal2, 10);
  }

  private animateLeg(l: Leg, color: number, cb: () => void) {
    const n = this.nodePos();
    const pts = l.hops.map((h) => n[h.node] ?? n.CONSOLE);
    if (!l.ok && l.reason === 'nexthop') pts.push(n.X);
    const dot = this.add.circle(pts[0].x, pts[0].y, 3, color).setDepth(100);
    const go = (i: number) => {
      if (i >= pts.length) {
        const end = pts[pts.length - 1];
        if (!l.ok) { this.marks.lineStyle(2, P.red).lineBetween(end.x - 5, end.y - 18, end.x + 5, end.y - 8).lineBetween(end.x + 5, end.y - 18, end.x - 5, end.y - 8); }
        dot.setFillStyle(l.ok ? P.phos : P.red);
        this.tweens.add({ targets: dot, scale: 2, alpha: 0, duration: 380, onComplete: () => { dot.destroy(); cb(); } });
        return;
      }
      Audio.type();
      this.tweens.add({ targets: dot, x: pts[i].x, y: pts[i].y, duration: 300, onComplete: () => go(i + 1) });
    };
    go(1);
  }

  update(_t: number, dt: number) {
    this.frame?.tick();
    this.iris.update(dt);
    if (!this.iris.open && !this.busy) this.renderTerm();
  }
}

function netOf(ip: string, mask: string) {
  const a = ip.split('.').map(Number), m = mask.split('.').map(Number);
  return a.map((v, i) => v & m[i]).join('.');
}
