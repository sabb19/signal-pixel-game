// IRIS TRACER — livelli. Ogni livello è una topologia diversa; ogni partita genera indirizzi nuovi
// (scenari dinamici). La difficoltà cambia guida, aiuti e numero di guasti:
//   studente: guida passo-passo con i comandi suggeriti · junior: solo obiettivi e aiuti (H)
//   esperto: guasti in più e nascosti, nessun aiuto, cronometro
import { Net, Device, Iface, ping, dev } from './model';

export type Difficulty = 'studente' | 'junior' | 'esperto';
// ping: l'obiettivo si completa solo quando il giocatore fa davvero quel ping (e riesce)
export interface Objective { text: string; check: (n: Net) => boolean; ping?: { from: string; ip: string } }
export interface GuideStep { text: string; cmd?: string; device?: string }
export interface Level {
  id: string; title: string; concept: string;
  brief: string[];
  net: Net;
  objectives: Objective[];
  guide: GuideStep[];
  hints: string[];
  parTime: number; // secondi per la terza stella
}

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const nic = (ip?: string, mask?: string): Iface => ({ name: 'f0', ip, mask, up: true });
const pc = (id: string, hostname: string, x: number, y: number, ip?: string, mask?: string, gateway?: string): Device =>
  ({ id, type: 'pc', x, y, hostname, ifaces: [nic(ip, mask)], gateway, routes: [] });
const sw = (id: string, hostname: string, x: number, y: number, ports: number): Device =>
  ({ id, type: 'switch', x, y, hostname, ifaces: Array.from({ length: ports }, (_, i) => ({ name: `f0/${i + 1}`, up: true })), routes: [] });
const rt = (id: string, hostname: string, x: number, y: number, ifaces: Iface[]): Device => ({ id, type: 'router', x, y, hostname, ifaces, routes: [] });
const M24 = '255.255.255.0', M30 = '255.255.255.252';
const pingOk = (from: string, ip: () => string) => (n: Net) => ping(n, from, ip()).ok;

export const LEVELS = [
  { id: '1.1', title: 'Due computer', concept: 'Indirizzi IP e maschera' },
  { id: '1.2', title: 'Il primo router', concept: 'Gateway e interfacce del router' },
  { id: '1.3', title: 'Due router', concept: 'Instradamento statico' },
];

