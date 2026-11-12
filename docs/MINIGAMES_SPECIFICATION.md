# SIGNAL — Minigames Specification

> Versione 0.1 · 12/11/2026 · Base: i 7 minigiochi del progetto Unity (`Assets/Scripts/Learning/Stations/`).
> Si portano **logica, simulazione e contenuti**. Si cambiano cornice narrativa (niente Entropia, aula, equipaggio, nave), interfaccia e conseguenze.
> Ogni minigioco segue i 9 elementi del master prompt; qui sono abbreviati in: **Perché · Problema · IRIS spiega · Interfaccia · Attività · Errori previsti · Vittoria · Conseguenza · Verifica**.

## Regole comuni a tutti
- Nessun timer, nessun game over, nessun punteggio visibile.
- Aiuti a 3 livelli (tasto H): orienta → concetto → esempio guidato. Dopo 3 errori di comprensione di fila IRIS propone l'aiuto.
- **Errore di comprensione** (es. gateway in un'altra subnet): spiegazione breve del perché. **Errore di esecuzione** (es. comando scritto male): solo correzione della sintassi.
- Ogni azione si può annullare; si può uscire e rientrare senza perdere lo stato.
- Ogni minigioco ha più **missioni** brevi e crescenti: la prima guidata, l'ultima autonoma (= verifica).
- Logica di verifica in `logic.ts` pura e testata; nessuna vittoria "per caso" (es. tentativi a caso tra opzioni).

| Unity → SIGNAL | Mantenuto | Cambiato |
|---|---|---|
| Fase Blu | Sì: riparazione | Cornice: la stazione |
| Fase Rossa (in ogni postazione) | Solo nel minigioco 7 | Le Fasi Rosse dei minigiochi 1, 3, 4, 5 confluiscono nel Red Team Arena come scenari |
| Rapporto con Cisco IOS | Contenuto "nella realtà" | Diventa una nota di IRIS nel fascicolo; comandi reali solo come approfondimento facoltativo |
| Punteggio, medaglie, Sfida con seed | — | Rimossi dalla demo |

---

## 1 — NETWORK DEFENDER · Atto I · Sala controllo
**Perché:** il terminale di comunicazione della sala controllo è acceso ma non raggiunge il gateway. IRIS: «Anomalia rilevata. Connessione con il nodo esterno non disponibile.»
**Problema:** configurazione errata, non guasto hardware.
**IRIS spiega:** IP = indirizzo del dispositivo; mask = quale parte indica la rete; gateway = la porta verso fuori, deve stare nella stessa rete.
**Interfaccia:** terminale di configurazione CRT verde fosforo; scheda della scheda di rete (IP / mask / gateway / stato) a sinistra, prompt a destra; piccolo schema "dispositivo — switch — gateway".
**Attività (missioni):**
1. Terminale sala controllo: gateway fuori subnet (es. IP `10.0.10.21/24`, gateway `10.0.20.1`). Leggere, correggere a `10.0.10.1`, `ping 10.0.10.1`.
2. Due console della sala: una ha la **mask sbagliata** (`/16` vs `/24`) e crede che il gateway sia "locale" in modo errato. Trovare quale e perché.
3. (Verifica) Console del corridoio: l'utente deve capire da solo se il problema è di configurazione o di raggiungibilità (cavo/porta giù ⇒ `ping` fallisce anche con configurazione corretta).
**Comandi:** `ipconfig`, `set ip|mask|gateway`, `ping <ip>`.
**Errori previsti:** gateway scelto fuori subnet; confondere IP del dispositivo con quello del gateway; correggere l'IP invece del gateway; pensare che "acceso" = "connesso".
**Vittoria:** `ping` riuscito verso il gateway da tutti i dispositivi della missione, con configurazione coerente.
**Conseguenza:** la mappa della stazione si accende sul monitor grande; la porta della sala server si sblocca; spia verde sul quadro.
**Indizio:** il gateway era stato cambiato con un valore preciso alle 05:12 → «Non è un errore di battitura.»
**Da Unity:** `NetworkDefenderGame`, `NetCli`, `ChallengeGen.DefenderSpec`, `NetAddress`.

## 2 — PACKET TRACE · Atto II · Sala server
**Perché:** alcuni sistemi rispondono, altri no. Non è tutta la rete: si interrompe un percorso.
**IRIS spiega:** i dati viaggiano in pacchetti; ogni router decide il passo successivo leggendo la propria tabella; serve anche la strada di ritorno.
**Interfaccia:** rappresentazione grafica della rete su un pannello a fosfori, pacchetto animato tappa per tappa, timeline delle tappe, tabella di routing del nodo selezionato.
**Attività (3 missioni, dal codice Unity):** 1) gateway errato su un host; 2) rotta statica mancante su un router (andata ok, ritorno no); 3) default route sbagliata che manda il traffico verso un nodo sconosciuto.
**Comandi:** `ping`, `traceroute`, `show ip route`, `ip route <rete> <mask> <next-hop>`.
**Errori previsti:** correggere il nodo dove il pacchetto si ferma invece di quello che lo ha instradato male; dimenticare il ritorno; route troppo generica.
**Vittoria:** ping andata e ritorno in ogni missione.
**Conseguenza:** le spie dei rack passano a verde, le ventole riprendono, si apre il Centro comunicazioni.
**Indizio:** la default route manomessa puntava a un nodo `NODE-X` non presente nell'inventario.
**Da Unity:** `PacketTraceGame`, `NetworkSimulator`, `RouteEntry`, `TraceHop/TraceResult`, `TopologyView`.

