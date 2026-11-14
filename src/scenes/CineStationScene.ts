import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { FONT_UI } from '../core/fonts';
import { Audio } from '../audio/AudioManager';

// CINEMATIC «LA STAZIONE» — pixel art, nel motore del gioco.
// Myra e la madre attraversano la stazione affollata durante l'evacuazione; un'esplosione lontana,
// il fischio del treno, la folla le travolge. Rallentatore, primo piano della mano di Myra, la madre sparisce.
// Due camere: "mondo" (carrelli, zoom, rallentatore) e "interfaccia" (bande nere e sottotitoli, mai deformati).
const K = VIEW_H / 768;            // scala dello sfondo (1792×768 → altezza 360)
const WORLD_W = 1792 * K;
const LANE_FRONT = 330, LANE_MID = 292, LANE_FAR = 268;

interface Walker { s: Phaser.GameObjects.Sprite; v: number }

export class CineStationScene extends Phaser.Scene {
  private view = { cx: VIEW_W / 2, cy: VIEW_H / 2, z: 1 };   // centro e ingrandimento della camera del mondo
  private slow = 1;
  private walkers: Walker[] = [];
  private myra!: Phaser.GameObjects.Sprite;
  private mother!: Phaser.GameObjects.Sprite;
  private myraV = 0;
  private motherV = 0;
  private ui!: Phaser.Cameras.Scene2D.Camera;
  private uiObjs: Phaser.GameObjects.GameObject[] = [];
  private caption!: Phaser.GameObjects.Text;
  private closeUp?: Phaser.GameObjects.Container;
  private spawnT = 0;
  private surge = false;
  private ended = false;
  private next?: { reel: string; from: number };
  private fire!: Phaser.GameObjects.Image;

  constructor() { super('cine'); }

  init(data: { next?: { reel: string; from: number } }) { this.next = data?.next; }

  create() {
    this.walkers = []; this.uiObjs = []; this.slow = 1; this.surge = false; this.ended = false; this.closeUp = undefined;
    this.view = { cx: VIEW_W / 2, cy: VIEW_H / 2, z: 1 };
    Audio.unlock();
    Audio.setMusic('theme');

    // --- mondo
    this.add.image(0, 0, 'cine-station_bg').setOrigin(0).setScale(K).setDepth(-100);
    // bagliore degli incendi in città
    this.fire = this.add.image(1250 * K, 255 * K, 'glow').setScale(9, 3).setTint(0xff5a1f).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(-90);
    this.tweens.add({ targets: this.fire, alpha: 0.4, duration: 260, yoyo: true, repeat: -1, repeatDelay: 500, ease: 'Sine.inOut' });
    // lampioni della pensilina che tremolano
    [[527, 88], [522, 208], [518, 283], [515, 322]].forEach(([x, y], i) => {
      const l = this.add.image(x * K, y * K, 'glow').setScale(1.4 - i * 0.25).setTint(0xffb35c).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(-80);
      this.tweens.add({ targets: l, alpha: 0.2, duration: 70, yoyo: true, repeat: -1, repeatDelay: 1500 + i * 700 });
    });
    // vapore del treno
    this.add.particles(0, 0, 'px', {
      x: { min: 1120 * K, max: 1190 * K }, y: 470 * K, lifespan: 2600, speedY: { min: -14, max: -26 }, speedX: { min: -6, max: 8 },
      scale: { start: 3, end: 9 }, alpha: { start: 0.35, end: 0 }, tint: 0xc9d6e8, frequency: 90,
    }).setDepth(-70);
    // folla lontana sul binario (silhouette piccole)
    for (let i = 0; i < 7; i++) this.spawn('far', Phaser.Math.Between(0, WORLD_W));
    for (let i = 0; i < 6; i++) this.spawn('mid', Phaser.Math.Between(-40, WORLD_W));

    // Myra e la madre, mano nella mano
    this.myra = this.add.sprite(-60, LANE_FRONT - 4, 'player', 'right-0').setOrigin(0.5, 0.96).setScale(0.31).setDepth(LANE_FRONT);
    this.myra.play('walk-right');
    this.mother = this.add.sprite(-34, LANE_FRONT - 8, 'mother', 'right-0').setOrigin(0.5, 0.96).setScale(0.27).setDepth(LANE_FRONT - 1);
    this.mother.play('mother-walk-right');
    this.myraV = 30; this.motherV = 30;

    // neve in due strati
    const snow = (depth: number, speed: number, scale: number, freq: number) => this.add.particles(0, 0, 'px', {
      x: { min: -20, max: WORLD_W + 20 }, y: -10, lifespan: 9000, speedY: { min: speed, max: speed * 1.6 }, speedX: { min: -8, max: 4 },
      scale, alpha: { min: 0.5, max: 0.9 }, tint: 0xe8eefc, frequency: freq,
    }).setDepth(depth);
    snow(-60, 14, 1, 45); snow(400, 34, 2, 120);

    // --- interfaccia: bande nere, sottotitoli, "Esc salta"
    const top = this.add.rectangle(0, 0, VIEW_W, 34, 0x000000).setOrigin(0).setDepth(1000);
    const bot = this.add.rectangle(0, VIEW_H - 46, VIEW_W, 46, 0x000000).setOrigin(0).setDepth(1000);
    this.caption = this.add.text(VIEW_W / 2, VIEW_H - 40, '', { fontFamily: FONT_UI, fontSize: '11px', color: '#f1ead8', align: 'center', wordWrap: { width: VIEW_W - 80 } }).setOrigin(0.5, 0).setDepth(1001).setAlpha(0);
    const skip = this.add.text(VIEW_W - 10, 12, 'Esc  salta', { fontFamily: FONT_UI, fontSize: '8px', color: '#7f8a96' }).setOrigin(1, 0).setDepth(1001);
    this.uiObjs = [top, bot, this.caption, skip];
    this.ui = this.cameras.add(0, 0, VIEW_W * 2, VIEW_H * 2).setOrigin(0, 0).setZoom(2);
    this.ui.ignore(this.children.list.filter((o) => !this.uiObjs.includes(o)));
    this.cameras.main.ignore(this.uiObjs);
    this.events.on('addedtoscene', (o: Phaser.GameObjects.GameObject) => { if (!this.uiObjs.includes(o)) this.ui.ignore(o); });

    this.input.keyboard!.on('keydown-ESC', () => this.finish());
    this.cameras.main.fadeIn(1600, 0, 0, 0);
    this.ui.fadeIn(1600, 0, 0, 0);
    Audio.crowd(true, 0.7);
    this.script();
  }

