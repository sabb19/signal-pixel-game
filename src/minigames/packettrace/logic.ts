// PACKET TRACE — logica pura (nessuna dipendenza da Phaser), coperta da tests/packettrace.test.ts.
// Rete di prova sul banco del laboratorio: la strada dalla console all'antenna.
//   CONSOLE 10.0.10.21 — R1 (10.0.10.1 | 10.0.30.1) — R2 (10.0.30.2 | 10.0.40.1) — ANTENNA 10.0.40.5
// Ogni router decide il passo successivo leggendo la propria tabella (vince la riga più precisa).
// Un ping riesce solo se arrivano sia l'andata sia il ritorno.
import { parseIp, isValidMask, prefixOf, intToIp } from '../netdefender/logic';

export interface Route { net: string; mask: string; via: string }
export interface Iface { ip: string; mask: string }
export interface Router { name: string; ifaces: Iface[]; routes: Route[] }
export interface Host { name: string; ip: string; mask: string; gateway: string }
export interface Net { hosts: Host[]; routers: Router[] }

export interface Hop { node: string; note: string }
export type Leg =
  | { ok: true; hops: Hop[] }
  | { ok: false; hops: Hop[]; at: string; reason: 'noroute' | 'nexthop' | 'ttl' | 'nohost' | 'gateway' };

const TTL = 8;
const net = (ip: string, mask: string) => ((parseIp(ip) ?? 0) & (parseIp(mask) ?? 0)) >>> 0;
const same = (a: string, b: string, mask: string) => net(a, mask) === net(b, mask);

export function cloneNet(n: Net): Net {
  return {
    hosts: n.hosts.map((h) => ({ ...h })),
    routers: n.routers.map((r) => ({ name: r.name, ifaces: r.ifaces.map((i) => ({ ...i })), routes: r.routes.map((x) => ({ ...x })) })),
  };
}

function nodeByIp(n: Net, ip: string): { kind: 'host'; h: Host } | { kind: 'router'; r: Router } | null {
  const h = n.hosts.find((x) => x.ip === ip);
  if (h) return { kind: 'host', h };
  const r = n.routers.find((x) => x.ifaces.some((i) => i.ip === ip));
  return r ? { kind: 'router', r } : null;
}

// La decisione di un router: rete collegata direttamente, oppure la riga della tabella più precisa.
export function lookup(r: Router, dst: string): { direct: true } | { direct: false; via: string; route: Route } | null {
  if (r.ifaces.some((i) => same(i.ip, dst, i.mask))) return { direct: true };
  let best: Route | null = null;
  for (const rt of r.routes) {
    if (net(dst, rt.mask) === net(rt.net, rt.mask) && (!best || prefixOf(rt.mask) > prefixOf(best.mask))) best = rt;
  }
  return best ? { direct: false, via: best.via, route: best } : null;
}

// Il viaggio di un pacchetto da un host a un indirizzo, tappa per tappa.
export function trace(n: Net, from: string, dst: string): Leg {
  const src = n.hosts.find((h) => h.name === from)!;
  const hops: Hop[] = [{ node: src.name, note: `parte da ${src.ip}` }];
  const deliver = (): Leg => {
    const t = nodeByIp(n, dst);
    if (!t) return { ok: false, hops, at: hops[hops.length - 1].node, reason: 'nohost' };
    hops.push({ node: t.kind === 'host' ? t.h.name : t.r.name, note: 'arrivato' });
    return { ok: true, hops };
  };
  if (same(src.ip, dst, src.mask)) return deliver();
  const gw = nodeByIp(n, src.gateway);
  if (!gw || gw.kind !== 'router' || !same(src.ip, src.gateway, src.mask)) return { ok: false, hops, at: src.name, reason: 'gateway' };
  let r = gw.r;
  for (let ttl = TTL; ttl > 0; ttl--) {
    if (r.ifaces.some((i) => i.ip === dst)) { hops.push({ node: r.name, note: 'arrivato' }); return { ok: true, hops }; }
    const d = lookup(r, dst);
    if (!d) { hops.push({ node: r.name, note: 'nessuna strada' }); return { ok: false, hops, at: r.name, reason: 'noroute' }; }
    if (d.direct) { hops.push({ node: r.name, note: 'consegna nella sua rete' }); return deliver(); }
    hops.push({ node: r.name, note: `verso ${d.via}` });
    const next = nodeByIp(n, d.via);
    if (!next || next.kind !== 'router') return { ok: false, hops, at: r.name, reason: 'nexthop' };
    r = next.r;
  }
  return { ok: false, hops, at: r.name, reason: 'ttl' };
}

