import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../../core/config';
import { P, hex } from '../../core/palette';
import { FONT, FONT_TITLE } from '../../core/fonts';
import { IrisDialog } from '../../iris/IrisDialog';
import { Audio } from '../../audio/AudioManager';
import {
  makeMissions, Mission, Device, ping, checkSet, parseIp, ROUTER_LOCAL, ARCHIVE, REAL_MASK,
  sameSubnet, networkOf, intToIp, prefixOf,
} from './logic';

// NETWORK DEFENDER — interfaccia: terminale di configurazione CRT della console.
// Sinistra: scheda di rete del dispositivo + schema dei "quartieri" (reti). Destra: terminale.
// Ciclo didattico: IRIS spiega → Myra prova → feedback immediato → conseguenza → verifica (missione 3).
const X0 = 18, Y0 = 34, LW = 214, TX = 244, TW = VIEW_W - TX - 18, TH = 250;

export class NetDefenderScene extends Phaser.Scene {
  private missions: Mission[] = [];
  private mi = 0;
  private devs: Device[] = [];
  private cur = 0;
  private pinged = new Set<string>();
  private diagnosis?: string;
  private lines: { t: string; c: number }[] = [];
  private typed = '';
  private history: string[] = [];
  private hi = -1;
  private hintLevel = 0;
  private wrong = 0;
  private guideStep = 0;
  private iris!: IrisDialog;
  private termRows: Phaser.GameObjects.Text[] = [];
  private cardText!: Phaser.GameObjects.Text;
  private header!: Phaser.GameObjects.Text;
  private goal!: Phaser.GameObjects.Text;
  private diagram!: Phaser.GameObjects.Graphics;
  private diagramLabels: Phaser.GameObjects.Text[] = [];
  private packet?: Phaser.GameObjects.Arc;
  private busy = false;
  private done = false;

  constructor() { super('netdefender'); }

  init(data: { mission?: number }) {
    this.missions = makeMissions();
    this.mi = data?.mission ?? 0;
    this.done = false;
  }

