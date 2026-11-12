import { describe, it, expect } from 'vitest';
import { ping, checkSet, isValidMask, makeMissions, Device, ROUTER_LOCAL, ARCHIVE } from '../src/minigames/netdefender/logic';

const d = (ip: string, mask: string, gateway: string, link = true): Device => ({ name: 'X', ip, mask, gateway, link });

describe('Network Defender', () => {
  it('maschere valide e non valide', () => {
    expect(isValidMask('255.255.255.0')).toBe(true);
    expect(isValidMask('255.255.0.0')).toBe(true);
    expect(isValidMask('255.0.255.0')).toBe(false);
  });
  it('gateway in un\'altra rete: il ping al router fallisce, corretto riesce', () => {
    expect(ping(d('10.0.10.21', '255.255.255.0', '10.0.20.1'), ARCHIVE).ok).toBe(false);
    expect(ping(d('10.0.10.21', '255.255.255.0', ROUTER_LOCAL), ROUTER_LOCAL).ok).toBe(true);
    expect(ping(d('10.0.10.21', '255.255.255.0', ROUTER_LOCAL), ARCHIVE).ok).toBe(true);
  });
  it('maschera troppo larga: l\'archivio viene cercato in locale e non risponde', () => {
    const r = ping(d('10.0.10.32', '255.255.0.0', ROUTER_LOCAL), ARCHIVE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('noarp');
  });
  it('cavo scollegato: fallisce anche con configurazione corretta', () => {
    const r = ping(d('10.0.10.40', '255.255.255.0', ROUTER_LOCAL, false), ROUTER_LOCAL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('nolink');
  });
  it('distingue errore di esecuzione e di comprensione', () => {
    const c = d('10.0.10.21', '255.255.255.0', '10.0.20.1');
    expect(checkSet(c, 'gateway', '10.0.10')).toMatchObject({ ok: false, kind: 'esecuzione' });
    expect(checkSet(c, 'gateway', '10.0.30.1')).toMatchObject({ ok: false, kind: 'comprensione' });
    expect(checkSet(c, 'gateway', '10.0.10.21')).toMatchObject({ ok: false, kind: 'comprensione' });
    expect(checkSet(c, 'gateway', '10.0.10.1')).toEqual({ ok: true });
  });
  it('le missioni non si risolvono senza verifica', () => {
    const [m1] = makeMissions();
    const devs = m1.devices.map((x) => ({ ...x, gateway: ROUTER_LOCAL }));
    expect(m1.done(devs, new Set())).toBe(false);
    expect(m1.done(devs, new Set([`CONSOLE-SC>${ROUTER_LOCAL}`]))).toBe(true);
  });
});
