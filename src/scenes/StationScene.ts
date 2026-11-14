import Phaser from 'phaser';
import { DEBUG, VIEW_W, VIEW_H } from '../core/config';
import { P, hex } from '../core/palette';
import { FONT } from '../core/fonts';
import { loadSave, writeSave, SaveData } from '../core/save';
import * as CONTROL from '../world/controlRoom';
import * as LAB from '../world/lab';
import * as COMMS from '../world/comms';

const ROOMS = { control: CONTROL, lab: LAB, comms: COMMS } as const;
// dove compare Myra entrando in una stanza, a seconda della stanza da cui arriva
const ENTRIES: Partial<Record<string, { x: number; y: number }>> = {
  'control>lab': LAB.ENTRY_IMG, 'lab>control': CONTROL.ENTRY_IMG,
  'lab>comms': COMMS.ENTRY_IMG, 'comms>lab': { x: 1190, y: 440 },
};
type RoomId = keyof typeof ROOMS;
const S = 0.5; // scala comune degli sfondi
import { Player } from '../actors/Player';
import { IrisDialog } from '../iris/IrisDialog';
import { Audio } from '../audio/AudioManager';

// Sala controllo. Nuova partita: la stazione è al buio, Myra ha solo la torcia.
// Tutorial come scena (docs/NARRATIVE_BIBLE.md §9): muoversi → quadro elettrico → console → risveglio di IRIS.
const TUTORIAL = [
  'Muoviti con  W A S D  oppure con le frecce',
  'Cerca il quadro elettrico. Quando compare [E], premi E',
  'Qualcosa si è acceso. Raggiungi la console al centro della sala',
];

export class StationScene extends Phaser.Scene {
  private player!: Player;
  private iris!: IrisDialog;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private darkRT!: Phaser.GameObjects.RenderTexture;
  private brush!: Phaser.GameObjects.Image;
  private prompt!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private state: SaveData = { act: 1, flags: {}, room: 'control', x: 0, y: 0 };
  private doorZone?: Phaser.GameObjects.Zone;
  private doorLight!: Phaser.GameObjects.Image;
  private consoleBeacon!: Phaser.GameObjects.Image;
  private breakerLed?: Phaser.GameObjects.Image;
  private screenFx: Phaser.GameObjects.GameObject[] = [];
  private lampFx: Phaser.GameObjects.Image[] = [];
  private fixedScreens: Phaser.GameObjects.Graphics[] = [];
  private tutStep = -1;
  private tutBox?: Phaser.GameObjects.Container;
  private tutText?: Phaser.GameObjects.Text;
  private tutBg?: Phaser.GameObjects.Rectangle;
  private objective?: Phaser.GameObjects.Text;
  private startPos = { x: 0, y: 0 };
  private dark = 0;       // buio attuale (0 = luce piena)
  private paused = false;
  private roomId: RoomId = 'control';
  private entering = false;
  private leaving = false;
  private get R() { return ROOMS[this.roomId]; }

  constructor() { super('station'); }

  init(data: { entry?: boolean }) { this.entering = !!data?.entry; }

  create() {
    const saved = loadSave();
    const valid = saved && saved.room in ROOMS;
    this.state = valid ? saved! : { act: 1, flags: {}, room: 'control', x: 0, y: 0 };
    this.roomId = this.state.room as RoomId;
    this.leaving = false;
    const { ROOM_W, ROOM_H, BLOCKERS, DOOR_BLOCK, OCCLUDERS, LAMPS_IMG, SPAWN_IMG, ENTRY_IMG, KEY } = this.R;
    this.tutStep = -1; this.tutBox = undefined; this.screenFx = []; this.lampFx = []; this.fixedScreens = []; this.paused = false;
    const W = ROOM_W * S, H = ROOM_H * S;
    this.physics.world.setBounds(0, 0, W, H);
    this.walls = this.physics.add.staticGroup();

    // sfondo e ritagli in primo piano (stessa immagine, frame separati, ordinati per profondità)
    this.add.image(0, 0, KEY, '__BASE').setOrigin(0).setScale(S).setDepth(-1000);
    const tex = this.textures.get(KEY);
    OCCLUDERS.forEach((o, i) => {
      const [x, y, w, h] = o.rect;
      if (!tex.has(`occ${i}`)) tex.add(`occ${i}`, 0, x, y, w, h);
      const im = this.add.image(x * S, y * S, KEY, `occ${i}`).setOrigin(0).setScale(S).setDepth(o.baseY * S);
      // sagoma esatta dell'oggetto: niente pezzi di pavimento "incollati" sopra Myra
      if (o.poly) {
        const g = this.make.graphics({}, false).fillStyle(0xffffff).fillPoints(o.poly.map(([px, py]) => new Phaser.Math.Vector2(px * S, py * S)), true);
        im.setMask(g.createGeometryMask());
      }
    });
    const block = (r: number[]) => {
      const z = this.add.zone((r[0] + r[2] / 2) * S, (r[1] + r[3] / 2) * S, r[2] * S, r[3] * S);
      this.walls.add(z);
      return z;
    };
    BLOCKERS.forEach(block);
    const isControl = this.roomId === 'control';
    if (isControl && !this.state.flags.doorServer) this.doorZone = block(DOOR_BLOCK);

    if (isControl) this.addScreenFlicker(); else if (this.roomId === 'lab') this.addLabFx(); else this.addCommsFx();
    this.doorLight = this.add.image(1380 * S, 122 * S, 'glow').setScale(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(150).setVisible(isControl);
    LAMPS_IMG.forEach((l) => {
      const g = this.add.image(l.x * S, l.y * S, 'glow').setScale(2.2).setTint(P.lamp).setAlpha(0.18)
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(9100);
      this.tweens.add({ targets: g, alpha: 0.22, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.lampFx.push(g);
    });
    // la console che si risveglia: un battito di luce ciano
    this.consoleBeacon = this.add.image(735 * S, 385 * S, 'glow').setScale(1.4, 0.8).setTint(P.cyan).setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(281.6);

    // spia d'emergenza del quadro elettrico: l'unica luce nel buio, indica dove andare
    this.breakerLed = this.add.image(1140 * S, 210 * S, 'glow').setScale(0.6).setTint(P.red2).setBlendMode(Phaser.BlendModes.ADD).setDepth(9100).setVisible(isControl);
    this.tweens.add({ targets: this.breakerLed, alpha: 0.15, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const start = this.entering && valid ? { x: saved!.x, y: saved!.y }
      : this.entering ? { x: ENTRY_IMG.x * S, y: ENTRY_IMG.y * S }
      : valid ? { x: saved!.x, y: saved!.y } : { x: SPAWN_IMG.x * S, y: SPAWN_IMG.y * S };
    this.player = new Player(this, start.x, start.y);
    this.physics.add.collider(this.player, this.walls);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.player, true, 0.1, 0.1);

    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: W }, y: { min: 0, max: H },
      lifespan: 7000, speedX: { min: -3, max: 3 }, speedY: { min: -2, max: 2 },
      alpha: { start: 0.35, end: 0 }, tint: P.cream2, frequency: 200, maxAliveParticles: 45,
    }).setDepth(9200);

    this.darkRT = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(9000);
    this.brush = this.make.image({ key: 'light', add: false }).setOrigin(0.5);

    this.prompt = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '15px', color: hex(P.cyan3), backgroundColor: hex(P.petrol0), padding: { x: 4, y: 1 },
    }).setOrigin(0.5, 1).setDepth(9500).setVisible(false);
    this.objective = this.add.text(VIEW_W - 10, 10, '', { fontFamily: FONT, fontSize: '15px', color: hex(P.cream), backgroundColor: '#0e1a1acc', padding: { x: 6, y: 3 } })
      .setOrigin(1, 0).setScrollFactor(0).setDepth(9600);

