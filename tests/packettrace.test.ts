import { describe, it, expect } from 'vitest';
import { makeMissions, ping, trace, checkRoute, addRoute, removeRoute, cloneNet, CONSOLE, ANT_IP, NODE_X } from '../src/minigames/packettrace/logic';

const fresh = (i: number) => cloneNet(makeMissions()[i].net);

describe('packet trace', () => {
  it('missione 1: il pacchetto si ferma su R1, una rotta lo sblocca', () => {
    const n = fresh(0);
    const t = trace(n, CONSOLE, ANT_IP);
    expect(t.ok).toBe(false);
    if (!t.ok) { expect(t.at).toBe('R1'); expect(t.reason).toBe('noroute'); }
    const rt = { net: '10.0.40.0', mask: '255.255.255.0', via: '10.0.30.2' };
    expect(checkRoute(n.routers[0], rt).ok).toBe(true);
    addRoute(n.routers[0], rt);
    expect(ping(n, CONSOLE, ANT_IP).ok).toBe(true);
  });

  it('missione 2: andata ok, ritorno fermo su R2', () => {
    const n = fresh(1);
    const p = ping(n, CONSOLE, ANT_IP);
    expect(p.go.ok).toBe(true);
    expect(p.ok).toBe(false);
    expect(p.back && !p.back.ok && p.back.at).toBe('R2');
    // correggere il router sbagliato non serve
    addRoute(n.routers[0], { net: '10.0.10.0', mask: '255.255.255.0', via: '10.0.30.2' });
    expect(ping(n, CONSOLE, ANT_IP).ok).toBe(false);
    addRoute(n.routers[1], { net: '10.0.10.0', mask: '255.255.255.0', via: '10.0.30.1' });
    expect(ping(n, CONSOLE, ANT_IP).ok).toBe(true);
  });

  it('missione 3: la default route manda verso un nodo sconosciuto', () => {
    const n = fresh(2);
    const t = trace(n, CONSOLE, ANT_IP);
    expect(!t.ok && t.reason).toBe('nexthop');
    expect(removeRoute(n.routers[0], '0.0.0.0', '0.0.0.0')).toBe(true);
    addRoute(n.routers[0], { net: '0.0.0.0', mask: '0.0.0.0', via: '10.0.30.2' });
    expect(ping(n, CONSOLE, ANT_IP).ok).toBe(true);
    expect(makeMissions()[2].done(n, true)).toBe(true);
    void NODE_X;
  });

  it('distingue errori di comprensione e di esecuzione', () => {
    const r1 = fresh(0).routers[0];
    expect(checkRoute(r1, { net: '10.0.40', mask: '255.255.255.0', via: '10.0.30.2' })).toMatchObject({ ok: false, kind: 'esecuzione' });
    expect(checkRoute(r1, { net: '10.0.40.0', mask: '255.255.255.0', via: '10.0.40.1' })).toMatchObject({ ok: false, kind: 'comprensione' });
    expect(checkRoute(r1, { net: '10.0.40.0', mask: '255.255.255.0', via: '10.0.30.1' })).toMatchObject({ ok: false, kind: 'comprensione' });
    expect(checkRoute(r1, { net: '10.0.40.5', mask: '255.255.255.0', via: '10.0.30.2' })).toMatchObject({ ok: false, kind: 'comprensione' });
  });

  it('un ciclo tra router termina con il contatore a zero', () => {
    const n = fresh(0);
    addRoute(n.routers[0], { net: '10.0.40.0', mask: '255.255.255.0', via: '10.0.30.2' });
    n.routers[1].routes.push({ net: '10.0.50.0', mask: '255.255.255.0', via: '10.0.30.1' });
    addRoute(n.routers[0], { net: '10.0.50.0', mask: '255.255.255.0', via: '10.0.30.2' });
    const t = trace(n, CONSOLE, '10.0.50.7');
    expect(!t.ok && t.reason).toBe('ttl');
  });
});
