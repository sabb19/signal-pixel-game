// Laboratorio di diagnostica — la postazione del padre. Sfondo illustrato: public/assets/rooms/lab.png (1536×864).
export const KEY = 'room-lab';
export const ROOM_SCALE = 0.5;
export const ROOM_W = 1536;
export const ROOM_H = 864;

type Rect = [number, number, number, number];

export const BLOCKERS: Rect[] = [
  [170, 0, 900, 410],           // banco di prova e finestra
  [580, 0, 90, 438],            // sgabello
  [1065, 0, 50, 405],           // parete prima della porta
  [1110, 0, 170, 376],          // porta verso la Sala Comunicazioni (si attraversa dal basso)
  [1275, 0, 261, 445],          // scaffali
  [40, 0, 130, 392],            // parete sinistra e stipite
  [0, 0, 40, 864],              // bordo sinistro
  [0, 556, 388, 256],           // scrivania del padre e sedia
  [0, 720, 120, 144],           // casse in basso a sinistra
  [1272, 468, 264, 396],        // letto e stufetta
  [0, 842, 1536, 22],           // bordo inferiore
];
export const DOOR_BLOCK: Rect = [0, 0, 0, 0];

export const OCCLUDERS: { rect: Rect; baseY: number }[] = [
  { rect: [0, 470, 392, 394], baseY: 812 },     // scrivania del padre
];

export const SPOTS: { id: string; label: string; x: number; y: number; r: number }[] = [
  { id: 'bench', label: 'Banco di prova', x: 760, y: 450, r: 110 },
  { id: 'fdesk', label: 'Scrivania', x: 430, y: 640, r: 85 },
  { id: 'schema', label: 'Schemi a matita', x: 330, y: 445, r: 70 },
  { id: 'board', label: 'Bacheca', x: 1030, y: 445, r: 70 },
  { id: 'window', label: 'Finestra', x: 560, y: 450, r: 60 },
  { id: 'bed', label: 'Letto', x: 1220, y: 620, r: 85 },
  { id: 'cdoor', label: 'Porta', x: 1190, y: 425, r: 70 },
  { id: 'back', label: 'Sala controllo', x: 120, y: 440, r: 60 },
];

export const LAMPS_IMG = [{ x: 140, y: 440 }, { x: 1310, y: 625 }];
export const SPAWN_IMG = { x: 170, y: 450 };
// ingresso dalla sala controllo
export const ENTRY_IMG = { x: 170, y: 450 };
