# Estructura del Proyecto — el PORQUÉ de cada capa (`proyecto-torneos`)

> **Versión:** 2.0 (auditoría post-W11, doc vs código, 2026-09)
> **Naturaleza:** descriptiva + reglas de conservación. No prescribe estructura nueva:
> explica por qué existe cada carpeta, cómo saber si un archivo está mal ubicado
> y qué violaciones hay que limpiar. Prevalece `AGENTS.md`.

## 0. La idea en una frase

Cada carpeta responde a una frontera que Next.js o el dominio imponen:
`domain/` = lo que ambos mundos necesitan sin I/O · `server/core/` = I/O y
transacciones · `routers/` = validación y transporte · `ui/` = píxeles sin datos ·
`features/` = vida cliente por dominio · `app/` = rutas y grupos de acceso.

Si un archivo puede vivir en una capa más barata (más arriba en esa lista),
está mal ubicado.

## 1. Capas y sus porqués (verificadas)

### 1.1. `src/domain/` — lógica pura isomórfica
**Porqué:** fórmulas que servidor (persistir) y cliente (pre-visualizar) necesitan
sin duplicar: Fair Play, orden de tabla, CONFLICT, aritmética de franjas.
**Test de pertenencia:** si importa `torneos/server`, `@prisma/client`, `next*`
o `next-auth`, NO es domain → mover a `core/`.
**Estado:** LIMPIO (0 imports impuros en 8 archivos; solo un comentario menciona
`@prisma/client` en `status-labels.ts:12`). Deuda: `status-labels.ts` triple
vocabulario inconsistente (`DRAFT=warning` vs `DRAFT=neutral`, P3).

### 1.2. `src/server/core/<modulo>/*.engine.ts` — negocio con I/O
**Porqué:** reglas + transacciones Prisma + auth en un lugar testeable sin Next
ni tRPC. 12 engines.
**Test:** si no toca BD/auth/tiempo, quizá es `domain/`. Si vive en un router,
está mal (ver §2.1).

### 1.3. `src/server/api/routers/` — Zod + delegación
**Porqué:** tRPC es transporte, no lugar de reglas. Router = `input(zod)` →
`engine.*` → `output`. Registrar en `root.ts` (hoy 15).
**Test:** más de ~15 líneas o un `db.<modelo>.<verbo>` fuera de un `select`
trivial = lógica fugada → bajar a engine.

### 1.4. `src/components/ui/` — píxeles sin datos
**Porqué:** Server Components por defecto = cero JS al cliente. Reciben todo por
props.
**Test:** importar `trpc`, `useQuery`/`useMutation` o `server/` = violación.
**Estado:** LIMPIO (0 matches, verificado). Sub-criterio vigente: raíz = átomos
genéricos (`button`, `badge`, `toast`…); subcarpetas = moléculas de dominio
(`court-form`, `team-card`, `tournament/`…). Las moléculas son presentacionales,
no van a `features/` mientras no tengan hooks/datos.
**Patrón grid vs matrix** (intencional, documentado en código):
`court-availability-grid` = lectura; `court-availability-matrix` = edición admin.
Nombres casi idénticos por decisión, no por accidente.

### 1.5. `src/components/features/<dominio>/` — vida cliente por dominio
**Porqué:** templates `'use client'` + rows + hooks co-localizados. Si se borra
una feature, se borra su hook (no hay `src/hooks/` global; no existe).
**Test:** importar `torneos/server/` = violación (verificado: 0).
Estructura interna libre pero plana: archivos del dominio a la raíz del dominio;
nada de `src/components` anidados (ver §2.2).

### 1.6. `src/app/` — rutas = grupos de acceso
`(anon)` vitrina (JAMÁS mover a `(app)`) · `(app)` shell con onboarding dentro ·
`(auth)` login/login-dev · `design/` escenas por wave · `api/` solo
`auth/[...nextauth]` + `trpc/[trpc]`.

### 1.7. Resto con dueño
`providers/` (globales) · `lib/` (puros edge-safe: `anon-access`, `utils`;
`hub.ts`/`session.ts` pendientes de auditar, no afirmar) · `styles/globals.css`
(tokens Cypher) · `trpc/` (react/server/query-client).