## 3 — FIREWALL ARCHITECT · Atto II · Centro comunicazioni
**Perché:** servizi legittimi bloccati, mentre traffico verso `NODE-X` passa ancora.
**IRIS spiega:** il firewall legge le regole dall'alto, vince la prima che corrisponde, in fondo c'è "nega tutto"; TCP vs UDP; porte come "sportelli" dei servizi.
**Interfaccia:** pannello di regole a cartellini metallici (sorgente, destinazione, protocollo, porta, ALLOW/DENY) da riordinare; lista requisiti con spie; simulatore di traffico con log "quale regola ha deciso".
**Attività:** 1) rendere verdi i requisiti (telemetria UDP, console HTTPS, DNS); 2) una regola troppo larga sopra una specifica: riordinare; 3) (verifica) traffico di prova nuovo che i requisiti non coprivano: trovare la regola che lo lascia passare.
**Errori previsti:** ALLOW any in alto; porta giusta ma protocollo sbagliato; bloccare il DNS e rompere tutto.
**Vittoria:** tutti i requisiti verdi e nessun traffico verso `NODE-X` consentito.
**Conseguenza:** l'allarme rosso del Centro comunicazioni si spegne, la luce torna stabile.
**Indizio:** nel log: tentativi di uscita verso `NODE-X` sulla porta 53 → il DNS.
**Da Unity:** `FirewallArchitectGame`, `FirewallRule`, `RuleAction`, `Protocol`, `RuleDragHandle`.

## 4 — DNS BLACKOUT · Atto II · Centro comunicazioni
**Perché:** i terminali raggiungono destinazioni sbagliate pur con rete e firewall a posto.
**IRIS spiega:** il DNS è la rubrica nomi → indirizzi; il resolver chiede per noi e conserva le risposte in cache per un tempo (TTL); se la cache contiene una risposta falsa, tutti la ricevono.
**Interfaccia:** console DNS a schede: Record, Cache, Log, Resolver; viaggio della domanda sulla mappa; prompt `nslookup`.
**Attività (3 missioni):** 1) record A errato nella zona; 2) dominio malevolo da bloccare; 3) cache avvelenata: trovare la voce che non corrisponde all'autorità, eliminarla, svuotare la cache, attivare la verifica delle risposte (DNSSEC, in forma semplificata).
**Errori previsti:** correggere solo il record e dimenticare la cache; cancellare record legittimi; fidarsi della prima risposta.
**Vittoria:** ogni nome verificato con `nslookup` porta all'indirizzo giusto.
**Conseguenza:** i terminali della stazione mostrano di nuovo i servizi corretti; si apre l'Ufficio tecnico (la sua serratura dipendeva da un nome DNS).
**Indizio:** le risposte false indicavano lo stesso `NODE-X`; la prima avvelenata risale a dopo un accesso con credenziali di manutenzione.
**Da Unity:** `DnsBlackoutGame`, `DnsService`.

