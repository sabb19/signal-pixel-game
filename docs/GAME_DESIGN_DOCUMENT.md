# SIGNAL — Game Design Document

> Versione 0.2 · 12/11/2026 · **Premessa e personaggi aggiornati: vale `NARRATIVE_BIBLE.md` v0.2** (Myra, rifugiata senza competenze tecniche, stazione abbandonata, IRIS scoperta nel gioco). · Ambito: **demo completa** (inizio → finale, tutti e 7 i minigiochi).
> Nome della stazione: `[STAZIONE]` (AURORA non confermato).
> Ipotesi in attesa di conferma sono marcate **[DA CONFERMARE]**.

## 1. Concept
Avventura narrativa 2D top-down in pixel art, per browser. Un giovane tecnico, al primo turno in una vecchia stazione terrestre per comunicazioni satellitari, resta isolato dopo un attacco informatico. Con l'aiuto di IRIS, il vecchio sistema operativo della stazione, impara a diagnosticare e ripristinare la rete fino a ricevere di nuovo una voce umana.

**Frase guida:** una connessione è la possibilità di raggiungere qualcuno e di essere raggiunti.

## 2. Target e obiettivi
- **Pubblico:** studenti delle superiori e principianti assoluti di reti **[DA CONFERMARE]**.
- **Durata demo:** 60–90 minuti.
- **Obiettivo didattico:** fondamenti di IP/subnet/gateway, routing, firewall, DNS, phishing, incident response, verifica delle difese.
- **Obiettivo emotivo:** isolamento → fiducia in IRIS → sollievo del contatto umano.

## 3. Genere e pilastri
1. **La cybersecurity è il linguaggio del mondo**: si agisce sulla stazione attraverso terminali e configurazioni.
2. **Ogni soluzione cambia la stazione**: luce, porte, macchinari, suono.
3. **Si impara sbagliando senza punizione**: errori spiegati, nessun game over, nessun timer.
4. **Silenzio e atmosfera**: pochi testi, ambienti che raccontano.

## 4. Core gameplay loop
```
Esplora la stazione → trova un sistema che non risponde → IRIS inquadra il problema
→ minigioco (contesto · spiegazione · prova · feedback) → la stazione cambia
→ nuova area / nuovo indizio → il concetto viene riusato nel problema successivo
```

## 5. Comandi
- Frecce / WASD: movimento in 4 direzioni.
- E / Spazio: interagire. Esc: menu/uscita dal terminale. Tab: fascicolo (documenti e indizi raccolti). H nei minigiochi: aiuto.

## 6. Personaggi
- **Protagonista:** giovane tecnica, giacca da lavoro marrone, sciarpa rossa, zaino (design in `ART_DIRECTION_BIBLE.md` §4). Nessun nome pronunciato **[DA CONFERMARE]**. Silenziosa: parla solo tramite scelte brevi al terminale.
- **IRIS:** nessun corpo. Si esprime con testo, un volto stilizzato che compare solo sugli schermi, spie, una voce controllata. Tono che evolve: tecnica → attenta → personale (ambigua) → «Non siamo più soli.»
- **Assenti:** il resto del personale esiste solo in tracce (note, registrazioni, tazze, armadietti). Nessun personaggio secondario controllato.

## 7. Storia (demo)
Ispirata alle conseguenze di attacchi reali alle infrastrutture satellitari (KA-SAT, 24/02/2022), **senza ricostruirne la tecnica**: l'attacco del gioco è inventato.

| Atto | Cosa succede | Aree | Minigiochi |
|---|---|---|---|
| I — The Arrival | Inizio turno. IRIS presenta la stazione. Il terminale della sala controllo non raggiunge il gateway. | Ingresso/corridoio, Sala controllo | 1 Network Defender |
| II — The Silence | Si interrompono i collegamenti esterni. Alcuni sistemi rispondono, altri no; poi traffico che non dovrebbe esserci; poi i terminali raggiungono destinazioni sbagliate. Luci di emergenza. | Sala server, Centro comunicazioni | 2 Packet Trace, 3 Firewall Architect, 4 DNS Blackout |
| III — The Last Connection | Il protagonista ricostruisce cosa è successo: email archiviate, log, timeline. Isola i sistemi compromessi. | Ufficio tecnico, Laboratorio diagnostica | 5 Phishing Detective, 6 Incident Response |
| IV — Signal | IRIS apre una simulazione isolata per verificare le nuove difese. Poi il ripristino: l'antenna si riallinea e arriva una voce umana. | Sala antenne | 7 Red Team Arena, ripristino finale |

Filo investigativo (ogni minigioco consegna un indizio al successivo):
gateway modificato → rotta che devia verso un nodo sconosciuto → regola firewall che lascia uscire quel traffico → risposte DNS che puntano allo stesso nodo → un'email che chiedeva le credenziali di manutenzione (indizio, non unica causa) → timeline: accesso, modifiche, cancellazione dei log → verifica che la configurazione ricostruita non abbia le stesse debolezze.

