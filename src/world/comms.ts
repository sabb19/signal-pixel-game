// Sala Comunicazioni — dove passa tutto il traffico verso l'antenna. Qui sta il filtro (firewall).
// Sfondo generato: public/assets/rooms/comms.png (1536×864). Coordinate in pixel DELL'IMMAGINE.
export const KEY = 'room-comms';
export const ROOM_SCALE = 0.5;
export const ROOM_W = 1536;
export const ROOM_H = 864;

type Rect = [number, number, number, number];

export const BLOCKERS: Rect[] = [
  [210, 0, 680, 428],           // armadi di sinistra e porta blindata
  [890, 0, 270, 445],           // pannello dei cavi e armadio destro
  [1160, 0, 376, 400],          // parete destra con finestra
  [0, 0, 210, 415],             // parete sinistra sopra la porta
  [0, 525, 60, 339],            // parete sinistra sotto la porta
  [0, 552, 282, 312],           // casse grandi
  [215, 688, 205, 176],         // casse piccole
  [1170, 395, 366, 165],        // postazione
  [1355, 540, 181, 250],        // cassettiera
  [1480, 540, 56, 324],         // armadietto a destra
  [0, 840, 1536, 24],           // bordo inferiore
];
export const DOOR_BLOCK: Rect = [0, 0, 0, 0];

export const OCCLUDERS: { rect: Rect; baseY: number }[] = [
  { rect: [0, 545, 422, 319], baseY: 690 },     // casse
  { rect: [1168, 378, 368, 182], baseY: 560 },  // postazione
  { rect: [1355, 540, 181, 260], baseY: 790 },  // cassettiera
];

export const SPOTS: { id: string; label: string; x: number; y: number; r: number }[] = [
  { id: 'gate', label: 'Porta blindata', x: 768, y: 470, r: 90 },
  { id: 'racks', label: 'Armadi di rete', x: 440, y: 470, r: 90 },
  { id: 'patch', label: 'Pannello dei cavi', x: 1020, y: 485, r: 80 },
  { id: 'desk', label: 'Postazione', x: 1240, y: 600, r: 80 },
  { id: 'crates', label: 'Casse', x: 340, y: 600, r: 70 },
  { id: 'back', label: 'Laboratorio', x: 150, y: 470, r: 60 },
];

export const LAMPS_IMG = [{ x: 1350, y: 430 }, { x: 768, y: 160 }];
export const SPAWN_IMG = { x: 230, y: 475 };
export const ENTRY_IMG = { x: 230, y: 475 };
