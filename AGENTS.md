# AGENTS.md — proyecto-torneos

## LEYES DEL PROYECTO (no negociables — prevalecen sobre cualquier sugerencia)

- Regla de Oro Backend: SOLO enmiendas ADITIVAS, jamás refactor de lógica existente. Tocar lógica compartida = "Clase C": requiere visto explícito del dueño ANTES. Prop/enmienda sin consumidor SE REVIERTE (precedente W8).
- Edits: busca/reemplaza por bloques ENTEROS, nunca líneas parciales. Tras CADA edit: `grep -nE "<ancla>" <archivo>` para confirmar. `grep` con `grep -rnE`, NUNCA `rg`. Batch = archivos COMPLETOS cuando son nuevos. Si un anchor no matchea: PARAR y pedir el fragmento real, NO improvisar.
- Stack: alias `torneos/*`, NUNCA `@/*`. Next 15 App Router · tRPC v11 · Prisma 6 · Tailwind v4 (tokens `@theme` Cypher en `globals.css`). Advertencia `package.json#prisma` deprecada (Prisma 7): conocida, NO tocar.
- Verificación obligatoria con salida pegada: `rm -rf .next && npx tsc --noEmit` (0 errores en archivos del batch) y `npx next build` para el cierre de wave. Errores en archivos FUERA del batch: reportar, NO arreglar por iniciativa.
- Contratos: antes de usar un componente/procedure, ver su firma REAL (`grep`/`cat`). El front jamás ofrece lo que el engine rechaza (espejar zod exacto). P1017 en migraciones = infra (DB caída): reintentar, no "arreglar".
- UI: optimistic `onMutate`/`onError`/`onSettled`. Toast ABAJO, jamás `toast-top`. Acentos jamás informativos; terminales Badge `neutral`; confirmación irreversible = `ConfirmModal`; doble-toque solo fila/tile reversible. Sin estilos inline (excepciones: CSS vars dinámicos, `columns`, SLOTS posicionales). `LoadingSkeleton` sin texto. Bogotá `es-CO`. `dayOfWeek` 0=domingo, `timeSlot` 0–11.
- Nav/rutas: `BottomNav` intocable. `/torneos` público vive en `(anon)`, JAMÁS moverlo a `(app)`. `signOut` solo en `notification-center` (punto único). Escenas `/design`: `pt-14 pb-28`.

T3 Stack: Next.js 15 App Router + tRPC v11 + Prisma 6 (PostgreSQL) + NextAuth v5 + Tailwind v4. Import alias `torneos/*` → `./src/*` (`tsconfig.json`). No test framework installed — there is no `test` script.

## Commands

- `npm run dev` (uses `--turbo`), `npm run build`, `npm run preview` (= build + start)
- Verify: `npm run check` (= `next lint && tsc --noEmit`). Also `npm run typecheck`, `npm run lint` / `lint:fix`, `npm run format:check` / `format:write` (prettier + tailwindcss plugin).
- DB: `npm run db:push` (prototype without migration), `npm run db:generate` (= `prisma migrate dev`, creates a migration), `npm run db:migrate` (= `migrate deploy`, prod/CI), `npm run db:studio`, `npm run db:seed` (= `tsx prisma/seed.ts`). `postinstall` runs `prisma generate`.
- Seed is deterministic (PRNG seed 42) and idempotent via upserts: `admin@admin`, `gestor@gestor`, `test1@test`…`test30@test` (captains: test1, test16), 3 courts, leagues/cups fixtures.

## Env / DB setup

- Env schema is `src/env.js` (`@t3-oss/env-nextjs`, `emptyStringAsUndefined: true`). Required: `DATABASE_URL` (url), `AUTH_GOOGLE_ID/SECRET`, `AUTH_DISCORD_ID/SECRET`; `AUTH_SECRET` required only in production. New vars must be added to both `.env.example` and `src/env.js`.
- `.env` is gitignored; local dev currently points at Supabase Postgres. `SKIP_ENV_VALIDATION=1` skips validation (Docker builds). `start-database.sh` is the T3 default local-Docker helper — unused with the current Supabase URL.
- Prisma: `prisma/schema.prisma`, provider `postgresql`, generator `prisma-client-js` (default output). After schema changes run `db:generate` (dev) and re-seed if needed.