  create() {
    this.drawFrame();
    this.header = this.add.text(X0, 10, '', { fontFamily: FONT_TITLE, fontSize: '11px', color: hex(P.cyan3) });
    this.add.text(VIEW_W - 18, 10, 'H aiuto · Esc esci', { fontFamily: FONT, fontSize: '14px', color: hex(P.metal2) }).setOrigin(1, 0);
    this.cardText = this.add.text(X0 + 8, Y0 + 20, '', { fontFamily: FONT, fontSize: '16px', color: hex(P.cream2), lineSpacing: -1 });
    this.diagram = this.add.graphics();
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

  // --- Cornice CRT
  private drawFrame() {
    const g = this.add.graphics();
    g.fillStyle(0x05080c).fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle(P.metal0).fillRect(4, 4, VIEW_W - 8, VIEW_H - 8);
    g.fillStyle(P.night0).fillRect(10, 26, VIEW_W - 20, VIEW_H - 36);
    // pannello scheda
    g.fillStyle(P.petrol0).fillRect(X0, Y0, LW, 112).lineStyle(1, P.cyan1).strokeRect(X0 + 0.5, Y0 + 0.5, LW, 112);
    // pannello schema
    g.fillStyle(P.petrol0).fillRect(X0, Y0 + 120, LW, TH - 120).lineStyle(1, P.cyan1).strokeRect(X0 + 0.5, Y0 + 120.5, LW, TH - 120);
    // terminale
    g.fillStyle(0x071214).fillRect(TX, Y0, TW, TH).lineStyle(1, P.cyan1).strokeRect(TX + 0.5, Y0 + 0.5, TW, TH);
    this.add.text(X0 + 6, Y0 + 3, 'SCHEDA DI RETE', { fontFamily: FONT, fontSize: '13px', color: hex(P.cyan1) });
    this.add.text(X0 + 6, Y0 + 123, 'SCHEMA DELLA RETE', { fontFamily: FONT, fontSize: '13px', color: hex(P.cyan1) });
    // scanline e bagliore sul vetro
    const s = this.add.graphics().setDepth(5000);
    for (let y = 26; y < VIEW_H - 10; y += 2) s.fillStyle(0x000000, 0.12).fillRect(10, y, VIEW_W - 20, 1);
    const glow = this.add.image(VIEW_W / 2, VIEW_H / 2, 'glow').setScale(9, 6).setTint(P.cyan).setAlpha(0.04).setBlendMode(Phaser.BlendModes.ADD).setDepth(5001);
    this.tweens.add({ targets: glow, alpha: 0.06, duration: 90, yoyo: true, repeat: -1, repeatDelay: 3000 });
  }

  // --- Missioni
  private get m() { return this.missions[this.mi]; }
  private get d() { return this.devs[this.cur]; }

  private startMission() {
    this.devs = this.m.devices.map((x) => ({ ...x }));
    this.cur = 0; this.pinged = new Set(); this.diagnosis = undefined;
    this.hintLevel = 0; this.wrong = 0; this.guideStep = 0;
    this.lines = [];
    this.header.setText(`NETWORK DEFENDER · ${this.mi + 1}/${this.missions.length} · ${this.m.title}`);
    this.goal.setText('Obiettivo: ' + this.m.goal);
    this.print('I.R.I.S. terminale di configurazione v3.2', P.cyan1);
    this.print(`Dispositivo: ${this.d.name}. Scrivi  aiuto  per i comandi.`, P.cyan1);
    this.refresh();
    this.busy = true;
    this.time.delayedCall(400, () => this.iris.say(this.m.brief, () => { this.busy = false; this.guide(); }));
  }

  // Tutorial della missione 1: passi espliciti, con evidenziazioni sulla scheda e sullo schema.
  // TAB scrive il comando suggerito. Si avanza solo facendo la cosa giusta.
  private guided = false;
  private guideCmd?: string;
  private quiz = false;
  private hl!: Phaser.GameObjects.Graphics;
  private guideBox!: Phaser.GameObjects.Text;

  private guide() {
    if (this.mi !== 0) { this.guided = false; this.guideBox?.setVisible(false); this.goal.setVisible(true); return; }
    this.guided = true;
    const steps = [
      { text: 'Leggiamo la scheda della console. Scrivi  ipconfig  e premi INVIO.', cmd: 'ipconfig', hl: 'prompt' },
      { text: 'Il gateway 10.0.20.1 è nel quartiere della console (10.0.10.x)?   Premi  S  per sì,  N  per no.', hl: 'gw' },
      { text: 'Nello schema, il router della sala ha indirizzo 10.0.10.1. Scrivi  set gateway 10.0.10.1', cmd: 'set gateway 10.0.10.1', hl: 'router' },
      { text: 'Ora verifica che la console raggiunga il router:  ping 10.0.10.1', cmd: 'ping 10.0.10.1', hl: 'prompt' },
    ];
    const st = steps[this.guideStep];
    if (!st) { this.guideBox.setVisible(false); this.highlight('none'); return; }
    this.guideCmd = st.cmd;
    this.quiz = this.guideStep === 1;
    this.goal.setVisible(false);
    this.guideBox.setVisible(true).setText(`PASSO ${this.guideStep + 1}/${steps.length}   ${st.text}${st.cmd ? '\n[TAB] scrive il comando per te' : ''}`);
    this.highlight(st.hl);
  }

  private highlight(what: string) {
    this.tweens.killTweensOf(this.hl);
    this.hl.clear().setAlpha(1);
    const rowY = (r: number) => Y0 + 20 + r * 15;
    const n = this.nodePos();
    this.hl.lineStyle(2, P.lamp2, 1);
    if (what === 'ip') this.hl.strokeRect(X0 + 4, rowY(1) - 1, LW - 8, 16);
    if (what === 'mask') this.hl.strokeRect(X0 + 4, rowY(2) - 1, LW - 8, 16);
    if (what === 'gw') this.hl.strokeRect(X0 + 4, rowY(3) - 1, LW - 8, 16);
    if (what === 'router') this.hl.strokeRect(n.rt.x - 16, n.rt.y - 13, 32, 46);
    if (what === 'prompt') this.hl.strokeRect(TX + 4, Y0 + 4, TW - 8, TH - 8);
    if (what !== 'none') this.tweens.add({ targets: this.hl, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
  }

  // Dopo il primo ipconfig: IRIS legge la scheda riga per riga, evidenziandola
  private explainCard() {
    this.busy = true;
    const parts: [string, string][] = [
      ['ip', 'IRIS: Questa è la casa della console: 10.0.10.21.'],
      ['mask', 'IRIS: La maschera 255.255.255.0 dice che il quartiere sono i primi tre numeri: 10.0.10.'],
      ['gw', 'IRIS: E questo è il gateway, la porta per uscire dal quartiere: 10.0.20.1. Guarda bene i primi tre numeri.'],
    ];
    const next = (i: number) => {
      if (i >= parts.length) { this.busy = false; this.guideStep = 1; this.guide(); return; }
      this.highlight(parts[i][0]);
      this.iris.say([parts[i][1]], () => next(i + 1));
    };
    next(0);
  }

  private answerQuiz(yes: boolean) {
    this.quiz = false;
    if (yes) {
      Audio.error();
      this.iris.say([
        'IRIS: Confronta i primi tre numeri: la console è in 10.0.10, il gateway in 10.0.20. Sono quartieri diversi.',
        'IRIS: È come se la porta del tuo condominio fosse in un\'altra via. Riprova.',
      ], () => { this.quiz = true; });
      return;
    }
    Audio.confirm();
    this.iris.say([
      'IRIS: Esatto. Il gateway è fuori dal quartiere: la console non può nemmeno raggiungerlo.',
      'MYRA: Allora devo dirle qual è la porta giusta.',
    ], () => { this.guideStep = 2; this.guide(); });
  }

  // --- Terminale
  private print(t: string, c: number = P.cyan3) {
    t.split('\n').forEach((x) => this.lines.push({ t: x, c }));
    this.renderTerm();
  }

  private renderTerm() {
    // ultime righe che entrano nel pannello, ognuna con il suo colore; l'ultima è il prompt
    const rows = this.termRows.length;
    const visible = this.wrapped().slice(-(rows - 1));
    const prompt = `MYRA@${this.d?.name ?? ''}> ${this.typed}${Math.floor(this.time.now / 450) % 2 ? '_' : ' '}`;
    this.termRows.forEach((t, i) => {
      if (i < visible.length) t.setText(visible[i].t).setColor(hex(visible[i].c));
      else if (i === visible.length) t.setText(prompt).setColor(hex(P.cream2));
      else t.setText('');
    });
  }

  // a capo manuale: ~54 caratteri per riga nel pannello del terminale
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
    if (this.done) return;
    if (this.iris.open) { if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Enter') this.iris.advance(); return; }
    if (this.busy) return;
    if (e.key === 'Escape') return this.exit(false);
    if (this.quiz && /^[sSnN]$/.test(e.key)) return this.answerQuiz(e.key.toLowerCase() === 's');
    if (this.quiz) return;
    if (e.key === 'Tab') { e.preventDefault(); if (this.guided && this.guideCmd) { this.typed = this.guideCmd; Audio.type(); this.renderTerm(); } return; }
    if (e.key === 'Enter') { const cmd = this.typed.trim(); this.typed = ''; if (cmd) this.run(cmd); else this.renderTerm(); return; }
    if (e.key === 'Backspace') { this.typed = this.typed.slice(0, -1); Audio.type(); return this.renderTerm(); }
    if (e.key === 'ArrowUp') { if (this.history.length) { this.hi = Math.max(0, (this.hi < 0 ? this.history.length : this.hi) - 1); this.typed = this.history[this.hi]; } return this.renderTerm(); }
    if ((e.key === 'h' || e.key === 'H') && this.typed === '') return this.hint();
    if (e.key.length === 1 && this.typed.length < 40) { this.typed += e.key; Audio.type(); this.renderTerm(); }
  }

  private run(raw: string) {
    this.history.push(raw); this.hi = -1;
    this.print(`MYRA@${this.d.name}> ${raw}`, P.cream2);
    const [cmd, ...args] = raw.toLowerCase().split(/\s+/);
    const arg = args.join(' ');
    switch (cmd) {
      case 'aiuto': case 'help':
        this.print('ipconfig                mostra la scheda di rete\nset ip|mask|gateway X    cambia un valore\nping X                  prova a raggiungere un indirizzo\nusa NOME                cambia dispositivo' +
          (this.mi === 2 ? '\ndiagnosi configurazione|collegamento' : '') + '\npulisci                 svuota lo schermo', P.cyan1);
        break;
      case 'ipconfig': this.ipconfig(); if (this.guided && this.guideStep === 0) this.time.delayedCall(300, () => this.explainCard()); break;
      case 'set': this.set(args[0], args[1] ?? ''); break;
      case 'ping': this.doPing(arg); break;
      case 'usa': this.use(arg); break;
      case 'diagnosi': this.diagnose(arg); break;
      case 'pulisci': case 'clear': this.lines = []; this.renderTerm(); break;
      default:
        Audio.error();
        // errore di esecuzione: si corregge la sintassi, senza spiegare concetti
        this.print(`Comando non riconosciuto: ${cmd}. ${this.closest(cmd)}`, P.red2);
    }
    this.refresh();
    this.checkDone();
  }

  private closest(cmd: string) {
    const all = ['ipconfig', 'set', 'ping', 'usa', 'aiuto', 'diagnosi', 'pulisci'];
    const near = all.find((a) => a[0] === cmd[0] || a.includes(cmd.slice(0, 3)));
    return near ? `Forse: ${near}` : 'Scrivi  aiuto  per l\'elenco.';
  }

  private ipconfig() {
    const d = this.d;
    this.print(`Scheda di rete · ${d.name}\n  Indirizzo IP . . : ${d.ip}\n  Maschera  . . . : ${d.mask}  (/${prefixOf(d.mask)})\n  Gateway . . . . : ${d.gateway}\n  Stato . . . . . : ${d.link ? 'collegato' : 'CAVO SCOLLEGATO'}`, P.cream);
  }

  private set(field: string, value: string) {
    const f = field === 'gw' ? 'gateway' : field === 'maschera' ? 'mask' : field;
    if (f !== 'ip' && f !== 'mask' && f !== 'gateway') {
      Audio.error();
      return this.print('Uso: set ip X · set mask X · set gateway X', P.red2);
    }
    const r = checkSet(this.d, f, value);
    if (!r.ok) {
      Audio.error();
      if (r.kind === 'comprensione') {
        this.wrong++;
        this.iris.say([`IRIS: ${r.msg}`, ...(this.wrong >= 3 ? ['IRIS: Vuoi un aiuto? Premi H.'] : [])]);
      } else this.print(r.msg, P.red2);
      return;
    }
    (this.d as unknown as Record<string, string>)[f] = value;
    Audio.confirm();
    this.print(`${f === 'mask' ? 'Maschera' : f === 'ip' ? 'Indirizzo' : 'Gateway'} aggiornato: ${value}`, P.phos);
    if (this.guided && this.guideStep === 2 && f === 'gateway' && value === ROUTER_LOCAL) { this.guideStep = 3; this.guide(); }
  }

  private use(name: string) {
    const i = this.devs.findIndex((x) => x.name.toLowerCase() === name);
    if (i < 0) { Audio.error(); return this.print(`Dispositivi disponibili: ${this.devs.map((x) => x.name).join(', ')}`, P.red2); }
    this.cur = i;
    Audio.click();
    this.print(`Ora sei su ${this.d.name}.`, P.cyan1);
  }

  private diagnose(what: string) {
    if (this.mi !== 2) return this.print('Nessuna diagnosi richiesta qui.', P.cyan1);
    if (what !== 'configurazione' && what !== 'collegamento') { Audio.error(); return this.print('Uso: diagnosi configurazione · diagnosi collegamento', P.red2); }
    if (what === 'configurazione') {
      Audio.error(); this.wrong++;
      return this.iris.say([
        'IRIS: Controlla di nuovo la scheda: indirizzo 10.0.10.40, maschera /24, gateway 10.0.10.1. Sono coerenti tra loro.',
        'IRIS: Se la configurazione è giusta e il segnale non parte, il problema è da un\'altra parte.',
      ]);
    }
    this.diagnosis = 'collegamento';
    Audio.confirm();
    this.busy = true;
    this.iris.say([
      'IRIS: Diagnosi corretta. Nessun comando può riparare un cavo.',
      'IRIS: Telecamera del corridoio: il cavo del terminale è a terra, staccato dalla porta 4 dello switch.',
      'MYRA: Vado io.',
    ], () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.d.link = true;
        Audio.click();
        this.print('— Myra ricollega il cavo alla porta 4. Una spia verde si accende. —', P.lamp2);
        this.refresh();
        this.cameras.main.fadeIn(400, 0, 0, 0);
        this.busy = false;
        this.print('Ora verifica con un ping al router.', P.cyan1);
      });
    });
  }

