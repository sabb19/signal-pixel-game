import Phaser from 'phaser';
import { P, hex } from '../core/palette';
import { TILE } from '../core/config';

// Asset segnaposto disegnati da codice, con palette e dimensioni definitive
// (docs/ART_DIRECTION_BIBLE.md §9). Verranno sostituiti da PNG con le stesse chiavi e gli stessi frame.

type Ctx = CanvasRenderingContext2D;
const px = (c: Ctx, color: number, x: number, y: number, w = 1, h = 1) => {
  c.fillStyle = hex(color);
  c.fillRect(x, y, w, h);
};

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
  return tex;
}

// Rumore deterministico, per variare le texture senza cambiare a ogni avvio
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

export const DIRS = ['down', 'left', 'right', 'up'] as const;
export type Dir = (typeof DIRS)[number];
export const PLAYER_FRAMES = { idle: 4, walk: 6 };

export function makePlaceholders(scene: Phaser.Scene) {
  // --- Tile: 0 pavimento cemento, 1 pavimento tecnico, 2 parete fronte, 3 parete sopra, 4 zoccolo parete
  canvasTexture(scene, 'tiles', TILE * 5, TILE, (c) => {
    const r = rng(7);
    // cemento
    px(c, P.conc0, 0, 0, TILE, TILE);
    px(c, P.conc, 1, 1, TILE - 2, TILE - 2);
    for (let i = 0; i < 40; i++) px(c, r() > 0.5 ? P.conc2 : P.conc0, Math.floor(r() * 30) + 1, Math.floor(r() * 30) + 1);
    // pavimento tecnico a piastre
    const o = TILE;
    px(c, P.metal0, o, 0, TILE, TILE);
    px(c, P.metal, o + 1, 1, 14, 14); px(c, P.metal, o + 17, 1, 14, 14);
    px(c, P.metal, o + 1, 17, 14, 14); px(c, P.metal, o + 17, 17, 14, 14);
    [[2, 2], [13, 2], [2, 13], [13, 13]].forEach(([x, y]) => {
      [0, 16].forEach((dx) => [0, 16].forEach((dy) => px(c, P.metal2, o + x + dx, y + dy)));
    });
    // parete fronte (verde industriale, metà bassa più scura, linea di vernice consumata)
    const w = TILE * 2;
    px(c, P.green, w, 0, TILE, TILE);
    px(c, P.green2, w, 0, TILE, 2);
    px(c, P.green0, w, 18, TILE, 14);
    px(c, P.ochre0, w, 17, TILE, 1);
    for (let i = 0; i < 14; i++) px(c, P.green3, w + Math.floor(r() * 32), Math.floor(r() * 16) + 1);
    px(c, P.petrol, w, 30, TILE, 2);
    // parete vista dall'alto
    const t = TILE * 3;
    px(c, P.petrol, t, 0, TILE, TILE);
    px(c, P.petrol2, t + 2, 2, TILE - 4, TILE - 4);
    // zoccolo: fronte parete con ombra a terra (parete che chiude sotto)
    const z = TILE * 4;
    px(c, P.petrol, z, 0, TILE, TILE);
    px(c, P.green0, z, 0, TILE, 6);
  });
  for (let i = 0; i < 5; i++) scene.textures.get('tiles').add(i, 0, i * TILE, 0, TILE, TILE);

  // --- Protagonista: righe = direzioni, colonne = 4 idle + 6 walk
  const cols = PLAYER_FRAMES.idle + PLAYER_FRAMES.walk;
  const sheet = canvasTexture(scene, 'player-placeholder', 32 * cols, 32 * 4, (c) => {
    DIRS.forEach((dir, row) => {
      for (let f = 0; f < cols; f++) {
        const walk = f >= PLAYER_FRAMES.idle;
        const k = walk ? f - PLAYER_FRAMES.idle : f;
        const bob = walk ? (k % 3 === 0 ? 0 : -1) : k === 2 ? 1 : 0; // respiro / passo
        const step = walk ? [0, 2, 2, 0, -2, -2][k] : 0;
        drawPlayer(c, f * 32, row * 32, dir, bob, step);
      }
    });
  });
  DIRS.forEach((_, row) => {
    for (let f = 0; f < cols; f++) sheet.add(row * cols + f, 0, f * 32, row * 32, 32, 32);
  });

  // --- Terminale CRT: frame 0 errore, 1 errore (sfarfallio), 2 attivo, 3 attivo (sfarfallio)
  const term = canvasTexture(scene, 'terminal', 32 * 4, 48, (c) => {
    for (let f = 0; f < 4; f++) {
      const x = f * 32;
      const ok = f >= 2;
      const flick = f % 2 === 1;
      px(c, P.metal0, x + 2, 10, 28, 36); // mobile
      px(c, P.cream0, x + 3, 11, 26, 20); // case CRT plastica ingiallita
      px(c, P.cream, x + 4, 11, 24, 2);
      px(c, P.petrol0, x + 6, 14, 20, 14); // vetro
      const scr = ok ? (flick ? P.cyan1 : P.cyan) : flick ? P.red0 : P.red;
      for (let y = 15; y < 27; y += 2) px(c, scr, x + 7, y, ok ? 6 + ((y * 7) % 12) : 18, 1);
      px(c, P.metal, x + 4, 33, 24, 6); // tastiera
      for (let k = 0; k < 6; k++) px(c, P.metal2, x + 6 + k * 4, 35, 2, 2);
      px(c, ok ? P.cyan3 : P.red2, x + 25, 29, 2, 1); // spia
      px(c, P.petrol, x + 2, 44, 28, 2); // ombra
    }
  });
  for (let f = 0; f < 4; f++) term.add(f, 0, f * 32, 0, 32, 48);

  // --- Porta: 0 chiusa bloccata (spia rossa), 1 chiusa sbloccata, 2..4 apertura
  const door = canvasTexture(scene, 'door', 32 * 5, 64, (c) => {
    for (let f = 0; f < 5; f++) {
      const x = f * 32;
      px(c, P.metal0, x, 0, 32, 64);
      const open = Math.max(0, f - 1) * 5;
      px(c, P.petrol0, x + 3, 6, 26, 58);
      px(c, P.metal, x + 3, 6, 13 - open, 58);
      px(c, P.metal, x + 16 + open, 6, 13 - open, 58);
      if (open < 12) {
        px(c, P.ochre0, x + 3, 30, 13 - open, 3);
        px(c, P.ochre0, x + 16 + open, 30, 13 - open, 3);
      }
      px(c, f === 0 ? P.red : P.cyan, x + 14, 2, 4, 2);
    }
  });
  for (let f = 0; f < 5; f++) door.add(f, 0, f * 32, 0, 32, 64);

  // --- Lampada da soffitto (fonte di luce visibile)
  canvasTexture(scene, 'lamp', 16, 8, (c) => {
    px(c, P.metal0, 0, 0, 16, 4);
    px(c, P.lamp2, 2, 4, 12, 2);
    px(c, P.lamp, 4, 6, 8, 2);
  });

  // --- Pennello di luce: gradiente radiale a gradini (niente sfumature continue)
  canvasTexture(scene, 'light', 256, 256, (c) => {
    const steps = 6;
    for (let i = steps; i >= 1; i--) {
      c.globalAlpha = 1 / steps;
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(128, 128, (128 * i) / steps, 0, Math.PI * 2);
      c.fill();
    }
  });
}

