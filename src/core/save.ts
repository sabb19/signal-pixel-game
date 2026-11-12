// Salvataggio su localStorage. Ogni accesso è protetto: in navigazione privata può fallire.
export interface SaveData {
  act: number;
  flags: Record<string, boolean | number>;
  room: string;
  x: number;
  y: number;
}

const KEY = 'signal.save.v1';

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* salvataggio non disponibile: il gioco continua */
  }
}

export function clearSave(): void {
  try { localStorage.removeItem(KEY); } catch { /* niente */ }
}
