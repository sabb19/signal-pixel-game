# SIGNAL — Development Roadmap

> Versione 0.1 · 12/11/2026 · Obiettivo: **demo web app completa**, con tutti e 7 i minigiochi.
> Dal progetto Unity si prendono solo i minigiochi di cybersecurity; grafica e oggetti sono nuovi.

| # | Fase | Contenuto | Fatto quando |
|---|---|---|---|
| 1 | Audit | `AUDIT_FASE1.md` | ✅ |
| 2 | Design | GDD, architettura, roadmap (✅); Narrative Bible, Learning Design, Minigames Specification | ✅ documenti scritti, ipotesi [DA CONFERMARE] aperte |
| 3 | Art Bible + prototipo | Art Direction Bible, Animation Spec, Asset List; progetto Vite+Phaser con una stanza di prova a 640×360, protagonista segnaposto, collisioni | ✅ 12/11/2026 — stanza di prova giocabile (`npm run dev`, `?debug`) |
| 4 | Vertical slice | Ingresso + Sala controllo, protagonista animato, IRIS, porta, salvataggio, audio base, **Network Defender** completo e sua conseguenza | ✅ 12/11/2026 — titolo, impostazioni, cutscene, tutorial al buio, risveglio di IRIS, Network Defender (3 missioni) e apertura della porta. Manca l'ambiente oltre la porta |
| 5a | Porting simulazione | `sim/` in TypeScript + test vitest (da `Simulation/` Unity) | Test verdi |
| 5b | Minigiochi 2–4 (Atto II) | Packet Trace, Firewall Architect, DNS Blackout + Sala server, Centro comunicazioni | Atto II giocabile |
| 5c | Minigiochi 5–6 (Atto III) | Phishing Detective, Incident Response + Ufficio, Laboratorio | Atto III giocabile |
| 5d | Minigioco 7 + finale (Atto IV) | Red Team Arena + Sala antenne, trasmissione finale | Demo completa dall'inizio alla fine |
| 6 | Espansione narrativa | Registrazioni, documenti, evoluzione di IRIS, eventi luce/suono | Ogni stanza ha i suoi elementi narrativi |
| 7 | Polish e test | `TESTING_CHECKLIST.md`, prestazioni, accessibilità, debug escluso dalla build | Checklist superata, build pubblicabile |

## Prossimo passo
Fase 2: `NARRATIVE_BIBLE.md`, `CYBERSECURITY_LEARNING_DESIGN.md`, `MINIGAMES_SPECIFICATION.md` (quest'ultimo partendo dal codice dei 7 minigiochi Unity).
