import { describe, it, expect } from 'vitest';
import { makeLevel, Difficulty } from '../src/tracer/levels';
import { runRouter, runPc, CliState } from '../src/tracer/cli';
import { dev, ping } from '../src/tracer/model';

// lo stato della CLI resta per dispositivo, come nel gioco
const states = new WeakMap<object, Record<string, CliState>>();
const run = (lv: ReturnType<typeof makeLevel>, id: string, cmds: string[]) => {
  const all = states.get(lv.net) ?? {}; states.set(lv.net, all);
  const st: CliState = (all[id] ??= { mode: 'user' });
  const d = dev(lv.net, id);
  for (const c of cmds) (d.type === 'router' ? runRouter(lv.net, d, st, c) : runPc(lv.net, d, c));
};
const allDone = (lv: ReturnType<typeof makeLevel>) => lv.objectives.every((o) => o.check(lv.net));
const diffs: Difficulty[] = ['studente', 'junior', 'esperto'];

describe('iris tracer', () => {
  it('nessun livello è già risolto', () => {
    for (const id of ['1.1', '1.2', '1.3']) for (const d of diffs) expect(allDone(makeLevel(id, d))).toBe(false);
  });

  it('1.1: i comandi della guida risolvono il livello, a ogni difficoltà', () => {
    for (const d of diffs) {
      const lv = makeLevel('1.1', d);
      lv.guide.forEach((g) => run(lv, g.device!, [g.cmd!]));
      expect(allDone(lv)).toBe(true);
    }
  });

  it('1.2 studente: la guida basta; junior/esperto servono anche gli altri guasti', () => {
    const lv = makeLevel('1.2', 'studente');
    lv.guide.forEach((g) => run(lv, g.device!, [g.cmd!]));
    expect(allDone(lv)).toBe(true);
    const ex = makeLevel('1.2', 'esperto');
    const A = ex.objectives[0].text.match(/192\.168\.(\d+)\.1/)![1];
    run(ex, 'r1', ['en', 'conf t', 'int g0/0', `ip add 192.168.${A}.1 255.255.255.0`, 'no shut', 'int g0/1', 'no shut']);
    expect(allDone(ex)).toBe(false); // manca il gateway del PC
    run(ex, 'pc0', [`ipconfig 192.168.${A}.10 255.255.255.0 192.168.${A}.1`]);
    expect(allDone(ex)).toBe(true);
  });

  it('1.3: una sola rotta non basta (manca il ritorno)', () => {
    const lv = makeLevel('1.3', 'studente');
    const g = lv.guide;
    run(lv, 'r1', ['enable', 'configure terminal', g[4].cmd!]);
    const target = g[0].cmd!.split(' ')[1];
    const p = ping(lv.net, 'pc0', target);
    expect(p.go.ok).toBe(true);
    expect(p.ok).toBe(false);
    run(lv, 'r2', ['enable', 'configure terminal', g[7].cmd!]);
    expect(allDone(lv)).toBe(true);
  });

  it('la CLI rispetta le modalità IOS', () => {
    const lv = makeLevel('1.2', 'studente');
    const r = dev(lv.net, 'r1'), st: CliState = { mode: 'user' };
    expect(runRouter(lv.net, r, st, 'conf t').lines[0].kind).toBe('err');
    runRouter(lv.net, r, st, 'en'); expect(st.mode).toBe('priv');
    runRouter(lv.net, r, st, 'conf t'); expect(st.mode).toBe('config');
    runRouter(lv.net, r, st, 'int gig0/0'); expect(st.mode).toBe('if');
    expect(runRouter(lv.net, r, st, 'ip address 192.168.1.0 255.255.255.0').event).toBe('concept-error');
    runRouter(lv.net, r, st, 'end'); expect(st.mode).toBe('priv');
  });
});