  private doPing(target: string) {
    if (!target) { Audio.error(); return this.print('Uso: ping X   (es. ping 10.0.10.1)', P.red2); }
    const r = ping(this.d, target);
    this.busy = true;
    this.animatePacket(target, r.ok, () => {
      r.lines.forEach((l, i) => this.time.delayedCall(i * 120, () => this.print(l, i === 0 ? P.cream : r.ok ? P.phos : P.red2)));
      this.time.delayedCall(r.lines.length * 120 + 100, () => {
        this.busy = false;
        if (r.ok) { Audio.confirm(); this.pinged.add(`${this.d.name}>${target}`); this.checkDone(); return; }
        Audio.error();
        this.explainFailure(r.reason);
      });
    });
  }

  // Feedback: perché il ping non funziona, detto con parole semplici
  private explainFailure(reason: string) {
    const d = this.d;
    const msg: Record<string, string> = {
      gwout: `IRIS: Il pacchetto doveva uscire dal quartiere, quindi la console l'ha affidato al gateway ${d.gateway}. Ma quel gateway non è nel suo quartiere (${intToIp(networkOf(d.ip, d.mask))}): non sa nemmeno come raggiungerlo.`,
      gwdown: `IRIS: Nel quartiere non c'è nessun router all'indirizzo ${d.gateway}.`,
      noarp: `IRIS: ${d.name} ha creduto che la destinazione fosse nel suo quartiere e l'ha cercata direttamente, senza passare dal router. Nessuno ha risposto.`,
      nolink: 'IRIS: Nessun pacchetto è partito. Non è una questione di indirizzi.',
      unknown: 'IRIS: Il router ha provato, ma a quell\'indirizzo non c\'è nessuno.',
      external: 'IRIS: Il collegamento verso l\'esterno è ancora interrotto. Una cosa alla volta.',
      badtarget: '',
    };
    if (msg[reason]) this.iris.say([msg[reason]]);
  }

