import { describe, it, expect } from 'vitest';
import { makeMissions, runTests, decide, moveRule, shadowedBy, cloneRules } from '../src/minigames/firewall/logic';

const m = makeMissions();
const allOk = (i: number, rules = cloneRules(m[i].rules)) => runTests(rules, m[i].reqs).every((t) => t.ok);

describe('firewall', () => {
  it('nessuna missione è già risolta all\'inizio', () => {
    [0, 1, 2].forEach((i) => expect(allOk(i)).toBe(false));
  });

  it('missione 1: protocollo giusto e azione giusta', () => {
    const r = cloneRules(m[0].rules);
    r[1].proto = 'UDP';
    expect(allOk(0, r)).toBe(false);
    r[2].action = 'PERMETTI';
    expect(allOk(0, r)).toBe(true);
  });

  it('missione 2: la regola larga in cima nasconde le altre; spostarla in fondo risolve', () => {
    const r = cloneRules(m[1].rules);
    expect(shadowedBy(r, 1)).toBe(0);
    let i = 0;
    i = moveRule(r, i, 1); i = moveRule(r, i, 1); i = moveRule(r, i, 1);
    expect(i).toBe(3);
    expect(moveRule(r, i, 1)).toBe(3); // il "blocca tutto" finale non si sposta
    expect(allOk(1, r)).toBe(true);
  });

  it('missione 2: togliere il blocco UDP rendendolo PERMETTI lascia passare NODE-X', () => {
    const r = cloneRules(m[1].rules);
    r[0].action = 'PERMETTI';
    expect(allOk(1, r)).toBe(false);
  });

  it('missione 3: la porta 53 verso tutti lascia uscire NODE-X; restringere al DNS risolve', () => {
    const r = cloneRules(m[2].rules);
    const nodex = m[2].reqs[3].packet;
    expect(decide(r, nodex)).toEqual({ action: 'PERMETTI', by: 2 });
    r[2].dst = 'DNS';
    expect(decide(r, nodex)).toEqual({ action: 'BLOCCA', by: 3 });
    expect(allOk(2, r)).toBe(true);
  });
});
