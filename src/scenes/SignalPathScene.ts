import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { P, hex } from '../core/palette';
import { FONT, FONT_TITLE } from '../core/fonts';
import { IrisDialog } from '../iris/IrisDialog';
import { Audio } from '../audio/AudioManager';

// IL PERCORSO DEL SEGNALE: il legame tra l'obiettivo di Myra e i 7 minigiochi.
// Un messaggio parte dalla console e deve arrivare all'antenna, e da lì a sua madre.
// Lungo la strada ci sono 7 tratti interrotti: ognuno si ripara con un minigioco.
// Si apre dopo il risveglio di IRIS, dopo ogni riparazione e con il tasto M.
export const PATH = [
  { name: 'Rete locale', story: 'La console non trova la porta per uscire.', flag: 'gatewayRestored' },
  { name: 'Strade', story: 'I messaggi prendono la strada sbagliata.', flag: 'routingRestored' },
  { name: 'Filtro', story: 'Qualcosa lascia passare chi non dovrebbe.', flag: 'firewallRestored' },
  { name: 'Nomi', story: 'I nomi portano nel posto sbagliato.', flag: 'dnsRestored' },
  { name: 'Archivio', story: 'Cosa è successo quella notte?', flag: 'phishingDone' },
  { name: 'Ricostruzione', story: 'Capire, isolare, ripristinare.', flag: 'incidentDone' },
  { name: 'Prova', story: 'Prima di trasmettere, verificare le difese.', flag: 'redteamDone' },
];

type Mode = 'intro' | 'repaired' | 'view';

export class SignalPathScene extends Phaser.Scene {
  private flags: Record<string, unknown> = {};
  private mode: Mode = 'view';
  private justFixed = -1;
  private iris!: IrisDialog;
  private g!: Phaser.GameObjects.Graphics;
  private pulse!: Phaser.GameObjects.Arc;
  private info!: Phaser.GameObjects.Text;
  private closing = false;

  constructor() { super('signalpath'); }

  init(data: { flags: Record<string, unknown>; mode?: Mode; fixed?: number }) {
    this.flags = data.flags ?? {};
    this.mode = data.mode ?? 'view';
    this.justFixed = data.fixed ?? -1;
    this.closing = false;
  }

  private x(i: number) { return 86 + i * 70; }

  create() {
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05080c, 0.94).setOrigin(0);
    for (let y = 0; y < VIEW_H; y += 2) this.add.rectangle(0, y, VIEW_W, 1, 0x000000, 0.18).setOrigin(0);
    this.add.text(VIEW_W / 2, 22, 'IL PERCORSO DEL SEGNALE', { fontFamily: FONT_TITLE, fontSize: '14px', color: hex(P.cyan3) }).setOrigin(0.5, 0);
    this.add.text(VIEW_W / 2, 44, 'Dalla console all\'antenna. Da qui, a chi ascolta.', { fontFamily: FONT, fontSize: '16px', color: hex(P.cream) }).setOrigin(0.5, 0);
    this.g = this.add.graphics();
    this.info = this.add.text(VIEW_W / 2, 214, '', { fontFamily: FONT, fontSize: '17px', color: hex(P.cream2), align: 'center', wordWrap: { width: VIEW_W - 80 } }).setOrigin(0.5, 0);
    if (this.mode === 'view') this.add.text(VIEW_W / 2, VIEW_H - 18, 'M / Esc  chiudi', { fontFamily: FONT, fontSize: '14px', color: hex(P.metal2) }).setOrigin(0.5);
    this.iris = new IrisDialog(this);
    this.draw(-1);

    // impulso del messaggio che viaggia e si ferma al primo tratto interrotto
    const firstBroken = PATH.findIndex((p) => !this.flags[p.flag]);
    const stopAt = firstBroken < 0 ? PATH.length : firstBroken;
    this.pulse = this.add.circle(30, 130, 4, P.cyan3).setDepth(10);
    this.tweens.add({
      targets: this.pulse, x: stopAt === PATH.length ? VIEW_W - 50 : this.x(stopAt) - 18, duration: 900 + stopAt * 250, repeat: -1, repeatDelay: 600, ease: 'Sine.inOut',
      onRepeat: () => this.pulse.setAlpha(1),
      onUpdate: (tw) => this.pulse.setAlpha(tw.progress > 0.85 ? 1 - (tw.progress - 0.85) * 6 : 1),
    });
    this.info.setText(firstBroken < 0 ? 'Tutti i tratti sono riparati.' : `Prossimo tratto: ${PATH[firstBroken].name.toUpperCase()}\n${PATH[firstBroken].story}`);

