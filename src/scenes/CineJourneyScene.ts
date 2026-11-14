import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { FONT_UI } from '../core/fonts';
import { Audio } from '../audio/AudioManager';

// CINEMATIC «IL CAMMINO» — pixel art, nel motore del gioco.
// 1) il viaggio: Myra cammina sulla strada innevata, parallasse (montagne lente, strada veloce), il tramonto diventa notte,
//    si ferma a controllare il telefono: nessun servizio.  2) l'arrivo: tormenta, la torcia, l'antenna gigante, la porta.
const K = VIEW_H / 768;
const W = 1792 * K;            // larghezza di un pannello alla scala dello schermo
const ROAD_Y = 300;            // piedi di Myra sulla strada (viaggio)

export class CineJourneyScene extends Phaser.Scene {
  private part: 'road' | 'arrival' = 'road';
  private far!: Phaser.GameObjects.TileSprite;
  private road!: Phaser.GameObjects.TileSprite;
  private night!: Phaser.GameObjects.Rectangle;
  private myra!: Phaser.GameObjects.Sprite;
  private torch?: Phaser.GameObjects.Image;
  private phone?: Phaser.GameObjects.Image;
  private walking = true;
  private speed = 34;            // velocità di scorrimento della strada (px/s)
  private ui!: Phaser.Cameras.Scene2D.Camera;
  private uiObjs: Phaser.GameObjects.GameObject[] = [];
  private caption!: Phaser.GameObjects.Text;
  private ended = false;
  private next?: { reel: string; from: number };
  private view = { cx: VIEW_W / 2, cy: VIEW_H / 2, z: 1 };
  private worldW = VIEW_W;

  constructor() { super('cinejourney'); }

  init(data: { next?: { reel: string; from: number } }) { this.next = data?.next; }

  create() {
    this.ended = false; this.part = 'road'; this.walking = true; this.speed = 34; this.uiObjs = [];
    this.view = { cx: VIEW_W / 2, cy: VIEW_H / 2, z: 1 }; this.worldW = VIEW_W;
    Audio.unlock();
    Audio.setMusic('theme');
    Audio.bed('wind', true, 0.8);

    // --- interfaccia (camera separata): bande nere e sottotitoli
    const top = this.add.rectangle(0, 0, VIEW_W, 34, 0x000000).setOrigin(0).setDepth(1000);
    const bot = this.add.rectangle(0, VIEW_H - 46, VIEW_W, 46, 0x000000).setOrigin(0).setDepth(1000);
    this.caption = this.add.text(VIEW_W / 2, VIEW_H - 40, '', { fontFamily: FONT_UI, fontSize: '11px', color: '#f1ead8', align: 'center', wordWrap: { width: VIEW_W - 80 } }).setOrigin(0.5, 0).setDepth(1001).setAlpha(0);
    const skip = this.add.text(VIEW_W - 10, 12, 'Esc  salta', { fontFamily: FONT_UI, fontSize: '8px', color: '#7f8a96' }).setOrigin(1, 0).setDepth(1001);
    this.uiObjs = [top, bot, this.caption, skip];
    this.ui = this.cameras.add(0, 0, VIEW_W * 2, VIEW_H * 2).setOrigin(0, 0).setZoom(2);
    this.cameras.main.ignore(this.uiObjs);
    this.events.on('addedtoscene', (o: Phaser.GameObjects.GameObject) => { if (!this.uiObjs.includes(o)) this.ui.ignore(o); });

    this.buildRoad();
    this.input.keyboard!.on('keydown-ESC', () => this.finish());
    this.cameras.main.fadeIn(1500, 0, 0, 0);
    this.ui.fadeIn(1500, 0, 0, 0);
    this.script();
  }

