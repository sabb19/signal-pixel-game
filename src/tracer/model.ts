// IRIS TRACER — modello di rete in stile Packet Tracer. Logica pura, coperta da tests/tracer.test.ts.
// Dispositivi (PC, server, switch, router) con interfacce vere, cavi tra porte, e un motore che fa
// viaggiare un pacchetto tappa per tappa esattamente come lo deciderebbero i dispositivi reali:
//   host: destinazione nella mia rete? consegna diretta : passa dal gateway
//   router: rete collegata (interfaccia accesa)? consegna : riga più precisa della tabella
//   switch: inoltra dentro il proprio segmento (livello 2), senza leggere gli indirizzi IP
import { parseIp, isValidMask, prefixOf, intToIp } from '../minigames/netdefender/logic';

export { parseIp, isValidMask, prefixOf, intToIp };
export type DevType = 'pc' | 'server' | 'switch' | 'router';

export interface Iface { name: string; ip?: string; mask?: string; up: boolean }
export interface Route { net: string; mask: string; via: string }
export interface Device {
  id: string; type: DevType; x: number; y: number; hostname: string;
  ifaces: Iface[]; gateway?: string; routes: Route[];
}
export interface Link { a: [string, string]; b: [string, string] }
export interface Net { devices: Device[]; links: Link[] }

export const netOf = (ip: string, mask: string) => ((parseIp(ip) ?? 0) & (parseIp(mask) ?? 0)) >>> 0;
export const same = (a: string, b: string, mask: string) => netOf(a, mask) === netOf(b, mask);

export function cloneNet(n: Net): Net { return JSON.parse(JSON.stringify(n)); }
export const dev = (n: Net, id: string) => n.devices.find((d) => d.id === id)!;
export const ifaceOf = (d: Device, name: string) => d.ifaces.find((i) => i.name === name);
export const isHost = (d: Device) => d.type === 'pc' || d.type === 'server';

export function peer(n: Net, d: string, i: string): [string, string] | null {
  for (const l of n.links) {
    if (l.a[0] === d && l.a[1] === i) return l.b;
    if (l.b[0] === d && l.b[1] === i) return l.a;
  }
  return null;
}

// un cavo "porta traffico" se entrambe le porte sono accese
export function linkUp(n: Net, l: Link): boolean {
  const a = ifaceOf(dev(n, l.a[0]), l.a[1]), b = ifaceOf(dev(n, l.b[0]), l.b[1]);
  return !!a?.up && !!b?.up;
}

// Il segmento di livello 2 raggiungibile uscendo da (d, i): attraversa gli switch.
// Restituisce le estremità (host e porte dei router) con il percorso di switch fatto per arrivarci.
export function segment(n: Net, d: string, i: string): { dev: string; iface: string; via: string[] }[] {
  const out: { dev: string; iface: string; via: string[] }[] = [];
  const start = ifaceOf(dev(n, d), i);
  if (!start?.up) return out;
  const seen = new Set<string>();
  const q: { at: [string, string]; via: string[] }[] = [];
  const p = peer(n, d, i);
  if (p) q.push({ at: p, via: [] });
  while (q.length) {
    const { at, via } = q.shift()!;
    const D = dev(n, at[0]), I = ifaceOf(D, at[1]);
    if (!I?.up || seen.has(at.join(':'))) continue;
    seen.add(at.join(':'));
    if (D.type !== 'switch') { out.push({ dev: D.id, iface: I.name, via }); continue; }
    for (const other of D.ifaces) {
      if (other.name === I.name || !other.up) continue;
      const nx = peer(n, D.id, other.name);
      if (nx) q.push({ at: nx, via: [...via, D.id] });
    }
  }
  return out;
}

export type Fail = 'noip' | 'nogw' | 'gwout' | 'noroute' | 'down' | 'arp' | 'ttl' | 'badip';
export interface Hop { dev: string; note: string }
export type Leg = { ok: true; hops: Hop[]; path: string[] } | { ok: false; hops: Hop[]; path: string[]; at: string; reason: Fail };

