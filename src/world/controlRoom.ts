// Sala controllo — sfondo illustrato: public/assets/rooms/control_room.png (1536×864). Coordinate in pixel DELL'IMMAGINE.
export const ROOM_SCALE = 0.5;
export const ROOM_W = 1536;
export const ROOM_H = 864;

type Rect = [number, number, number, number];

export const BLOCKERS: Rect[] = [
  [0, 0, 1536, 300],            // parete di fondo
  [455, 0, 565, 352],           // scrivania dei monitor
  [1020, 0, 240, 378],          // armadi di rete
  [140, 0, 175, 372],           // schedario e pianta
  [0, 0, 150, 470],             // parete sinistra con finestra
  [0, 470, 36, 394],            // bordo sinistro
  [1255, 0, 60, 405],           // parete tra armadi e porta
  [1440, 0, 96, 330],           // parete destra
  [1425, 320, 111, 270],        // schedario a destra
  [470, 452, 520, 188],         // console centrale (base)
  [0, 598, 428, 205],           // scrivania sinistra e sedia
  [0, 680, 240, 184],           // scatole
  [1058, 655, 478, 209],        // scrivania destra
  [0, 842, 1536, 22],           // bordo inferiore
];
export const DOOR_BLOCK: Rect = [1310, 330, 130, 200];

export const OCCLUDERS: { rect: Rect; baseY: number }[] = [
  { rect: [455, 310, 540, 330], baseY: 640 },   // console
  { rect: [0, 478, 436, 386], baseY: 803 },     // scrivania sinistra
  { rect: [1052, 545, 484, 319], baseY: 864 },  // scrivania destra
  { rect: [1420, 315, 116, 275], baseY: 590 },  // schedario destro
];

export const SPOTS: { id: string; label: string; x: number; y: number; r: number }[] = [
  { id: 'console', label: 'Console di controllo', x: 730, y: 680, r: 100 },
  { id: 'monitors', label: 'Parete di monitor', x: 735, y: 385, r: 75 },
  { id: 'breaker', label: 'Quadro elettrico', x: 1140, y: 410, r: 75 },
  { id: 'map', label: 'Cartina', x: 420, y: 370, r: 75 },
  { id: 'deskL', label: 'Scrivania', x: 260, y: 560, r: 80 },
  { id: 'deskR', label: 'Scrivania', x: 1250, y: 615, r: 80 },
  { id: 'door', label: 'Porta est', x: 1290, y: 470, r: 75 },
];

export const LAMPS_IMG = [{ x: 140, y: 515 }, { x: 1340, y: 575 }];
export const SPAWN_IMG = { x: 760, y: 780 };
export const KEY = 'room-control';
// ingresso tornando dal laboratorio (davanti alla porta est)
export const ENTRY_IMG = { x: 1240, y: 480 };
