import Phaser from 'phaser';
import { VIEW_W, VIEW_H, DEBUG } from './core/config';
import { P } from './core/palette';
import { BootScene } from './scenes/BootScene';
import { StationScene } from './scenes/StationScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { SettingsScene } from './scenes/SettingsScene';
import { NetDefenderScene } from './minigames/netdefender/NetDefenderScene';
import { TracerScene } from './tracer/TracerScene';
import { SprintScene } from './tracer/SprintScene';
import { TracerHubScene } from './tracer/TracerHubScene';
import { FirewallScene } from './minigames/firewall/FirewallScene';
import { PacketTraceScene } from './minigames/packettrace/PacketTraceScene';
import { SignalPathScene } from './scenes/SignalPathScene';

// Testi disegnati a risoluzione più alta del gioco (640×360): senza questo, ingranditi,
// alcune lettere del font pixel si confondono (la M sembrava una N).
const textFactory = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
  text: (x: number, y: number, t: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
};
const baseText = textFactory.text;
// Font unico in tutto il gioco: Inter (leggibile). I vecchi font pixel vengono sostituiti qui,
// con la dimensione riproporzionata, così nessuna schermata va riscritta.
const SWAP: [RegExp, string, number, string?][] = [
  [/VT323/, 'Inter, "Helvetica Neue", Arial, sans-serif', 0.74],
  [/Silkscreen/, 'Inter, "Helvetica Neue", Arial, sans-serif', 1.05, '700'],
];
function soften(style: Phaser.Types.GameObjects.Text.TextStyle = {}) {
  const fam = String(style.fontFamily ?? 'VT323');
  const rule = SWAP.find(([re]) => re.test(fam));
  if (!rule) return style;
  const size = parseFloat(String(style.fontSize ?? '16'));
  return { ...style, fontFamily: rule[1], fontSize: `${Math.round(size * rule[2] * 10) / 10}px`, ...(rule[3] ? { fontStyle: rule[3] } : {}) };
}
textFactory.text = function (this: unknown, x, y, t, style) {
  const txt = baseText.call(this, x, y, t, { resolution: 3, ...soften(style ?? {}) });
  txt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR); // testo morbido, immagini pixel art nette
  return txt;
};

// Doppia risoluzione: il gioco resta progettato a 640×360, ma la tela è 1280×720 e ogni camera
// ha zoom 2 con origine in alto a sinistra. Pixel art nitida (ingrandita a pixel pieni) e testi leggibili.
const CamMgr = Phaser.Cameras.Scene2D.CameraManager.prototype as unknown as { boot: () => void; main: Phaser.Cameras.Scene2D.Camera };
const camBoot = CamMgr.boot;
CamMgr.boot = function (this: typeof CamMgr) { camBoot.call(this); this.main.setOrigin(0, 0).setZoom(2); };

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W * 2,
  height: VIEW_H * 2,
  backgroundColor: P.petrol0,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: DEBUG } },
  scene: [BootScene, TitleScene, IntroScene, StationScene, SettingsScene, NetDefenderScene, SignalPathScene, PacketTraceScene, FirewallScene, TracerHubScene, TracerScene, SprintScene],
});

if (DEBUG) (window as unknown as { signal: Phaser.Game }).signal = game;

// solo in sviluppo: accesso al gioco dalla console del browser (test e scorciatoie)
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
