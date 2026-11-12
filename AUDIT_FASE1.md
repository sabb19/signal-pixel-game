# SIGNAL — Fase 1: Audit del progetto esistente

> Stato: bozza per decisione. Nessun codice modificato.
> Progetto analizzato: `~/Downloads/TheLastSignal_Progetto` (Unity), l'unico che contiene i sette minigiochi.
> Visti anche, solo come riferimento: `~/Desktop/2d game/prototipo/index.html` (prototipo canvas 2D) e `TheLastSignal_Progetto/web/` (abbozzo three.js "dead-link", 1 file).
> Limite: ho letto codice e documentazione, **non** ho aperto Unity né eseguito i test.

---

## 1. Architettura attuale

| Aspetto | Stato |
|---|---|
| Engine | Unity 6000.6.8f1, URP, nuovo Input System |
| Genere attuale | Gioco didattico **3D in prima persona** (`PlayerLook`, `PlayerMovement`) |
| Build | Mac e Windows desktop. **Nessuna build Web** |
| Scene | `MainMenu`, `Hangar`, `Meridiana`, generate **da codice** dai builder in `Assets/Scripts/Editor/*Builder.cs` |
| Codice | ~144 file C#; ~9.400 righe tra `Learning/Stations` e `Simulation` |
| Logica pura | `Assets/Scripts/Simulation/` è **indipendente da Unity** (rete, routing, firewall, DNS, generatore guasti), coperta da 20 test EditMode |
| Didattica | `StationGame` (base comune: cornice, aiuti a 3 livelli, punteggio), `LearningContent`, `LevelContent`, `GlossaryData`, `LearnerLevel` adattivo |
| Persistenza | `PlayerPrefs` (punteggi, medaglie, badge) |
| Lingue | IT nel codice + `en.txt` |
| Audio | Effetti e musica sintetizzati da codice (`Sfx`, `MusicSynth`, `AdaptiveMusic`) |
| Grafica | Kit 3D Quaternius CC0, personaggi 3D modellati in Blender (Bruno, Aiko, Nadia) |

## 2. Stato dei sette minigiochi

Tutti esistono, sono interattivi e seguono lo schema **Fase Blu (ripara) → Fase Rossa (attacca in sandbox) → Rapporto**.

| # | File | Righe | Cosa fa oggi | Valutazione rispetto a SIGNAL |
|---|---|---|---|---|
| 1 | `NetworkDefenderGame` | 430 | Aula 3B, PC con gateway errato, mappa + terminale (`ipconfig`, `ping`), poi Telnet/password di fabbrica | Nucleo IP/gateway/ping **ottimo e da tenere**. Manca un passo esplicito sulla **subnet mask** come causa. La Fase Rossa anticipa concetti del minigioco 7 |
| 2 | `PacketTraceGame` | 279 | Rotte e traceroute tra router | Coerente. Da verificare la lettura della tabella di routing |
| 3 | `FirewallArchitectGame` | 531 | Regole scritte e riordinabili (drag) | Coerente, include l'ordine delle regole |
| 4 | `DnsBlackoutGame` | 779 | Rubrica DNS, cache avvelenata | Coerente, il più ricco |
| 5 | `PhishingDetectiveGame` | 579 | Analisi email | Coerente. Da verificare la presenza di header SPF/DKIM |
| 6 | `IncidentResponseGame` | 593 | Fasi NIST | Coerente. Da verificare la timeline ordinabile |
| 7 | `RedTeamArenaGame` | 676 | Telnet, SMB, password, ARP | Coerente. Contenuti già "da sandbox", nessuna istruzione offensiva reale |
| + | `FinalMissionGame` | 403 | 5 ondate, barra integrità | Non previsto da SIGNAL: può diventare l'Atto III |

Componenti condivisi riusabili: `TopologyView` (mappa di rete), `TerminalView` + `NetCli` (terminale con comandi), `StationKit`.

## 3. Criticità principali (in ordine di gravità)

