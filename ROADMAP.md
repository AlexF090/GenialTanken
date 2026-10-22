# Roadmap GenialTanken

Ziel: GenialTanken als Fullstack-Anwendung neu aufbauen (Angular + NestJS im Monorepo).

Datenquellen: aktuelle Preise, keine Historie.

- **Frankreich (primär):** staatliche Open Data von prix-carburants.gouv.fr über das Portal des Wirtschaftsministeriums (`data.economie.gouv.fr`, Datensatz `prix-des-carburants-en-france-flux-instantane-v2`). Kein Key nötig, Geo-Suche serverseitig, 50.000 Anfragen pro Tag.

## Entscheidungen

- **Monorepo:** pnpm Workspaces mit den offiziellen CLIs (Angular CLI, Nest CLI), ohne Nx. Grund: `@nx/nest` unterstützte NestJS 12 nicht, die Plugin-Schicht blockiert Framework-Updates. Bei zwei Apps bringen Build-Cache und `affected` kaum Nutzen.
  - `apps/web` – Angular
  - `apps/api` – NestJS
  - `packages/contracts` – geteilte DTO-Typen und zod-Schemas
- **Rolle von NestJS:** Backend-for-Frontend (BFF) vor den Preisquellen. Jede Quelle ist ein Provider hinter der Schnittstelle `FuelPriceProvider`; der BFF führt alle aktiven Provider zusammen und liefert ein einheitliches Format ans Frontend.
- **Module:** ESM durchgehend (Nest-12-Default)
- **Tests:** Vitest überall (Angular- und Nest-12-Default), Supertest für API-E2E, Playwright für Browser-E2E
- **Lint:** ESLint Flat Config im Root (typescript-eslint strict, angular-eslint inkl. Template-Accessibility)
- **Git-Hooks und Draft-CI:** lefthook prüft vor jedem Commit Formatierung und Lint der gestagten Dateien, vor jedem Push Typecheck und Unit-Tests. Fehler fallen so lokal auf statt erst in der CI. Die CI überspringt Draft-PRs; PRs werden als Draft eröffnet und erst im fertigen Zustand auf „Ready for review“ gestellt. Zwischenstände lösen so weder CI-Läufe noch Preview-Deploys aus.
- **Cloudflare Workers statt Pages:** Das Frontend läuft als Worker `genialtanken` mit Static Assets (`apps/web/wrangler.jsonc`) statt als Pages-Projekt. Gründe: Cloudflare empfiehlt Workers für neue Projekte, im Free-Tier gibt es keinen Unterschied, und SPA plus `/api`-Proxy funktionieren über Static Assets (`not_found_handling: single-page-application`) mit `run_worker_first` für `/api/*`. GitHub Actions deployt (`wrangler deploy` für `main`, `wrangler versions upload --preview-alias pr-<Nummer>` für PRs); die Wrangler-Konfiguration kommt dabei nur vom Default-Branch, damit kein PR Build-Befehle mit den Deploy-Secrets ausführen kann. Der Mapbox-Token ist auf die Produktions-URL beschränkt (Mapbox kennt keine Wildcards), PR-Previews zeigen deshalb OpenStreetMap-Kacheln.
- **Suchradius:** 1 bis 30 km.
- **Vorerst nur Frankreich:** Der deutsche Provider (tankentanken-API) ist entfernt, ebenso die Ortssuche in Deutschland. Grund: Die deutsche Quelle steht nicht zur Verfügung. Die Architektur bleibt mehrländerfähig (`FUEL_PRICE_PROVIDERS`, Länderpräfix in Stations-IDs, Routing der Sammelabfrage nach Präfix); ein weiteres Land kommt als neuer Provider dazu, der alte Code liegt in der Git-Historie. Gespeicherte Favoriten mit `de-…` meldet die API als nicht verfügbar.

## Phase 1 – BFF-Proxy (umgesetzt)

