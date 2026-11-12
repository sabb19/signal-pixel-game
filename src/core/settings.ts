// Impostazioni del giocatore, salvate nel browser (con protezione se lo storage non è disponibile).
export interface Settings {
  master: number;   // 0..10
  ambience: number; // 0..10
  music: number;    // 0..10
  sfx: number;      // 0..10
  textSpeed: 0 | 1 | 2; // lenta, normale, veloce
}

const KEY = 'signal.settings.v1';
const DEFAULTS: Settings = { master: 7, ambience: 6, music: 7, sfx: 7, textSpeed: 1 };

let current: Settings = (() => {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) }; }
  catch { return { ...DEFAULTS }; }
})();

const listeners: (() => void)[] = [];
export const settings = () => current;
export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* */ }
  listeners.forEach((f) => f());
}
export const onSettings = (f: () => void) => listeners.push(f);
// millisecondi per carattere nei testi
export const charDelay = () => [45, 28, 12][current.textSpeed];

export function isFullscreen() { return !!document.fullscreenElement; }
export function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  } catch { /* non supportato */ }
}
