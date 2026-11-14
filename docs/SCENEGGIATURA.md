# SIGNAL — Sceneggiatura v1.0 (versione hackathon)

> Sostituisce la trama del NARRATIVE_BIBLE v0.x. Struttura: prologo · 3 capitoli · finale · epilogo.
> Ogni capitolo: **esplorazione → simulazione in IRIS Tracer → intervento sulla rete vera → interludio**.
> La guerra è sempre presente: radio, sirene, luce che salta, messaggi di altre persone che tornano a parlarsi.

---

## Personaggi

**MYRA (Myroslava Kovalenko), 17 anni.** Profuga. Separata dalla madre durante l'evacuazione. Non sa niente di reti: impara con il giocatore. Testarda, ironica quando ha paura.

**IRIS.** Sistema di supporto della stazione. Nessun volto: solo una forma d'onda ciano. SILENCE l'ha isolata ma non distrutta. Parla poco, in modo preciso; con Myra, piano piano, impara a scherzare. Ha un obbligo che si è data: *nessuno tocca la rete vera senza averla capita.* Per questo allena Myra con le simulazioni.

**SILENCE.** Arma informatica lasciata nella rete della stazione all'inizio della guerra. Non ha odio e non ha volto: esegue un ordine, *nessuno trasmette*. Si manifesta come schermi che si spengono, configurazioni cambiate, una forma d'onda piatta e grigia. Parla solo per frasi di sistema.

**OLEH KOVALENKO** (solo voce, dai nastri). Padre di Myra, tecnico della stazione. La notte dell'attacco ha provato a fermare SILENCE. Ha salvato IRIS. Non è più tornato.

**LA MADRE** (solo voce, nel finale).

---

## PROLOGO — «La città spenta» (cutscene)

**1. INT. CASA — NOTTE.** Una radio accesa sul tavolo.
> NARRAZIONE (Myra): Da noi la radio restava accesa tutta la notte. Finché parlava, voleva dire che qualcuno, da qualche parte, era ancora lì.
> RADIO: …attacchi informatici alle reti di comunicazione. Intere regioni isolate…
> NARRAZIONE: In guerra non cadono solo le case. Cadono anche le voci.

**2. EXT. STAZIONE FERROVIARIA — NOTTE.** Folla, sirene. Il telefono di Myra.
> NARRAZIONE: Il giorno dell'evacuazione io e mia madre ci siamo perse tra la folla.
> SCHERMO: «nessun servizio».
> NARRAZIONE: Il suo ultimo messaggio è arrivato alle 4:12. «Se ci perdiamo, cerca un segnale. Io ascolterò.»

**3. INT. RIFUGIO — GIORNO.** La mappa del padre.
> NARRAZIONE: Mio padre era tecnico in una stazione satellitare in montagna. Diceva che da lassù si parla con tutto il mondo.
> NARRAZIONE: La stazione si è spenta la prima notte di guerra. Anche lui non è più tornato.

**4. EXT. MONTAGNE — GIORNO, NEVE.** Myra cammina; l'antenna all'orizzonte.
> NARRAZIONE: I centri di accoglienza ascoltano ancora la radio. Se riesco a trasmettere da lassù, lei mi sentirà.

**5. INT. STAZIONE — NOTTE.** Buio, una luce rossa che lampeggia.
> NARRAZIONE: Non so niente di reti. So solo che non posso restare ferma ad aspettare.

→ titolo **SIGNAL**. Gioco: sala controllo al buio (tutorial: movimento, quadro elettrico, console).

---

## CAPITOLO 1 — «Rete» (sala controllo → laboratorio)