export interface PingResult { ok: boolean; go: Leg; back?: Leg }

// Andata e ritorno: la risposta parte dalla destinazione e deve ritrovare la strada da sola.
export function ping(n: Net, from: string, dst: string): PingResult {
  const go = trace(n, from, dst);
  if (!go.ok) return { ok: false, go };
  const target = n.hosts.find((h) => h.ip === dst);
  if (!target) return { ok: true, go }; // un router risponde da sé: in questa rete conosce sempre le sue reti
  const src = n.hosts.find((h) => h.name === from)!;
  const back = trace(n, target.name, src.ip);
  return { ok: back.ok, go, back };
}

// --- Comandi sulle tabelle: distinguono errori di esecuzione e di comprensione
export type Check = { ok: true } | { ok: false; kind: 'esecuzione' | 'comprensione'; msg: string };

export function checkRoute(r: Router, rt: Route): Check {
  for (const [v, what] of [[rt.net, 'La rete'], [rt.mask, 'La maschera'], [rt.via, 'Il prossimo salto']] as const) {
    if (parseIp(v) === null) return { ok: false, kind: 'esecuzione', msg: `${what} non è scritta bene. Uso: ip route RETE MASCHERA PROSSIMO-SALTO (es. ip route 10.0.40.0 255.255.255.0 10.0.30.2)` };
  }
  if (rt.mask !== '0.0.0.0' && !isValidMask(rt.mask)) return { ok: false, kind: 'esecuzione', msg: 'Maschera non valida: i bit a 1 devono stare tutti a sinistra (es. 255.255.255.0).' };
  if (net(rt.net, rt.mask) !== (parseIp(rt.net) ?? 0)) return { ok: false, kind: 'comprensione', msg: `${rt.net} non è l'inizio di una rete con maschera ${rt.mask}. La rete si scrive con gli ultimi numeri a zero: ${intToIp(net(rt.net, rt.mask))}.` };
  if (r.ifaces.some((i) => i.ip === rt.via)) return { ok: false, kind: 'comprensione', msg: `${rt.via} è ${r.name} stesso. Il prossimo salto è il router VICINO a cui passare il pacchetto.` };
  if (!r.ifaces.some((i) => same(i.ip, rt.via, i.mask))) return { ok: false, kind: 'comprensione', msg: `${r.name} non tocca la rete di ${rt.via}: non può consegnargli niente. Il prossimo salto deve stare in una rete collegata a ${r.name}.` };
  if (r.ifaces.some((i) => same(i.ip, rt.net, i.mask) && i.mask === rt.mask)) return { ok: false, kind: 'comprensione', msg: `${r.name} è già collegato direttamente alla rete ${rt.net}: non serve una strada.` };
  return { ok: true };
}

export function addRoute(r: Router, rt: Route) {
  r.routes = r.routes.filter((x) => !(x.net === rt.net && x.mask === rt.mask));
  r.routes.push(rt);
}

export function removeRoute(r: Router, netS: string, mask: string): boolean {
  const before = r.routes.length;
  r.routes = r.routes.filter((x) => !(x.net === netS && x.mask === mask));
  return r.routes.length < before;
}

// --- La rete del banco e le missioni
export const CONSOLE = 'CONSOLE';
export const ANT_IP = '10.0.40.5';
export const R2_NEAR = '10.0.30.2';
export const R1_NEAR = '10.0.30.1';
export const NODE_X = '10.0.30.99';

function baseNet(): Net {
  return {
    hosts: [
      { name: 'CONSOLE', ip: '10.0.10.21', mask: '255.255.255.0', gateway: '10.0.10.1' },
      { name: 'ANTENNA', ip: ANT_IP, mask: '255.255.255.0', gateway: '10.0.40.1' },
    ],
    routers: [
      { name: 'R1', ifaces: [{ ip: '10.0.10.1', mask: '255.255.255.0' }, { ip: R1_NEAR, mask: '255.255.255.0' }], routes: [{ net: '10.0.40.0', mask: '255.255.255.0', via: R2_NEAR }] },
      { name: 'R2', ifaces: [{ ip: R2_NEAR, mask: '255.255.255.0' }, { ip: '10.0.40.1', mask: '255.255.255.0' }], routes: [{ net: '10.0.10.0', mask: '255.255.255.0', via: R1_NEAR }] },
    ],
  };
}

