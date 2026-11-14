// IRIS TRACER — riga di comando in stile Cisco IOS (router) e prompt dei comandi (PC).
// Logica pura: riceve una riga, modifica la rete, restituisce le righe da stampare.
// Accetta le abbreviazioni come IOS: en, conf t, int g0/0, no shut, sh ip int br, sh run...
import { Net, Device, ifaceOf, isHost, ping, trace, checkIfaceIp, parseIp, isValidMask, prefixOf, intToIp, netOf, Ping } from './model';

export type Mode = 'user' | 'priv' | 'config' | 'if';
export interface CliState { mode: Mode; iface?: string }
export interface CliOut { lines: { t: string; kind?: 'err' | 'ok' | 'info' }[]; ping?: { from: string; dst: string; result: Ping; tracert?: boolean }; event?: string }

const longName = (s: string) => s.replace(/^g(\d)/, 'GigabitEthernet$1').replace(/^f(\d)/, 'FastEthernet$1');

// "g0/0", "gi0/0", "gig 0/0", "GigabitEthernet0/0" → "g0/0"
export function normIface(t: string): string | null {
  const m = /^(g|gi|gig|giga|gigabit|gigabitethernet|f|fa|fast|fastethernet)\s*(\d+\/\d+)$/i.exec(t.replace(/\s+/g, ''));
  return m ? (m[1][0].toLowerCase() === 'g' ? 'g' : 'f') + m[2] : null;
}

export function prompt(d: Device, st: CliState): string {
  if (isHost(d)) return 'C:\\>';
  return d.hostname + ({ user: '>', priv: '#', config: '(config)#', if: '(config-if)#' } as const)[st.mode];
}

// confronta una parola scritta con una parola del comando, ammettendo le abbreviazioni
const is = (typed: string | undefined, word: string, min = 1) => !!typed && typed.length >= min && word.startsWith(typed.toLowerCase());

export function runRouter(n: Net, d: Device, st: CliState, raw: string): CliOut {
  const out: CliOut = { lines: [] };
  const err = (t: string) => out.lines.push({ t, kind: 'err' });
  const ok = (t: string) => out.lines.push({ t, kind: 'ok' });
  const say = (t: string) => out.lines.push({ t });
  const w = raw.trim().split(/\s+/);
  const [a, b, c] = w;
  if (!a) return out;
  if (a === '?') { say(help(st.mode)); return out; }

  // comandi validi in più modalità
  if (is(a, 'exit', 2)) { st.mode = st.mode === 'if' ? 'config' : st.mode === 'config' ? 'priv' : 'user'; st.iface = undefined; return out; }
  if (is(a, 'end', 2) && (st.mode === 'config' || st.mode === 'if')) { st.mode = 'priv'; st.iface = undefined; return out; }

  if (st.mode === 'user' || st.mode === 'priv') {
    if (is(a, 'enable', 2)) { st.mode = 'priv'; return out; }
    if (is(a, 'disable', 4)) { st.mode = 'user'; return out; }
    if (is(a, 'ping', 2)) {
      if (!b || parseIp(b) === null) { err('% Indirizzo non valido. Uso: ping 192.168.1.1'); return out; }
      out.ping = { from: d.id, dst: b, result: ping(n, d.id, b) };
      out.event = 'ping'; return out;
    }
    if (is(a, 'traceroute', 3)) {
      if (!b || parseIp(b) === null) { err('% Uso: traceroute 192.168.1.1'); return out; }
      out.ping = { from: d.id, dst: b, result: { ok: false, go: trace(n, d.id, b) }, tracert: true };
      out.event = 'tracert'; return out;
    }
    if (is(a, 'show', 2)) {
      if (st.mode === 'user' && !is(b, 'ip')) { err('% Per questo comando serve la modalità privilegiata: scrivi  enable'); return out; }
      if (is(b, 'ip') && is(c, 'interface', 3) ) { showBrief(d).forEach(say); out.event = 'show-brief'; return out; }
      if (is(b, 'ip') && is(c, 'route', 1)) { showRoute(d).forEach(say); out.event = 'show-route'; return out; }
      if (is(b, 'running-config', 3) || is(b, 'run', 3)) {
        if (st.mode !== 'priv') { err('% Serve la modalità privilegiata: scrivi  enable'); return out; }
        showRun(d).forEach(say); out.event = 'show-run'; return out;
      }
      err('% Comandi: show ip interface brief · show ip route · show running-config'); return out;
    }
    if (is(a, 'configure', 4)) {
      if (st.mode !== 'priv') { err('% Prima entra in modalità privilegiata:  enable'); return out; }
      st.mode = 'config'; say('Inserisci i comandi di configurazione, uno per riga. Fine con  end.'); return out;
    }
    err(`% Comando non riconosciuto: "${a}".${st.mode === 'user' ? ' Prova  enable' : ' Prova  configure terminal'}  ( ? per l'elenco)`);
    return out;
  }

  if (st.mode === 'config') {
    if (is(a, 'hostname', 4)) { if (!b) { err('% Uso: hostname NOME'); return out; } d.hostname = b; out.event = 'hostname'; return out; }
    if (is(a, 'interface', 3)) {
      const name = normIface(w.slice(1).join(''));
      if (!name || !ifaceOf(d, name)) { err(`% Interfaccia non valida. Su ${d.hostname}: ${d.ifaces.map((i) => i.name).join(', ')}`); return out; }
      st.mode = 'if'; st.iface = name; out.event = 'interface'; return out;
    }
    if (is(a, 'ip') && is(b, 'route', 2)) return route(n, d, w.slice(2), false, out);
    if (is(a, 'no') && is(b, 'ip') && is(c, 'route', 2)) return route(n, d, w.slice(3), true, out);
    err(`% Comando non valido in configurazione: "${raw.trim()}". Comandi: hostname · interface · ip route`);
    return out;
  }

  // modalità interfaccia
  const I = ifaceOf(d, st.iface!)!;
  if (is(a, 'ip') && is(b, 'address', 2)) {
    const [ip, mask] = w.slice(2);
    if (!ip || !mask) { err('% Uso: ip address 192.168.1.1 255.255.255.0'); return out; }
    const bad = checkIfaceIp(ip, mask);
    if (bad) { err('% ' + bad); out.event = 'concept-error'; return out; }
    const clash = d.ifaces.find((o) => o !== I && o.ip && o.mask && netOf(o.ip, o.mask) === netOf(ip, mask));
    if (clash) { err(`% ${ip}/${prefixOf(mask)} è nella stessa rete di ${clash.name}: ogni interfaccia di un router sta in una rete diversa.`); out.event = 'concept-error'; return out; }
    I.ip = ip; I.mask = mask; out.event = 'ip-address'; return out;
  }
  if (is(a, 'no') && is(b, 'shutdown', 4)) {
    I.up = true;
    ok(`%LINK-5-CHANGED: Interface ${longName(I.name)}, changed state to up`);
    out.event = 'no-shut'; return out;
  }
  if (is(a, 'shutdown', 4)) { I.up = false; say(`%LINK-5-CHANGED: Interface ${longName(I.name)}, changed state to administratively down`); out.event = 'shut'; return out; }
  if (is(a, 'interface', 3)) { st.mode = 'config'; return runRouter(n, d, st, raw); }
  err('% Comandi dell\'interfaccia: ip address IP MASCHERA · no shutdown · shutdown · exit');
  return out;
}