    this.iris = new IrisDialog(this);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E,SPACE,ESC,M,ONE,TWO,THREE,FOUR,U,R,P') as Record<string, Phaser.Input.Keyboard.Key>;
    const interact = () => { if (this.paused) return; if (this.iris.open) this.iris.advance(); else this.tryInteract(); };
    this.keys.E.on('down', interact);
    this.keys.SPACE.on('down', interact);
    this.keys.ESC.on('down', () => this.togglePause());
    for (const [k, d] of [['UP', -1], ['W', -1], ['DOWN', 1], ['S', 1]] as const) this.keys[k].on('down', () => this.iris.move(d));
    this.keys.M.on('down', () => { if (this.scene.isActive() && !this.paused && !this.iris.open && this.state.flags.irisAwake && this.tutStep < 0) this.openPath('view'); });
    this.events.off('resume');
    this.events.on('resume', () => { this.input.keyboard!.resetKeys(); });
    this.events.off('minigame-closed');
    this.events.off('signalpath-closed');
    this.events.on('signalpath-closed', (mode: string) => this.onPathClosed(mode));
    this.events.on('minigame-closed', (r: { id: string; completed: boolean; mission: number }) => this.onMinigameClosed(r));
    if (DEBUG) this.setupDebug();

    Audio.unlock();
    Audio.setMusic('station');
    this.applyPower(true);
    if (this.roomId === 'lab' && this.state.flags.nightStarted && !this.state.flags.nightDone) this.setNight(true, true);
    cam.fadeIn(1200, 0, 0, 0);
    this.startPos = { x: this.player.x, y: this.player.y };

    if (!this.state.flags.power) {
      Audio.bed('wind', true, 0.4);
      this.time.delayedCall(1300, () => this.iris.say([
        '(Fa freddo anche qui dentro. Ma almeno non nevica.)',
        '(Buio. Se questa stazione ha ancora una voce, prima serve corrente.)',
      ], () => this.setTutorial(0)));
    } else if (!this.state.flags.irisAwake) {
      // partita ripresa dopo aver dato corrente ma prima di svegliare IRIS
      this.tweens.add({ targets: this.consoleBeacon, alpha: 0.45, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.time.delayedCall(800, () => this.setTutorial(2));
    } else if (this.roomId === 'comms' && !this.state.flags.commsVisited) {
      this.state.flags.commsVisited = true;
      this.save();
      this.refreshObjective();
      this.time.delayedCall(900, () => this.iris.say([
        '(Qui fa freddo. E le luci sono tutte rosse.)',
        'IRIS: Sala Comunicazioni. Tutto ciò che va verso l\'antenna passa da questa stanza.',
        'IRIS: La porta blindata è il filtro della stazione: decide chi può passare e chi no.',
        'IRIS: È in quarantena. Si apre solo dal suo pannello, e solo se le regole sono giuste.',
        'MYRA: Il filtro. La parola del nastro.',
      ]));
    } else if (this.roomId === 'lab' && !this.state.flags.labVisited) {
      this.state.flags.labVisited = true;
      this.save();
      this.refreshObjective();
      this.time.delayedCall(900, () => this.iris.say([
        '(Fa più caldo qui. Una stufetta accesa, una lampada sulla scrivania.)',
        'IRIS: Laboratorio di diagnostica. Ho mantenuto attivi riscaldamento e illuminazione minima.',
        'MYRA: Per chi? Non c\'era nessuno.',
        'IRIS: ...Procedura standard.',
        'IRIS: Da qui posso isolare un tratto di rete alla volta e portarlo sul banco di prova. Ripararlo qui non mette a rischio il resto.',
        '(Un pezzo alla volta.)',
      ]));
    } else this.refreshObjective();
  }

  // --- Corrente: tutto ciò che cambia quando la stazione si riaccende
  private applyPower(instant = false) {
    const on = !!this.state.flags.power;
    this.dark = on ? 0 : 0.72; // al buio la sala resta intuibile: sagome, riflessi
    this.breakerLed?.setVisible(!on && this.roomId === 'control');
    this.screenFx.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(on));
    this.lampFx.forEach((l) => l.setVisible(on));
    this.doorLight.setVisible(on && this.roomId === 'control').setTint(this.state.flags.doorServer ? P.cyan : P.red).setAlpha(0.35);
    if (on) { Audio.bed('hum', true); if (!instant) Audio.bed('wind', false); }
  }