  private hint() {
    const h = this.m.hints[Math.min(this.hintLevel, 2)];
    this.hintLevel = Math.min(this.hintLevel + 1, 3);
    Audio.click();
    this.iris.say([`IRIS: ${h}`]);
  }

  private checkDone() {
    if (this.done || !this.m.done(this.devs, this.pinged, this.diagnosis)) return;
    this.done = true;
    this.guideBox.setVisible(false); this.highlight('none'); this.guided = false;
    const wrap: string[][] = [
      ['IRIS: Gateway raggiungibile. Hai corretto una configurazione, non un guasto.', 'IRIS: Un dispositivo può essere acceso e funzionante, e non comunicare comunque.', 'MYRA: Come avere un telefono carico e il numero sbagliato.'],
      ['IRIS: Entrambi i monitor raggiungono l\'archivio.', 'IRIS: La maschera decide chi è "vicino". Se è sbagliata, il dispositivo cerca nel posto sbagliato.', 'MYRA: Quindi non basta sapere dove andare. Bisogna sapere dove si è.'],
      ['IRIS: Terminale del corridoio raggiungibile.', 'IRIS: Hai distinto un problema di configurazione da un problema di collegamento. Senza aiuto.', 'IRIS: ...Sei più veloce di molti operatori che ho registrato.'],
    ];
    this.time.delayedCall(500, () => this.iris.say(wrap[this.mi], () => {
      if (this.mi + 1 < this.missions.length) {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => { this.mi++; this.done = false; this.registry.set('ndMission', this.mi); this.cameras.main.fadeIn(400, 0, 0, 0); this.startMission(); });
      } else this.exit(true);
    }));
  }

  private exit(completed: boolean) {
    this.done = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      this.scene.get('station').events.emit('minigame-closed', { id: 'netdefender', completed, mission: this.mi });
      this.scene.resume('station');
    });
  }

  // --- Scheda + schema dei quartieri
  private refresh() {
    const d = this.d;
    if (!d) return;
    const ok = sameSubnet(d.ip, d.gateway, d.mask);
    this.cardText.setText(
      `${d.name}${this.devs.length > 1 ? `   (${this.devs.map((x) => x.name).join(' / ')})` : ''}\n` +
      `IP        ${d.ip}\nMaschera  ${d.mask}\nGateway   ${d.gateway}\nStato     ${d.link ? 'collegato' : 'cavo scollegato'}`,
    );
    void ok;
    this.drawDiagram();
    this.renderTerm();
  }

  private nodePos() {
    const y = Y0 + 150, x = X0 + 8;
    return {
      dev: { x: x + 18, y: y + 30 }, sw: { x: x + 70, y: y + 30 }, rt: { x: x + 128, y: y + 30 }, ar: { x: x + 186, y: y + 30 },
      boxA: { x: x + 2, y: y + 8, w: 146, h: 52 }, boxB: { x: x + 162, y: y + 8, w: 42, h: 52 }, y,
    };
  }

  private drawDiagram() {
    const g = this.diagram.clear();
    this.diagramLabels.forEach((t) => t.destroy());
    this.diagramLabels = [];
    const n = this.nodePos(), d = this.d;
    const label = (x: number, y: number, t: string, c: number, size = 12) =>
      this.diagramLabels.push(this.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color: hex(c) }).setOrigin(0.5, 0));
    // quartieri reali
    g.lineStyle(1, P.cyan1, 0.8).strokeRect(n.boxA.x, n.boxA.y, n.boxA.w, n.boxA.h);
    g.lineStyle(1, P.lamp0, 0.8).strokeRect(n.boxB.x, n.boxB.y, n.boxB.w, n.boxB.h);
    label(n.boxA.x + n.boxA.w / 2, n.boxA.y - 12, 'quartiere 10.0.10.x', P.cyan1, 11);
    label(n.boxB.x + n.boxB.w / 2, n.boxB.y - 12, '10.0.20.x', P.lamp, 11);
    // collegamenti
    g.lineStyle(2, d.link ? P.metal2 : P.red, 1).lineBetween(n.dev.x, n.dev.y, n.sw.x, n.sw.y);
    if (!d.link) { g.lineStyle(2, P.red).lineBetween(n.dev.x + 20, n.dev.y - 6, n.dev.x + 30, n.dev.y + 6); }
    g.lineStyle(2, P.metal2).lineBetween(n.sw.x, n.sw.y, n.rt.x, n.rt.y).lineBetween(n.rt.x, n.rt.y, n.ar.x, n.ar.y);
    // nodi
    const node = (p: { x: number; y: number }, c: number, name: string, ip: string) => {
      g.fillStyle(P.night).fillRect(p.x - 12, p.y - 9, 24, 18).lineStyle(1, c).strokeRect(p.x - 12, p.y - 9, 24, 18);
      label(p.x, p.y + 11, name, P.cream, 11);
      label(p.x, p.y + 21, ip, P.conc, 10);
    };
    node(n.dev, P.cyan3, d.name.split('-')[0], '.' + d.ip.split('.')[3]);
    node(n.sw, P.metal2, 'switch', '');
    node(n.rt, P.lamp, 'router', '.1');
    node(n.ar, P.lamp, 'archivio', '20.5');
    // dove il dispositivo CREDE sia il suo quartiere (secondo la sua maschera)
    const wide = prefixOf(d.mask) < 24;
    if (wide) {
      g.lineStyle(1, P.red2, 0.9);
      for (let x = n.boxA.x - 4; x < n.boxB.x + n.boxB.w + 4; x += 6) g.lineBetween(x, n.y + 74, x + 3, n.y + 74);
      label((n.boxA.x + n.boxB.x + n.boxB.w) / 2, n.y + 76, `per ${d.name} è tutto un quartiere`, P.red2, 11);
    }
    const gwIn = sameSubnet(d.ip, d.gateway, REAL_MASK);
    label(X0 + LW / 2, n.y + (wide ? 92 : 78), `gateway: ${d.gateway}${gwIn ? '' : '  ✗'}`, gwIn ? P.conc : P.red2, 12);
  }

  private animatePacket(target: string, ok: boolean, cb: () => void) {
    const n = this.nodePos(), d = this.d;
    const path = [n.dev];
    if (d.link) {
      path.push(n.sw);
      const remote = !sameSubnet(d.ip, target, d.mask);
      if (target === ROUTER_LOCAL || (remote && sameSubnet(d.ip, d.gateway, d.mask))) path.push(n.rt);
      if (target === ARCHIVE && remote && ok) path.push(n.ar);
    }
    this.packet?.destroy();
    this.packet = this.add.circle(n.dev.x, n.dev.y, 3, P.cyan3).setDepth(100);
    const steps = path.slice(1);
    const go = (i: number) => {
      if (i >= steps.length) {
        this.packet!.setFillStyle(ok ? P.phos : P.red);
        this.tweens.add({ targets: this.packet, scale: 2, alpha: 0, duration: 400, onComplete: cb });
        return;
      }
      this.tweens.add({ targets: this.packet, x: steps[i].x, y: steps[i].y, duration: 260, onComplete: () => go(i + 1) });
    };
    go(0);
    void parseIp;
  }

  update(_t: number, dt: number) {
    this.iris.update(dt);
    if (!this.iris.open && !this.busy) this.renderTerm();
  }
}