function route(n: Net, d: Device, args: string[], remove: boolean, out: CliOut): CliOut {
  const [net, mask, via] = args;
  if (!net || !mask || !via || parseIp(net) === null || parseIp(via) === null || (mask !== '0.0.0.0' && !isValidMask(mask))) {
    out.lines.push({ t: `% Uso: ${remove ? 'no ' : ''}ip route RETE MASCHERA PROSSIMO-SALTO  (es. ip route 192.168.2.0 255.255.255.0 10.0.0.2)`, kind: 'err' });
    return out;
  }
  if (remove) {
    const before = d.routes.length;
    d.routes = d.routes.filter((r) => !(r.net === net && r.mask === mask));
    out.lines.push(before > d.routes.length ? { t: 'Rotta rimossa.', kind: 'ok' } : { t: '% Rotta non trovata. Controlla con  show ip route', kind: 'err' });
    out.event = 'route-del'; return out;
  }
  if (netOf(net, mask) !== parseIp(net)) { out.lines.push({ t: `% ${net} non è l'inizio di una rete con maschera ${mask}: dovrebbe essere ${intToIp(netOf(net, mask))}.`, kind: 'err' }); out.event = 'concept-error'; return out; }
  if (d.ifaces.some((i) => i.ip === via)) { out.lines.push({ t: `% ${via} è un indirizzo di ${d.hostname} stesso: il prossimo salto è il router VICINO.`, kind: 'err' }); out.event = 'concept-error'; return out; }
  if (!d.ifaces.some((i) => i.ip && i.mask && netOf(i.ip, i.mask) === netOf(via, i.mask))) {
    out.lines.push({ t: `% ${via} non è in nessuna rete collegata a ${d.hostname}: non può passargli i pacchetti.`, kind: 'err' }); out.event = 'concept-error'; return out;
  }
  d.routes = d.routes.filter((r) => !(r.net === net && r.mask === mask));
  d.routes.push({ net, mask, via });
  out.event = 'route-add';
  return out;
}

export function showBrief(d: Device): string[] {
  return ['Interface              IP-Address      Status', ...d.ifaces.map((i) =>
    `${longName(i.name).padEnd(22)} ${(i.ip ?? 'unassigned').padEnd(15)} ${i.up ? 'up' : 'administratively down'}`)];
}

