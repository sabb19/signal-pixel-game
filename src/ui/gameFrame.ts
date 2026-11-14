import Phaser from 'phaser';
import { VIEW_W, VIEW_H } from '../core/config';
import { FONT_UI } from '../core/fonts';

// Cornice comune dei minigiochi, nello stile di IRIS Tracer:
// fondo notte con griglia, barra in alto (onda di IRIS · missione · titolo · tasti), pannelli luminosi.
export const UI = {
  bg: 0x070d13, grid: 0x10202e, bar: 0x060c12, panel: 0x0f1a24, line: 0x2c5a72,
  cyan: 0x3fc7e0, cyanT: '#5fd8ee', gold: 0xf2c14e, goldT: '#f6cf6a', text: '#e6f1f7', dim: '#8aa4b8',
  ok: 0x3ee07a, bad: 0xff4d5e, amber: 0xf0b040,
};

export interface Frame { setTitle: (kicker: string, title: string) => void; tick: (attack?: boolean) => void }

export function gameFrame(scene: Phaser.Scene, keys: [string, string][] = [['H', 'AIUTO'], ['ESC', 'ESCI']]): Frame {
  const g = scene.add.graphics();
  g.fillStyle(UI.bg).fillRect(0, 0, VIEW_W, VIEW_H);
  g.lineStyle(1, UI.grid);
  for (let x = 0; x < VIEW_W; x += 16) g.lineBetween(x, 0, x, VIEW_H);
  for (let y = 0; y < VIEW_H; y += 16) g.lineBetween(0, y, VIEW_W, y);
  g.fillStyle(UI.bar).fillRect(0, 0, VIEW_W, 30).lineStyle(1, UI.line).lineBetween(0, 30, VIEW_W, 30);
  g.fillStyle(0x0b1520).fillRoundedRect(4, 3, 30, 24, 3).lineStyle(1, UI.cyan, 0.8).strokeRoundedRect(4.5, 3.5, 30, 24, 3);
  const kicker = scene.add.text(40, 4, '', { fontFamily: FONT_UI, fontStyle: '700', fontSize: '8.5px', color: UI.goldT });
  const title = scene.add.text(40, 15, '', { fontFamily: FONT_UI, fontStyle: '700', fontSize: '10px', color: UI.text });
  // tasti in alto a destra
  let x = VIEW_W - 8;
  [...keys].reverse().forEach(([k, label]) => {
    const lt = scene.add.text(x, 10, label, { fontFamily: FONT_UI, fontStyle: '700', fontSize: '8.5px', color: UI.text }).setOrigin(1, 0);
    x -= lt.width + 4;
    const kw = Math.max(16, k.length * 7 + 6);
    g.fillStyle(0x1d3448).fillRoundedRect(x - kw, 7, kw, 16, 3).fillStyle(0x0c1a26).fillRect(x - kw, 19, kw, 4);
    scene.add.text(x - kw / 2, 9, k, { fontFamily: FONT_UI, fontStyle: '700', fontSize: '8px', color: UI.text }).setOrigin(0.5, 0);
    x -= kw + 12;
  });
  const wave = scene.add.graphics().setDepth(3);
  return {
    setTitle: (k, t) => { kicker.setText(k); title.setText(t); },
    tick: (attack = false) => {
      const tt = scene.time.now;
      wave.clear().lineStyle(1.5, attack ? UI.bad : UI.cyan).beginPath();
      for (let i = 0; i <= 28; i += 2) { const v = Math.sin(i / 3 + tt / 130) * Math.sin(i / 9 + tt / 550) * 3.5; const py = 15 + v; if (i === 0) wave.moveTo(5 + i, py); else wave.lineTo(5 + i, py); }
      wave.strokePath();
    },
  };
}

// pannello arrotondato con bordo luminoso e titoletto
export function panel(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, label = '', accent = UI.cyan, fill = UI.panel) {
  g.fillStyle(fill, 0.96).fillRoundedRect(x, y, w, h, 5).lineStyle(1, accent, 0.8).strokeRoundedRect(x + 0.5, y + 0.5, w, h, 5);
  if (label) scene.add.text(x + 7, y + 4, label, { fontFamily: FONT_UI, fontStyle: '700', fontSize: '8px', color: '#' + accent.toString(16).padStart(6, '0') });
}
