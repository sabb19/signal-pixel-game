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

// --- Punti esperienza, distintivi, record delle sfide lampo
const XKEY = 'signal.tracer.extra.v1';
interface Extra { xp: number; badges: string[]; sprint: number }
function loadExtra(): Extra {
  try { return { xp: 0, badges: [], sprint: 0, ...(JSON.parse(localStorage.getItem(XKEY) ?? '{}') as Partial<Extra>) }; } catch { return { xp: 0, badges: [], sprint: 0 }; }
}
function saveExtra(e: Extra) { try { localStorage.setItem(XKEY, JSON.stringify(e)); } catch { /* niente */ } }
export function totalXp() { return loadExtra().xp; }
export function addXp(n: number) { const e = loadExtra(); e.xp += n; saveExtra(e); }
export function badges() { return loadExtra().badges; }
// restituisce true se il distintivo è nuovo
export function earnBadge(id: string): boolean { const e = loadExtra(); if (e.badges.includes(id)) return false; e.badges.push(id); saveExtra(e); return true; }
export function sprintBest() { return loadExtra().sprint; }
export function recordSprint(score: number): boolean { const e = loadExtra(); if (score <= e.sprint) return false; e.sprint = score; saveExtra(e); return true; }

export const BADGES: Record<string, { name: string; desc: string }> = {
  'primo-ping': { name: 'Primo ping', desc: 'Il tuo primo ping riuscito' },
  'zero-aiuti': { name: 'Zero aiuti', desc: 'Livello completato senza aiuti' },
  'serie-5': { name: 'Mano ferma', desc: '5 comandi giusti di fila' },
  'contrattacco': { name: 'Più veloce di SILENCE', desc: 'Riparato un attacco in meno di 20 secondi' },
  'esperto': { name: 'Esperto di rete', desc: 'Un livello completato in modalità Esperto' },
  'sprint-20': { name: 'Subnet master', desc: '20 punti in Subnet Sprint' },
};