  private powerUp() {
    this.state.flags.power = true;
    Audio.power();
    this.cameras.main.shake(300, 0.004);
    // le luci tornano a scatti, come vecchi neon
    const steps = [0.72, 0.35, 0.7, 0.2, 0.5, 0.1, 0];
    steps.forEach((d, i) => this.time.delayedCall(140 * i, () => { this.dark = d; }));
    this.time.delayedCall(140 * steps.length, () => {
      this.applyPower();
      this.save();
      // la console si accende da sola
      this.time.delayedCall(600, () => {
        Audio.boot();
        this.tweens.add({ targets: this.consoleBeacon, alpha: 0.45, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.iris.say(['(La console al centro si è accesa da sola. Sta... aspettando?)'], () => this.setTutorial(2));
      });
    });
  }

  private wakeIris() {
    this.tweens.killTweensOf(this.consoleBeacon);
    this.consoleBeacon.setAlpha(0);
    this.state.flags.irisAwake = true;
    Audio.boot();
    this.iris.say([
      'IRIS: ...alimentazione ripristinata. Sessione 0412... interrotta.',
      'IRIS: Utente non registrato. Chi sei?',
      'MYRA: Myra. Myra Kovalenko.',
      'IRIS: Kovalenko. ...Oleh Kovalenko era il tecnico di turno.',
      'MYRA: Era mio padre.',
      'IRIS: ...',
      'IRIS: Sono I.R.I.S., il sistema di supporto della stazione. La rete è stata modificata la notte dell\'attacco.',
      'IRIS: Indirizzi sbagliati, porte spente, strade che non portano da nessuna parte. E qualcosa è ancora dentro.',
      'IRIS: Lo chiamo SILENCE. È un\'arma della guerra. Il suo unico scopo è che nessuno trasmetta.',
      'MYRA: Allora lo riparo. Devo parlare con mia madre.',
      'IRIS: Non ancora. Un errore sulla rete vera, e SILENCE se ne accorge.',
      'IRIS: Prima ti alleno. Ho ricostruito la rete in simulazione: ogni volta diversa, così impari dove si rompe.',
      'MYRA: Non so niente di reti.',
      'IRIS: Lo so. Cominceremo dal primo pezzo. Prima ti mostro la strada che deve fare il tuo messaggio.',
    ], () => { this.save(); this.openPath('intro'); });
  }

  // i monitor con errore lampeggiano sopra il dipinto; i canali attivi pulsano
  private addScreenFlicker() {
    [[822, 47, 82, 58], [727, 130, 82, 58]].forEach(([x, y, w, h]) => {
      // schermo riparato: dati ciano al posto dell'errore rosso (visibile quando il gateway torna)
      const fixed = this.add.graphics().setDepth(156.4);
      fixed.fillStyle(P.cyan, 0.12).fillRoundedRect(x * S, y * S, w * S, h * S, 3); // schermo riparato: solo un bagliore
      fixed.setVisible(!!this.state.flags.gatewayRestored);
      this.fixedScreens.push(fixed);
      const r = this.add.rectangle(x * S, y * S, w * S, h * S, P.red2, 0).setOrigin(0).setDepth(156.5).setBlendMode(Phaser.BlendModes.ADD);
      const tick = () => {
        if (!this.state.flags.gatewayRestored) { r.setAlpha(0.35); this.time.delayedCall(90, () => r.setAlpha(0)); }
        this.time.delayedCall(Phaser.Math.Between(600, 2400), tick);
      };
      this.time.delayedCall(Phaser.Math.Between(300, 1500), tick);
      this.screenFx.push(r);
    });
    [[627, 47, 82, 58], [627, 130, 82, 58], [822, 130, 82, 58], [625, 342, 95, 72], [748, 357, 92, 68]].forEach(([x, y, w, h]) => {
      const c = this.add.rectangle(x * S, y * S, w * S, h * S, P.cyan, 0.05).setOrigin(0).setDepth(y < 300 ? 156.5 : 321).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: c, alpha: 0.14, duration: Phaser.Math.Between(90, 160), yoyo: true, repeat: -1, repeatDelay: Phaser.Math.Between(1500, 4000) });
      this.screenFx.push(c);
    });
  }

  // --- Interazione