- [x] API-Key aus dem Frontend-Bundle entfernen, nur noch als Env-Variable im Backend
- [x] NestJS-API aufsetzen (TypeScript strict, `@nestjs/config`)
- [x] Provider-Modul: Frankreich (data.economie.gouv.fr) hinter gemeinsamer Schnittstelle (Deutschland war angebunden und ist wieder entfernt, siehe Entscheidungen)
- [x] Feature-Modul `stations` (ein eigenes `prices`-Modul war nicht nötig: Preise kommen immer mit der Station)
- [x] Validierung mit zod über Nests eingebaute `StandardSchemaValidationPipe` (zod 4 implementiert Standard Schema; `nestjs-zod` unterstützt Nest 12 noch nicht), Schemas aus `packages/contracts`
- [x] Caching mit `@nestjs/cache-manager` (In-Memory, später austauschbar)
- [x] Rate-Limit mit `@nestjs/throttler`
- [x] OpenAPI-Doku mit `@nestjs/swagger`
- [x] Health-Endpoint mit `@nestjs/terminus`
- [x] Tests: Vitest (Unit) und Supertest (E2E)
- [x] Angular ruft nur noch den BFF auf
- [x] Favoriten bleiben vorerst im localStorage, aber hinter einem Service abstrahiert

Offene Punkte aus dem Review (Follow-ups):

- [x] Größenbegrenzung des In-Memory-Caches (LRU über `@cacheable/memory`, `CACHE_MAXIMUM_ENTRIES`, Standard 5000 Einträge)
- [ ] Echter HTTP-Status 404 für unbekannte Routen; mit Static Assets und `not_found_handling: single-page-application` liefert der Cloudflare Worker die SPA mit 200 aus (bräuchte SSR oder Routing-Logik im Worker)
- [x] Favoriten gebündelt in einem Request laden statt einem Request pro Favorit (`GET /api/stations/by-identifiers`, bis zu 50 IDs pro Request)
- [ ] Favoriten auch beim Upstream gebündelt abfragen: eine Abfrage mit `where id in (...)` statt einer Upstream-Anfrage pro ID

## Phase 2 – Persistenz (geplant)

- [ ] PostgreSQL, gehostet bei Neon
- [ ] Prisma als ORM
- [ ] Favoriten und Einstellungen in der Datenbank speichern
- [ ] Identifikation zunächst über Geräte-ID
- [ ] Frontend-Service von localStorage auf API umstellen

## Phase 3 – Auth (geplant)

- [ ] Echtes Login per Magic Link oder OAuth
- [ ] Geräte-ID-Daten auf Benutzerkonto übertragen

## Hosting (alles kostenlos)

Vorgabe: Alles muss dauerhaft kostenlos laufen. Keine kostenpflichtigen Dienste einführen; falls etwas nur kostenpflichtig geht, vorher nachfragen.

| Teil                  | Dienst                    | Hinweise                                                             |
| --------------------- | ------------------------- | -------------------------------------------------------------------- |
| Frontend (`apps/web`) | Cloudflare Workers (Free) | Statischer Angular-Build als Static Assets + Worker als `/api`-Proxy |
| Backend (`apps/api`)  | Render Free Web Service   | Build direkt aus Dockerfile im Repo                                  |
| Datenbank (Phase 2)   | Neon Free (Postgres)      |                                                                      |
| CI                    | GitHub Actions            | Öffentliches Repo, unbegrenzte Minuten                               |

Umsetzung:

- Dockerfile für `apps/api`: Multi-Stage-Build, schlankes Node-Image
- GitHub Actions: Lint, Tests, Build; Deploy über Render-Auto-Deploy bzw. Deploy-Hook
- Secrets (geteiltes Proxy-Secret) als Render-Env-Variablen
- `/api/*` läuft über den Cloudflare Worker zum BFF (gleiche Origin, `run_worker_first`): keine API-URL im Build, PR-Previews funktionieren ohne CORS-Pflege. Der Worker reicht die Client-IP mit einem geteilten Secret weiter, damit das Rate-Limit pro Nutzer greift und nicht fälschbar ist.
- CORS im BFF zusätzlich auf die Worker-Domain (`genialtanken.alexf090.workers.dev`) beschränkt (zweite Verteidigungslinie für direkte Aufrufe)
- Health-Endpoint als Render-Healthcheck
- Cold Start (ca. 1 Minute nach 15 Minuten Inaktivität): Frontend zeigt Ladezustand beim ersten Request

## Warum dieser Stack

Die nächsten Phasen ergänzen, was einer Fullstack-Anwendung noch fehlt: Datenbank (PostgreSQL, Prisma), Auth und ein sauberes API-Design darüber. Bewusst schlankes Monorepo-Setup ohne Nx: weniger Kopplung, Framework-Updates ohne Wartezeit auf Plugins.
