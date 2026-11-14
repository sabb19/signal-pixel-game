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
textFactory.text = function (this: unknown, x, y, t, style) {
  const txt = baseText.call(this, x, y, t, { resolution: 3, ...(style ?? {}) });
  // i font "da app" (simulatore IRIS) restano morbidi anche con il gioco in pixel art
  if (!/VT323|Silkscreen/.test(String(style?.fontFamily ?? 'VT323'))) txt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return txt;
};

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: P.petrol0,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: DEBUG } },
  scene: [BootScene, TitleScene, IntroScene, StationScene, SettingsScene, NetDefenderScene, SignalPathScene, PacketTraceScene, FirewallScene, TracerHubScene, TracerScene],
});

if (DEBUG) (window as unknown as { signal: Phaser.Game }).signal = game;

// solo in sviluppo: accesso al gioco dalla console del browser (test e scorciatoie)
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;