**Il risveglio di IRIS** (in gioco, alla console):
> IRIS: …Utente non registrato. Chi sei?
> MYRA: Myra. Myra Kovalenko.
> IRIS: Kovalenko. …Oleh Kovalenko era il tecnico di turno.
> MYRA: Era mio padre.
> IRIS: (pausa, l'onda si spezza) La rete è stata modificata la notte dell'attacco. Indirizzi sbagliati, porte spente, strade che non portano da nessuna parte. Qualcosa è ancora dentro. Lo chiamo SILENCE: il suo unico scopo è che nessuno trasmetta.
> MYRA: Allora lo riparo.
> IRIS: Non ancora. Un errore sulla rete vera e SILENCE se ne accorge. Prima ti alleno. Ho ricostruito la rete del laboratorio in simulazione.

**Il patto (spiega la rigiocabilità):**
> IRIS: Ogni simulazione è diversa. Ogni volta che sbagli, impari dove si rompe una rete. Quando sarai pronta, la rete vera.

**Simulazioni:** IRIS Tracer 1.1 → 1.2 → 1.3 (indirizzi, router, rotte).
**Rete vera:** Myra configura il router della stazione (versione "studente" con la rete reale).
**Conseguenza:** le luci si accendono, i monitor tornano. Alla radio, gracchiando:
> VOCE SCONOSCIUTA: …qui Leopoli, centro accoglienza tre… qualcuno mi sente?
> MYRA: (sottovoce) Funziona.
> IRIS: Una rete riparata non è un cavo. Sono persone che tornano a parlarsi.

**SILENCE reagisce:** uno schermo si spegne da solo.
> SISTEMA: [SILENCE] modifica rilevata. Ripristino in corso.
> IRIS: Ci ha visti.

**Interludio «La notte»** (già nel gioco): generatori al limite, il letto, due scelte con IRIS, il nastro del padre.
> NASTRO (Oleh): …se qualcuno trova questo… SILENCE non è un guasto, è un'arma… ho chiuso IRIS dove non può raggiungerla… Myroslava, se sei tu…

---

## CAPITOLO 2 — «Filtro» (Sala Comunicazioni)

**Apertura:** sirene lontane, la luce salta. La porta blindata della Sala Comunicazioni è in quarantena.
> IRIS: SILENCE ha aperto il filtro della stazione. Chiunque può entrare e uscire. È così che si nasconde: in mezzo al traffico normale.
> MYRA: Allora chiudiamo tutto.
> IRIS: Se chiudi tutto, chiudi anche noi. Un filtro non è un muro. È una lista di invitati.

**Simulazioni:** IRIS Tracer 2.x — VLAN (separare i reparti), ACL (chi passa e chi no, l'ordine conta), NAT (uscire senza mostrare la rete interna).
**Rete vera:** la porta blindata si apre.
**Scoperta:** il badge del padre sulla postazione.
> MYRA: Era qui anche quella notte.

**Radio:** un'altra città è al buio.
> RADIO: …attacco alle reti di Kharkiv… stesso schema di…
> IRIS: SILENCE non è solo qui. È una copia. Ce ne sono altre.

**SILENCE si mostra** (cutscene breve): tutti gli schermi della sala diventano grigi, una forma d'onda piatta.
> SISTEMA: [SILENCE] trasmissione non autorizzata. Nessuno trasmette.
> IRIS: (onda tremante) È la prima volta che parla.
> MYRA: Allora ha paura anche lui.

---

## CAPITOLO 3 — «Indagine» (laboratorio, scrivania del padre)

**Apertura:**
> IRIS: SILENCE cambia le configurazioni e poi cancella le tracce. Ma non tutte. Ogni modifica lascia un segno nei registri.
> MYRA: Come impronte sulla neve.

**Simulazioni:** IRIS Tracer 3.x — usare `show running-config`, `show ip route`, i registri, per trovare cosa è stato cambiato: una rotta falsa, un DNS falsificato, una porta aperta.
**Rete vera:** Myra trova l'ultima modifica di SILENCE: un collegamento nascosto verso l'esterno.
**Scoperta:** nei registri, l'ultima sessione di Oleh. Il nastro ricostruito per intero:
> NASTRO (Oleh): Ho cinque minuti prima che mi stacchi. SILENCE non si può cancellare: si può solo isolare. Ho salvato IRIS fuori dalla sua portata. Chi trova questo: difendi la rete, poi attaccala tu, come farebbe lui. Solo così saprai che regge. …Myroslava, se sei tu: tua madre ha il mio vecchio indirizzo di frequenza. Ascolta sempre.
> MYRA: Lei ascolta.
> IRIS: Allora trasmettiamo.

---

## FINALE — «Difesa e attacco» (sala controllo)

**Cutscene breve:** Myra alla console centrale. Tutti i monitor accesi. L'antenna fuori, sotto la neve.
> IRIS: Quando accenderai l'antenna, SILENCE attaccherà con tutto quello che ha.

**Fase BLU — difesa.** Una topologia completa (tutta la stazione). Myra mette in sicurezza la rete usando i tre capitoli: indirizzi e rotte, filtro, controlli. SILENCE attacca dal vivo: cambia una rotta, apre una porta, finge un DNS.

**Fase ROSSA — attacco.**
> IRIS: Ora pensa come lui. Se fossi SILENCE, da dove entreresti?
Myra usa scansioni e prove per trovare le falle rimaste. Ogni falla trovata va chiusa. Il giocatore vede la propria rete dal punto di vista di chi attacca.

**Vittoria:**
> SISTEMA: [SILENCE] isolato. Nessun percorso disponibile.
> IRIS: Rete sicura. Antenna pronta.

---

## EPILOGO — «Il segnale» (cutscene)

**1. INT. SALA CONTROLLO — NOTTE.** Myra davanti al microfono.
> MYRA: Qui Myra Kovalenko, stazione di montagna. Cerco Olena Kovalenko. Mamma… sono io.

**2.** Silenzio. Solo il fruscio. L'onda di IRIS, ferma.
> IRIS: (piano) Aspettiamo.

**3.** Un crepitio. Una voce.
> MADRE: …Myra? Myra, sono la mamma. Ti sento.

**4. EXT. MONTAGNE — ALBA.** Una dopo l'altra, nelle valli, si accendono luci: altre reti tornano, altre famiglie si ritrovano.
> IRIS: Una rete riparata non è un cavo.
> MYRA: Sono persone che tornano a parlarsi.

→ titolo **SIGNAL**. Si sblocca il **Simulatore I.R.I.S. completo** (tutte le difficoltà).

---

## Riepilogo delle cutscene

| # | Nome | Quando | Immagini |
|---|---|---|---|
| 1 | La città spenta | Prologo | riuso: radio, telefono, mappa, viaggio, rifugio, interno · **nuova:** stazione ferroviaria/folla |
| 2 | SILENCE | Capitolo 2 | **nuova:** sala comunicazioni con schermi grigi (o effetto in gioco) |
| 3 | Il nastro | Capitolo 3 | in gioco (registratore, onda arancione) |
| 4 | La console | Finale | in gioco (sala controllo) |
| 5 | Il segnale | Epilogo | **nuove:** Myra al microfono · valli all'alba con le luci |