export function showRoute(d: Device): string[] {
  const rows = ['Codici: C - collegata, S - statica', ''];
  d.ifaces.filter((i) => i.up && i.ip && i.mask).forEach((i) => rows.push(`C    ${intToIp(netOf(i.ip!, i.mask!))}/${prefixOf(i.mask!)} collegata, ${longName(i.name)}`));
  d.routes.forEach((r) => rows.push(`S    ${r.net}/${prefixOf(r.mask)} [1/0] via ${r.via}`));
  if (rows.length === 2) rows.push('(tabella vuota: nessuna interfaccia accesa e nessuna rotta)');
  return rows;
}

export function showRun(d: Device): string[] {
  const r = ['!', `hostname ${d.hostname}`, '!'];
  d.ifaces.forEach((i) => { r.push(`interface ${longName(i.name)}`, i.ip ? ` ip address ${i.ip} ${i.mask}` : ' no ip address', i.up ? ' no shutdown' : ' shutdown', '!'); });
  d.routes.forEach((x) => r.push(`ip route ${x.net} ${x.mask} ${x.via}`));
  r.push('end');
  return r;
}

function help(m: Mode): string {
  return {
    user: 'enable · ping IP · traceroute IP · show ip interface brief',
    priv: 'configure terminal · show ip interface brief · show ip route · show running-config · ping IP · traceroute IP · disable',
    config: 'hostname NOME · interface g0/0 · ip route RETE MASCHERA SALTO · no ip route ... · end · exit',
    if: 'ip address IP MASCHERA · no shutdown · shutdown · exit · end',
  }[m];
}

// --- Prompt dei comandi del PC (come la scheda Desktop di Packet Tracer)
export function runPc(n: Net, d: Device, raw: string): CliOut {
  const out: CliOut = { lines: [] };
  const w = raw.trim().split(/\s+/);
  const [a, b, c, e] = w;
  const nic = d.ifaces[0];
  if (!a) return out;
  if (is(a, 'ipconfig', 3)) {
    if (!b) {
      out.lines.push({ t: `FastEthernet0 · indirizzo IP . . : ${nic.ip ?? '0.0.0.0'}` }, { t: `               maschera  . . . : ${nic.mask ?? '0.0.0.0'}` }, { t: `               gateway . . . . : ${d.gateway ?? '0.0.0.0'}` });
      out.event = 'ipconfig'; return out;
    }
    const bad = c ? checkIfaceIp(b, c) : 'Uso: ipconfig IP MASCHERA GATEWAY  (es. ipconfig 192.168.1.20 255.255.255.0 192.168.1.1)';
    if (bad) { out.lines.push({ t: bad, kind: 'err' }); out.event = 'concept-error'; return out; }
    if (n.devices.some((o) => o !== d && o.ifaces.some((i) => i.ip === b))) { out.lines.push({ t: `${b} è già usato da un altro dispositivo: due dispositivi con lo stesso indirizzo si confondono a vicenda.`, kind: 'err' }); out.event = 'concept-error'; return out; }
    if (e && parseIp(e) === null) { out.lines.push({ t: 'Gateway non valido.', kind: 'err' }); return out; }
    if (e && netOf(e, c) !== netOf(b, c)) { out.lines.push({ t: `Il gateway ${e} non è nella rete ${intToIp(netOf(b, c))}/${prefixOf(c)}: il PC non potrebbe raggiungerlo.`, kind: 'err' }); out.event = 'concept-error'; return out; }
    nic.ip = b; nic.mask = c; if (e) d.gateway = e;
    out.lines.push({ t: 'Configurazione IP aggiornata.', kind: 'ok' });
    out.event = 'ipconfig-set'; return out;
  }
  if (is(a, 'ping', 2)) {
    if (!b || parseIp(b) === null) { out.lines.push({ t: 'Uso: ping 192.168.1.1', kind: 'err' }); return out; }
    out.ping = { from: d.id, dst: b, result: ping(n, d.id, b) }; out.event = 'ping'; return out;
  }
  if (is(a, 'tracert', 3)) {
    if (!b || parseIp(b) === null) { out.lines.push({ t: 'Uso: tracert 192.168.1.1', kind: 'err' }); return out; }
    out.ping = { from: d.id, dst: b, result: { ok: false, go: trace(n, d.id, b) }, tracert: true }; out.event = 'tracert'; return out;
  }
  if (a === '?' || is(a, 'help', 2)) { out.lines.push({ t: 'ipconfig · ipconfig IP MASCHERA GATEWAY · ping IP · tracert IP' }); return out; }
  out.lines.push({ t: `'${a}' non è un comando riconosciuto. Comandi: ipconfig, ping, tracert`, kind: 'err' });
  return out;
}
