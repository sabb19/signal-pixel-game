# SIGNAL — Art Direction Bible

> Versione 0.1 · 12/11/2026 · Tutta la grafica è nuova: nulla dal progetto Unity.
> Riferimenti (solo per qualità e approccio, mai da copiare): Eastward (densità e composizione), Signalis (isolamento, analogico), Fallout (retrofuturismo industriale).

## 1. Identità
Atomic Age · tecnologia della Guerra Fredda · retrofuturismo · design industriale · analogico · decadimento digitale.
Una stazione **usata per decenni**: vernice consumata, pannelli rifatti, cavi aggiunti, etichette a mano. Non un'astronave, non cyberpunk, niente neon.

## 2. Formato
| Voce | Valore |
|---|---|
| Risoluzione interna | 640×360, scaling solo intero |
| Tile | 32×32 |
| Prospettiva | Top-down a 3/4 (si vedono pavimento e il fronte delle pareti/oggetti) |
| Pareti | Fronte alto 2 tile (64 px) + bordo superiore 1 tile visto dall'alto |
| Protagonista | 24×32 px in un frame 32×32, piedi su riga 30 |
| Contorni | 1 px, colore scuro della stessa famiglia (non nero puro) |
| Luce | Da in alto a sinistra per l'ombreggiatura degli sprite; luci dinamiche separate |
| Anti-aliasing | Solo manuale, interno alle forme; mai sui bordi esterni |

## 3. Palette
Base (dal master prompt) + rampe derivate. Massimo **48 colori** totali nel gioco.

