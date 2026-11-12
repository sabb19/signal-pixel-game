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
  [0, 640, 330, 224],           // gradino in basso a sinistra
  [145, 560, 330, 100],         // scrivania del padre e sedia
  [1350, 0, 186, 864],          // scaffali a destra
  [1170, 470, 265, 320],        // branda
  [0, 838, 1536, 26],           // bordo inferiore
];
export const DOOR_BLOCK: Rect = [0, 0, 0, 0];

export const OCCLUDERS: { rect: Rect; baseY: number }[] = [
  { rect: [140, 400, 335, 265], baseY: 660 },   // scrivania del padre
  { rect: [1168, 455, 270, 335], baseY: 790 },  // branda
];

export const SPOTS: { id: string; label: string; x: number; y: number; r: number }[] = [
  { id: 'bench', label: 'Banco di prova', x: 700, y: 490, r: 110 },
  { id: 'fdesk', label: 'Scrivania', x: 320, y: 700, r: 70 },
  { id: 'schema', label: 'Schemi a matita', x: 420, y: 490, r: 70 },
  { id: 'board', label: 'Bacheca', x: 1140, y: 490, r: 70 },
  { id: 'window', label: 'Finestra', x: 920, y: 490, r: 70 },
  { id: 'bed', label: 'Branda', x: 1120, y: 640, r: 70 },
  { id: 'back', label: 'Sala controllo', x: 150, y: 470, r: 70 },
];

export const LAMPS_IMG = [{ x: 280, y: 400 }, { x: 1460, y: 660 }];
export const SPAWN_IMG = { x: 210, y: 500 };
// ingresso dalla sala controllo
export const ENTRY_IMG = { x: 210, y: 500 };