## 8. Ambientazione e level design (demo: 7 stanze)
| Stanza | Funzione | Stato iniziale → dopo la riparazione |
|---|---|---|
| Ingresso e corridoio | Tutorial movimento, interazione, primo dialogo con IRIS | Luce piena → nell'Atto II luci di emergenza → Atto IV luce calda |
| Sala controllo | Hub, terminale principale, mappa della stazione | Monitor in errore → mappa di rete accesa |
| Sala server | Rack, ventole, cablaggio | Porta chiusa (si apre dopo il minigioco 1) → spie verdi dopo il 2 |
| Centro comunicazioni | Firewall e DNS | Allarme rosso intermittente → stabile dopo il 3 e il 4 |
| Ufficio tecnico | Archivio email, oggetti personali | Buio → lampada accesa, archivio leggibile |
| Laboratorio diagnostica | Log, oscilloscopi, isolamento | Accesso dopo il 5 → banco di isolamento attivo dopo il 6 |
| Sala antenne | Finale | Bloccata → simulazione IRIS (7) → antenna, trasmissione |

Si può tornare in ogni stanza già aperta. Ogni stanza ha 2–4 oggetti narrativi utili (nessun oggetto inutile).

## 9. Minigiochi (sintesi; dettagli in `MINIGAMES_SPECIFICATION.md`)
Ciclo fisso: **contesto → spiegazione di IRIS → prova → feedback → conseguenza → verifica**.
Aiuti: 1) orienta, 2) indica il concetto, 3) esempio guidato. Gli errori di comprensione ricevono una spiegazione; gli errori di esecuzione (es. un errore di battitura nel comando) solo una correzione.

| # | Interfaccia | Il giocatore deve | Conseguenza |
|---|---|---|---|
| 1 Network Defender | Terminale di configurazione CRT | Leggere IP/mask/gateway, trovare il gateway fuori subnet (poi un caso con mask errata), correggerlo, verificare con `ping` | Sala controllo online, porta sala server sbloccata |
| 2 Packet Trace | Mappa grafica della rete con pacchetti animati | Seguire il percorso, leggere la tabella di routing, trovare la rotta errata, correggerla | Spie dei rack verdi, accesso al Centro comunicazioni |
| 3 Firewall Architect | Pannello di regole a schede | Ordinare e scrivere regole ALLOW/DENY (sorgente, destinazione, protocollo, porta), testarle con traffico simulato | Allarme spento, traffico anomalo bloccato |
| 4 DNS Blackout | Console DNS | Confrontare richieste/risposte, trovare la voce avvelenata in cache, eliminarla, verificare con `nslookup` | I terminali raggiungono le destinazioni corrette; si apre l'Ufficio tecnico |
| 5 Phishing Detective | Client di posta archivistico | Classificare email valutando più indizi: mittente, dominio, link, allegati, SPF/DKIM | Indizio nel fascicolo, accesso al Laboratorio |
| 6 Incident Response | Banco log + timeline | Ordinare gli eventi, distinguere sintomi e cause, scegliere contenimento, preservare le evidenze, pianificare il ripristino (fasi NIST) | Sistemi compromessi isolati, sala antenne alimentata |
| 7 Red Team Arena | Laboratorio di simulazione IRIS | Costruire una piccola rete virtuale, osservare le debolezze, simulare attacchi controllati, applicare contromisure, riverificare | Configurazione validata → ripristino finale |

La simulazione del 7 è completamente fittizia: nessun comando o tecnica utilizzabile su sistemi reali.

## 10. Progressione e sblocchi
Lineare tra gli atti, libera dentro un atto quando possibile (nell'Atto II il 3 e il 4 dopo il 2). Le porte bloccate mostrano sempre perché sono chiuse (spia, messaggio di IRIS).

## 11. Interfacce
Tutte diegetiche: CRT fosforo, pannelli industriali, carta. Stessa famiglia visiva (cornici, font bitmap, palette), forme diverse per funzione. Nessun pulsante web generico. Medaglie, punteggi e classifica **non** fanno parte della demo **[DA CONFERMARE]**.

## 12. Sound design
Ronzio costante degli impianti, ventole, passi, terminali, porte. Musica rara. Il silenzio cresce negli Atti II–III; il ripristino riporta i suoni degli impianti uno a uno. Voce di IRIS: testo con suono di segnale; voce registrata **[DA CONFERMARE]**.

## 13. Salvataggio
Autosave dopo ogni minigioco e a ogni cambio di stanza. Menu: Continua / Nuova partita.

## 14. Fuori dalla demo
Deposito, zona manutenzione e sala radio come aree esplorabili; lingua inglese; modalità extra di rigioco.
