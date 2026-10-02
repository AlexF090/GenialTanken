# Roadmap GenialTanken

Ziel: GenialTanken als Fullstack-Showcase neu aufbauen (Angular + NestJS im Monorepo).

Datenquellen: aktuelle Preise, keine Historie.

- **Frankreich (primär):** staatliche Open Data von prix-carburants.gouv.fr über das Portal des Wirtschaftsministeriums (`data.economie.gouv.fr`, Datensatz `prix-des-carburants-en-france-flux-instantane-v2`). Kein Key nötig, Geo-Suche serverseitig, 50.000 Anfragen pro Tag.
- **Deutschland (optional):** tankentanken-API, aktiv sobald ein API-Key gesetzt ist.

## Entscheidungen

- **Monorepo:** pnpm Workspaces mit den offiziellen CLIs (Angular CLI, Nest CLI), ohne Nx. Grund: `@nx/nest` unterstützte NestJS 12 nicht, die Plugin-Schicht blockiert Framework-Updates. Bei zwei Apps bringen Build-Cache und `affected` kaum Nutzen.
  - `apps/web` – Angular
  - `apps/api` – NestJS
  - `packages/contracts` – geteilte DTO-Typen und zod-Schemas
- **Rolle von NestJS:** Backend-for-Frontend (BFF) vor den Preisquellen. Jede Quelle ist ein Provider hinter der Schnittstelle `FuelPriceProvider`; der BFF führt alle aktiven Provider zusammen und liefert ein einheitliches Format ans Frontend.
- **Module:** ESM durchgehend (Nest-12-Default)
- **Tests:** Vitest überall (Angular- und Nest-12-Default), Supertest für API-E2E, Playwright für Browser-E2E
- **Lint:** ESLint Flat Config im Root (typescript-eslint strict, angular-eslint inkl. Template-Accessibility)

## Phase 1 – BFF-Proxy (aktuell)

- [ ] API-Key aus dem Frontend-Bundle entfernen, nur noch als Env-Variable im Backend
- [ ] NestJS-API aufsetzen (TypeScript strict, `@nestjs/config`)
- [ ] Provider-Modul: Frankreich (data.economie.gouv.fr) und Deutschland (tankentanken, optional) hinter gemeinsamer Schnittstelle
- [ ] Feature-Module, z. B. `stations`, `prices`
- [ ] Validierung mit zod über Nests eingebaute `StandardSchemaValidationPipe` (zod 4 implementiert Standard Schema; `nestjs-zod` unterstützt Nest 12 noch nicht), Schemas aus `packages/contracts`
- [ ] Caching mit `@nestjs/cache-manager` (In-Memory, später austauschbar)
- [ ] Rate-Limit mit `@nestjs/throttler`
- [ ] OpenAPI-Doku mit `@nestjs/swagger`
- [ ] Health-Endpoint mit `@nestjs/terminus`
- [ ] Tests: Vitest (Unit) und Supertest (E2E)
- [ ] Angular ruft nur noch den BFF auf
- [ ] Favoriten bleiben vorerst im localStorage, aber hinter einem Service abstrahiert

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

| Teil                  | Dienst                  | Hinweise                               |
| --------------------- | ----------------------- | -------------------------------------- |
| Frontend (`apps/web`) | Cloudflare Pages (Free) | Statischer Angular-Build               |
| Backend (`apps/api`)  | Render Free Web Service | Build direkt aus Dockerfile im Repo    |
| Datenbank (Phase 2)   | Neon Free (Postgres)    |                                        |
| CI                    | GitHub Actions          | Öffentliches Repo, unbegrenzte Minuten |

Umsetzung:

- Dockerfile für `apps/api`: Multi-Stage-Build, schlankes Node-Image
- GitHub Actions: Lint, Tests, Build; Deploy über Render-Auto-Deploy bzw. Deploy-Hook
- Secrets (optionaler tankentanken-API-Key) als Render-Env-Variablen
- CORS im BFF auf die Cloudflare-Pages-Domain beschränkt
- Health-Endpoint als Render-Healthcheck
- Cold Start (ca. 1 Minute nach 15 Minuten Inaktivität): Frontend zeigt Ladezustand beim ersten Request

## Warum dieser Stack

Fullstack-Stellen fragen vor allem nach Datenbank-Erfahrung (PostgreSQL, ORM wie Prisma), Auth sowie sauberem API-Design. Bewusst schlankes Monorepo-Setup ohne Nx: weniger Kopplung, Framework-Updates ohne Wartezeit auf Plugins.
