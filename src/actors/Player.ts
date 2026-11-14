import Phaser from 'phaser';

// Protagonista: foglio generato (public/assets/sprites/player_sheet.png) già ritagliato in BootScene.
// Frame per direzione: "<dir>-0" in piedi, "<dir>-1" passo.
export type Dir = 'down' | 'left' | 'right' | 'up';
export const PLAYER_SCALE = 0.23;
const SPEED = 110; // px/s nel mondo

export function createPlayerAnims(scene: Phaser.Scene) {
  (['down', 'left', 'right', 'up'] as Dir[]).forEach((d) => {
    scene.anims.create({ key: `idle-${d}`, frames: [{ key: 'player', frame: `${d}-0` }], frameRate: 1 });
    scene.anims.create({
      key: `walk-${d}`,
      frames: [{ key: 'player', frame: `${d}-1` }, { key: 'player', frame: `${d}-0` }],
      frameRate: 6, repeat: -1,
    });
  });
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  facing: Dir = 'down';
  frozen = false;
  private t = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player', 'down-0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 0.98).setScale(PLAYER_SCALE);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(120, 44).setOffset(132, 372); // collisione solo ai piedi (pixel del frame)
    this.play('idle-down');
  }

  move(keys: { up: boolean; down: boolean; left: boolean; right: boolean }, dt: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    let vx = 0, vy = 0;
    if (!this.frozen) {
      vx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      vy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    }
    const v = new Phaser.Math.Vector2(vx, vy).normalize().scale(SPEED);
    body.setVelocity(v.x, v.y);

    if (vx || vy) {
      this.facing = vx < 0 ? 'left' : vx > 0 ? 'right' : vy < 0 ? 'up' : 'down';
      this.play(`walk-${this.facing}`, true);
      this.t += dt;
      this.setScale(PLAYER_SCALE, PLAYER_SCALE * (1 + Math.abs(Math.sin(this.t / 85)) * 0.015)); // leggero rimbalzo del passo
    } else {
      this.play(`idle-${this.facing}`, true);
      this.t += dt;
      this.setScale(PLAYER_SCALE, PLAYER_SCALE * (1 + Math.sin(this.t / 600) * 0.006)); // respiro
    }
    this.setDepth(this.y);
  }

  probe(dist = 26) {
    const d = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[this.facing];
    return new Phaser.Math.Vector2(this.x + d[0] * dist, this.y - 8 + d[1] * dist);
  }
}
