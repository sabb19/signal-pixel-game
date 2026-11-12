// Sala controllo: sfondo generato (public/assets/rooms/control_room.png, 1536×864).
// Tutte le coordinate qui sotto sono in pixel DELL'IMMAGINE; la scena le scala con ROOM_SCALE.
export const ROOM_SCALE = 0.5;
export const ROOM_W = 1536;
export const ROOM_H = 864;

type Rect = [number, number, number, number]; // x, y, larghezza, altezza

// Zone non calpestabili (muri e impronte dei mobili alla base)
export const BLOCKERS: Rect[] = [
  [0, 0, ROOM_W, 300],          // parete di fondo
  [0, 0, 130, ROOM_H],          // parete sinistra
  [1395, 0, 141, 200],          // parete destra sopra la porta
  [1395, 470, 141, 394],        // parete destra sotto la porta
  [1480, 200, 56, 270],         // oltre la porta (chiusa finché non si apre)
  [500, 0, 435, 318],           // parete di monitor
  [1115, 0, 230, 308],          // rack
  [135, 0, 155, 312],           // schedario e pianta
  [525, 470, 410, 95],          // console centrale (base)
  [130, 660, 320, 120],         // scrivania sinistra e sedia
  [1015, 660, 345, 120],        // scrivania destra e sedia
  [35, 500, 105, 260],          // schedario in basso a sinistra
  [1360, 545, 105, 250],        // schedario a destra
  [0, 770, 210, 94],            // scatole
];
export const DOOR_BLOCK: Rect = [1395, 200, 85, 270];

// Ritagli dello sfondo disegnati sopra la protagonista quando lei è "dietro" (ordinamento per base y)
export const OCCLUDERS: { rect: Rect; baseY: number }[] = [
  { rect: [505, 66, 430, 250], baseY: 312 },
  { rect: [1118, 66, 225, 238], baseY: 302 },
  { rect: [140, 135, 150, 178], baseY: 306 },
  { rect: [522, 352, 416, 212], baseY: 562 },
  { rect: [128, 588, 320, 212], baseY: 780 },   // scrivania sinistra: dal bordo del piano in giù
  { rect: [1012, 596, 345, 204], baseY: 780 },  // scrivania destra
  { rect: [36, 500, 102, 256], baseY: 755 },
  { rect: [1362, 542, 102, 254], baseY: 796 },
  { rect: [12, 768, 200, 96], baseY: 864 },
];

// Punti di interazione (centro dell'area in cui stare per usarli)
export const SPOTS: { id: string; label: string; x: number; y: number; r: number }[] = [
  { id: 'console', label: 'Console di controllo', x: 730, y: 480, r: 90 },
  { id: 'monitors', label: 'Parete di monitor', x: 715, y: 318, r: 70 },
  { id: 'racks', label: 'Rack di rete', x: 1250, y: 330, r: 70 },
  { id: 'map', label: 'Cartina', x: 380, y: 330, r: 80 },
  { id: 'deskL', label: 'Scrivania', x: 300, y: 640, r: 70 },
  { id: 'deskR', label: 'Scrivania', x: 1180, y: 640, r: 70 },
  { id: 'door', label: 'Porta est', x: 1370, y: 340, r: 70 },
  { id: 'breaker', label: 'Quadro elettrico', x: 1055, y: 330, r: 70 },
];

export const LAMPS_IMG = [
  { x: 235, y: 610 },
  { x: 1185, y: 620 },
];
export const SPAWN_IMG = { x: 760, y: 760 };
export const KEY = 'room-control';
// ingresso tornando dal laboratorio (davanti alla porta est)
export const ENTRY_IMG = { x: 1280, y: 380 };