## Architecture — put code in the right layer

- `src/server/api/routers/*.ts` — thin tRPC routers only (zod input → delegate). Register new routers in `src/server/api/root.ts`.
- `src/server/core/<modulo>/*.engine.ts` — all business logic lives here (e.g. `tournament/tournament.engine.ts`, `enrollment.engine.ts`, `slotHold.engine.ts`). Never put rules in routers or components.
- `src/domain/*` — pure framework-free functions shared front/back (`availability/conflict.ts`, `standings/sort.ts`, `stats/fair-play.ts`, `tournament-slots.ts`).
- Frontend pattern "Materializar → Sembrar → Vivir": RSC `page.tsx` fetches via `src/trpc/server.ts` and passes `initialData` → `'use client'` template in `src/components/features/` seeds TanStack Query → `src/components/ui/` are pure renderers that must NEVER import tRPC/hooks.
- Route groups: `src/app/(anon)` showcase, `(app)` authenticated shell, `(auth)` login/onboarding, `api/` only `auth/[...nextauth]` + `trpc/[trpc]`. Specs per system live in `context/SISTEMA_*.md` (Spanish) — consult before changing business rules.

## Auth / tRPC gotchas

- Procedures in `src/server/api/trpc.ts`: `publicProcedure` (vitrina reads only), `protectedProcedure`, `permissionProcedure("<code>")` (RBAC via `RoleAssignment→Role→Permission`, seed codes in `prisma/seed.ts`), `managerProcedure` (injects active `Manager` into ctx; per-tournament ownership still checked in engines).
- NextAuth v5 (`src/server/auth/config.ts`): Discord + Google; Credentials "Dev Login" exists ONLY when `NODE_ENV=development` (auto-creates user+profile+player+availability). Session JWT carries `profileId`/`onboarded` — `middleware.ts` casts `req.auth.user` for it.
- `src/middleware.ts`: `/api` and `/trpc` never redirect; anon allowlist is exactly `/`, `/torneos`, `/canchas/<id>`, `/torneos/<id>` (see `src/lib/anon-access.ts` — keep edge-safe, no runtime imports); unauthenticated others → `/login?callbackUrl=…`; non-onboarded → `/onboarding`; `callbackUrl` must pass `isSafeInternalPath`.
- `timingMiddleware` adds a random 100–500ms delay to every tRPC call in dev — not a bug.
- No cron jobs: slot-hold expiry (`TournamentSlotHold`) and cleanups use lazy purge at request time.
- `Tournament.dayOfWeek/timeSlot` scalars remain the source of truth (vitrina, holds, fixture); `TournamentSlot` multi-franja is additive and the auto-scheduler still uses only the principal slot. Derived stats (`PlayerStats`, `TeamStats`, `TournamentStanding`) are persisted in `$transaction`, never computed by joins at runtime.


ESTADO: Wave 11 — Gestor (EN CURSO — enmiendas emitidas, aplicar en orden)
Aplicado y certificado (NO re-hacer)
E1: entrada /invitaciones desde /equipos (fila Mail + badge) ✅
E2 backend: zod reschedule min(0).max(11) ✅
E3 delegación (Clase C, VISTO otorgado): ManagerDelegate migrada, helpergetMatchForManagerAction exportado con rama delegación, 6 gates bajados aprotectedProcedure, endurecimientos H-1 (assignReferee) y H-2 (result.engine),router delegation montado en root ✅
E4: tournament.listMine + pestaña Gestor en perfil + DelegatesSection ✅
E5: TournamentSlot migrada, create con slots opcionales, wizard en(app)/gestor/torneos/nuevo, modal W5 eliminado ✅
Higiene H1–H8 (stat-card onTap, TabBar readonly, narrowing) ✅