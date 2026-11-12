import Phaser from 'phaser';
import { makePlaceholders } from '../fx/placeholders';
import { makeEnvironment } from '../fx/environment';
import { createPlayerAnims } from '../actors/Player';
import { loadFonts } from '../core/fonts';
import { writeSave } from '../core/save';

// Carica gli asset generati e prepara la protagonista: sfondo magenta reso trasparente, frame ritagliati.
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    this.load.image('room-control', 'assets/rooms/control_room.png');
    this.load.image('room-lab', 'assets/rooms/lab.png');
    this.load.image('room-comms', 'assets/rooms/comms.png');
    this.load.image('player-raw', 'assets/sprites/player_sheet.png');
    this.load.image('keyart', 'assets/story/keyart.png');
    ['c1_radio', 'c2_phone', 'c3_map', 'c2_dish', 'c5_journey', 'c4_refuge', 'c6_inside'].forEach((k) => this.load.image(k, `assets/story/${k}.png`));
    // barra di caricamento
    const bar = this.add.rectangle(220, 180, 0, 4, 0x3fa7b5).setOrigin(0, 0.5);
    this.load.on('progress', (v: number) => bar.setSize(200 * v, 4));
  }

  create() {
    makePlaceholders(this); // luce e texture di servizio
    makeEnvironment(this);
    this.keyPlayer();
    createPlayerAnims(this);
    // lo sfondo è dipinto ad alta risoluzione e mostrato a metà: filtro lineare per ridurlo pulito
    ['room-control', 'room-lab', 'room-comms', 'keyart', 'c1_radio', 'c2_phone', 'c3_map', 'c2_dish', 'c5_journey', 'c4_refuge', 'c6_inside'].forEach((k) => this.textures.get(k).setFilter(Phaser.Textures.FilterMode.LINEAR));
    loadFonts().then(() => {
      const q = new URLSearchParams(location.search);
      // Scorciatoia di sviluppo: ?nd=1|2|3 apre Network Defender alla missione indicata
      if (import.meta.env.DEV && q.has('pt')) {
      const m = Phaser.Math.Clamp(Number(q.get('pt')) || 1, 1, 3) - 1;
      writeSave({ act: 1, flags: { power: true, irisAwake: true, tutorialDone: true, gatewayRestored: true, doorServer: true, ptMission: m }, room: 'lab', x: 350, y: 240 });
      const mgr = this.game.scene;
      this.scene.start('station');
      setTimeout(() => { mgr.pause('station'); mgr.start('packettrace', { mission: m }); }, 600);
      return;
    }
    if (import.meta.env.DEV && q.has('nd')) {
        const m = Phaser.Math.Clamp(Number(q.get('nd')) || 1, 1, 3) - 1;
        writeSave({ act: 1, flags: { power: true, irisAwake: true, tutorialDone: true, ndMission: m }, room: 'control', x: 365, y: 215 });
        const mgr = this.game.scene;
        this.scene.start('station');
        // la scena di boot si ferma: il passaggio al minigioco si fa con un timer del browser
        setTimeout(() => { mgr.pause('station'); mgr.start('netdefender', { mission: m }); }, 600);
        return;
      }
      this.scene.start(q.has('skip') ? 'station' : 'title');
    });
  }

  private keyPlayer() {
    const src = this.textures.get('player-raw').getSourceImage() as HTMLImageElement;
    const tex = this.textures.createCanvas('player', src.width, src.height)!;
    const ctx = tex.getContext();
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, src.width, src.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // magenta e i suoi bordi sfumati diventano trasparenti
      if (r > 140 && b > 140 && g < 110 && Math.abs(r - b) < 90) d[i + 3] = 0;
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    // griglia 4×2: colonne giù, sinistra, destra, su; riga 0 fermo, riga 1 passo
    tex.add('face', 0, 160, 95, 130, 120); // ritratto per i dialoghi
    const dirs = ['down', 'left', 'right', 'up'];
    dirs.forEach((dir, c) => {
      tex.add(`${dir}-0`, 0, c * 384, 38, 384, 352);
      tex.add(`${dir}-1`, 0, c * 384, 418, 384, 352);
    });
  }
}