    const kb = this.input.keyboard!;
    kb.on('keydown', (e: KeyboardEvent) => {
      if (this.iris.open) { if (['e', 'E', ' ', 'Enter'].includes(e.key)) this.iris.advance(); return; }
      if (this.mode === 'view' && (e.key === 'm' || e.key === 'M' || e.key === 'Escape')) this.close();
    });
    this.cameras.main.fadeIn(400, 0, 0, 0);

    if (this.mode === 'intro') this.time.delayedCall(700, () => this.introTalk());
    if (this.mode === 'repaired') this.time.delayedCall(500, () => this.repairedTalk());
  }

  private draw(highlight: number) {
    const g = this.g.clear();
    const y = 130;
    // console di Myra
    g.fillStyle(P.night).fillRect(14, y - 14, 32, 28).lineStyle(1, P.cyan3).strokeRect(14, y - 14, 32, 28);
    this.label(30, y + 18, 'MYRA', P.lamp2);
    // tratti
    PATH.forEach((p, i) => {
      const x = this.x(i), ok = !!this.flags[p.flag];
      const col = ok ? P.cyan : P.red;
      g.lineStyle(3, col, ok ? 1 : 0.8);
      if (ok) g.lineBetween(x - 34, y, x + 34, y);
      else { g.lineBetween(x - 34, y, x - 8, y); g.lineBetween(x + 8, y, x + 34, y); g.lineStyle(2, P.red2).lineBetween(x - 6, y - 7, x + 6, y + 7); }
      g.fillStyle(ok ? P.cyan1 : P.night0).fillCircle(x, y - 26, 13).lineStyle(2, i === highlight ? P.lamp2 : col).strokeCircle(x, y - 26, 13);
      this.label(x, y - 33, String(i + 1), ok ? P.cream2 : P.red2, 14);
      this.label(x, y + 10, p.name, ok ? P.cyan3 : P.cream, 14);
    });
    // antenna e chi ascolta
    const ax = VIEW_W - 42;
    g.lineStyle(2, P.metal2).lineBetween(ax, y - 4, ax, y + 14).strokeCircle(ax, y - 12, 9);
    this.label(ax, y + 18, 'antenna', P.cream, 13);
    this.label(ax, y - 52, '?', P.lamp2, 18);
  }

  private labels: Phaser.GameObjects.Text[] = [];
  private label(x: number, y: number, t: string, c: number, size = 13) {
    this.labels.push(this.add.text(x, y, t, { fontFamily: FONT, fontSize: `${size}px`, color: hex(c) }).setOrigin(0.5, 0));
  }

  private introTalk() {
    this.iris.say([
      'IRIS: Un messaggio da questa console deve fare molta strada prima di diventare un segnale nel cielo.',
      'IRIS: Ho controllato il percorso. È interrotto in sette punti.',
      'MYRA: Sette...',
      'IRIS: Ogni tratto è un problema diverso. Ognuno si può capire e riparare.',
      'MYRA: Mio padre diceva: un pezzo alla volta.',
      'IRIS: Allora il primo pezzo è qui. La rete locale: la console non trova nemmeno la porta per uscire.',
      'MYRA: E quando saranno riparati tutti?',
      'IRIS: Allora potrai trasmettere. E qualcuno potrà rispondere.',
    ], () => this.close());
  }

  private repairedTalk() {
    const p = PATH[this.justFixed];
    this.draw(this.justFixed);
    Audio.confirm();
    this.cameras.main.flash(300, 63, 167, 181);
    const next = PATH[this.justFixed + 1];
    this.iris.say([
      `IRIS: Tratto ${this.justFixed + 1} riparato: ${p.name.toLowerCase()}.`,
      ...(next ? [`IRIS: Il segnale ora arriva fino al tratto ${this.justFixed + 2}: ${next.name.toLowerCase()}. ${next.story}`] : []),
      `(${PATH.length - this.justFixed - 1} tratti ancora. Mamma, sto arrivando. Un pezzo alla volta.)`,
    ], () => this.close());
  }

  private close() {
    if (this.closing) return;
    this.closing = true;
    Audio.click();
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      this.scene.get('station').events.emit('signalpath-closed', this.mode);
      this.scene.resume('station');
    });
  }

  update(_t: number, dt: number) { this.iris.update(dt); }
}
