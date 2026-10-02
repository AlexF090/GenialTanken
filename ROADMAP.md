# Roadmap GenialTanken

Ziel: GenialTanken als Fullstack-Showcase neu aufbauen (Angular + NestJS im Monorepo).

## Entscheidungen

- **Monorepo:** Nx mit pnpm als Paketmanager
  - `apps/web` – Angular
  - `apps/api` – NestJS
  - `packages/contracts` – geteilte DTO-Typen und zod-Schemas
- **Rolle von NestJS:** Backend-for-Frontend (BFF) vor der tankentanken-API

## Phase 1 – BFF-Proxy (aktuell)

- [ ] API-Key aus dem Frontend-Bundle entfernen, nur noch als Env-Variable im Backend
- [ ] NestJS-API aufsetzen (TypeScript strict, `@nestjs/config`)
- [ ] Zugriff auf tankentanken-API in eigenem Client/Service kapseln
- [ ] Feature-Module, z. B. `stations`, `prices`
- [ ] Validierung mit zod + `nestjs-zod`, Schemas aus `packages/contracts`
- [ ] Caching mit `@nestjs/cache-manager` (In-Memory, später austauschbar)
- [ ] Rate-Limit mit `@nestjs/throttler`
- [ ] OpenAPI-Doku mit `@nestjs/swagger`
- [ ] Health-Endpoint mit `@nestjs/terminus`
- [ ] Tests: Jest (Unit) und Supertest (E2E)
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

| Teil | Dienst | Hinweise |
| ---- | ------ | -------- |
| Frontend (`apps/web`) | Cloudflare Pages (Free) | Statischer Angular-Build |
| Backend (`apps/api`) | Render Free Web Service | Build direkt aus Dockerfile im Repo |
| Datenbank (Phase 2) | Neon Free (Postgres) | |
| CI | GitHub Actions | Öffentliches Repo, unbegrenzte Minuten |

Umsetzung:

- Dockerfile für `apps/api`: Multi-Stage-Build, schlankes Node-Image
- GitHub Actions: Lint, Tests, Build; Deploy über Render-Auto-Deploy bzw. Deploy-Hook
- Secrets (tankentanken-API-Key) als Render-Env-Variablen
- CORS im BFF auf die Cloudflare-Pages-Domain beschränkt
- Health-Endpoint als Render-Healthcheck
- Cold Start (ca. 1 Minute nach 15 Minuten Inaktivität): Frontend zeigt Ladezustand beim ersten Request

## Warum dieser Stack

Fullstack-Stellen fragen vor allem nach Datenbank-Erfahrung (PostgreSQL, ORM wie Prisma), Auth sowie sauberem API-Design. Nx ist im Angular-Enterprise-Umfeld verbreitet.
