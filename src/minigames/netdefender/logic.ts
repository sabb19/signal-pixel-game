// NETWORK DEFENDER — logica pura (nessuna dipendenza da Phaser), coperta da tests/netdefender.test.ts.
// Rete della sala controllo: segmento locale 10.0.10.0/24, router 10.0.10.1 verso l'archivio 10.0.20.0/24.
// Indirizzi solo da intervalli privati (docs/CYBERSECURITY_LEARNING_DESIGN.md §9).

export interface Device {
  name: string;
  ip: string;
  mask: string;
  gateway: string;
  link: boolean; // cavo collegato
}

export function parseIp(s: string): number | null {
  const parts = s.trim().split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

export function isValidMask(s: string): boolean {
  const m = parseIp(s);
  if (m === null || m === 0) return false;
  const inv = (~m) >>> 0;
  return ((inv + 1) & inv) === 0; // tutti 1 a sinistra, poi tutti 0
}

export function prefixOf(mask: string): number {
  const m = parseIp(mask) ?? 0;
  let c = 0;
  for (let i = 31; i >= 0; i--) if ((m >>> i) & 1) c++;
  return c;
}

export function networkOf(ip: string, mask: string): number {
  return ((parseIp(ip) ?? 0) & (parseIp(mask) ?? 0)) >>> 0;
}

export function sameSubnet(a: string, b: string, mask: string): boolean {
  return networkOf(a, mask) === networkOf(b, mask);
}

export function intToIp(n: number): string {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

// --- La rete "vera" (quello che esiste fisicamente)
export const ROUTER_LOCAL = '10.0.10.1';
export const REAL_MASK = '255.255.255.0';
const LOCAL_HOSTS = new Set(['10.0.10.1', '10.0.10.21', '10.0.10.31', '10.0.10.32', '10.0.10.40']);
const REMOTE_HOSTS = new Set(['10.0.20.1', '10.0.20.5']); // dietro il router: interfaccia archivio e server archivio
export const ARCHIVE = '10.0.20.5';

export type PingResult =
  | { ok: true; via: 'diretto' | 'gateway'; lines: string[] }
  | { ok: false; reason: 'nolink' | 'noarp' | 'gwout' | 'gwdown' | 'unknown' | 'external' | 'badtarget'; lines: string[] };

// Simula un ping da un dispositivo, seguendo esattamente la decisione che prende un host:
// destinazione nella mia rete (secondo la MIA maschera)? consegna diretta : passa dal gateway.
export function ping(d: Device, target: string): PingResult {
  if (parseIp(target) === null) return { ok: false, reason: 'badtarget', lines: [`Indirizzo non valido: ${target}`] };
  const head = `Esecuzione di ping ${target} da ${d.ip}:`;
  if (!d.link) {
    return { ok: false, reason: 'nolink', lines: [head, 'Errore: nessun collegamento fisico.', 'Pacchetti: inviati 4, ricevuti 0.'] };
  }
  const reply = (via: 'diretto' | 'gateway'): PingResult => ({
    ok: true, via,
    lines: [head, ...[1, 2, 3, 4].map((i) => `Risposta da ${target}: durata=${via === 'diretto' ? 1 : 3 + i}ms`), 'Pacchetti: inviati 4, ricevuti 4.'],
  });
  const fail = (reason: Exclude<PingResult, { ok: true }>['reason'], msg: string): PingResult =>
    ({ ok: false, reason, lines: [head, ...[1, 2, 3, 4].map(() => msg), 'Pacchetti: inviati 4, ricevuti 0.'] });

  if (sameSubnet(d.ip, target, d.mask)) {
    // l'host crede che la destinazione sia accanto a lui e la cerca direttamente sul cavo
    if (sameSubnet(d.ip, target, REAL_MASK) && LOCAL_HOSTS.has(target)) return reply('diretto');
    return fail('noarp', 'Nessuna risposta nella rete locale.');
  }
  // destinazione fuori dalla mia rete: serve il gateway, che deve stare nella MIA rete
  if (!sameSubnet(d.ip, d.gateway, d.mask)) return fail('gwout', 'Gateway fuori dalla rete del dispositivo.');
  if (d.gateway !== ROUTER_LOCAL) return fail('gwdown', `Nessuna risposta da ${d.gateway}.`);
  if (REMOTE_HOSTS.has(target)) return reply('gateway');
  if (target.startsWith('10.')) return fail('unknown', 'Host di destinazione non raggiungibile.');
  return fail('external', 'Richiesta scaduta.');
}

// --- Validazione delle modifiche: distingue errori di esecuzione (sintassi) e di comprensione (concetto)
export type Check = { ok: true } | { ok: false; kind: 'esecuzione' | 'comprensione'; msg: string };

export function checkSet(d: Device, field: 'ip' | 'mask' | 'gateway', value: string): Check {
  if (field === 'mask') {
    if (parseIp(value) === null) return { ok: false, kind: 'esecuzione', msg: 'Formato non valido. Una maschera si scrive come un indirizzo, ad esempio 255.255.255.0.' };
    if (!isValidMask(value)) return { ok: false, kind: 'comprensione', msg: 'Questa non è una maschera: i bit a 1 devono stare tutti a sinistra (255.255.255.0, 255.255.0.0...).' };
    return { ok: true };
  }
  if (parseIp(value) === null) return { ok: false, kind: 'esecuzione', msg: 'Formato non valido. Un indirizzo ha 4 numeri da 0 a 255 separati da punti.' };
  if (field === 'gateway') {
    if (value === d.ip) return { ok: false, kind: 'comprensione', msg: 'Il gateway è un altro dispositivo, il router: non può essere l\'indirizzo della console stessa.' };
    if (!sameSubnet(d.ip, value, d.mask))
      return { ok: false, kind: 'comprensione', msg: `Con maschera ${d.mask} la rete della console è ${intToIp(networkOf(d.ip, d.mask))}/${prefixOf(d.mask)}. ${value} è fuori da questa rete: la console non potrebbe mai raggiungerlo direttamente.` };
  }
  if (field === 'ip' && networkOf(value, REAL_MASK) !== networkOf(ROUTER_LOCAL, REAL_MASK))
    return { ok: false, kind: 'comprensione', msg: 'Questo indirizzo non appartiene al segmento della sala controllo (10.0.10.x): la console sarebbe isolata.' };
  return { ok: true };
}

// --- Missioni
export interface Mission {
  id: number;
  title: string;
  brief: string[];          // IRIS: contesto + spiegazione breve
  devices: Device[];
  goal: string;             // obiettivo mostrato a schermo
  hints: [string, string, string];
  done: (devs: Device[], pinged: Set<string>, diagnosis?: string) => boolean;
}

const dev = (name: string, ip: string, mask: string, gateway: string, link = true): Device => ({ name, ip, mask, gateway, link });

export function makeMissions(): Mission[] {
  return [
    {
      id: 1,
      title: 'LA CONSOLE',
      brief: [
        'IRIS: Prima di parlare con il mondo, la console deve parlare con la stanza accanto.',
        'IRIS: Ogni dispositivo in una rete ha un INDIRIZZO IP. È come l\'indirizzo di una casa: quattro numeri separati da punti.',
        'MYRA: Quindi anche questa console ha una casa.',
        'IRIS: Sì. E la MASCHERA dice quale parte dell\'indirizzo è il quartiere. Con 255.255.255.0 il quartiere sono i primi tre numeri.',
        'IRIS: Per uscire dal quartiere serve il GATEWAY: il router, la porta verso le altre reti. Deve stare nello stesso quartiere.',
        'IRIS: Scrivi  ipconfig  e premi INVIO. Leggiamo insieme la scheda della console.',
      ],
      devices: [dev('CONSOLE-SC', '10.0.10.21', '255.255.255.0', '10.0.20.1')],
      goal: 'Correggi il gateway della console e verifica con  ping 10.0.10.1  (il router).',
      hints: [
        'Guarda il gateway della console. È nello stesso quartiere del suo indirizzo IP?',
        'Con maschera 255.255.255.0 il quartiere sono i primi tre numeri: 10.0.10. Il gateway deve iniziare allo stesso modo. Nello schema, il router della sala ha un indirizzo che finisce con .1.',
        'Esempio: una casa in Via Roma 10 non può avere la porta del condominio in Via Milano. Scrivi:  set gateway 10.0.10.1  poi  ping 10.0.10.1',
      ],
      done: (d, pinged) => d[0].gateway === ROUTER_LOCAL && pinged.has(`${d[0].name}>${ROUTER_LOCAL}`),
    },
    {
      id: 2,
      title: 'I DUE MONITOR',
      brief: [
        'IRIS: I monitor della parete leggono i dati dall\'archivio, 10.0.20.5. Un altro quartiere.',
        'IRIS: MON-A ci arriva. MON-B no. Eppure hanno lo stesso gateway.',
        'MYRA: Allora il problema non è la porta d\'uscita.',
        'IRIS: Corretto. Un dispositivo decide da solo, con la sua maschera, se una destinazione è "nel quartiere" o va mandata al gateway.',
        'IRIS: Scrivi  usa MON-A  o  usa MON-B  per cambiare dispositivo. Confrontali.',
      ],
      devices: [dev('MON-A', '10.0.10.31', '255.255.255.0', '10.0.10.1'), dev('MON-B', '10.0.10.32', '255.255.0.0', '10.0.10.1')],
      goal: 'Fai raggiungere l\'archivio 10.0.20.5 da entrambi i monitor (un ping da ciascuno).',
      hints: [
        'Confronta ipconfig di MON-A e di MON-B. Cosa cambia tra le due schede?',
        'Con maschera 255.255.0.0 MON-B crede che tutto ciò che inizia con 10.0 sia nel suo quartiere: cerca l\'archivio nella stanza accanto invece di passare dal router.',
        'Esempio: se pensi che un amico abiti nel tuo palazzo, bussi a tutte le porte del pianerottolo e non lo trovi mai. Su MON-B scrivi:  set mask 255.255.255.0',
      ],
      done: (d, pinged) => d.every((x) => x.mask === REAL_MASK && pinged.has(`${x.name}>${ARCHIVE}`)),
    },
    {
      id: 3,
      title: 'VERIFICA · IL TERMINALE DEL CORRIDOIO',
      brief: [
        'IRIS: Il terminale del corridoio non comunica.',
        'IRIS: Questa volta non ti dico dove guardare. Prima di cambiare qualcosa, decidi:',
        'IRIS: è un problema di CONFIGURAZIONE (indirizzi sbagliati) o di COLLEGAMENTO (il segnale non parte proprio)?',
        'IRIS: Quando sei sicura scrivi  diagnosi configurazione  oppure  diagnosi collegamento.',
      ],
      devices: [dev('TERM-CORR', '10.0.10.40', '255.255.255.0', '10.0.10.1', false)],
      goal: 'Trova la causa, scrivi la diagnosi, poi verifica con un ping al router.',
      hints: [
        'Controlla la scheda con ipconfig: indirizzo, maschera e gateway sono coerenti tra loro?',
        'Se la configurazione è corretta ma nessun pacchetto parte, il problema è più in basso: il cavo o la porta.',
        'Esempio: un telefono con il numero giusto ma il cavo staccato non chiama nessuno. Leggi la riga "Stato" di ipconfig.',
      ],
      done: (d, pinged, diag) => diag === 'collegamento' && d[0].link && pinged.has(`${d[0].name}>${ROUTER_LOCAL}`),
    },
  ];
}
