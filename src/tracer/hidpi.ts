import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';

// Le schermate del simulatore sono piene di testo: le disegniamo a doppia risoluzione (1280×720)
// mantenendo le coordinate a 640×360 (camera con zoom 2). All'uscita il gioco torna a 640×360 (pixel art).
export function hiDpi(scene: Phaser.Scene) {
  scene.scale.setGameSize(VIEW_W * 2, VIEW_H * 2);
  scene.cameras.main.setOrigin(0, 0).setZoom(2);
  scene.events.once('shutdown', () => scene.scale.setGameSize(VIEW_W, VIEW_H));
}