1. **Piattaforma e prospettiva sbagliate.** SIGNAL è 2D top-down pixel art per Web. Il progetto è 3D in prima persona per desktop. Il mondo 3D (Hangar, builder delle scene, modelli, camera, movimento) **non è riutilizzabile** in 2D: va rifatto in ogni caso.
2. **Narrativa incompatibile.** Oggi: IA antagonista "Entropia", squadra "Lanterna", equipaggio 3D, aula scolastica 3B, tono da hackathon. SIGNAL: protagonista isolato, IRIS come unica voce, nessun antagonista personificato, **nessun personaggio secondario**. Va riscritta la cornice di tutti i 7 minigiochi (situazioni, nomi dei dispositivi, battute).
3. **Gamification fuori tono.** Medaglie, badge, punteggi da 1200, classifica, Modalità Sfida con seed, timer: utili per la classe, ma in SIGNAL rischiano di trasformare l'esperienza in un quiz game. Proposta: tenerli solo come modalità extra dopo la storia, o rimuoverli dal flusso principale.
4. **Dipendenza da marchi.** Riferimenti diretti a Cisco / Packet Tracer / Networking Academy nei rapporti. Da decidere se restano (contesto hackathon) o diventano neutri.
5. **Interfacce dei minigiochi.** Oggi sono pannelli uGUI generati da codice, con la stessa cornice "Holo" per tutti. SIGNAL chiede interfacce diegetiche diverse per funzione (CRT, client di posta archivistico, pannello di regole...).
6. **Conseguenze nel mondo.** Oggi una postazione "ripresa" cambia colore e suono. SIGNAL chiede conseguenze spaziali: porte che si aprono, corridoi che si illuminano, nuove aree. Va progettato da zero.
7. **Atti assenti.** Ordine libero delle postazioni 1–6. SIGNAL chiede una progressione per atti con informazioni che passano da un minigioco al successivo.

## 4. Cosa mantenere

