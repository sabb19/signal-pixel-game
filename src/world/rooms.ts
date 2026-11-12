// Prototipo: Sala controllo (ovest) + Ingresso (est), unite da un corridoio.
// Legenda mappa: # muro · . pavimento · D porta della sala server (nel muro)
// I muri sopra un pavimento diventano "fronte" alto 2 tile (zoccolo + pannello con tubo).
export const PROTO_MAP = [
  '################################',
  '################################',
  '##..............################',
  '##..............#####D##########',
  '##..............###...........##',
  '##..............###...........##',
  '##..............###...........##',
  '##............................##',
  '##............................##',
  '##..............###...........##',
  '##..............###...........##',
  '###################...........##',
  '###################...........##',
  '################################',
  '################################',
];

// Tipo di pavimento per zona (in tile, estremi inclusi)
export const FLOOR_ZONES: { c0: number; r0: number; c1: number; r1: number; kind: 'tech' | 'conc' | 'stripe' }[] = [
  { c0: 2, r0: 2, c1: 15, r1: 10, kind: 'tech' },
  { c0: 16, r0: 7, c1: 18, r1: 8, kind: 'conc' },
  { c0: 19, r0: 4, c1: 29, r1: 12, kind: 'conc' },
  { c0: 20, r0: 4, c1: 22, r1: 4, kind: 'stripe' },
];

// Arredi. x,y = punto in basso al centro in pixel. foot = impronta di collisione (larghezza, altezza) alla base.
// wall: true = appeso alla parete (nessuna collisione, sta sul fronte del muro).
export interface PropDef {
  key: string; x: number; y: number; frame?: number;
  foot?: [number, number]; wall?: boolean; floor?: boolean;
  id?: string; label?: string; glow?: number;
}

const T = 32;
export const PROPS: PropDef[] = [
  // --- Sala controllo
  { key: 'worldmap', x: 9 * T, y: 1 * T + 26, wall: true },
  { key: 'crtbank', x: 5 * T, y: 2 * T + 30, foot: [96, 14], id: 'crtbank', glow: 0x3fa7b5 },
  { key: 'terminal', x: 5 * T, y: 4 * T + 6, foot: [28, 12], id: 'main', label: 'Terminale principale', glow: 0x3fa7b5 },
  { key: 'terminal', x: 12 * T, y: 3 * T + 4, foot: [28, 12], id: 'comms', label: 'Console comunicazioni', glow: 0x3fa7b5 },
  { key: 'rack', x: 14 * T + 16, y: 3 * T + 10, foot: [32, 16], id: 'rack' },
  { key: 'rack', x: 13 * T + 12, y: 3 * T + 10, foot: [32, 16] },
  { key: 'clock', x: 3 * T + 16, y: 1 * T + 20, wall: true },
  { key: 'poster', x: 12 * T + 16, y: 1 * T + 30, wall: true },
  { key: 'console', x: 9 * T, y: 6 * T + 20, foot: [96, 18], glow: 0x3fa7b5 },
  { key: 'chair', x: 9 * T - 20, y: 7 * T + 14, foot: [12, 6] },
  { key: 'chair', x: 9 * T + 22, y: 7 * T + 18, foot: [12, 6] },
  { key: 'desk', x: 4 * T + 8, y: 9 * T + 12, foot: [64, 16] },
  { key: 'chair', x: 4 * T + 12, y: 8 * T + 14, foot: [12, 6] },
  { key: 'desk', x: 12 * T + 16, y: 9 * T + 12, foot: [64, 16] },
  { key: 'cabinet', x: 15 * T + 4, y: 6 * T + 10, foot: [24, 10] },
  { key: 'cabinet', x: 15 * T + 4, y: 5 * T + 10, foot: [24, 10] },
  { key: 'boxes', x: 3 * T, y: 10 * T + 20, foot: [24, 8] },
  { key: 'plant', x: 2 * T + 12, y: 3 * T + 4, foot: [12, 6] },
  // --- Ingresso
  { key: 'plaque', x: 23 * T + 8, y: 2 * T + 16, wall: true },
  { key: 'noticeboard', x: 25 * T, y: 3 * T + 20, wall: true },
  { key: 'locker', x: 27 * T + 4, y: 4 * T + 22, foot: [22, 10] },
  { key: 'locker', x: 27 * T + 26, y: 4 * T + 22, foot: [22, 10] },
  { key: 'locker', x: 28 * T + 16, y: 4 * T + 22, foot: [22, 10] },
  { key: 'bench', x: 27 * T + 8, y: 8 * T + 20, foot: [60, 8] },
  { key: 'crate', x: 20 * T, y: 12 * T + 26, foot: [28, 12] },
  { key: 'crate', x: 21 * T + 4, y: 12 * T + 26, foot: [28, 12] },
  { key: 'crate', x: 20 * T + 14, y: 12 * T + 6, foot: [28, 12] },
  { key: 'mat', x: 24 * T + 16, y: 12 * T + 28, floor: true },
];

export const LAMPS = [
  { x: 4 * T + 8, y: 8 * T + 20, color: 0xd9853b },
  { x: 12 * T + 16, y: 8 * T + 20, color: 0xd9853b },
  { x: 24 * T, y: 7 * T, color: 0xd9853b },
];
// Cavi a terra (sala controllo): segmenti in pixel, dal pannello ai rack e alla console
export const CABLES: [number, number][][] = [
  [[5 * T + 40, 3 * T + 4], [5 * T + 40, 5 * T + 10], [9 * T - 30, 5 * T + 10]],
  [[13 * T + 12, 3 * T + 12], [13 * T + 12, 5 * T + 4], [9 * T + 30, 5 * T + 4], [9 * T + 30, 5 * T + 12]],
  [[14 * T + 26, 3 * T + 12], [14 * T + 26, 8 * T + 30], [12 * T + 40, 8 * T + 30]],
];
export const SPAWN = { x: 24 * T + 16, y: 11 * T + 20 };
export const DOOR = { c: 21, r: 3 };
