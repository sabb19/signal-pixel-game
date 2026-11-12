// Laboratorio di diagnostica — la postazione del padre (docs/NARRATIVE_BIBLE.md §11).
// Sfondo generato: public/assets/rooms/lab.png (1536×864). Coordinate in pixel DELL'IMMAGINE.
export const KEY = 'room-lab';
export const ROOM_SCALE = 0.5;
export const ROOM_W = 1536;
export const ROOM_H = 864;

type Rect = [number, number, number, number];

export const BLOCKERS: Rect[] = [
  [140, 0, 1230, 458],          // parete di fondo e banco di prova
  [0, 0, 140, 225],             // parete sinistra sopra la porta
  [0, 640, 135, 224],           // gradino in basso a sinistra
  [0, 710, 210, 154],
  [0, 780, 310, 84],
  [140, 400, 335, 250],         // scrivania del padre e sedia (anche lo spazio dietro)
  [1350, 0, 186, 864],          // scaffali a destra
  [1170, 470, 265, 320],        // letto
  [0, 838, 1536, 26],           // bordo inferiore
];
export const DOOR_BLOCK: Rect = [0, 0, 0, 0];

export const OCCLUDERS: { rect: Rect; baseY: number }[] = [
  { rect: [140, 400, 335, 265], baseY: 660 },   // scrivania del padre
];

export const SPOTS: { id: string; label: string; x: number; y: number; r: number }[] = [
  { id: 'bench', label: 'Banco di prova', x: 700, y: 490, r: 110 },
  { id: 'fdesk', label: 'Scrivania', x: 310, y: 690, r: 80 },
  { id: 'schema', label: 'Schemi a matita', x: 560, y: 480, r: 70 },
  { id: 'board', label: 'Bacheca', x: 1140, y: 490, r: 70 },
  { id: 'window', label: 'Finestra', x: 920, y: 490, r: 70 },
  { id: 'bed', label: 'Letto', x: 1120, y: 640, r: 70 },
  { id: 'back', label: 'Sala controllo', x: 90, y: 500, r: 70 },
];

export const LAMPS_IMG = [{ x: 280, y: 400 }, { x: 1460, y: 660 }];
export const SPAWN_IMG = { x: 100, y: 560 };
// ingresso dalla sala controllo
export const ENTRY_IMG = { x: 100, y: 560 };
