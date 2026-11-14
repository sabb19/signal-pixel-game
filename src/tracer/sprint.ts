// SUBNET SPRINT — generatore di domande (logica pura, testata).
import { intToIp, parseIp } from './model';

export interface Q { net: string; prefix: number; ip: string; inside: boolean; first: string; last: string }

export function makeQuestion(rnd = Math.random): Q {
  const prefix = [24, 24, 25, 26, 27, 28, 16][Math.floor(rnd() * 7)];
  const size = 2 ** (32 - prefix);
  const base = prefix === 16 ? (parseIp(`10.${10 + Math.floor(rnd() * 80)}.0.0`)! >>> 0)
    : (parseIp(`192.168.${1 + Math.floor(rnd() * 200)}.0`)! + size * Math.floor(rnd() * (256 / Math.min(size, 256)))) >>> 0;
  const inside = rnd() < 0.5;
  let ip: number;
  if (inside) ip = base + 1 + Math.floor(rnd() * (size - 2));
  else {
    // fuori, ma vicino: il trabocchetto è il bordo della rete
    const near = rnd() < 0.6;
    ip = near ? (rnd() < 0.5 ? base + size + Math.floor(rnd() * 20) : base - 1 - Math.floor(rnd() * 20)) : base + size * (2 + Math.floor(rnd() * 3)) + 5;
  }
  return { net: intToIp(base), prefix, ip: intToIp(ip >>> 0), inside, first: intToIp(base), last: intToIp((base + size - 1) >>> 0) };
}

