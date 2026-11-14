// Progressi del simulatore IRIS: stelle migliori per livello e difficoltà (localStorage, protetto).
import type { Difficulty } from './levels';

const KEY = 'signal.tracer.v1';
type Stars = Record<string, number>;

export function loadStars(): Stars {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Stars; } catch { return {}; }
}

export function recordStars(level: string, diff: Difficulty, stars: number) {
  const s = loadStars();
  const k = `${level}:${diff}`;
  if ((s[k] ?? 0) >= stars) return;
  s[k] = stars;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* niente */ }
}

export function totalStars(): number { return Object.values(loadStars()).reduce((a, b) => a + b, 0); }

// gradi: la progressione visibile del giocatore
export function rank(total: number): { name: string; next?: number } {
  const ranks: [number, string][] = [[0, 'Recluta'], [4, 'Operatore'], [10, 'Tecnico di rete'], [18, 'Analista'], [25, 'Difensore']];
  let cur = ranks[0][1], next: number | undefined;
  for (const [min, name] of ranks) { if (total >= min) cur = name; else { next = min; break; } }
  return { name: cur, next };
}