| Ruolo | Base | Rampa (scuro → chiaro) |
|---|---|---|
| Petrol dark (ombre, fondo) | `#182B2A` | `#0E1A1A` `#182B2A` `#22403C` |
| Industrial green (pareti) | `#304B43` | `#253A34` `#304B43` `#41625A` `#587A70` |
| Screen cyan (**solo** schermi, UI e IRIS) | `#3FA7B5` | `#12303A` `#1F5A66` `#3FA7B5` `#8FE3EA` |
| Lamp orange (luci calde, lampade, finestre) | `#D9853B` | `#8A4A22` `#D9853B` `#F2B66D` |
| Phosphor green (vecchi CRT anni '60–'70, strumenti) | `#A9B77B` | `#4E5A36` `#7E8B57` `#A9B77B` `#D6E0A8` |
| Jacket brown (protagonista) | `#8C6446` | `#4E3526` `#6B4A34` `#8C6446` `#A9805A` |
| Scarf red (protagonista, più scuro dell'allarme) | `#7A3A30` | `#4F241E` `#7A3A30` |
| Muted ochre (luci calde, etichette) | `#D3B46F` | `#8C7240` `#D3B46F` `#EBD39A` |
| Warm cream (carta, plastica) | `#E5D8B9` | `#BBA987` `#E5D8B9` `#F4EDDC` |
| Night blue (notte, vetri, atto II) | `#24364A` | `#16212F` `#24364A` `#3A5470` |
| Alarm red (**solo** allarmi e anomalie) | `#A94E42` | `#6E2E27` `#A94E42` `#D2766A` |
| Aged metal (macchinari) | `#74675B` | `#4A4139` `#74675B` `#9A8C7C` |
| Concrete (pavimenti) | `#B5A68D` | `#8A7D69` `#B5A68D` `#CDC1AA` |

Regole: il ciano si usa solo per schermi, interfacce e IRIS, mai per l'ambiente; il rosso allarme compare solo se qualcosa è guasto; le luci calde arancio contrastano il blu notte; ogni stanza ha un colore dominante diverso (vedi §6).

**Tavola di riferimento (12/11/2026, fornita dall'utente):** si adottano mood (bunker, notte, finestra sul cielo), contrasto blu freddo / arancio caldo, schermi ciano, densità degli ambienti e il design della protagonista. **Non** si adottano: IRIS come robot fisico, neon diffusi, minigiochi diversi dai 7 previsti (crittografia, password, backup), stanze fuori dalla demo (alloggi).

## 4. Protagonista
- Giovane tecnica: capelli neri spettinati a caschetto lungo, giacca da lavoro marrone con toppe e cuciture, sciarpa rossa scura, pantaloni blu notte, scarponi marroni, zaino grande sulla schiena; badge della stazione sulla giacca.
- Silhouette: zaino e sciarpa la rendono riconoscibile anche a 24 px.
- Nessuna arma, nessuna armatura, niente aspetto militare.
- 4 direzioni; destra = specchio di sinistra (zaino e sciarpa sono simmetrici).

## 5. Oggetti
- Ogni oggetto interattivo ha un **dettaglio luminoso** (spia, schermo) che segnala lo stato: spento / anomalia (rosso) / attivo (fosforo o ocra).
- Epoche distinguibili: anni '60 (metallo verniciato, manopole), anni '80 (plastica crema ingiallita, CRT), anni 2000 (rack grigi, LED).
- Stati separati come frame o sprite diversi: guasto, attivo, spento.

## 6. Stanze (demo)
| Stanza | Dominante | Luce | Elemento firma |
|---|---|---|---|
| Ingresso e corridoio | cemento + verde industriale | neon a soffitto freddi | bacheca turni |
| Sala controllo | blu notte + crema | monitor, lampada ocra | parete di CRT |
| Sala server | metallo + petrolio | LED dei rack | file di rack, cavi a soffitto |
| Centro comunicazioni | verde industriale + ocra | spia d'allarme | pannello radio |
| Ufficio tecnico | crema + legno ocra | lampada da scrivania | archivio, mangianastri |
| Laboratorio | metallo + petrolio | oscilloscopi | banco di misura |
| Sala antenne | blu notte | luce dalla finestra | finestra sul piatto dell'antenna |

Composizione: 1 punto focale per stanza, percorso libero largo almeno 2 tile, decorazione concentrata sui bordi, il centro leggibile.

## 7. Illuminazione per atto
| Atto | Ambiente | Effetto |
|---|---|---|
| I | luminoso, oscuramento 0–15% | neon stabili |
| II | 45–60% buio, luci d'emergenza rosse a impulsi lenti | zone d'ombra, monitor spenti |
| III | 60–70% buio, luce solo da lampade e monitor | contrasti marcati |
| IV | si torna a 10%, luce calda | le luci si accendono stanza per stanza |

## 8. UI e interfacce
- Font bitmap pixel (8 px e 16 px), costruito o scelto con licenza aperta.
- Cornici: metallo verniciato con viti agli angoli; schermi CRT con bordo arrotondato, scanline leggere (opacità ≤ 15%), lieve bagliore ciano.
- **IRIS:** un volto stilizzato (due occhi rettangolari e una linea per la bocca, stile tavola di riferimento) che appare **solo sugli schermi**: nel riquadro dei dialoghi e sui monitor vicini quando parla. Espressioni: neutra, attenta, "sorriso" appena accennato (solo Atti III–IV), disturbata (interferenza). Nessun corpo fisico.
- Avvisi: riquadro bordato rosso allarme con icona triangolare, solo per anomalie reali.
- Ogni minigioco: stessa cornice, forma interna diversa (terminale, mappa, pannello a cartellini, schede, posta, banco log, laboratorio).
- Niente icone moderne flat, niente angoli arrotondati da web app.

## 9. Placeholder
Nel prototipo gli asset sono rettangoli e forme generate da codice **con la palette definitiva**, alle dimensioni definitive, così la sostituzione non cambia la logica.

## 10. Pipeline asset (aggiornata 12/11/2026)
La pixel art disegnata da codice è stata abbandonata: qualità insufficiente.
- **Ambienti:** un'immagine generata con l'IA (Figma, file "SIGNAL – Asset generati") per stanza, 1536×864, mostrata a scala 0,5 (mondo 768×432). Contiene pavimento, muri e arredi fissi.
- **Profondità:** i mobili davanti ai quali si può passare sono ritagli della stessa immagine, ordinati per la loro base (`src/world/controlRoom.ts`, `OCCLUDERS`). Collisioni e punti di interazione sono definiti a mano sulle coordinate dell'immagine.
- **Elementi vivi separati:** sfarfallio dei monitor, spie, aloni delle lampade, polvere, velo d'allarme, buio per atto: tutti su layer sopra lo sfondo.
- **Protagonista:** foglio generato 4 direzioni × (fermo, passo), sfondo magenta reso trasparente al caricamento; scala 0,3 (circa 100 px di altezza nel mondo). Sostituisce le specifiche 24×32 dei §2 e §4 e di `ANIMATION_SPECIFICATION.md`.
- **Limite noto:** l'animazione di camminata ha 2 pose per direzione. Pose aggiuntive coerenti vanno generate e verificate una per una.
