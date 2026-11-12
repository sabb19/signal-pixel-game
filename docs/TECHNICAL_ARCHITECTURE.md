# SIGNAL — Technical Architecture

> Versione 0.1 · 12/11/2026 · Stato: approvata la scelta Phaser + TypeScript. Nessun codice scritto.
> Obiettivo: **demo web app** giocabile dall'inizio alla fine, con **tutti e 7 i minigiochi**.

## Scelte
| Tema | Scelta | Motivo |
|---|---|---|
| Piattaforma | Web app statica (HTML/JS), giocabile da browser desktop; mobile non prioritario | Richiesta: web app |
| Engine | **Phaser 3.80.x** | 2D, tilemap, camera, collisioni Arcade, animazioni sprite, pipeline WebGL con fallback Canvas |
| Linguaggio | TypeScript 5.4 (strict) | Tipi per la simulazione di rete |
| Build | Vite 4.5.x | Compatibile con Node 16 installato su questo Mac (Vite 5 richiede Node 18+) |
| Test | Vitest 0.34.x | Porting dei test di `Simulation/` |
| Mappe | Tiled (`.tmj`), tile 32×32 | Layer separati, oggetti interattivi come object layer |
| Salvataggio | `localStorage` (con try/catch), un solo slot + autosave a ogni conseguenza | Semplice e sufficiente per la demo |
| Deploy | `vite build` → cartella `dist/` pubblicabile su qualsiasi hosting statico | Nessun server |

## Rendering
- Risoluzione interna **640×360**, `pixelArt: true`, `roundPixels: true`.
- Scaling **intero** (×2, ×3, ×4) con bande nere; mai scaling frazionario.
- Camera che segue il protagonista con lerp leggero, limitata ai bordi della stanza.

## Layer (dal basso)
1. Pavimento (tilemap)
2. Pareti basse / dettagli a terra
3. Oggetti e protagonista, ordinati per Y (depth = y)
4. Pareti alte / soffitto che coprono il protagonista
5. Luce: RenderTexture in *multiply* (buio) + sprite luce in *add*
6. Particelle (polvere, scintille)
7. Post-effetto CRT leggero (solo dentro le interfacce, non sul mondo)
8. UI diegetica (dialoghi IRIS, prompt di interazione)

## Struttura del codice
```
src/
  main.ts            config Phaser, scaling
  core/              SaveSystem, GameState (flag della stazione), Input, Debug (solo import.meta.env.DEV)
  sim/               porting di Simulation/ (C#, ~2.250 righe): NetAddress, NetNode, NetLink,
                     RouteEntry, FirewallRule, DnsService, NetworkSimulator, Packet, Trace*
  world/             StationScene, RoomLoader (Tiled), Door, Interactable, StationStateApplier
  actors/            Player (movimento 4 direzioni, collisioni, animazioni)
  fx/                Lighting, Flicker, Dust, CrtShader
  iris/              IrisDialogue (coda messaggi, tono per atto), IrisTerminal
  minigames/
    MinigameScene.ts base comune: ciclo didattico, 3 livelli di aiuto, errori, verifica
    netdefender/  packettrace/  firewall/  dns/  phishing/  incident/  redteam/
  content/           testi IT (dialoghi, lezioni, log, email) separati dal codice
  audio/             AudioManager (ambiente, sfx, voce IRIS)
tests/               vitest per sim/ e per la logica di verifica di ogni minigioco
public/assets/       tilesets/ sprites/ fx/ ui/ audio/ maps/
```

## Stato del mondo
Un unico oggetto `GameState` con flag (es. `gatewayRestored`, `dnsCachePurged`) e l'atto corrente.
Ogni stanza, porta, luce e terminale legge i flag all'ingresso e reagisce agli eventi:
il minigioco cambia solo il flag; è `StationStateApplier` a cambiare il mondo (luci, porte, monitor).

## Minigiochi
- Ogni minigioco è una **Scene Phaser** aperta sopra la stazione (la stazione resta in pausa sotto).
- Logica di verifica **pura** (in `minigames/*/logic.ts`, testabile), interfaccia separata (`*/view.ts`).
- Interfacce disegnate con sprite/bitmap font pixel, **non** con HTML/DOM, per restare nel mondo di gioco.
  Eccezione ammessa: input di testo del terminale tramite tastiera catturata da Phaser.

## Debug (solo sviluppo)
`?debug` + `import.meta.env.DEV`: teletrasporto tra stanze, set dei flag, apertura diretta di un minigioco, collisioni visibili. Escluso dalla build di produzione.

## Riuso dal progetto Unity
Dal progetto Unity si prendono **solo i 7 minigiochi di cybersecurity** (logica, simulazione di rete, contenuti didattici).
Grafica, oggetti, ambienti, personaggi, UI e storia di "The Last Signal" **non** si riusano: SIGNAL ha grafica e mondo nuovi.

| Da Unity | Destinazione | Modo |
|---|---|---|
| `Simulation/*.cs` + test | `src/sim/` + `tests/` | Porting 1:1, poi adattamento |
| Testi didattici, aiuti, debrief | `src/content/` | Riscrittura nel tono di SIGNAL e IRIS |
| `NetCli` (comandi terminale) | `minigames/*/terminal` | Porting |
| Mondo 3D, builder, UI uGUI, medaglie, Sfida | — | Non portati |

## Rischi
- **Asset:** tutta la pixel art va prodotta. Mitigazione: segnaposto coerenti con la palette fin dal giorno 1, sostituiti stanza per stanza.
- **Node 16:** versioni bloccate compatibili; consigliato aggiornare a Node 20 più avanti.
- **Audio nel browser:** parte solo dopo il primo input (schermata titolo "premi un tasto").