  // --- personaggi della folla: tre corsie di profondità
  private spawn(lane: 'far' | 'mid' | 'front', x: number, fast = false) {
    const c = Phaser.Math.Between(0, 3);
    const cfg = { far: { y: LANE_FAR, sc: 0.11, v: 18, tint: 0x5a6a8a }, mid: { y: LANE_MID, sc: 0.19, v: 26, tint: 0xa8b4c8 }, front: { y: VIEW_H + 22, sc: 0.42, v: 95, tint: 0x0b1018 } }[lane];
    const s = this.add.sprite(x, cfg.y + Phaser.Math.Between(-3, 3), 'crowd', `p${c}-0`).setOrigin(0.5, 0.96).setScale(cfg.sc * Phaser.Math.FloatBetween(0.92, 1.08)).setTint(cfg.tint).setDepth(lane === 'front' ? 500 : cfg.y);
    s.play({ key: `crowd-walk-${c}`, startFrame: Phaser.Math.Between(0, 1) });
    if (lane === 'front') s.setAlpha(0.92);
    const w = { s, v: cfg.v * Phaser.Math.FloatBetween(0.85, 1.2) * (fast ? 2.2 : 1) };
    this.walkers.push(w);
    return w;
  }

  private say(text: string, hold = 3200) {
    this.tweens.killTweensOf(this.caption);
    this.caption.setText(text).setAlpha(0);
    this.tweens.add({ targets: this.caption, alpha: 1, duration: 600, hold, yoyo: true });
  }

  private at(sec: number, fn: () => void) { this.time.delayedCall(sec * 1000, () => { if (!this.ended) fn(); }); }

  private camTo(cx: number, cy: number, z: number, ms: number, ease = 'Sine.inOut') {
    this.tweens.add({ targets: this.view, cx, cy, z, duration: ms, ease });
  }

  // --- la regia
  private script() {
    this.camTo(380, VIEW_H / 2, 1.05, 9000);
    this.at(0.8, () => Audio.siren(9));
    this.at(1.2, () => this.say('Il giorno dell\'evacuazione, la stazione era un mare di persone.'));
    this.at(5.2, () => this.say('Mia madre mi teneva per mano. Dovevamo solo salire su quel treno.'));
    // esplosione lontana: lampo, tremore, la folla si muove di colpo
    this.at(8.6, () => {
      Audio.rumble();
      this.cameras.main.flash(260, 255, 140, 60);
      this.cameras.main.shake(700, 0.008);
      this.fire.setAlpha(0.8).setScale(12, 4);
      this.surge = true;
      Audio.crowd(true, 1.4);
      this.walkers.forEach((w) => { w.v *= 1.9; });
    });
    this.at(9.2, () => Audio.whistle());
    // la folla le separa: la madre viene trascinata avanti
    this.at(9.6, () => {
      this.motherV = 85; this.myraV = 12;
      for (let i = 0; i < 5; i++) this.time.delayedCall(i * 160, () => this.spawn('front', this.view.cx - 380 + i * 30, true));
    });
    // rallentatore
    this.at(10.4, () => {
      this.slow = 0.25;
      this.tweens.timeScale = 0.6;
      this.anims.globalTimeScale = 0.3;
      Audio.crowd(true, 0.35);
      Audio.heartbeat(6, 1.0);
      this.camTo(this.myra.x + 40, this.myra.y - 40, 1.9, 1800);
      this.say('Le ho lasciato la mano per un secondo.', 2600);
    });
    this.at(13.4, () => this.showCloseUp());
    this.at(18.6, () => this.hideCloseUp());
    this.at(19.2, () => {
      this.slow = 1; this.tweens.timeScale = 1; this.anims.globalTimeScale = 1;
      this.mother.destroy();
      this.myraV = 0; this.myra.stop().setFrame('right-0');
      Audio.crowd(true, 0.5);
      this.camTo(this.myra.x + 60, VIEW_H / 2 + 10, 1.25, 2400);
      this.say('Quando mi sono girata, non c\'era più.', 3600);
    });
    this.at(22.5, () => { this.myra.setFrame('left-0'); });
    this.at(25.5, () => this.finish());
  }

