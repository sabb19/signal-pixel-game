// Sala Comunicazioni — sfondo illustrato: public/assets/rooms/comms.png (1536×864). Coordinate in pixel DELL'IMMAGINE.
export const KEY = 'room-comms';
export const ROOM_SCALE = 0.5;
export const ROOM_W = 1536;
export const ROOM_H = 864;

type Rect = [number, number, number, number];

export const BLOCKERS: Rect[] = [
  [160, 0, 1010, 402],          // armadi e porta blindata
  [1170, 0, 366, 392],          // parete destra con finestra
  [40, 0, 160, 405],            // parete sinistra sopra la porta
  [0, 0, 40, 864],              // bordo sinistro
  [0, 520, 175, 344],           // casse
  [75, 605, 235, 259],
  [0, 700, 395, 164],
  [1145, 392, 391, 238],        // postazione
  [1340, 600, 196, 264],        // cassettiera
  [1195, 640, 115, 120],        // sgabello
  [0, 842, 1536, 22],           // bordo inferiore
];
export const DOOR_BLOCK: Rect = [0, 0, 0, 0];

export const OCCLUDERS: { rect: Rect; baseY: number }[] = [
  { rect: [0, 515, 400, 349], baseY: 864 },     // casse
];

export const SPOTS: { id: string; label: string; x: number; y: number; r: number }[] = [
  { id: 'gate', label: 'Porta blindata', x: 700, y: 440, r: 90 },
  { id: 'racks', label: 'Armadi di rete', x: 400, y: 440, r: 90 },
  { id: 'patch', label: 'Armadi con i cavi', x: 1000, y: 440, r: 80 },
  { id: 'desk', label: 'Postazione', x: 1100, y: 560, r: 85 },
  { id: 'crates', label: 'Casse', x: 440, y: 660, r: 75 },
  { id: 'back', label: 'Laboratorio', x: 150, y: 470, r: 60 },
];

export const LAMPS_IMG = [{ x: 1360, y: 400 }, { x: 700, y: 90 }];
export const SPAWN_IMG = { x: 210, y: 470 };
export const ENTRY_IMG = { x: 210, y: 470 };
