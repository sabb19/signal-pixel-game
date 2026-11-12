# SIGNAL — Cybersecurity Learning Design

> Versione 0.1 · 12/11/2026 · Pubblico ipotizzato: studenti delle superiori, principianti assoluti **[DA CONFERMARE]**.

## 1. Principio
Il giocatore non studia la rete: la **usa per riparare la stazione**. Ogni concetto entra quando serve, si prova subito e ha un effetto visibile.

## 2. Ciclo per ogni minigioco
| Passo | Come appare in SIGNAL | Durata indicativa |
|---|---|---|
| 1 Contesto | Un sistema della stazione non risponde; IRIS lo segnala | 30 s |
| 2 Spiegazione | IRIS: 2–4 righe + un piccolo schema animato | ≤ 1 min |
| 3 Sperimentazione | Missione guidata (primo passo evidenziato) | 3–5 min |
| 4 Feedback | Immediato, dice **perché** | — |
| 5 Applicazione | La stazione cambia (luce, porta, suono) | 10–20 s |
| 6 Verifica | Ultima missione senza guida, o il concetto riusato nel minigioco successivo | 2–4 min |

## 3. Mappa dei concetti e prerequisiti
```
IP ─ subnet mask ─ gateway ─ ping            (1)
        └──► pacchetto ─ router ─ tabella di routing ─ ritorno   (2)
                 └──► porte ─ TCP/UDP ─ regole ─ ordine        (3)
                          └──► DNS ─ resolver ─ cache ─ poisoning    (4)
fattore umano: phishing ─ mittente ─ URL ─ allegati ─ SPF/DKIM      (5)
tutto insieme: log ─ timeline ─ sintomo/causa ─ contenimento ─ NIST (6)
prospettiva: vulnerabilità ─ superficie d'attacco ─ Red/Blue ─ verifica continua (7)
```
Nessun concetto compare prima dei suoi prerequisiti. Le porte (3) servono a capire perché il DNS usa la 53 (4) e perché Telnet/23 è un rischio (7).

## 4. Obiettivi di apprendimento (al termine il giocatore sa…)
| # | Obiettivo verificabile | Dove si verifica |
|---|---|---|
| 1 | Dire se un gateway è nella stessa subnet di un host /24 e correggerlo; distinguere configurazione errata da destinazione irraggiungibile | NetDef missioni 2–3 |
| 2 | Leggere una tabella di routing semplice e trovare la rotta mancante o errata, compreso il ritorno | Packet Trace missione 3 |
| 3 | Ordinare regole ALLOW/DENY perché una regola specifica non sia oscurata da una generica | Firewall missione 3 |
| 4 | Spiegare cosa fa un resolver e perché svuotare una cache avvelenata | DNS missione 3 |
| 5 | Giudicare un'email combinando almeno 2 indizi, incluso SPF/DKIM | Phishing |
| 6 | Ordinare una timeline, scegliere contenimento prima di ripristino, preservare le evidenze | Incident Response |
| 7 | Collegare una debolezza alla contromisura e riverificare | Red Team Arena |

## 5. Aiuti
1. **Orienta:** «Guarda il gateway del terminale. In quale rete si trova?»
2. **Concetto:** «Con mask /24 i primi tre numeri indicano la rete. Il gateway deve avere gli stessi tre numeri.»
3. **Esempio guidato:** un caso diverso risolto passo per passo, poi si torna al proprio.
Gli aiuti non risolvono mai direttamente il caso del giocatore.

## 6. Errori
| Tipo | Esempio | Risposta |
|---|---|---|
| Comprensione | gateway `10.0.20.1` per host `10.0.10.21/24` | IRIS spiega con lo schema della subnet |
| Esecuzione | `pign 10.0.10.1`, IP con 5 ottetti | «Comando non riconosciuto. Forse: ping.» |
| Esplorazione | provare una regola e annullarla | Nessun commento: sperimentare è permesso |
Tre errori di comprensione consecutivi → IRIS propone il primo aiuto (non lo impone).

## 7. Adattamento
Ripreso da `LearnerLevel` di Unity, semplificato e invisibile: se il giocatore usa molti aiuti, le spiegazioni successive includono un esempio in più; se non ne usa, IRIS è più breve. Nessuna etichetta "Base/Avanzato" a schermo.

## 8. Fascicolo
Ogni concetto appreso diventa una scheda nel fascicolo (Tab): definizione breve, schema, "nella stazione", "nella realtà". Il glossario contestuale di Unity (`GlossaryData`) è la base dei testi.

## 9. Accuratezza
- Indirizzi solo da intervalli privati o di documentazione (10.0.0.0/8, 192.0.2.0/24, 203.0.113.0/24).
- Fasi NIST: SP 800-61 (4 fasi). SPF/DKIM descritti nel loro scopo, non nel formato completo.
- KA-SAT citato solo come ispirazione nei crediti/note; l'attacco del gioco è inventato.
- Red Team: solo concetti; nessuna procedura offensiva reale.
- Revisione di ogni testo didattico prima del rilascio (checklist in `TESTING_CHECKLIST.md`).
