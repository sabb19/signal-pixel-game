import Phaser from 'phaser';
import { P, hex } from '../core/palette';
import { TILE } from '../core/config';

// Ambienti e arredi segnaposto, disegnati pixel per pixel con la palette definitiva.
// Ogni oggetto è una texture separata (mai una stanza "piatta"), con la sua impronta di collisione.

type Ctx = CanvasRenderingContext2D;
const px = (c: Ctx, color: number, x: number, y: number, w = 1, h = 1) => {
  c.fillStyle = hex(color);
  c.fillRect(x, y, w, h);
};
function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void, frames?: { w: number; h: number; n: number }) {
  const t = scene.textures.createCanvas(key, w, h)!;
  draw(t.getContext());
  t.refresh();
  if (frames) for (let i = 0; i < frames.n; i++) t.add(i, 0, i * frames.w, 0, frames.w, frames.h);
  return t;
}
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}
// rettangolo con contorno scuro, faccia e luce in alto a sinistra
function box(c: Ctx, x: number, y: number, w: number, h: number, base: number, dark: number, light: number) {
  px(c, dark, x, y, w, h);
  px(c, base, x + 1, y + 1, w - 2, h - 2);
  px(c, light, x + 1, y + 1, w - 2, 1);
  px(c, light, x + 1, y + 1, 1, h - 2);
}

// Pavimenti: frame 0-3 cemento, 4-7 piastre tecniche, 8 cemento con striscia gialla di sicurezza
export const FLOOR = { conc: 0, tech: 4, stripe: 8 };
// Muri: 0 cima vista dall'alto, 1 fronte alto (pannello + tubo), 2 fronte basso (zoccolo), 3 fronte alto senza tubo
export const WALL = { top: 0, upper: 1, lower: 2, upperPlain: 3 };