export interface Mission {
  id: number;
  title: string;
  brief: string[];
  goal: string;
  net: Net;
  hints: [string, string, string];
  done: (n: Net, pinged: boolean) => boolean;
}

export function makeMissions(): Mission[] {
  const m1 = baseNet(); m1.routers[0].routes = [];
  const m2 = baseNet(); m2.routers[1].routes = [];
  const m3 = baseNet(); m3.routers[0].routes = [{ net: '0.0.0.0', mask: '0.0.0.0', via: NODE_X }];
  const pingOk = (n: Net) => ping(n, CONSOLE, ANT_IP).ok;
  return [
    {
      id: 1, title: 'LA STRADA', net: m1,
      brief: [
        'IRIS: Sul banco ho ricostruito la strada tra la console e l\'antenna. Due router in mezzo: R1 e R2.',
        'IRIS: I messaggi non viaggiano interi. Vengono spezzati in pacchetti, e ogni pacchetto fa la strada da solo.',
        'IRIS: A ogni incrocio un router legge la sua tabella: "per andare lì, passa da lui". Se la riga non c\'è, il pacchetto si ferma.',
        'MYRA: Come chiedere la strada a ogni incrocio.',
      ],
      goal: 'Fai arrivare un ping dalla CONSOLE all\'ANTENNA (10.0.40.5).',
      hints: [
        'Guarda dove si ferma il pacchetto con  traceroute 10.0.40.5.',
        'Il router dove si ferma non ha una riga per la rete 10.0.40.0. Il suo vicino verso l\'antenna è R2, 10.0.30.2.',
        'Su R1:  ip route 10.0.40.0 255.255.255.0 10.0.30.2  poi  ping 10.0.40.5.',
      ],
      done: (n, p) => p && pingOk(n),
    },
    {
      id: 2, title: 'IL RITORNO', net: m2,
      brief: [
        'IRIS: Seconda prova. Questa volta il pacchetto arriva all\'antenna. Ma la risposta non torna mai.',
        'MYRA: Arriva e basta non serve?',
        'IRIS: No. Una conversazione è andata e ritorno. La risposta fa un viaggio tutto suo, e ogni router decide di nuovo.',
      ],
      goal: 'La risposta dell\'ANTENNA deve tornare alla CONSOLE (10.0.10.21).',
      hints: [
        'Il ping mostra due viaggi: l\'andata e il ritorno. Guarda dove si ferma il ritorno.',
        'R2 non sa come raggiungere la rete della console, 10.0.10.0. Il suo vicino verso la console è R1, 10.0.30.1.',
        'Su R2:  ip route 10.0.10.0 255.255.255.0 10.0.30.1  poi  ping 10.0.40.5.',
      ],
      done: (n, p) => p && pingOk(n),
    },
    {
      id: 3, title: 'VERIFICA · IL NODO SCONOSCIUTO', net: m3,
      brief: [
        'IRIS: Ultima prova. Ho copiato sul banco la tabella di R1 così come l\'ho trovata nella stazione.',
        'IRIS: Questa volta non ti guido. Trova la riga sbagliata, toglila, e rimetti la strada giusta.',
      ],
      goal: 'Trova la riga sbagliata di R1, toglila con  no ip route ...  e ripristina la strada verso l\'antenna.',
      hints: [
        'Leggi la tabella di R1 con  usa R1  e  show ip route. Dove manda i pacchetti?',
        `La riga 0.0.0.0 0.0.0.0 vale per QUALSIASI destinazione. Manda tutto a ${NODE_X}, che non è nessuno dei nostri router.`,
        `Su R1:  no ip route 0.0.0.0 0.0.0.0 ${NODE_X}  poi  ip route 10.0.40.0 255.255.255.0 10.0.30.2  e un ping.`,
      ],
      done: (n, p) => p && pingOk(n) && !n.routers[0].routes.some((r) => r.via === NODE_X),
    },
  ];
}
