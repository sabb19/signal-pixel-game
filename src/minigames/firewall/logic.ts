// FIREWALL ARCHITECT — logica pura (nessuna dipendenza da Phaser), coperta da tests/firewall.test.ts.
// Il filtro della Sala Comunicazioni: una lista di regole lette DALL'ALTO.
// Per ogni pacchetto decide la prima regola che corrisponde; se nessuna corrisponde, in fondo c'è sempre "nega tutto".

export type Proto = 'TCP' | 'UDP' | 'tutti';
export type Action = 'PERMETTI' | 'BLOCCA';
export type Dest = 'ANTENNA' | 'ARCHIVIO' | 'DNS' | 'NODE-X' | 'tutti';

export interface Rule { action: Action; proto: Proto; port: number | 'tutte'; dst: Dest; locked?: boolean }
export interface Packet { label: string; proto: 'TCP' | 'UDP'; port: number; dst: Exclude<Dest, 'tutti'> }
export interface Req { packet: Packet; want: Action; why: string; hidden?: boolean }

export const PROTOS: Proto[] = ['TCP', 'UDP', 'tutti'];
export const DESTS: Dest[] = ['ANTENNA', 'ARCHIVIO', 'DNS', 'tutti'];

export function matches(r: Rule, p: Packet): boolean {
  return (r.proto === 'tutti' || r.proto === p.proto)
    && (r.port === 'tutte' || r.port === p.port)
    && (r.dst === 'tutti' || r.dst === p.dst);
}

// indice della regola che decide (−1 = nessuna: decide il "nega tutto" finale)
export function decide(rules: Rule[], p: Packet): { action: Action; by: number } {
  const i = rules.findIndex((r) => matches(r, p));
  return i < 0 ? { action: 'BLOCCA', by: -1 } : { action: rules[i].action, by: i };
}

export interface TestRow { req: Req; got: Action; by: number; ok: boolean }
export function runTests(rules: Rule[], reqs: Req[]): TestRow[] {
  return reqs.map((req) => { const d = decide(rules, req.packet); return { req, got: d.action, by: d.by, ok: d.action === req.want }; });
}

// Una regola che non decide mai niente perché un'altra più larga sopra di lei prende tutto prima
export function shadowedBy(rules: Rule[], i: number): number {
  const r = rules[i];
  for (let j = 0; j < i; j++) {
    const a = rules[j];
    const covers = (a.proto === 'tutti' || a.proto === r.proto) && (a.port === 'tutte' || a.port === r.port) && (a.dst === 'tutti' || a.dst === r.dst);
    if (covers) return j;
  }
  return -1;
}

export function moveRule(rules: Rule[], i: number, d: -1 | 1): number {
  const j = i + d;
  if (j < 0 || j >= rules.length || rules[i].locked || rules[j].locked) return i;
  [rules[i], rules[j]] = [rules[j], rules[i]];
  return j;
}

export function cycle<T>(list: T[], v: T): T { return list[(list.indexOf(v) + 1) % list.length]; }

// --- Il traffico della stazione
const P = {
  telem: { label: 'Telemetria dell\'antenna', proto: 'UDP', port: 5005, dst: 'ANTENNA' } as Packet,
  https: { label: 'Console sicura → archivio', proto: 'TCP', port: 443, dst: 'ARCHIVIO' } as Packet,
  dns: { label: 'Richiesta dei nomi', proto: 'UDP', port: 53, dst: 'DNS' } as Packet,
  nodexDns: { label: '??? UDP 53 → NODE-X', proto: 'UDP', port: 53, dst: 'NODE-X' } as Packet,
  nodexTcp: { label: 'Uscita verso NODE-X', proto: 'TCP', port: 443, dst: 'NODE-X' } as Packet,
};

export interface Mission {
  id: number;
  title: string;
  brief: string[];
  goal: string;
  rules: Rule[];
  reqs: Req[];
  hints: [string, string, string];
}

const denyAll: Rule = { action: 'BLOCCA', proto: 'tutti', port: 'tutte', dst: 'tutti', locked: true };