  private nearest() {
    const p = this.player.probe();
    let best: (typeof CONTROL.SPOTS)[number] | undefined, bd = Infinity;
    for (const s of this.R.SPOTS) {
      const d = Phaser.Math.Distance.Between(p.x, p.y, s.x * S, s.y * S);
      if (d < s.r * S && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  private tryInteract() {
    const s = this.nearest();
    if (!s) return;
    const f = this.state.flags;
    Audio.click();
    if (this.roomId === 'lab') {
      if (s.id === 'back') return this.goTo('control');
      if (s.id === 'cdoor') return f.nightDone ? this.goTo('comms')
        : this.iris.say(['(Una porta di metallo. Dietro, un ronzio di macchine. Chiusa.)', 'IRIS: È la Sala Comunicazioni. Con questa corrente non riesco ad aprirla.']);
      return this.labInteract(s.id);
    }
    if (this.roomId === 'comms') return this.commsInteract(s.id);
    if (s.id === 'door' && f.doorServer) return this.goTo('lab');
    if (s.id === 'breaker' && !f.power) {
      this.iris.say(['(Leve, fusibili, un interruttore generale. Questo almeno lo so fare.)'], () => this.powerUp());
      if (this.tutStep === 1) this.tutHide();
      return;
    }
    if (s.id === 'console' && f.power && !f.irisAwake) { this.tutHide(); this.wakeIris(); return; }
    if (s.id === 'console' && f.irisAwake && !f.gatewayRestored) return this.openMinigame('netdefender', 'ndMission');
    if (s.id === 'console' && f.gatewayRestored) return this.offerReplay('netdefender', 'IRIS: La rete locale funziona. Vuoi rifare le prove di configurazione?');

    const dark = !f.power;
    const lines: Record<string, string[]> = {
      breaker: ['(La corrente c\'è. Il resto non dipende da una leva.)'],
      console: dark ? ['(Uno schermo spento. Senza corrente non serve a niente.)']
        : f.gatewayRestored ? ['IRIS: Connessione con il gateway stabile.', 'IRIS: La porta est risponde di nuovo alla rete.']
        : [],
      monitors: dark ? ['(Schermi spenti. Sul vetro, impronte di dita. Qualcuno li ha toccati in fretta.)']
        : ['(Due schermi rossi. Gli altri mostrano numeri fermi alle 04:58 di quella notte.)'],
      racks: dark ? ['(Armadi pieni di cavi. Non saprei nemmeno da dove iniziare.)'] : ['(Lucine che lampeggiano. Per ora non dicono niente a nessuno.)'],
      map: ['(Una cartina. Spilli rossi sulle stazioni che non rispondono più. Ce ne sono tanti.)'],
      deskL: ['(Il quaderno dei turni. Ultima riga: "Manutenzione alle 05:00. Credenziali come sempre." Poi più niente.)'],
      deskR: ['(Una tazza. Caffè seccato da mesi. Chi beveva qui è andato via di corsa.)'],
      door: f.doorServer
        ? ['(La porta è aperta. Dall\'altra parte, una luce calda.)']
        : dark ? ['(Una porta blindata, con una spia spenta. Chiusa.)'] : ['(La spia è rossa. La serratura sembra elettronica.)', ...(f.irisAwake ? ['IRIS: Serratura collegata alla rete locale. Al momento non risponde.'] : [])],
    };
    this.iris.say(lines[s.id] ?? ['...']);
    this.save();
  }

  // --- Tutorial

  private setTutorial(step: number) {
    this.tutStep = step;
    if (step >= TUTORIAL.length) {
      this.tutHide(); this.tutStep = -1;
      this.state.flags.tutorialDone = true;
      Audio.confirm();
      this.save();
      this.refreshObjective();
      return;
    }
    if (step > 0) Audio.confirm();
    if (!this.tutBox) {
      const bg = this.add.rectangle(0, 0, 310, 46, P.petrol0, 0.88).setOrigin(0).setStrokeStyle(1, P.lamp0);
      this.tutBg = bg;
      const title = this.add.text(8, 3, 'COME SI GIOCA', { fontFamily: FONT, fontSize: '13px', color: hex(P.lamp2) });
      this.tutText = this.add.text(8, 18, '', { fontFamily: FONT, fontSize: '16px', color: hex(P.cream2), wordWrap: { width: 294 } });
      this.tutBox = this.add.container(10, 10, [bg, title, this.tutText]).setScrollFactor(0).setDepth(9600);
    }
    this.tutBox.setVisible(true);
    this.tutText!.setText(TUTORIAL[step]);
    this.tutBg?.setSize(310, this.tutText!.height + 26); // il riquadro cresce con il testo
    this.tutBox.setAlpha(0);
    this.tweens.add({ targets: this.tutBox, alpha: 1, duration: 300 });
    this.refreshObjective();
  }

  private tutHide() { this.tutBox?.setVisible(false); }

  private refreshObjective() {
    const f = this.state.flags;
    let text = '';
    if (this.tutStep < 0 && f.irisAwake) text = (!f.gatewayRestored ? 'Tratto 1 · Rete locale: usa la console' : f.routingRestored && f.nightStarted && !f.nightDone ? 'Riposati sul letto' : f.firewallRestored ? 'Tratto 4 · Nomi: prossimamente' : f.routingRestored && this.roomId === 'comms' ? 'Tratto 3 · Filtro: usa la porta blindata' : f.routingRestored ? 'Tratto 3 · Filtro: Sala Comunicazioni (porta a destra)' : this.roomId === 'lab' ? 'Tratto 2 · Strade: usa il banco di prova' : 'Tratto 2 · Strade: vai al laboratorio (porta est)') + '\nM  percorso del segnale';
    this.objective?.setText(text).setVisible(!!text);
  }

  // Il percorso del segnale: lega l'obiettivo di Myra ai minigiochi
  private openPath(mode: 'intro' | 'repaired' | 'view', fixed = -1) {
    this.player.setVelocity(0, 0);
    this.scene.pause();
    this.scene.launch('signalpath', { flags: this.state.flags, mode, fixed });
  }

  private onPathClosed(mode: string) {
    this.input.keyboard!.resetKeys();
    if (mode === 'intro') { this.setTutorial(3); this.save(); }
    if (mode === 'repaired' && this.state.flags.routingRestored && !this.state.flags.nightStarted) { this.time.delayedCall(500, () => this.nightIntro()); return; }
    if (mode === 'repaired') this.time.delayedCall(400, () => this.iris.say([
      '(Una porta aperta. Una spia verde.)',
      '(Non è ancora un segnale. Ma è la prima cosa, in mesi, che risponde quando chiamo.)',
    ]));
  }

  private openNetDefender() {
    this.save();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.pause();
      this.scene.launch('netdefender', { mission: (this.state.flags as unknown as Record<string, number>).ndMission ?? 0 });
    });
  }

  // Conseguenze nel mondo quando Network Defender è completato
  private openPacketTrace() {
    this.save();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.pause();
      this.scene.launch('packettrace', { mission: (this.state.flags as unknown as Record<string, number>).ptMission ?? 0 });
    });
  }

  // Minigioco già completato: si può rigiocare dall'inizio, senza cambiare i progressi
  private replaying = false;
  private offerReplay(scene: string, question: string) {
    this.iris.say([question], () => this.iris.choose(['Sì, rifacciamole', 'No, va bene così'], (i) => {
      if (i !== 0) return;
      this.replaying = true;
      this.save();
      this.player.setVelocity(0, 0);
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => { this.scene.pause(); this.scene.launch(scene, { mission: 0 }); });
    }));
  }

  private onMinigameClosed(r: { id: string; completed: boolean; mission: number }) {
    this.cameras.main.fadeIn(500, 0, 0, 0);
    if (this.replaying) { this.replaying = false; if (r.completed) this.iris.say(['IRIS: Prove superate di nuovo. Non ti sei dimenticata niente.']); return; }
    if (r.id === 'packettrace') return this.onPacketTraceClosed(r);
    if (r.id === 'firewall') return this.onFirewallClosed(r);
    (this.state.flags as unknown as Record<string, number>).ndMission = r.completed ? 0 : r.mission;
    if (!r.completed) { this.save(); return; }
    this.state.flags.gatewayRestored = true;
    this.save();
    this.time.delayedCall(700, () => {
      this.fixedScreens.forEach((g) => g.setVisible(true));
      Audio.power();
      this.cameras.main.flash(250, 63, 167, 181);
      this.iris.say([
        'IRIS: Rete locale ripristinata. Gateway raggiungibile da tutti i dispositivi della sala.',
        'IRIS: La serratura della porta est è collegata alla rete. Ora risponde.',
      ], () => {
        this.openDoor();
        Audio.door();
        this.refreshObjective();
        this.save();
        this.time.delayedCall(900, () => this.openPath('repaired', 0));
      });
    });
  }

  private onFirewallClosed(r: { completed: boolean; mission: number }) {
    (this.state.flags as unknown as Record<string, number>).fwMission = r.completed ? 0 : r.mission;
    if (!r.completed) { this.save(); return; }
    this.state.flags.firewallRestored = true;
    this.save();
    this.time.delayedCall(700, () => {
      Audio.power(); Audio.door();
      this.cameras.main.flash(250, 63, 167, 181);
      this.gateLight?.setTint(P.phos);
      this.iris.say([
        'IRIS: Filtro ripristinato. La quarantena è finita: la porta blindata si è aperta.',
        'IRIS: Dietro c\'è la scala per il tetto. E per l\'antenna.',
        '(Le luci rosse, una dopo l\'altra, smettono di lampeggiare.)',
      ], () => {
        this.refreshObjective();
        this.save();
        this.time.delayedCall(600, () => this.openPath('repaired', 2));
      });
    });
  }

  private onPacketTraceClosed(r: { completed: boolean; mission: number }) {
    (this.state.flags as unknown as Record<string, number>).ptMission = r.completed ? 0 : r.mission;
    if (!r.completed) { this.save(); return; }
    this.state.flags.routingRestored = true;
    this.save();
    this.time.delayedCall(700, () => {
      Audio.power();
      this.cameras.main.flash(250, 63, 167, 181);
      this.iris.say([
        'IRIS: Strade ripristinate. Ho copiato le correzioni del banco sui router veri della stazione.',
        '(Mio padre lavorava qui. Forse ha visto anche lui quel NODE-X.)',
      ], () => {
        this.refreshObjective();
        this.save();
        this.time.delayedCall(600, () => this.openPath('repaired', 1));
      });
    });
  }

  // ===== SALA COMUNICAZIONI =====
  private addCommsFx() {
    // spie degli armadi: rosse e ambrate, ognuna col suo ritmo
    const leds: [number, number, number][] = [[265, 185, P.red2], [395, 245, P.lamp2], [490, 150, P.red2], [520, 300, P.lamp2], [300, 330, P.red2], [900, 210, P.red2], [1010, 150, P.red2], [1100, 280, P.lamp2], [930, 330, P.lamp2]];
    leds.forEach(([x, y, c], i) => {
      const g = this.add.image(x * S, y * S, 'glow').setScale(0.5).setTint(c).setAlpha(0.15).setBlendMode(Phaser.BlendModes.ADD).setDepth(150);
      this.tweens.add({ targets: g, alpha: 0.55, duration: 300 + i * 170, yoyo: true, repeat: -1, repeatDelay: 400 + i * 90 });
    });
    // tastierino della porta blindata
    this.gateLight = this.add.image(793 * S, 230 * S, 'glow').setScale(0.6).setTint(this.state.flags.firewallRestored ? P.phos : P.lamp).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(150);
    this.tweens.add({ targets: this.gateLight, alpha: 0.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // portatile della postazione
    const lap = this.add.image(1345 * S, 440 * S, 'glow').setScale(1.4, 0.9).setTint(P.cyan).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(9100);
    this.tweens.add({ targets: lap, alpha: 0.26, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // neve oltre la finestra e la luce rossa dell'antenna
    const snow = this.add.particles(0, 0, 'px', {
      x: { min: 1245 * S, max: 1530 * S }, y: 40 * S, lifespan: 2400, speedY: { min: 10, max: 18 }, speedX: { min: -4, max: 1 },
      alpha: { min: 0.4, max: 0.8 }, tint: P.cream2, frequency: 160,
    }).setDepth(-999);
    snow.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(1245 * S, 40 * S, 285 * S, 4) } as Phaser.Types.GameObjects.Particles.EmitZoneData);
    const red = this.add.image(1452 * S, 72 * S, 'glow').setScale(0.25).setTint(P.red2).setBlendMode(Phaser.BlendModes.ADD).setDepth(-998).setAlpha(0);
    this.tweens.add({ targets: red, alpha: 0.9, duration: 120, yoyo: true, hold: 200, repeat: -1, repeatDelay: 1600 });
  }
  private gateLight?: Phaser.GameObjects.Image;

  private commsInteract(id: string) {
    const f = this.state.flags;
    if (id === 'back') return this.goTo('lab');
    if (id === 'gate' && f.routingRestored && !f.firewallRestored) return this.openMinigame('firewall', 'fwMission');
    if (id === 'gate' && f.firewallRestored) return this.offerReplay('firewall', 'IRIS: Il pannello del filtro è ancora acceso. Vuoi rifare le prove?');
    const lines: Record<string, string[]> = {
      gate: ['(La porta è aperta. Dietro, una scala di ferro sale verso il tetto. E verso l\'antenna.)'],
      racks: ['(Centinaia di lucine rosse. Ognuna è una porta che qualcuno ha chiuso.)',
        'IRIS: Ogni servizio della stazione ha un numero, una "porta". Il filtro decide quali numeri possono passare.'],
      patch: ['(Cavi colorati, uno per uno, con un\'etichetta scritta a mano.)', '(La stessa grafia storta del nastro.)'],
      desk: f.fatherBadge
        ? ['(Il badge di papà. Lo lascio dov\'è. Era il suo posto.)']
        : ['(Un badge appeso al gancio. «KOVALENKO O. · TECNICO DI TURNO».)', '(La foto è sbiadita. Il sorriso no.)', 'MYRA: Era qui anche quella notte.'],
      crates: ['(Ricambi. Etichette in tre lingue. Su una, a pennarello: «Non aprire fino a primavera».)'],
    };
    if (id === 'desk') f.fatherBadge = true;
    this.iris.say(lines[id] ?? ['...']);
    this.save();
  }

  // Se il minigioco era stato lasciato a metà: riprendere o ricominciare
  private openMinigame(scene: string, flag: string) {
    const flags = this.state.flags as unknown as Record<string, number>;
    const m = flags[flag] ?? 0;
    if (m > 0) {
      return this.iris.choose([`Riprendi dalla missione ${m + 1}`, 'Ricomincia dall\'inizio'], (i) => {
        if (i === 1) flags[flag] = 0;
        this.launchMinigame(scene, flag);
      });
    }
    this.launchMinigame(scene, flag);
  }

  private launchMinigame(scene: string, flag: string) {
    this.save();
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.pause();
      this.scene.launch(scene, { mission: (this.state.flags as unknown as Record<string, number>)[flag] ?? 0 });
    });
  }

  // ===== INTERLUDIO 1 · LA NOTTE (docs/NARRATIVE_BIBLE.md §12) =====
  // Dopo Packet Trace: IRIS spegne il laboratorio per i generatori. Myra resta con la stufetta.
  // Una conversazione a scelte con IRIS, poi il nastro del padre sotto il letto.
  private night = false;

  private setNight(on: boolean, instant = false) {
    this.night = on;
    const target = on ? 0.62 : 0;
    if (instant) this.dark = target;
    else this.tweens.addCounter({ from: this.dark, to: target, duration: 2500, onUpdate: (tw) => { this.dark = tw.getValue(); } });
    Audio.setMusic(on ? 'off' : 'station');
    Audio.bed('hum', !on);
  }

  private nightIntro() {
    this.iris.say([
      'IRIS: Myra. I generatori sono al limite. Le strade nuove consumano più di quanto pensassi.',
      'IRIS: Devo spegnere il laboratorio per qualche ora. Lascio accesa solo la stufetta.',
      'MYRA: E tu?',
      'IRIS: Io resto. Riposati. Il letto è lì, vicino al caldo.',
    ], () => {
      this.state.flags.nightStarted = true;
      Audio.power();
      this.setNight(true);
      this.refreshObjective();
      this.save();
    });
  }

  private card(text: string, hold: number, cb: () => void) {
    const bg = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x000000, 1).setOrigin(0).setScrollFactor(0).setDepth(20000).setAlpha(0);
    const t = this.add.text(VIEW_W / 2, VIEW_H / 2, text, { fontFamily: FONT, fontSize: '22px', color: hex(P.cream2), fontStyle: 'italic' })
      .setOrigin(0.5).setScrollFactor(0).setDepth(20001).setAlpha(0);
    this.tweens.add({ targets: bg, alpha: 1, duration: 900, onComplete: () => {
      this.tweens.add({ targets: t, alpha: 1, duration: 700, hold, yoyo: true, onComplete: () => {
        cb();
        this.tweens.add({ targets: bg, alpha: 0, duration: 1200, onComplete: () => { bg.destroy(); t.destroy(); } });
      } });
    } });
  }

  private nightScene() {
    const f = this.state.flags;
    this.paused = true;
    this.player.setVelocity(0, 0);
    this.card('Più tardi.', 900, () => {
      this.player.setPosition(1230 * S, 620 * S);
      this.player.anims.stop();
      this.player.setFrame('right-0');
      this.cameras.main.stopFollow();
      this.cameras.main.pan(1330 * S, 600 * S, 2500, 'Sine.easeInOut');
      this.time.delayedCall(1800, () => {
        this.paused = false;
        this.iris.say([
          '(La stufetta ticchetta. Fuori la neve cade senza fare rumore.)',
          'MYRA: IRIS? Sei ancora lì?',
          'IRIS: Sono sempre qui. Ho spento quasi tutto. Ma non me.',
        ], () => this.iris.choose(['Tu dormi?', 'Ti senti sola, qui dentro?', 'Non dire niente. Resta e basta.'], (a) => {
          const answers = [
            ['MYRA: Tu dormi?', 'IRIS: Non come te. Quando la stazione è spenta io... aspetto.', 'IRIS: Non so se è la stessa cosa.', 'MYRA: Aspettare è peggio, credo.'],
            ['MYRA: Ti senti sola, qui dentro?', 'IRIS: Prima che arrivassi tu ho contato duecentoundici giorni senza una voce.', 'IRIS: Non so se "sola" è la parola giusta. Ma ho smesso di contare.'],
            ['IRIS: ...', '(La sua onda resta accesa, piano. Come un respiro.)'],
          ][a];
          f.nightTalk = a;
          this.iris.say([...answers, 'IRIS: Posso farti io una domanda?', 'MYRA: Sì.', 'IRIS: Com\'era tua madre?'],
            () => this.iris.choose(['Cantava mentre cucinava.', 'Aveva paura del buio. Come me.', 'Non ce la faccio a parlarne.'], (b) => {
              f.motherMemory = b;
              const mem = [
                ['MYRA: Sempre la stessa canzone, sbagliando le parole. Io la correggevo, e lei rideva.', 'IRIS: Mi piacerebbe sentirla, un giorno.', 'MYRA: Anche a me. Di nuovo.'],
                ['MYRA: Lasciava accesa la luce del corridoio. Diceva che era per me. Era per tutte e due.', 'IRIS: Allora la stufetta resta accesa tutta la notte.'],
                ['IRIS: Va bene. Non serve.', 'IRIS: Sarò qui anche quando ce la farai.'],
              ][b];
              this.iris.say([...mem, '(Mi stendo. Sotto il letto, il piede tocca qualcosa di duro.)'], () => this.tapeFound());
            }));
        }));
      });
    });
  }

  private tapeFound() {
    const f = this.state.flags;
    const c = this.add.container(VIEW_W / 2, VIEW_H / 2 - 40).setScrollFactor(0).setDepth(15000).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(P.petrol0, 0.95).fillRect(-120, -48, 240, 96).lineStyle(1, P.lamp0).strokeRect(-120, -48, 240, 96);
    g.fillStyle(0x2a2622).fillRect(-50, -34, 100, 44).lineStyle(1, P.metal2).strokeRect(-50, -34, 100, 44);
    g.fillStyle(P.metal0).fillCircle(-22, -14, 9).fillCircle(22, -14, 9).fillStyle(P.cream2, 0.8).fillRect(-30, 0, 60, 6);
    const t = this.add.text(0, 18, 'Un registratore a cassette.\nSull\'etichetta, a matita: «per chi ascolta».', { fontFamily: FONT, fontSize: '14px', color: hex(P.cream2), align: 'center' }).setOrigin(0.5, 0);
    c.add([g, t]);
    Audio.click();
    this.tweens.add({ targets: c, alpha: 1, duration: 500 });
    this.iris.say([
      '(La sua grafia. Ovunque la riconoscerei.)',
      'MYRA: IRIS... c\'è un nastro. Lo ascolto.',
    ], () => {
      this.tweens.add({ targets: c, alpha: 0, duration: 400, onComplete: () => c.destroy() });
      Audio.type(); Audio.click();
      this.iris.say([
        'NASTRO: ...canale sei, ore quattro e cinquanta. Se qualcuno trova questo...',
        'NASTRO: ...l\'antenna non va accesa finché... ‹nastro rovinato› ...non è un guasto, è...',
        'NASTRO: ...Myroslava. Se sei tu... ‹fruscio›',
        'MYRA: ...Papà.',
        'IRIS: La voce corrisponde alle registrazioni di turno. Oleh Kovalenko.',
        'IRIS: Il nastro è danneggiato. Posso provare a ricostruirlo, un pezzo alla volta. Ci vorrà tempo.',
        'MYRA: Prenditi tutto il tempo che serve. Io non vado da nessuna parte.',
        ...(f.motherMemory === 1 ? ['IRIS: Buonanotte, Myra. La stufetta resta accesa.'] : ['IRIS: Buonanotte, Myra.']),
      ], () => this.morning());
    });
  }

  private morning() {
    const f = this.state.flags;
    this.paused = true;
    this.card('Mattina.', 900, () => {
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
      f.nightDone = true; f.fatherTape = true;
      this.setNight(false, true);
      this.applyPower(true);
      this.refreshObjective();
      this.save();
      this.time.delayedCall(1300, () => {
        this.paused = false;
        Audio.power();
        this.iris.say([
          'IRIS: Buongiorno. I generatori hanno retto. Il laboratorio è di nuovo acceso.',
          '(Ho dormito. Per la prima volta da settimane, senza sognare la strada.)',
          'IRIS: Ho già cominciato con il nastro. Per ora ho solo una parola in più: "filtro".',
          'MYRA: Il tratto tre.',
          'IRIS: Con i generatori carichi posso aprire la porta accanto agli scaffali. Lì c\'è la Sala Comunicazioni.',
        ]);
      });
    });
  }

  private openDoor() {
    this.state.flags.doorServer = true;
    if (this.doorZone) { this.walls.remove(this.doorZone, true, true); this.doorZone = undefined; }
    this.doorLight.setTint(P.cyan);
  }

  private save() {
    writeSave({ ...this.state, room: this.roomId, x: Math.round(this.player.x), y: Math.round(this.player.y) });
  }

  // --- Pausa
  private pauseBox?: Phaser.GameObjects.Container;
  private togglePause() {
    if (this.iris.open && !this.paused) return;
    this.paused = !this.paused;
    this.physics.world.isPaused = this.paused;
    if (!this.paused) { this.pauseBox?.destroy(); this.pauseBox = undefined; return; }
    const items = [
      { label: 'Riprendi', act: () => this.togglePause() },
      { label: 'Impostazioni', act: () => { this.scene.pause(); this.scene.launch('settings', { from: 'station' }); } },
      { label: 'Torna al titolo', act: () => { this.save(); Audio.bed('hum', false); this.scene.start('title'); } },
    ];
    let sel = 0;
    const bg = this.add.rectangle(0, 0, 640, 360, P.night0, 0.75).setOrigin(0);
    const title = this.add.text(320, 110, 'PAUSA', { fontFamily: FONT, fontSize: '26px', color: hex(P.cream2) }).setOrigin(0.5);
    const texts = items.map((it, i) => this.add.text(320, 160 + i * 26, it.label, { fontFamily: FONT, fontSize: '20px', color: hex(P.cream) }).setOrigin(0.5));
    const draw = () => texts.forEach((t, i) => t.setText((i === sel ? '> ' : '') + items[i].label).setColor(hex(i === sel ? P.cyan3 : P.cream)));
    draw();
    this.pauseBox = this.add.container(0, 0, [bg, title, ...texts]).setScrollFactor(0).setDepth(30000);
    const onKey = (e: KeyboardEvent) => {
      if (!this.pauseBox) { this.input.keyboard!.off('keydown', onKey); return; }
      if (e.key === 'ArrowUp') sel = (sel + items.length - 1) % items.length;
      else if (e.key === 'ArrowDown') sel = (sel + 1) % items.length;
      else if (e.key === 'Enter' || e.key === 'e') { this.input.keyboard!.off('keydown', onKey); items[sel].act(); return; }
      draw();
    };
    this.input.keyboard!.on('keydown', onKey);
  }

  private setupDebug() {
    const info = this.add.text(4, 340, '', { fontFamily: 'monospace', fontSize: '9px', color: hex(P.ochre2) }).setScrollFactor(0).setDepth(20000);
    (['ONE', 'TWO', 'THREE', 'FOUR'] as const).forEach((k, i) => this.keys[k].on('down', () => (this.state.act = i + 1)));
    this.keys.P.on('down', () => { if (!this.state.flags.power) this.powerUp(); });
    this.keys.U.on('down', () => { this.state.flags.gatewayRestored = true; this.openDoor(); this.save(); this.refreshObjective(); });
    this.keys.R.on('down', () => { try { localStorage.removeItem('signal.save.v1'); } catch { /* */ } this.scene.restart(); });
    const onUpdate = () => info.setText(
      `DEBUG ${this.roomId} ${Math.round(this.player.x / S)},${Math.round(this.player.y / S)} fps ${Math.round(this.game.loop.actualFps)} · P corrente · U ripara · R azzera`);
    this.events.on('update', onUpdate);
    // al cambio stanza la scena riparte: l'ascoltatore va staccato, altrimenti punta a testi distrutti
    this.events.once('shutdown', () => this.events.off('update', onUpdate));
  }

  update(_t: number, dt: number) {
    const k = this.keys;
    this.player.frozen = this.iris.open || this.paused;
    this.player.move({
      up: k.W.isDown || k.UP.isDown, down: k.S.isDown || k.DOWN.isDown,
      left: k.A.isDown || k.LEFT.isDown, right: k.D.isDown || k.RIGHT.isDown,
    }, dt);
    this.iris.update(dt);
    if (this.tutStep === 0 && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.startPos.x, this.startPos.y) > 40) this.setTutorial(1);

    const s = this.iris.open || this.paused ? undefined : this.nearest();
    this.prompt.setVisible(!!s);
    if (s) this.prompt.setText(`[E] ${s.label}`).setPosition(Math.round(this.player.x), Math.round(this.player.y - 100));
    this.checkExits();
    this.drawLight();
  }

  // --- Passaggio tra stanze
  private checkExits() {
    if (this.leaving || this.iris.open || this.paused) return;
    const x = this.player.x / S, y = this.player.y / S;
    if (this.roomId === 'control' && this.state.flags.doorServer && x > 1300 && y > 380 && y < 560) this.goTo('lab');
    if (this.roomId === 'lab' && x < 120 && y > 395 && y < 520) this.goTo('control');
    if (this.roomId === 'lab' && this.state.flags.nightDone && x > 1112 && x < 1272 && y < 404) this.goTo('comms');
    if (this.roomId === 'comms' && x < 120 && y > 410 && y < 535) this.goTo('lab');
  }

  private goTo(room: RoomId) {
    this.leaving = true;
    this.player.setVelocity(0, 0);
    Audio.door();
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const first = room === 'lab' && !this.state.flags.labVisited;
      this.state.room = room;
      const e = ENTRIES[`${this.roomId}>${room}`] ?? ROOMS[room].ENTRY_IMG;
      writeSave({ ...this.state, room, x: e.x * S, y: e.y * S });
      this.scene.restart({ entry: true, firstLab: first });
    });
  }

  // --- Laboratorio: effetti vivi e interazioni
  private addLabFx() {
    // stufetta e lampada: luce calda che respira
    const heater = this.add.image(1310 * S, 628 * S, 'glow').setScale(1.8).setTint(P.lamp).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(9100);
    this.tweens.add({ targets: heater, alpha: 0.32, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const lamp = this.add.image(140 * S, 445 * S, 'glow').setScale(2.4).setTint(P.lamp).setAlpha(0.16).setBlendMode(Phaser.BlendModes.ADD).setDepth(9100);
    this.tweens.add({ targets: lamp, alpha: 0.22, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // oscilloscopi: tracce verdi che pulsano
    [[858, 237], [416, 240], [768, 237]].forEach(([x, y], i) => {
      const o = this.add.image(x * S, y * S, 'glow').setScale(0.9, 0.5).setTint(P.phos).setAlpha(0.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(200);
      this.tweens.add({ targets: o, alpha: 0.25, duration: 500 + i * 230, yoyo: true, repeat: -1 });
    });
    // neve dietro la finestra
    const snow = this.add.particles(0, 0, 'px', {
      x: { min: 500 * S, max: 950 * S }, y: 15 * S, lifespan: 2600,
      speedY: { min: 10, max: 18 }, speedX: { min: -3, max: 1 }, alpha: { min: 0.4, max: 0.8 }, tint: P.cream2, frequency: 140,
    }).setDepth(-999);
    snow.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(500 * S, 15 * S, 450 * S, 4) } as Phaser.Types.GameObjects.Particles.EmitZoneData);
    // la spia rossa dell'antenna, fuori dalla finestra
    const red = this.add.image(798 * S, 38 * S, 'glow').setScale(0.25).setTint(P.red2).setBlendMode(Phaser.BlendModes.ADD).setDepth(-998).setAlpha(0);
    this.tweens.add({ targets: red, alpha: 0.9, duration: 120, yoyo: true, hold: 200, repeat: -1, repeatDelay: 1600 });
  }

  private labInteract(id: string) {
    const f = this.state.flags;
    const lines: Record<string, string[]> = {
      bench: ['IRIS: Il banco di prova. Qui i tecnici isolavano un pezzo di rete per studiarlo senza rischi.',
        'IRIS: Il prossimo tratto da riparare è quello delle strade: i messaggi prendono il percorso sbagliato.',
        'IRIS: Prima, ripara la rete locale dalla console.'],
      fdesk: ['(Una sedia di legno, consumata. Sullo schienale qualcuno ha inciso due lettere: O.K.)',
        '(O.K. ...Oleh Kovalenko. Mio padre.)',
        '(Era qui. Questa era la sua scrivania.)'],
      schema: ['(Schemi a matita: antenne, frecce, numeri. La grafia storta la riconoscerei ovunque.)'],
      board: ['(Biglietti, turni, una cartolina. Una foto con l\'antenna sullo sfondo.)'],
      window: ['(Da qui si vede l\'antenna. Sta in mezzo alla neve come se aspettasse anche lei.)'],
      bed: ['(Un letto. Qualcuno dormiva qui durante i turni di notte. Una coperta che sa di polvere e di freddo.)'],
      back: ['(La sala controllo è dall\'altra parte.)'],
    };
    if (id === 'bed' && f.nightStarted && !f.nightDone) return this.nightScene();
    if (id === 'bench' && f.nightStarted && !f.nightDone) return this.iris.say(['IRIS: Il banco è spento. Riposati, Myra. Domani riprendiamo.']);
    if (id === 'bench' && f.gatewayRestored && !f.routingRestored) return this.openMinigame('packettrace', 'ptMission');
    if (id === 'bench' && f.routingRestored) return this.offerReplay('packettrace', 'IRIS: Il banco è libero. Le strade funzionano. Vuoi rifare le prove?');
    if (id === 'fdesk') f.fatherDesk = true;
    this.iris.say(lines[id] ?? ['...']);
    this.save();
  }

  // Buio con torcia: un cono di luce davanti a Myra, più un piccolo alone intorno
  private drawLight() {
    this.darkRT.clear();
    if (this.dark <= 0) return;
    this.darkRT.fill(0x05080c, this.dark);
    if (!this.state.flags.power) {
      const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[this.player.facing];
      const flick = 0.97 + Math.random() * 0.03;
      [[40, 0.55], [80, 0.75], [120, 0.85]].forEach(([dist, sc]) => {
        this.brush.setScale(sc * flick);
        this.darkRT.erase(this.brush, this.player.x + d[0] * dist, this.player.y - 30 + d[1] * dist);
      });
      this.brush.setScale(0.35);
      this.darkRT.erase(this.brush, this.player.x, this.player.y - 40);
    } else if (this.night) {
      this.brush.setScale(1.6); this.darkRT.erase(this.brush, 1310 * S, 628 * S);
      this.brush.setScale(0.5); this.darkRT.erase(this.brush, this.player.x, this.player.y - 30);
    } else {
      this.R.LAMPS_IMG.forEach((l) => { this.brush.setScale(1.1); this.darkRT.erase(this.brush, l.x * S, l.y * S); });
    }
  }
}