  // primo piano: la mano di Myra tesa verso la folla che scorre
  private showCloseUp() {
    this.cameras.main.flash(120, 255, 255, 255);
    const c = this.add.container(0, 0).setDepth(800);
    const bg = this.add.rectangle(0, 0, WORLD_W * 2, VIEW_H * 2, 0x05070c).setOrigin(0);
    const strip = this.add.image(0, 70, 'crowdstrip').setOrigin(0, 0).setScale(0.36).setTint(0x8796b4);
    const strip2 = this.add.image(-200, 120, 'crowdstrip').setOrigin(0, 0).setScale(0.5).setTint(0x2a3346).setFlipX(true);
    const reach = this.add.image(-40, 30, 'myrareach').setOrigin(0, 0).setScale(0.42);
    const glow = this.add.image(380, 160, 'glow').setScale(8, 4).setTint(0xff8a3c).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
    c.add([bg, strip, glow, strip2, reach]);
    // la camera del mondo guarda il primo piano, fissa
    this.tweens.killTweensOf(this.view);
    this.view = { cx: VIEW_W / 2, cy: VIEW_H / 2, z: 1 };
    c.setPosition(this.cameras.main.scrollX, this.cameras.main.scrollY);
    this.closeUp = c;
    this.tweens.add({ targets: strip, x: -260, duration: 9000 });
    this.tweens.add({ targets: strip2, x: 120, duration: 9000 });
    this.tweens.add({ targets: reach, x: -20, y: 22, scale: 0.44, duration: 6000, ease: 'Sine.out' });
    this.say('Un secondo solo.', 3000);
  }

  private hideCloseUp() {
    this.cameras.main.flash(160, 0, 0, 0);
    this.closeUp?.destroy(); this.closeUp = undefined;
    this.view = { cx: this.myra.x + 40, cy: this.myra.y - 40, z: 1.9 };
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    this.tweens.timeScale = 1; this.anims.globalTimeScale = 1;
    Audio.crowd(false);
    this.cameras.main.fadeOut(1400, 0, 0, 0);
    this.ui.fadeOut(1400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      if (this.next) this.scene.start('intro', this.next);
      else this.scene.start('title');
    });
  }

  update(_t: number, dtMs: number) {
    const dt = (dtMs / 1000) * this.slow;
    // personaggi
    this.myra.x += this.myraV * dt;
    if (this.mother.active) this.mother.x += this.motherV * dt;
    for (const w of this.walkers) w.s.x += w.v * dt;
    this.walkers = this.walkers.filter((w) => { if (w.s.x > WORLD_W + 60) { w.s.destroy(); return false; } return true; });
    // nuova folla da sinistra
    this.spawnT -= dt;
    if (this.spawnT <= 0 && !this.closeUp) {
      this.spawnT = this.surge ? 0.35 : 1.1;
      const lane = Math.random() < 0.55 ? 'mid' : Math.random() < 0.7 ? 'far' : 'front';
      this.spawn(lane, this.cameras.main.scrollX - 40, this.surge && lane === 'front');
    }
    // camera del mondo: centro + zoom (origine in alto a sinistra, zoom di base 2)
    if (!this.closeUp) {
      const cam = this.cameras.main, z = 2 * this.view.z;
      cam.setZoom(z);
      const vw = (VIEW_W * 2) / z, vh = (VIEW_H * 2) / z;
      cam.setScroll(Phaser.Math.Clamp(this.view.cx - vw / 2, 0, WORLD_W - vw), Phaser.Math.Clamp(this.view.cy - vh / 2, 0, VIEW_H - vh));
    } else {
      this.cameras.main.setZoom(2);
    }
  }
}