## 5 — PHISHING DETECTIVE · Atto III · Ufficio tecnico
**Perché:** come sono state usate le credenziali di manutenzione? Il protagonista recupera l'archivio di posta.
**IRIS spiega:** il phishing inganna le persone, non le macchine; il mittente visualizzato può mentire; link e allegati vanno letti, non solo guardati; SPF/DKIM dicono se un server era autorizzato e se il messaggio è integro.
**Interfaccia:** client di posta archivistico (stile terminale per ufficio anni '80–'90): elenco, messaggio, "ispettore" che mostra mittente reale, URL reale, allegato, header.
**Attività:** 5 email (2–3 legittime). Per segnalarne una servono **almeno 2 indizi** raccolti cliccando. Poi: bloccare il dominio malevolo, isolare la postazione che ha aperto l'allegato.
**Errori previsti:** segnalare per un solo indizio (es. tono urgente in un'email legittima); fidarsi del logo; ignorare SPF fail.
**Vittoria:** classificazione corretta con indizi sufficienti.
**Conseguenza:** indizio nel fascicolo; la porta del Laboratorio di diagnostica si apre.
**Nota narrativa obbligatoria:** l'email è **un** pezzo dell'incidente, non la causa unica. IRIS: «Questo spiega un accesso. Non spiega tutto.»
**Da Unity:** `PhishingDetectiveGame` (la Fase Rossa "costruisci una campagna" non si porta).

## 6 — INCIDENT RESPONSE · Atto III · Laboratorio di diagnostica
**Perché:** ci sono abbastanza indizi per smettere di riparare a caso e capire l'incidente.
**IRIS spiega:** log = memoria dei sistemi; sintomo ≠ causa; contenere prima di ripulire; preservare le evidenze; fasi NIST: preparazione · rilevamento e analisi · contenimento, eradicazione e ripristino · attività post-incidente.
**Interfaccia:** banco log (righe selezionabili) + timeline a cartellini da ordinare + mappa per isolare i sistemi + elenco azioni.
**Attività:** 1) selezionare le righe correlate e ordinarle in timeline (email → accesso manutenzione → modifica gateway → route → firewall → DNS → cancellazione log); 2) contenimento: isolare i sistemi giusti senza spegnere l'antenna; 3) preservare le evidenze **prima** di ripristinare; 4) ripristino da backup puliti; 5) lezioni apprese.
**Tempo:** niente timer; ma ogni azione fa avanzare l'orologio dell'incidente, e se si contiene tardi un sistema in più risulta coinvolto (conseguenza spiegata, non punizione).
**Errori previsti:** ripristinare prima di contenere; cancellare i log "sporchi"; isolare tutto.
**Vittoria:** timeline corretta, contenimento senza danni collaterali, evidenze preservate.
**Conseguenza:** i sistemi compromessi si spengono uno a uno; la sala antenne riceve alimentazione.
**Da Unity:** `IncidentResponseGame` (3 scenari → 1 scenario principale + 1 di verifica).

## 7 — RED TEAM ARENA · Atto IV · Sala antenne (simulazione IRIS)
**Perché:** prima di riaccendere il collegamento, verificare che la rete ricostruita non abbia le stesse debolezze.
**IRIS spiega:** vulnerabilità, superficie di attacco, Red Team e Blue Team come due sguardi sullo stesso problema.
**Interfaccia:** laboratorio di simulazione: griglia "sandbox" nettamente diversa dalla stazione reale (bordo tratteggiato, etichetta SIMULAZIONE), dispositivi da collegare e configurare.
**Attività:** Fase Blu: costruire la rete (PC, router, firewall, server, switch) finché i due test funzionali passano. Fase Rossa: 4 scenari simulati, ciascuno mostra percorso, punto debole e contromisura: accesso remoto in chiaro con password di fabbrica; servizio di condivisione file esposto; password debole; dispositivo che si finge il gateway nella rete locale. Torna Blu, correggi, riprova.
**Limiti:** solo concetti e simulazione; nessun comando, payload o procedura applicabile a sistemi reali.
**Vittoria:** rete funzionante e tutti e 4 gli scenari bloccati.
**Conseguenza:** IRIS conferma la configurazione → sequenza finale di ripristino nella stazione reale.
**Da Unity:** `RedTeamArenaGame`, `FinalWaves` (eventuale ripresa per il ripristino finale, senza ondate a tempo).
