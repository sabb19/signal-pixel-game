# SIGNAL — Animation Specification

> Versione 0.1 · 12/11/2026

## Protagonista (frame 32×32, sprite 24×32, origine ai piedi: x=16, y=30)
| Animazione | Frame | FPS | Loop | Direzioni | Note |
|---|---|---|---|---|---|
| idle | 4 | 5 | sì | 4 | respiro: spalle ±1 px, sciarpa che si muove di 1 px |
| walk | 6 | 10 | sì | 4 | passo a contatto/passaggio, testa ±1 px |
| interact | 4 | 10 | no | 4 | mano avanti, torna a idle |
| terminal | 6 | 8 | sì | su (+ laterali) | digita; schiena alla camera |
| door | 5 | 10 | no | 4 | spinge leva/maniglia |
| pickup | 5 | 10 | no | giù, lato | piega le ginocchia, oggetto al petto |

Totale stimato: ~120 frame (con specchio sinistra→destra dove possibile).
Velocità di camminata: 90 px/s; lo sprite di walk deve coprire ~9 px per ciclo a frame, per evitare l'effetto "pattinaggio".

Regole: palette e silhouette identiche in tutti i frame; nessun pixel che "salta" senza motivo; gli occhi restano allineati alla stessa riga.

## Ambiente
| Elemento | Frame | FPS | Funzione |
|---|---|---|---|
| CRT sfarfallio | 3 | casuale 0,5–2 s | stazione viva |
| Spia stato | 2 | 1–2 | stato del sistema (verde/ocra/rosso) |
| Ventola | 4 | 12 | rack attivi; ferma se il sistema è giù |
| Oscilloscopio | 8 | 8 | laboratorio, segnale cambia con il ripristino |
| Luce d'emergenza | tween | 0,5 Hz | Atto II–III |
| Porta | 5 | 12 | apertura/chiusura, con suono |
| Polvere | particelle | — | 10–20 particelle per stanza, nei fasci di luce |
| Antenna | 12 | 6 | finale |

Ogni animazione ambientale deve indicare uno stato o un'atmosfera precisa: niente effetti solo decorativi.