## 2. Violaciones y basura (verificado en disco, 2026-09)

### P0 — roto ahora
1. **Árbol fantasma:** `features/tournament/src/components/features/tournament/create-tournament-wizard.tsx`
   es el ÚNICO wizard; el import canónico de `(app)/gestor/torneos/nuevo/page.tsx:1`
   apunta a `features/tournament/create-tournament-wizard` (inexistente).
   Fix: mover el archivo a la raíz del dominio y borrar el árbol `src/` anidado
   (apareció hoy 10:39, probable batch mal aplicado).
2. **`manager-match-template.tsx(174,85)` TS1382** — error SINTÁCTICO que, demostrado
   con micro-repro, **enmascara todos los semánticos del programa** (el TS2307 del
   wizard no se reporta mientras exista). Regla de verificación nueva: ante
   cualquier TS1xxx, corregir primero y RE-correr `tsc`; "1 error" no significa
   "1 problema".

### P1 — lógica en routers (bajar a engine)
`team.getMyTeams/getById` · `court.list/getById/getAvailability(+Public)` ·
`match.markAbsent/getById/getByIdPublic/listByTournament` ·
`enrollment.listByTournament` · `availability.getMine` · `result.load` escribe
`notes` post-engine.

### P2 — archivos muertos (borrar con aprobación)
- `components/templates/` entero: solo `onboarding/use-onboarding.ts` con
  0 importadores (el vivo es `features/onboarding/use-onboarding.tsx`).
- `ui/court-availability-grid/court-availability-matrix.variants.ts`: copia
  huérfana (el matrix importa de su propia carpeta; 0 refs a la copia).
- `api/routers/post.ts` (ni registrado en `root.ts`) + `app/_components/post.tsx`.
- `test-fetch.ts` (scratch de conectividad, 03/09).
- `generated/prisma/` (output legacy 03/09; el schema usa default + `postinstall`;
  `tsconfig` lo excluye).

### P3 — decidir destino
- `prototipo/*.html` (pre-React; tocado hoy 10:39 por el mismo batch): archivar
  fuera del repo o borrar.
- `start-database.sh`: helper T3 sin uso (DB real = Supabase). Marcar no-usar.
- `TournamentSlot` creado sin scheduler multi-franja (deuda declarada en schema).

## 3. Dónde escribir código (conservado de v1, vigente)

| Necesidad | Lugar | Ejemplo |
|---|---|---|
| Tabla/relación | `prisma/schema.prisma` | nuevo modelo + `db:generate` + seed |
| Regla con I/O | `server/core/<modulo>/*.engine.ts` | sorteo, holds, Factor 1/2 |
| Endpoint | `api/routers/<modulo>.ts` | Zod→engine + registro en `root.ts` |
| Función pura | `src/domain/<modulo>/` | Fair Play, sort, CONFLICT |
| Pantalla | `(anon)/(app)/page.tsx` + `features/` | RSC `initialData` → template siembra Query |
| Visual reutilizable | `ui/` (átomo raíz / molécula subcarpeta) | card, badge, modal puros |
| Tokens | `styles/globals.css` | Cypher `@theme` |

## 4. Cómo conservarla limpia (checklist por cambio)

1. ¿Mi archivo pasa el test de pertenencia de su capa (§1)? Si no, mover.
2. ¿Creé `index.ts` re-exportador, `src/` anidado o dupliqué un nombre entre
   `ui/` y `features/`? Revertir el patrón.
3. ¿El router tiene Prisma directo o el `ui/` tiene hooks? Bajar a engine / subir
   datos por props.
4. `npx tsc --noEmit`: si hay TS1xxx, fix-first y re-correr (enmascaran todo).
5. Nada de secretos, snapshots pegados ni scratch (`test-*.ts`) en el repo.
6. Todo hook (useState/useQuery/useMutation/useUtils) va junto a los
   existentes, JAMÁS tras un `return` temprano (loading/error/guards): el
   conteo cambia entre renders y React crashea ("Rendered more hooks").