// Protagonista 24×32 nel frame 32×32 (ART_DIRECTION_BIBLE §4): giacca marrone, sciarpa rossa,
// zaino, capelli neri, pantaloni blu notte, scarponi marroni.
function drawPlayer(c: Ctx, ox: number, oy: number, dir: Dir, bob: number, step: number) {
  const x = ox + 4, y = oy + bob;
  const side = dir === 'left' || dir === 'right';
  const flip = dir === 'left';
  const X = (dx: number, w = 1) => (flip ? x + 24 - dx - w : x + dx);
  const R = (color: number, dx: number, dy: number, w = 1, h = 1) => px(c, color, X(dx, w), y + dy, w, h);

  px(c, P.petrol0, ox + 9, oy + 29, 14, 2); // ombra a terra

  // gambe e scarponi
  if (side) {
    R(P.night, 9, 21, 3, 7 + Math.max(0, step)); R(P.night0, 13, 21, 3, 7 - Math.max(0, step));
    R(P.jacket0, 9 + step, 28, 4, 2); R(P.jacket0, 13 - step, 28, 4, 2);
  } else {
    R(P.night, 7, 21, 4, 7 - Math.max(0, step)); R(P.night, 13, 21, 4, 7 + Math.min(0, step));
    R(P.jacket0, 7, 28 - Math.max(0, step), 4, 2); R(P.jacket0, 13, 28 + Math.min(0, step), 4, 2);
  }
  // zaino (dietro: si disegna prima del busto se guarda giù)
  if (dir === 'down') { R(P.green0, 5, 11, 2, 9); R(P.green0, 17, 11, 2, 9); }
  // giacca (lunga fino a metà coscia)
  R(P.jacket0, 6, 11, 12, 13);
  R(P.jacket, 7, 11, 10, 12);
  R(P.jacket3, 7, 12, 2, 7);
  if (dir === 'down') { R(P.jacket1, 11, 14, 2, 9); R(P.cream, 14, 15, 2, 2); } // cerniera e badge
  // braccia
  if (side) {
    R(P.jacket1, 10 - step, 13, 3, 8); R(P.skin, 10 - step, 21, 3, 1);
  } else {
    R(P.jacket1, 4, 12 + Math.max(0, step), 3, 9); R(P.jacket1, 17, 12 - Math.min(0, step), 3, 9);
    R(P.skin, 4, 21 + Math.max(0, step), 3, 1); R(P.skin, 17, 21 - Math.min(0, step), 3, 1);
  }
  // zaino visibile da dietro e di lato
  if (dir === 'up') { R(P.green0, 6, 11, 12, 11); R(P.green, 7, 12, 10, 8); R(P.metal, 8, 15, 8, 1); }
  if (side) { R(P.green0, 3, 11, 5, 10); R(P.green, 4, 12, 3, 7); }
  // sciarpa
  R(P.scarf0, 7, 9, 10, 3);
  R(P.scarf, 8, 9, 8, 2);
  if (dir === 'down') R(P.scarf, 9, 12, 3, 3 + (bob ? 0 : 1));
  if (dir === 'up') R(P.scarf, 13, 11, 3, 4);
  // testa
  R(P.skin0, 8, 1, 8, 9);
  R(P.skin, 8, 2, 8, 7);
  // capelli neri spettinati, lunghi fino al collo
  R(P.hair, 7, 0, 10, 3);
  if (dir === 'up') R(P.hair, 7, 2, 10, 8);
  else if (side) { R(P.hair, 7, 2, 5, 7); R(P.hair, 12, 2, 4, 1); }
  else { R(P.hair, 7, 2, 2, 7); R(P.hair, 15, 2, 2, 7); R(P.hair, 9, 2, 3, 2); }
  // occhi
  if (dir === 'down') { R(P.petrol0, 10, 5, 1, 2); R(P.petrol0, 13, 5, 1, 2); }
  if (side) R(P.petrol0, 14, 5, 1, 2);
}