// Il viaggio di un pacchetto da un dispositivo a un indirizzo IP.
// hops = le decisioni (per la modalità Simulazione); path = tutti i dispositivi attraversati, switch compresi.
export function trace(n: Net, fromId: string, dst: string): Leg {
  const hops: Hop[] = [], path: string[] = [fromId];
  const fail = (at: string, reason: Fail, note: string): Leg => { hops.push({ dev: at, note }); return { ok: false, hops, path, at, reason }; };
  if (parseIp(dst) === null) return fail(fromId, 'badip', `${dst} non è un indirizzo valido`);
  let cur = dev(n, fromId);
  for (let ttl = 12; ttl > 0; ttl--) {
    if (cur.ifaces.some((i) => i.up && i.ip === dst)) { hops.push({ dev: cur.id, note: `${dst} è un mio indirizzo: arrivato` }); return { ok: true, hops, path }; }
    let nextIp: string, egress: Iface | undefined;
    if (isHost(cur)) {
      const nic = cur.ifaces[0];
      if (!nic.ip || !nic.mask) return fail(cur.id, 'noip', `${cur.hostname} non ha un indirizzo IP`);
      if (same(nic.ip, dst, nic.mask)) { nextIp = dst; hops.push({ dev: cur.id, note: `${dst} è nella mia rete: consegna diretta` }); }
      else if (!cur.gateway) return fail(cur.id, 'nogw', `${dst} è fuori dalla mia rete e non ho un gateway`);
      else if (!same(nic.ip, cur.gateway, nic.mask)) return fail(cur.id, 'gwout', `il gateway ${cur.gateway} non è nella mia rete`);
      else { nextIp = cur.gateway; hops.push({ dev: cur.id, note: `${dst} è fuori dalla mia rete: lo affido al gateway ${cur.gateway}` }); }
      egress = nic;
    } else {
      const conn = cur.ifaces.find((i) => i.up && i.ip && i.mask && same(i.ip, dst, i.mask));
      if (conn) { nextIp = dst; egress = conn; hops.push({ dev: cur.id, note: `rete ${intToIp(netOf(dst, conn.mask!))} collegata: esco da ${conn.name}` }); }
      else {
        let best: Route | null = null;
        for (const r of cur.routes) if (netOf(dst, r.mask) === netOf(r.net, r.mask) && (!best || prefixOf(r.mask) > prefixOf(best.mask))) best = r;
        if (!best) return fail(cur.id, 'noroute', `nessuna strada verso ${dst} nella tabella`);
        nextIp = best.via;
        egress = cur.ifaces.find((i) => i.up && i.ip && i.mask && same(i.ip, best!.via, i.mask));
        if (!egress) return fail(cur.id, 'noroute', `la strada passa da ${best.via}, ma nessuna interfaccia accesa è in quella rete`);
        hops.push({ dev: cur.id, note: `tabella: ${best.net}/${prefixOf(best.mask)} via ${best.via}, esco da ${egress.name}` });
      }
    }
    const pe = peer(n, cur.id, egress.name);
    if (!pe) return fail(cur.id, 'down', `nessun cavo collegato a ${egress.name}`);
    const l = n.links.find((x) => (x.a[0] === cur.id && x.a[1] === egress!.name) || (x.b[0] === cur.id && x.b[1] === egress!.name))!;
    if (!linkUp(n, l)) return fail(cur.id, 'down', `il collegamento su ${egress.name} è spento`);
    const seg = segment(n, cur.id, egress.name);
    const t = seg.find((e) => ifaceOf(dev(n, e.dev), e.iface)?.ip === nextIp);
    if (!t) return fail(cur.id, 'arp', `nessuno risponde all'indirizzo ${nextIp} nel segmento`);
    path.push(...t.via, t.dev);
    cur = dev(n, t.dev);
  }
  return fail(cur.id, 'ttl', 'il pacchetto gira in tondo: contatore di salti a zero');
}

export interface Ping { ok: boolean; go: Leg; back?: Leg }
export function ping(n: Net, fromId: string, dst: string): Ping {
  const go = trace(n, fromId, dst);
  if (!go.ok) return { ok: false, go };
  const target = go.path[go.path.length - 1];
  const src = dev(n, fromId);
  const srcIp = isHost(src) ? src.ifaces[0].ip! : (src.ifaces.find((i) => i.up && i.ip) ?.ip ?? '');
  if (target === fromId) return { ok: true, go };
  const back = trace(n, target, srcIp);
  return { ok: back.ok, go, back };
}

// rotta: controlli che distinguono sintassi (esecuzione) e concetto (comprensione)
export function checkIfaceIp(ip: string, mask: string): string | null {
  if (parseIp(ip) === null) return 'Indirizzo non valido: 4 numeri da 0 a 255 separati da punti.';
  if (!isValidMask(mask)) return 'Maschera non valida (es. 255.255.255.0).';
  const host = (parseIp(ip)! & ~parseIp(mask)!) >>> 0, bcast = (~parseIp(mask)!) >>> 0;
  if (host === 0) return `${ip} è l'indirizzo della rete stessa, non di un dispositivo.`;
  if (host === bcast) return `${ip} è l'indirizzo di broadcast della rete, non di un dispositivo.`;
  return null;
}

export function usedIps(n: Net): string[] {
  return n.devices.flatMap((d) => d.ifaces.map((i) => i.ip).filter((x): x is string => !!x));
}