export function makeEnvironment(scene: Phaser.Scene) {
  const r = rng(11);

  tex(scene, 'floors', TILE * 9, TILE, (c) => {
    for (let v = 0; v < 4; v++) {
      // cemento: niente bordi a griglia, solo grana, macchie e qualche crepa
      const o = v * TILE;
      px(c, P.conc, o, 0, TILE, TILE);
      for (let i = 0; i < 26; i++) px(c, r() > 0.5 ? P.conc2 : P.conc0, o + Math.floor(r() * 32), Math.floor(r() * 32));
      if (v === 1) { px(c, P.conc0, o + 6, 10, 9, 1); px(c, P.conc0, o + 14, 11, 6, 1); px(c, P.conc0, o + 19, 12, 1, 4); }
      if (v === 2) { c.globalAlpha = 0.12; px(c, P.metal0, o + 9, 15, 13, 5); px(c, P.metal0, o + 12, 13, 7, 9); c.globalAlpha = 1; }
      if (v === 3) px(c, P.conc0, o, 31, TILE, 1); // giunto di dilatazione ogni tanto
      // piastre tecniche: 2×2 per tile, giunti sottili, rivetti
      const t = (v + 4) * TILE;
      px(c, P.night, t, 0, TILE, TILE);
      // giunti appena accennati: solo un lato scuro, niente bordo chiaro
      c.globalAlpha = 0.45; px(c, P.night0, t, 31, TILE, 1); px(c, P.night0, t + 31, 0, 1, TILE); c.globalAlpha = 1;
      for (let i = 0; i < 10; i++) px(c, P.night0, t + Math.floor(r() * 32), Math.floor(r() * 32));
      if (v === 1) { px(c, P.night0, t + 3, 3, 9, 9); px(c, P.night2, t + 4, 4, 7, 7); for (let k = 5; k < 11; k += 2) px(c, P.night0, t + 5, k, 5, 1); } // griglia di ventilazione
      [[2, 2], [13, 2], [18, 18], [29, 29]].forEach(([a, b]) => px(c, P.metal2, t + a, b));
    }
    const s = 8 * TILE;
    px(c, P.conc, s, 0, TILE, TILE);
    for (let i = 0; i < 20; i++) px(c, P.conc0, s + Math.floor(r() * 32), Math.floor(r() * 32));
    for (let i = 0; i < 4; i++) { px(c, P.ochre, s + i * 8, 12, 4, 6); px(c, P.ochre0, s + i * 8 + 4, 12, 4, 6); }
  }, { w: TILE, h: TILE, n: 9 });

  tex(scene, 'walls', TILE * 4, TILE, (c) => {
    // cima: blocco scuro con bordo chiaro verso la stanza
    px(c, P.petrol0, 0, 0, TILE, TILE);
    px(c, P.petrol, 1, 1, TILE - 2, TILE - 2);
    for (let i = 0; i < 6; i++) px(c, P.petrol2, Math.floor(r() * 30) + 1, Math.floor(r() * 30) + 1);
    // fronte alto: pannelli verdi, giunti verticali, tubo orizzontale con staffe
    const u = TILE;
    px(c, P.green, u, 0, TILE, TILE);
    px(c, P.green2, u, 0, TILE, 1);
    px(c, P.green0, u + 15, 0, 1, TILE);
    for (let i = 0; i < 10; i++) px(c, P.green3, u + Math.floor(r() * 32), Math.floor(r() * 32));
    px(c, P.metal0, u, 8, TILE, 5); px(c, P.metal, u, 9, TILE, 2); px(c, P.metal2, u, 9, TILE, 1);
    px(c, P.metal0, u + 6, 6, 2, 9); px(c, P.metal0, u + 24, 6, 2, 9);
    // fronte basso: zoccolo scuro, linea ocra consumata, battiscopa
    const l = TILE * 2;
    px(c, P.green, l, 0, TILE, 14);
    px(c, P.green0, l + 15, 0, 1, 14);
    px(c, P.ochre0, l, 14, TILE, 2);
    px(c, P.green0, l, 16, TILE, 13);
    for (let i = 0; i < 8; i++) px(c, P.petrol2, l + Math.floor(r() * 32), 17 + Math.floor(r() * 11));
    px(c, P.petrol0, l, 29, TILE, 3);
    // fronte alto senza tubo
    const p = TILE * 3;
    px(c, P.green, p, 0, TILE, TILE);
    px(c, P.green2, p, 0, TILE, 1);
    px(c, P.green0, p + 15, 0, 1, TILE);
    for (let i = 0; i < 10; i++) px(c, P.green3, p + Math.floor(r() * 32), Math.floor(r() * 32));
  }, { w: TILE, h: TILE, n: 4 });

  // --- Parete di monitor (sala controllo), 96×56: 6 schermi, frame 0 errore / 1 attivo
  tex(scene, 'crtbank', 96 * 2, 56, (c) => {
    for (let f = 0; f < 2; f++) {
      const o = f * 96;
      box(c, o, 0, 96, 56, P.metal, P.metal0, P.metal2);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const x = o + 5 + i * 30, y = 4 + j * 22;
        box(c, x, y, 26, 19, P.cream0, P.metal0, P.cream);
        px(c, P.petrol0, x + 3, y + 3, 20, 13);
        const bad = f === 0 && (i + j) % 2 === 0;
        const col = bad ? P.red : P.cyan1;
        for (let k = 0; k < 5; k++) px(c, col, x + 4, y + 4 + k * 2, 4 + ((i * 7 + j * 3 + k * 5) % 14), 1);
        if (!bad && f === 1) px(c, P.cyan3, x + 19, y + 13, 2, 1);
      }
      for (let k = 0; k < 8; k++) px(c, k % 3 ? P.metal0 : P.ochre, o + 8 + k * 10, 50, 3, 3); // manopole
    }
  }, { w: 96, h: 56, n: 2 });

  // --- Scrivania 64×40 (piano visto da sopra + fronte), con carte, tazza e lampada
  tex(scene, 'desk', 64, 40, (c) => {
    px(c, P.jacket0, 0, 4, 64, 22);
    px(c, P.jacket1, 1, 5, 62, 20);
    px(c, P.jacket, 1, 5, 62, 2);
    px(c, P.metal0, 0, 26, 64, 12); px(c, P.metal, 1, 27, 62, 9);
    px(c, P.metal0, 30, 27, 1, 9); px(c, P.metal2, 14, 31, 6, 1); px(c, P.metal2, 44, 31, 6, 1); // cassetti
    px(c, P.cream, 6, 9, 14, 10); px(c, P.cream0, 8, 11, 10, 1); px(c, P.cream0, 8, 13, 8, 1); px(c, P.cream0, 8, 15, 9, 1);
    px(c, P.cream2, 10, 7, 12, 9); px(c, P.cream0, 12, 9, 8, 1); px(c, P.cream0, 12, 11, 6, 1);
    px(c, P.cream, 30, 10, 5, 5); px(c, P.jacket0, 31, 11, 3, 3); // tazza
    px(c, P.metal0, 50, 2, 2, 14); px(c, P.metal0, 46, 1, 10, 3); px(c, P.lamp2, 47, 4, 8, 1); // lampada
    px(c, P.petrol0, 2, 38, 60, 2);
  });

  tex(scene, 'chair', 18, 22, (c) => {
    box(c, 2, 0, 14, 8, P.night2, P.night0, P.night2);
    px(c, P.night, 2, 9, 14, 6); px(c, P.night0, 2, 15, 14, 1);
    px(c, P.metal0, 8, 16, 2, 4); px(c, P.metal0, 3, 20, 12, 1);
    px(c, P.petrol0, 3, 21, 12, 1);
  });

  // --- Rack 32×64: frame 0 spento/allarme, 1 attivo
  tex(scene, 'rack', 64, 64, (c) => {
    for (let f = 0; f < 2; f++) {
      const o = f * 32;
      px(c, P.metal0, o, 0, 32, 8); px(c, P.metal, o + 1, 1, 30, 6);
      box(c, o, 8, 32, 54, P.metal0, P.petrol0, P.metal);
      for (let k = 0; k < 8; k++) {
        const y = 11 + k * 6;
        px(c, P.metal, o + 3, y, 26, 5); px(c, P.metal0, o + 3, y + 4, 26, 1);
        px(c, f ? (k % 3 ? P.cyan : P.cyan3) : k === 2 ? P.red : P.metal0, o + 5, y + 1, 2, 2);
        if (f) px(c, P.phos, o + 9, y + 2, 1, 1);
        for (let g = 0; g < 4; g++) px(c, P.metal0, o + 18 + g * 2, y + 1, 1, 3);
      }
      px(c, P.petrol0, o + 1, 62, 30, 2);
    }
  }, { w: 32, h: 64, n: 2 });

  tex(scene, 'locker', 22, 56, (c) => {
    box(c, 0, 0, 22, 54, P.green2, P.green0, P.green3);
    px(c, P.green0, 0, 26, 22, 1);
    for (let k = 0; k < 4; k++) px(c, P.green0, 5, 5 + k * 2, 12, 1); // feritoie
    px(c, P.metal2, 17, 30, 2, 6);
    px(c, P.cream, 6, 16, 10, 5); px(c, P.metal0, 7, 18, 8, 1); // targhetta col nome
    px(c, P.petrol0, 1, 54, 20, 2);
  });

  // decorazioni a parete
  tex(scene, 'noticeboard', 48, 28, (c) => {
    box(c, 0, 0, 48, 28, P.ochre0, P.jacket0, P.ochre);
    px(c, P.cream, 4, 4, 12, 14); px(c, P.cream2, 18, 3, 10, 9); px(c, P.cream, 31, 5, 13, 11); px(c, P.ochre2, 20, 14, 9, 10);
    [[9, 4], [22, 3], [37, 5], [24, 14]].forEach(([x, y]) => px(c, P.red, x, y, 2, 2));
    for (let k = 0; k < 4; k++) px(c, P.metal0, 6, 8 + k * 2, 8, 1);
  });
  tex(scene, 'worldmap', 56, 30, (c) => {
    box(c, 0, 0, 56, 30, P.cream0, P.metal0, P.cream);
    px(c, P.night2, 2, 2, 52, 26);
    px(c, P.conc0, 6, 6, 12, 8); px(c, P.conc0, 10, 14, 6, 10); px(c, P.conc0, 24, 5, 16, 9); px(c, P.conc0, 28, 14, 8, 8); px(c, P.conc0, 42, 18, 8, 5);
    [[12, 9], [30, 8], [33, 16], [27, 11]].forEach(([x, y]) => px(c, P.red2, x, y, 2, 2));
    px(c, P.red, 26, 8, 10, 1); // linea del fronte
  });
  tex(scene, 'plaque', 40, 10, (c) => {
    box(c, 0, 0, 40, 10, P.ochre, P.ochre0, P.ochre2);
    for (let k = 0; k < 6; k++) px(c, P.jacket0, 4 + k * 6, 4, 4, 2);
  });

  tex(scene, 'bench', 64, 20, (c) => {
    px(c, P.jacket0, 0, 2, 64, 8); px(c, P.jacket, 1, 3, 62, 2); px(c, P.jacket1, 1, 6, 62, 3);
    px(c, P.metal0, 4, 10, 3, 8); px(c, P.metal0, 57, 10, 3, 8);
    px(c, P.petrol0, 2, 18, 60, 2);
  });
  tex(scene, 'crate', 30, 30, (c) => {
    px(c, P.ochre0, 0, 0, 30, 10); px(c, P.ochre, 1, 1, 28, 8);
    box(c, 0, 10, 30, 18, P.jacket, P.jacket0, P.jacket3);
    px(c, P.jacket0, 0, 18, 30, 1); px(c, P.jacket0, 14, 10, 2, 18);
    px(c, P.cream, 4, 13, 7, 3);
    px(c, P.petrol0, 1, 28, 28, 2);
  });
  tex(scene, 'plant', 18, 30, (c) => {
    px(c, P.green0, 3, 0, 4, 8); px(c, P.green2, 8, 2, 5, 9); px(c, P.green3, 11, 0, 4, 6); px(c, P.green, 4, 6, 10, 8);
    px(c, P.ochre0, 7, 4, 2, 4); // foglia secca
    box(c, 3, 14, 12, 12, P.jacket1, P.jacket0, P.jacket);
    px(c, P.petrol0, 3, 26, 12, 2);
  });
  tex(scene, 'mat', 48, 24, (c) => {
    px(c, P.night0, 0, 0, 48, 24); px(c, P.night, 2, 2, 44, 20);
    for (let k = 0; k < 10; k++) px(c, P.night0, 4 + k * 4, 4, 1, 16);
  });
  tex(scene, 'boxes', 26, 16, (c) => { // scatola di documenti a terra
    box(c, 0, 2, 26, 12, P.cream0, P.jacket1, P.cream);
    px(c, P.cream2, 3, 0, 9, 4); px(c, P.cream2, 14, 1, 8, 3);
    px(c, P.petrol0, 1, 14, 24, 2);
  });

  tex(scene, 'cabinet', 26, 44, (c) => { // schedario metallico a 3 cassetti
    px(c, P.metal0, 0, 0, 26, 6); px(c, P.metal, 1, 1, 24, 4);
    box(c, 0, 6, 26, 36, P.metal, P.metal0, P.metal2);
    for (let k = 0; k < 3; k++) { px(c, P.metal0, 1, 17 + k * 11, 24, 1); px(c, P.metal2, 10, 10 + k * 11, 6, 2); px(c, P.cream, 4, 10 + k * 11, 4, 3); }
    px(c, P.cream2, 4, 0, 10, 3); // fogli sopra
    px(c, P.petrol0, 1, 42, 24, 2);
  });
  tex(scene, 'console', 96, 44, (c) => { // isola di controllo centrale: piano inclinato con tasti e due piccoli schermi
    px(c, P.metal0, 0, 0, 96, 30); px(c, P.metal, 1, 1, 94, 27); px(c, P.metal2, 1, 1, 94, 1);
    for (let i = 0; i < 2; i++) { const x = 8 + i * 50; box(c, x, 4, 30, 14, P.cream0, P.metal0, P.cream); px(c, P.petrol0, x + 2, 6, 26, 10); for (let k = 0; k < 4; k++) px(c, P.cyan1, x + 4, 7 + k * 2, 6 + ((k * 9 + i * 5) % 16), 1); }
    for (let k = 0; k < 14; k++) px(c, [P.ochre, P.metal0, P.red0, P.cyan1][k % 4], 6 + k * 6, 22, 4, 3);
    px(c, P.metal0, 0, 30, 96, 12); px(c, P.metal, 1, 31, 94, 9); px(c, P.metal0, 47, 31, 1, 9);
    px(c, P.petrol0, 2, 42, 92, 2);
  });
  tex(scene, 'clock', 14, 14, (c) => { px(c, P.metal0, 2, 0, 10, 14); px(c, P.metal0, 0, 2, 14, 10); px(c, P.cream, 2, 2, 10, 10); px(c, P.metal0, 6, 3, 1, 4); px(c, P.metal0, 7, 6, 3, 1); });
  tex(scene, 'poster', 22, 30, (c) => { box(c, 0, 0, 22, 30, P.cream, P.cream0, P.cream2); px(c, P.red, 3, 3, 16, 4); px(c, P.night, 5, 10, 12, 10); px(c, P.ochre, 9, 12, 4, 6); for (let k = 0; k < 3; k++) px(c, P.metal0, 3, 22 + k * 2, 16, 1); });

  tex(scene, 'px', 1, 1, (c) => px(c, 0xffffff, 0, 0));

  // luce calda e fredda (aloni additivi)
  tex(scene, 'glow', 64, 64, (c) => {
    for (let i = 4; i >= 1; i--) {
      c.globalAlpha = 0.25;
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(32, 32, i * 8, 0, Math.PI * 2); c.fill();
    }
  });
}
