import Phaser from 'phaser';
import { VIEW_W, VIEW_H, DEBUG } from './core/config';
import { P } from './core/palette';
import { BootScene } from './scenes/BootScene';
import { StationScene } from './scenes/StationScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { SettingsScene } from './scenes/SettingsScene';
import { NetDefenderScene } from './minigames/netdefender/NetDefenderScene';
import { SignalPathScene } from './scenes/SignalPathScene';

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
  scene: [BootScene, TitleScene, IntroScene, StationScene, SettingsScene, NetDefenderScene, SignalPathScene],
});

if (DEBUG) (window as unknown as { signal: Phaser.Game }).signal = game;