export function makeLevel(id: string, diff: Difficulty): Level {
  const A = rnd(1, 9) * 10, B = A + rnd(1, 9), C = rnd(0, 60) * 4;
  if (id === '1.1') {
    const expert = diff === 'esperto';
    // esperto: la rete è divisa a metà (/25): bisogna scegliere un indirizzo nella metà giusta
    const mask = expert ? '255.255.255.128' : M24;
    const ip0 = expert ? `192.168.${A}.${rnd(140, 200)}` : `192.168.${A}.10`;
    const net: Net = {
      devices: [pc('pc0', 'PC0', 50, 70, ip0, mask), sw('sw0', 'Switch0', 160, 150, 4), pc('pc1', 'PC1', 270, 70)],
      links: [{ a: ['pc0', 'f0'], b: ['sw0', 'f0/1'] }, { a: ['pc1', 'f0'], b: ['sw0', 'f0/2'] }],
    };
    return {
      id, title: 'Due computer', concept: 'Indirizzi IP e maschera', net, parTime: expert ? 90 : 120,
      brief: [
        'IRIS: Simulazione 1. Due computer collegati allo stesso switch. Uno è configurato, l\'altro no.',
        'IRIS: Per parlarsi devono stare nella stessa rete: stesso inizio dell\'indirizzo, deciso dalla maschera.',
        ...(expert ? ['IRIS: Attenzione: la maschera qui è 255.255.255.128. La rete è divisa in due metà.'] : []),
      ],
      objectives: [
        { text: 'PC1 ha un indirizzo IP valido', check: (n) => !!dev(n, 'pc1').ifaces[0].ip },
        { text: `PC1 raggiunge PC0 (${ip0}) con un ping`, check: pingOk('pc1', () => ip0), ping: { from: 'pc1', ip: ip0 } },
      ],
      guide: [
        { text: 'Clicca su PC0 e leggi la sua configurazione:  ipconfig', cmd: 'ipconfig', device: 'pc0' },
        { text: `Ora clicca su PC1 e dagli un indirizzo nella stessa rete di PC0:  ipconfig 192.168.${A}.20 ${mask}`, cmd: `ipconfig 192.168.${A}.${expert ? 230 : 20} ${mask}`, device: 'pc1' },
        { text: `Verifica dal PC1:  ping ${ip0}`, cmd: `ping ${ip0}`, device: 'pc1' },
      ],
      hints: [
        'Leggi la configurazione di PC0 con ipconfig: quale rete usa?',
        `Con maschera ${mask}, PC1 deve avere ${expert ? 'un indirizzo tra .129 e .254' : 'un indirizzo 192.168.' + A + '.x'} diverso da PC0.`,
        `Su PC1: ipconfig 192.168.${A}.${expert ? 230 : 20} ${mask}  poi  ping ${ip0}`,
      ],
    };
  }
  if (id === '1.2') {
    const junior = diff !== 'studente', expert = diff === 'esperto';
    const net: Net = {
      devices: [
        pc('pc0', 'PC0', 30, 60, `192.168.${A}.10`, M24, junior ? undefined : `192.168.${A}.1`),
        sw('sw0', 'Switch0', 80, 170, 4),
        rt('r1', 'R1', 160, 110, [{ name: 'g0/0', up: false }, { name: 'g0/1', ip: `192.168.${B}.1`, mask: M24, up: !expert }]),
        sw('sw1', 'Switch1', 240, 170, 4),
        pc('pc1', 'PC1', 290, 60, `192.168.${B}.10`, M24, `192.168.${B}.1`),
      ],
      links: [
        { a: ['pc0', 'f0'], b: ['sw0', 'f0/1'] }, { a: ['sw0', 'f0/2'], b: ['r1', 'g0/0'] },
        { a: ['r1', 'g0/1'], b: ['sw1', 'f0/1'] }, { a: ['sw1', 'f0/2'], b: ['pc1', 'f0'] },
      ],
    };
    return {
      id, title: 'Il primo router', concept: 'Gateway e interfacce del router', net, parTime: expert ? 150 : 210,
      brief: [
        'IRIS: Simulazione 2. Due reti diverse. Per passare dall\'una all\'altra serve un router.',
        'IRIS: Ogni porta del router sta in una rete, e per quella rete è il gateway: la porta d\'uscita.',
        'IRIS: Sui router veri le porte nascono spente. Bisogna dar loro un indirizzo e accenderle.',
      ],
      objectives: [
        { text: `R1: g0/0 ha l'indirizzo 192.168.${A}.1 ed è accesa`, check: (n) => { const i = dev(n, 'r1').ifaces[0]; return i.ip === `192.168.${A}.1` && i.up; } },
        ...(junior ? [{ text: 'PC0 ha il gateway giusto', check: (n: Net) => dev(n, 'pc0').gateway === `192.168.${A}.1` }] : []),
        { text: `PC0 raggiunge PC1 (192.168.${B}.10)`, check: pingOk('pc0', () => `192.168.${B}.10`), ping: { from: 'pc0', ip: `192.168.${B}.10` } },
      ],
      guide: [
        { text: 'Clicca sul router R1. Entra in modalità privilegiata:  enable', cmd: 'enable', device: 'r1' },
        { text: 'Guarda lo stato delle porte:  show ip interface brief', cmd: 'show ip interface brief', device: 'r1' },
        { text: 'Entra in configurazione:  configure terminal', cmd: 'configure terminal', device: 'r1' },
        { text: 'Scegli la porta verso PC0:  interface g0/0', cmd: 'interface g0/0', device: 'r1' },
        { text: `Dalle l'indirizzo del gateway di PC0:  ip address 192.168.${A}.1 255.255.255.0`, cmd: `ip address 192.168.${A}.1 255.255.255.0`, device: 'r1' },
        { text: 'Accendila:  no shutdown', cmd: 'no shutdown', device: 'r1' },
        { text: `Ora clicca su PC0 e prova:  ping 192.168.${B}.10`, cmd: `ping 192.168.${B}.10`, device: 'pc0' },
      ],
      hints: [
        'Su R1: enable, poi show ip interface brief. Quale porta è spenta e senza indirizzo?',
        `La porta g0/0 deve avere l'indirizzo che PC0 usa come gateway (192.168.${A}.1). ${junior ? 'Controlla anche il gateway di PC0 con ipconfig. ' : ''}${expert ? 'E controlla che TUTTE le porte siano accese.' : ''}`,
        `R1: configure terminal → interface g0/0 → ip address 192.168.${A}.1 255.255.255.0 → no shutdown.${junior ? ` PC0: ipconfig 192.168.${A}.10 255.255.255.0 192.168.${A}.1` : ''}`,
      ],
    };
  }
  // 1.3 — due router collegati da una rete /30: servono le rotte statiche in entrambe le direzioni
  const junior = diff !== 'studente', expert = diff === 'esperto';
  const l1 = `10.0.${A}.${C + 1}`, l2 = `10.0.${A}.${C + 2}`, ln = `10.0.${A}.${C}`;
  const r1: Device = rt('r1', 'R1', 110, 110, [{ name: 'g0/0', ip: `192.168.${A}.1`, mask: M24, up: true }, { name: 'g0/1', ip: l1, mask: M30, up: true }]);
  const r2: Device = rt('r2', 'R2', 210, 110, [{ name: 'g0/0', ip: `192.168.${B}.1`, mask: M24, up: true }, { name: 'g0/1', ip: l2, mask: M30, up: !junior }]);
  if (expert) r1.routes.push({ net: `192.168.${B}.0`, mask: M24, via: `10.0.${A}.${C + 6}` }); // rotta sbagliata lasciata da qualcuno
  const net: Net = {
    devices: [pc('pc0', 'PC0', 30, 60, `192.168.${A}.10`, M24, `192.168.${A}.1`), r1, r2, pc('pc1', 'PC1', 290, 60, `192.168.${B}.10`, M24, `192.168.${B}.1`)],
    links: [{ a: ['pc0', 'f0'], b: ['r1', 'g0/0'] }, { a: ['r1', 'g0/1'], b: ['r2', 'g0/1'] }, { a: ['r2', 'g0/0'], b: ['pc1', 'f0'] }],
  };
  return {
    id: '1.3', title: 'Due router', concept: 'Instradamento statico', net, parTime: expert ? 180 : 240,
    brief: [
      'IRIS: Simulazione 3. Due router, ognuno con la sua rete. Tra loro un collegamento piccolo, una rete /30: solo due indirizzi.',
      'IRIS: Un router conosce da solo solo le reti a cui è attaccato. Per le altre serve una rotta: "per quella rete, passa da lui".',
      'IRIS: E ricorda: la risposta deve saper tornare indietro.',
    ],
    objectives: [
      { text: `R1 sa raggiungere 192.168.${B}.0`, check: (n) => dev(n, 'r1').routes.some((r) => r.net === `192.168.${B}.0` && r.via === l2) },
      { text: `R2 sa raggiungere 192.168.${A}.0`, check: (n) => dev(n, 'r2').routes.some((r) => r.net === `192.168.${A}.0` && r.via === l1) },
      { text: `PC0 raggiunge PC1 (192.168.${B}.10), andata e ritorno`, check: pingOk('pc0', () => `192.168.${B}.10`), ping: { from: 'pc0', ip: `192.168.${B}.10` } },
    ],
    guide: [
      { text: `Clicca su PC0 e prova:  ping 192.168.${B}.10  (guarda dove si ferma)`, cmd: `ping 192.168.${B}.10`, device: 'pc0' },
      { text: 'Clicca su R1:  enable  poi  show ip route', cmd: 'enable', device: 'r1' },
      { text: 'Leggi la tabella:  show ip route', cmd: 'show ip route', device: 'r1' },
      { text: 'Entra in configurazione:  configure terminal', cmd: 'configure terminal', device: 'r1' },
      { text: `Aggiungi la rotta verso la rete di PC1, passando da R2 (${l2}):\n  ip route 192.168.${B}.0 255.255.255.0 ${l2}`, cmd: `ip route 192.168.${B}.0 255.255.255.0 ${l2}`, device: 'r1' },
      { text: 'Ora clicca su R2:  enable', cmd: 'enable', device: 'r2' },
      { text: 'configure terminal', cmd: 'configure terminal', device: 'r2' },
      { text: `La strada del ritorno, passando da R1 (${l1}):\n  ip route 192.168.${A}.0 255.255.255.0 ${l1}`, cmd: `ip route 192.168.${A}.0 255.255.255.0 ${l1}`, device: 'r2' },
      { text: `Torna su PC0:  ping 192.168.${B}.10`, cmd: `ping 192.168.${B}.10`, device: 'pc0' },
    ],
    hints: [
      `Fai un ping da PC0 e usa la modalità Simulazione: guarda quale router non sa dove mandare il pacchetto.${junior ? ' Controlla anche che tutte le porte siano accese (show ip interface brief).' : ''}`,
      `R1 deve sapere che 192.168.${B}.0 si raggiunge da ${l2}; R2 che 192.168.${A}.0 si raggiunge da ${l1}.${expert ? ' E guarda bene la tabella di R1: c\'è già qualcosa.' : ''}`,
      `R1: ip route 192.168.${B}.0 255.255.255.0 ${l2} · R2: ip route 192.168.${A}.0 255.255.255.0 ${l1}${junior ? ' · R2: interface g0/1 → no shutdown' : ''}`,
    ],
  };
  void ln;
}
