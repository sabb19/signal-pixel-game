export const VIEW_W = 640;
export const VIEW_H = 360;
export const TILE = 32;
// Debug solo in sviluppo e solo con ?debug nell'indirizzo
export const DEBUG = import.meta.env.DEV && new URLSearchParams(location.search).has('debug');