  // ===== parte 1: la strada
  private buildRoad() {
    // i pannelli si ripetono: TileSprite con la scala dello schermo
    this.far = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'cine-journey_far').setOrigin(0).setTileScale(K).setDepth(-100);
    this.road = this.add.tileSprite(0, 0, VIEW_W, VIEW_H, 'journeyroad').setOrigin(0).setTileScale(K).setDepth(200);
    this.night = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0a1030, 0).setOrigin(0).setDepth(300).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.myra = this.add.sprite(VIEW_W * 0.42, ROAD_Y, 'player', 'right-0').setOrigin(0.5, 0.96).setScale(0.24).setDepth(250);
    this.myra.play('walk-right');
    this.snow(-50, 10, 1, 60); this.snow(280, 26, 2, 160);
    this.ui.ignore(this.children.list.filter((o) => !this.uiObjs.includes(o)));
  }

  private snow(depth: number, speed: number, scale: number, freq: number, wind = -6) {
    return this.add.particles(0, 0, 'px', {
      x: { min: -40, max: this.worldW + 40 }, y: -10, lifespan: 12000, speedY: { min: speed, max: speed * 1.6 }, speedX: { min: wind - 8, max: wind + 4 },
      scale, alpha: { min: 0.5, max: 0.9 }, tint: 0xe8eefc, frequency: freq,
    }).setDepth(depth);
  }

  // ===== parte 2: l'arrivo
  private buildArrival() {
    this.part = 'arrival';
    this.children.list.filter((o) => !this.uiObjs.includes(o)).forEach((o) => o.destroy());
    this.worldW = W;
    this.add.image(0, 0, 'cine-arrival_bg').setOrigin(0).setScale(K).setDepth(-100);
    // luce rossa dell'antenna
    const red = this.add.image(1338 * K, 44 * K, 'glow').setScale(0.8).setTint(0xff2020).setBlendMode(Phaser.BlendModes.ADD).setDepth(-50).setAlpha(0);
    this.tweens.add({ targets: red, alpha: 1, duration: 140, yoyo: true, hold: 260, repeat: -1, repeatDelay: 1400 });
    this.myra = this.add.sprite(20, 282, 'player', 'right-0').setOrigin(0.5, 0.96).setScale(0.17).setDepth(250);
    this.myra.play('walk-right');
    // la torcia: un cono di luce calda davanti a lei
    this.torch = this.add.image(this.myra.x + 30, this.myra.y - 8, 'glow').setScale(2.4, 0.9).setTint(0xffd79a).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(240);
    this.snow(-40, 22, 1, 30, -18); this.snow(280, 46, 2, 70, -26);
    this.ui.ignore(this.children.list.filter((o) => !this.uiObjs.includes(o)));
    this.view = { cx: VIEW_W / 2, cy: VIEW_H / 2, z: 1 };
    Audio.bed('wind', true, 1.4);
  }

  private say(text: string, hold = 3400) {
    this.tweens.killTweensOf(this.caption);
    this.caption.setText(text).setAlpha(0);
    this.tweens.add({ targets: this.caption, alpha: 1, duration: 600, hold, yoyo: true });
  }

  private at(sec: number, fn: () => void) { this.time.delayedCall(sec * 1000, () => { if (!this.ended) fn(); }); }

  private script() {
    // il tramonto diventa notte
    this.tweens.add({ targets: this.night, fillAlpha: 0.55, duration: 16000, ease: 'Sine.in' });
    this.at(1.2, () => this.say('Tre giorni di cammino. Sirene lontane, fili della corrente a terra, nessuna voce.', 4200));
    this.at(4, () => Audio.siren(5));
    // si ferma, accende il telefono
    this.at(7.5, () => {
      this.walking = false;
      this.myra.stop().setFrame('down-0');
      this.phone = this.add.image(this.myra.x + 4, this.myra.y - 38, 'glow').setScale(0.45).setTint(0x7fd8ff).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(260);
      this.ui.ignore(this.phone);
      this.tweens.add({ targets: this.phone, alpha: 0.9, duration: 300 });
      this.say('Ogni sera accendevo il telefono. Nessun servizio. Ogni sera.', 3600);
    });
    this.at(11.6, () => {
      this.tweens.add({ targets: this.phone, alpha: 0, duration: 300 });
      this.walking = true;
      this.myra.play('walk-right');
    });
    this.at(14.5, () => { this.cameras.main.fadeOut(1000, 0, 0, 0); });
    this.at(15.6, () => { this.buildArrival(); this.cameras.main.fadeIn(1200, 0, 0, 0); });
    this.at(16.4, () => this.say('Non so niente di reti. Non so da dove si comincia.', 3400));
    this.at(21, () => this.say('So solo che non posso restare ferma ad aspettare.', 3400));
    // arriva alla porta: si ferma, la camera stringe su porta e antenna
    this.at(27.5, () => {
      this.walking = false;
      this.myra.stop().setFrame('right-0');
      this.tweens.add({ targets: this.view, cx: 600, cy: 170, z: 1.35, duration: 4000, ease: 'Sine.inOut' });
      this.say('E nel buio, qualcosa teneva la stazione in silenzio.', 3800);
    });
    this.at(33, () => this.finish());
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    Audio.bed('wind', false);
    this.cameras.main.fadeOut(1400, 0, 0, 0);
    this.ui.fadeOut(1400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.next) this.scene.start('intro', this.next);
      else this.scene.start('title');
    });
  }

  update(_t: number, dtMs: number) {
    const dt = dtMs / 1000;
    const cam = this.cameras.main;
    if (this.part === 'road') {
      if (this.walking) {
        this.far.tilePositionX += (this.speed * 0.12) * dt / K;
        this.road.tilePositionX += this.speed * dt / K;
        this.myra.y = ROAD_Y - Math.abs(Math.sin(this.time.now / 1000 * 6)) * 1.4;
      }
      cam.setZoom(2).setScroll(0, 0);
      return;
    }
    // arrivo: Myra avanza verso la porta, la camera la segue
    if (this.walking && this.myra.x < 548) {
      this.myra.x += 48 * dt;
      this.myra.y = 282 - (this.myra.x / 548) * 8 - Math.abs(Math.sin(this.time.now / 1000 * 6)) * 1.1;
      this.view.cx = Phaser.Math.Clamp(this.myra.x + 110, VIEW_W / 2, W - VIEW_W / 2);
    }
    if (this.torch) this.torch.setPosition(this.myra.x + 30, this.myra.y - 8).setAlpha(0.3 + Math.random() * 0.05);
    const z = 2 * this.view.z, vw = (VIEW_W * 2) / z, vh = (VIEW_H * 2) / z;
    cam.setZoom(z).setScroll(Phaser.Math.Clamp(this.view.cx - vw / 2, 0, W - vw), Phaser.Math.Clamp(this.view.cy - vh / 2, 0, VIEW_H - vh));
  }
}
