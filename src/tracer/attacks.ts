// IRIS TRACER — le mosse di SILENCE durante un livello (Junior ed Esperto).
// Regola: SILENCE rompe solo qualcosa che in quel momento FUNZIONA, così ogni attacco è sensato,
// si vede nei sintomi (spie, ping, tabelle) e si ripara con gli stessi comandi del livello.
import { Net, Device, isHost } from './model';

export interface Attack {
  target: string;      // dispositivo colpito
  desc: string;        // cosa è successo (Junior)
  vague: string;       // avviso generico (Esperto)
  fixed: (n: Net) => boolean;
}

export function pickAttack(n: Net, rnd = Math.random): Attack | null {
  const moves: (() => Attack)[] = [];
  for (const d of n.devices) {
    if (d.type === 'router') {
      for (const i of d.ifaces.filter((x) => x.up && x.ip)) moves.push(() => {
        i.up = false;
        return { target: d.id, desc: `${d.hostname}: interfaccia ${i.name} spenta`, vague: `anomalia su ${d.hostname}`, fixed: () => i.up };
      });
      for (const r of [...d.routes]) moves.push(() => {
        d.routes = d.routes.filter((x) => x !== r);
        return { target: d.id, desc: `${d.hostname}: rotta verso ${r.net} cancellata`, vague: `anomalia su ${d.hostname}`,
          fixed: (net) => (net.devices.find((x) => x.id === d.id) as Device).routes.some((x) => x.net === r.net && x.mask === r.mask && x.via === r.via) };
      });
    }
    if (isHost(d) && d.ifaces[0].ip) {
      const nic = d.ifaces[0];
      if (d.gateway) {
        const good = d.gateway;
        moves.push(() => {
          d.gateway = good.replace(/\.\d+$/, '.254');
          return { target: d.id, desc: `${d.hostname}: gateway cambiato in ${d.gateway}`, vague: `anomalia su ${d.hostname}`, fixed: () => d.gateway === good };
        });
      } else if (nic.mask === '255.255.255.0') {
        moves.push(() => {
          nic.mask = '255.255.255.252';
          return { target: d.id, desc: `${d.hostname}: maschera cambiata in 255.255.255.252`, vague: `anomalia su ${d.hostname}`, fixed: () => nic.mask === '255.255.255.0' };
        });
      }
    }
  }
  if (!moves.length) return null;
  return moves[Math.floor(rnd() * moves.length)]();
}