- **Tutta la logica di simulazione** (`Simulation/`): è il vero patrimonio tecnico, già testata.
- **Il contenuto didattico** dei 7 minigiochi: obiettivi, errori previsti, spiegazioni, debrief.
- **Aiuti a 3 livelli** (dove guardare → l'idea → la soluzione): corrispondono già al punto 9 del master prompt.
- **Livello adattivo** e "Sembra che tu sia bloccato" dopo 3 errori: già distingue tra sperimentare e restare bloccati.
- **Terminale con comandi** e **mappa di rete cliccabile**.
- **Glossario** contestuale.
- **Schema Blu/Rosso**: si adatta bene al Red Team Arena come "due prospettive sullo stesso problema".
- Menu Admin come base per il sistema di debug.

## 5. Fattibilità della direzione artistica

- 640×360 con tile 32×32 = 20×11,25 tile per schermata. Ok per stanze piccole e leggibili; con uno sprite 24×32 il personaggio è alto quanto un tile, proporzione corretta per il top-down.
- **Collo di bottiglia reale: gli asset.** Oggi non esiste nessun asset 2D. Uno sprite con 6 animazioni × 4 direzioni × 4–8 frame sono circa **130–170 frame** solo per il protagonista, più tileset e oggetti animati per ogni stanza. Senza un pixel artist questa è la parte più lenta e più a rischio.
- Proposta realistica: vertical slice con **2 stanze** (ingresso/corridoio + sala controllo), protagonista con idle + walk + interazione, 8–12 oggetti animati. Gli asset si producono a mano (Aseprite) secondo la Art Bible; non userei immagini generate come asset finali, per i problemi di coerenza tra frame che il prompt stesso segnala.
- Luce: layer di illuminazione separato (multiply + additivo) per gestire il passaggio stazione luminosa → zone buie → ripristino.

## 6. Architettura proposta

Due strade possibili. **Raccomando la B.**

**A — Restare in Unity, convertire in 2D + build WebGL**
- Pro: si conservano C# dei minigiochi e i test; Unity 2D ha Tilemap, Pixel Perfect Camera, luci 2D URP.
- Contro: tutto il mondo 3D va comunque rifatto; build WebGL URP pesante (decine di MB, caricamento lento, debole su mobile e Safari); le UI dei minigiochi vanno comunque ridisegnate; flusso "Claude non vede l'editor" lento.

**B — Nuovo progetto Web: TypeScript + Phaser 3 + Vite, in `~/Desktop/signal`**
- Pro: nativo per il browser, leggero; 640×360 pixel-perfect e scaling intero sono semplici; tilemap da Tiled; luce e particelle come layer separati; minigiochi come scene/overlay DOM-free con interfacce diegetiche; si verifica tutto nel browser.
- Contro: `Simulation/` va **portata da C# a TypeScript** (logica pura, ~2.500 righe stimate, con i test come riferimento). Il progetto Unity resta intatto come fonte.
- Non è una riscrittura da zero del contenuto: si portano simulazione, testi, aiuti e casi d'errore; si rifanno solo mondo e interfacce, che andrebbero rifatti anche restando in Unity.

Struttura proposta (B):
```
src/
  core/        loop, salvataggio, input, debug (solo in dev)
  sim/         rete simulata (porting di Simulation/, con test vitest)
  world/       mappe Tiled, collisioni, porte, interazioni, stato della stazione
  actors/      protagonista (sprite + animazioni)
  fx/          luce, particelle, CRT, sfarfallio
  iris/        dialoghi, voce, evoluzione del tono
  minigames/   uno per cartella, ognuno con la propria interfaccia
  content/     testi didattici e narrativi (IT, poi EN)
  audio/
assets/        tileset, sprite, suoni (separati per layer)
docs/          i 10 documenti richiesti
```

## 7. Struttura narrativa e distribuzione dei minigiochi

Nome della stazione: segnaposto `[STAZIONE]` (AURORA non confermato).

| Atto | Aree | Minigiochi | Conseguenza nel mondo | Filo investigativo |
|---|---|---|---|---|
| I — The Arrival | Ingresso/corridoio, Sala controllo, Ufficio tecnico | **1 Network Defender** | Il terminale locale torna online, la sala controllo si riaccende, si apre l'Ufficio tecnico | Un indirizzo del gateway modificato "da qualcuno": prima anomalia |
| II — The Silence | Laboratorio diagnostica, Sala server, Centro comunicazioni | **2 Packet Trace**, **3 Firewall Architect**, **4 DNS Blackout** | Luci del corridoio est, porta della sala server, terminali che risolvono di nuovo i nomi | Percorso anomalo → regola che lascia passare traffico verso l'esterno → risposte DNS verso un host estraneo |
| III — The Last Connection | Archivio/Ufficio, Deposito, Zona manutenzione | **5 Phishing Detective**, **6 Incident Response** | Evidenze raccolte nel fascicolo; isolamento dei sistemi compromessi; alimentazione della sala radio | Email sospette come *uno* degli indizi, non come causa unica; timeline completa dell'incidente |
| IV — Signal | Sala radio, Sala antenne | **7 Red Team Arena** (simulazione isolata di IRIS), poi ripristino finale | Antenna riallineata, trasmissione umana ricevuta | «Non siamo più soli.» |

Note:
- La Fase Rossa del Network Defender (Telnet) si sposta nel Red Team Arena, per non introdurre concetti offensivi prima del tempo.
- `FinalMissionGame` può diventare il ripristino finale dell'Atto III/IV, senza ondate a tempo.
- Ogni minigioco segue il ciclo del punto 9: contesto → IRIS spiega → sperimentazione → feedback → conseguenza → verifica (che riusa il concetto nel minigioco successivo).

## 8. Piano di sviluppo

| Fase | Contenuto | Prodotto verificabile |
|---|---|---|
| 1 | Audit (questo documento) | Decisione su architettura e punti aperti |
| 2 | GDD + Narrative Bible + Learning Design | `GAME_DESIGN_DOCUMENT.md`, `NARRATIVE_BIBLE.md`, `CYBERSECURITY_LEARNING_DESIGN.md`, `MINIGAMES_SPECIFICATION.md` |
| 3 | Art Direction Bible + prototipo tecnico | `ART_DIRECTION_BIBLE.md`, `ANIMATION_SPECIFICATION.md`, `ASSET_LIST.md`; scena di prova 640×360 con un tile e uno sprite segnaposto |
| 4 | Vertical slice | 2 stanze, protagonista animato, collisioni, porte, IRIS, Network Defender completo, conseguenza visibile, audio base, salvataggio |
| 5 | Minigiochi 2–7 | Porting della simulazione + interfacce dedicate, uno alla volta |
| 6 | Espansione narrativa | Aree, registrazioni, documenti, evoluzione di IRIS |
| 7 | Polish e test | `TESTING_CHECKLIST.md`, accessibilità, responsive, debug nascosto in produzione |

`TECHNICAL_ARCHITECTURE.md` e `DEVELOPMENT_ROADMAP.md` si scrivono dopo la decisione al punto 9.

## 9. Decisioni che servono prima della Fase 2

1. **Architettura:** A (Unity 2D + WebGL) o B (Phaser + TypeScript, raccomandata)?
2. **Medaglie, badge, Sfida, classifica:** rimuoverli, o tenerli come modalità extra dopo la storia?
3. **Riferimenti Cisco** nei rapporti: mantenerli o renderli neutri?
4. **Asset grafici:** c'è un pixel artist, o gli asset vanno prodotti da noi (pixel art disegnata a codice / a mano)? Cambia molto i tempi della vertical slice.
5. **Pubblico:** resta lo studente delle superiori principiante assoluto?