export function makeMissions(): Mission[] {
  return [
    {
      id: 1, title: 'GLI SPORTELLI',
      brief: [
        'IRIS: Il filtro è una lista di regole. Ogni pacchetto le legge dall\'alto, una alla volta.',
        'IRIS: La prima regola che gli corrisponde decide: permetti o blocca. Le altre non le guarda nemmeno.',
        'IRIS: E in fondo ce n\'è sempre una: blocca tutto. Chi non è stato invitato, non passa.',
        'MYRA: Come un buttafuori con una lista.',
        'IRIS: Ogni servizio ha uno sportello con un numero, la porta. E due modi di viaggiare: TCP, che controlla ogni consegna, e UDP, veloce e senza ricevuta.',
      ],
      goal: 'Tutte le spie dei requisiti verdi. Poi SPAZIO per provare il traffico.',
      rules: [
        { action: 'PERMETTI', proto: 'TCP', port: 443, dst: 'ARCHIVIO' },
        { action: 'PERMETTI', proto: 'TCP', port: 5005, dst: 'ANTENNA' },
        { action: 'BLOCCA', proto: 'UDP', port: 53, dst: 'DNS' },
        denyAll,
      ],
      reqs: [
        { packet: P.https, want: 'PERMETTI', why: 'la console deve leggere l\'archivio' },
        { packet: P.telem, want: 'PERMETTI', why: 'l\'antenna deve mandare i suoi dati' },
        { packet: P.dns, want: 'PERMETTI', why: 'senza nomi non si trova niente' },
      ],
      hints: [
        'Premi SPAZIO e leggi il registro: per ogni pacchetto dice quale regola ha deciso.',
        'La telemetria viaggia in UDP, ma la regola 2 parla di TCP. E la regola 3 blocca proprio i nomi.',
        'Seleziona la regola 2 e premi P finché dice UDP. Poi seleziona la regola 3 e premi A per farla diventare PERMETTI.',
      ],
    },
    {
      id: 2, title: 'L\'ORDINE',
      brief: [
        'IRIS: Questa è la lista che ho trovato. Le regole giuste ci sono tutte.',
        'IRIS: Eppure l\'antenna è muta e i nomi non rispondono.',
        'MYRA: Se ci sono tutte, allora il problema è... dove stanno?',
      ],
      goal: 'Sposta la regola troppo larga dove non nasconde le altre. INVIO prende e posa una regola.',
      rules: [
        { action: 'BLOCCA', proto: 'UDP', port: 'tutte', dst: 'tutti' },
        { action: 'PERMETTI', proto: 'UDP', port: 5005, dst: 'ANTENNA' },
        { action: 'PERMETTI', proto: 'UDP', port: 53, dst: 'DNS' },
        { action: 'PERMETTI', proto: 'TCP', port: 443, dst: 'ARCHIVIO' },
        denyAll,
      ],
      reqs: [
        { packet: P.https, want: 'PERMETTI', why: 'la console deve leggere l\'archivio' },
        { packet: P.telem, want: 'PERMETTI', why: 'l\'antenna deve mandare i suoi dati' },
        { packet: P.dns, want: 'PERMETTI', why: 'senza nomi non si trova niente' },
        { packet: P.nodexDns, want: 'BLOCCA', why: 'NODE-X non è dei nostri' },
      ],
      hints: [
        'Premi SPAZIO: guarda quale regola decide per la telemetria. È quella che ti aspetti?',
        'La regola 1 blocca TUTTO l\'UDP. Sta in cima, quindi decide prima delle regole specifiche sotto.',
        'Seleziona la regola 1, premi INVIO per prenderla, ↓ finché è sopra "blocca tutto", poi INVIO per posarla.',
      ],
    },
    {
      id: 3, title: 'VERIFICA · LA FUGA',
      brief: [
        'IRIS: Ultima prova, senza guida. Ho caricato le regole vere del filtro, così come le ha lasciate l\'ultima persona che le ha toccate.',
        'IRIS: I requisiti sembrano a posto. Ma ho aggiunto al test un pacchetto che ho visto nei registri di quella notte.',
      ],
      goal: 'Trova la regola che lascia uscire il traffico verso NODE-X e restringila, senza rompere i servizi.',
      rules: [
        { action: 'PERMETTI', proto: 'TCP', port: 443, dst: 'ARCHIVIO' },
        { action: 'PERMETTI', proto: 'UDP', port: 5005, dst: 'ANTENNA' },
        { action: 'PERMETTI', proto: 'UDP', port: 53, dst: 'tutti' },
        denyAll,
      ],
      reqs: [
        { packet: P.https, want: 'PERMETTI', why: 'la console deve leggere l\'archivio' },
        { packet: P.telem, want: 'PERMETTI', why: 'l\'antenna deve mandare i suoi dati' },
        { packet: P.dns, want: 'PERMETTI', why: 'senza nomi non si trova niente' },
        { packet: P.nodexDns, want: 'BLOCCA', why: 'quello visto nei registri', hidden: true },
        { packet: P.nodexTcp, want: 'BLOCCA', why: 'nessuna uscita verso NODE-X' },
      ],
      hints: [
        'Premi SPAZIO e guarda l\'ultima riga del registro: quale regola fa passare il pacchetto verso NODE-X?',
        'La regola 3 permette la porta 53 verso "tutti". I nomi servono, ma solo verso il NOSTRO server DNS.',
        'Seleziona la regola 3 e premi D finché la destinazione è DNS. Poi SPAZIO.',
      ],
    },
  ];
}

export function cloneRules(r: Rule[]): Rule[] { return r.map((x) => ({ ...x })); }
