# Contexto del Proyecto: Plataforma de Gestión de Torneos de Barrio

> **Estado:** En refactor (auditoría post-W11)
> **Versión:** 3.0
> **Última actualización:** 2026-09
> **Propósito:** Fuente única de verdad DESCRIPTIVA: describe el código tal cual es.
> Lo deseado-no-implementado vive en §12 Horizonte. La deuda marcada P0–P3.
> Antes de generar código, revisar este documento + el `.md` del sistema tocado.

## CHANGELOG v3.0 (auditoría post-W11, doc vs código)

- Naturaleza cambiada a descriptiva + §12 Horizonte + §13 Deuda P0–P3 (decisión del dueño).
- Eliminado duplicado literal de §7.6 (estaba pegado dos veces).
- Eliminada línea final con fragmento de credencial (`DBfutbol...`): jamás secretos en docs.
- §2 Stack corregido a dependencias reales (`motion`, sin Shadcn instalado, NextAuth v5).
- §3.2/§3.3 alineados con AGENTS.md (excepciones de style, alias `torneos/*`).
- §4 árbol regenerado desde disco (incluye `(anon)`, `gestor/`, `design/`, `delegation`, `domain/*`).
- §7.1: gestor SÍ delega (W11-E3 `ManagerDelegate`); §7.5: `lat/lon` existen, cascada W10 real (partidos→POSTPONED, nunca torneos→SUSPENDED); §7.3: DRAFT nace con 1 miembro, borrado es soft (`INACTIVE`); §7.6: sin cooldown, sin cross-torneo, `GRACE_PERIOD` muerto; §7.7: regla walkover del dueño + bug P0 documentado; §7.8: solo `result.load`, sin update/remove; §7.9: 16 tipos reales + decisión abierta de silencio; §7.10: Leaflet + `lat/lon`.
- §9 tabla con filenames reales (`_REFACTOR`) + S12.

---

## 1. Visión del Producto

Plataforma web **mobile-first** para la gestión de torneos de microfútbol en canchas barriales. Estética urbana (HipHop, Graffiti, FIFA Street). Digitaliza la organización: canchas, torneos, reclutamiento, partidos, aplazamientos y estadísticas.

---

## 2. Stack Tecnológico Base (verificado en `package.json` / disco)

| Tecnología | Real | Nota |
|---|---|---|
| Framework | Next.js 15 App Router | `dev` usa `--turbo` |
| Lenguaje | TypeScript Strict | `noUncheckedIndexedAccess: true` |
| API | tRPC v11 + TanStack Query | Sin REST (solo webhooks externos futuros) |
| Validación | Zod | Backend (tRPC) + formularios; espejar zod exacto front↔engine |
| ORM / DB | Prisma 6 + PostgreSQL (Supabase) | `prisma/schema.prisma`; `postinstall: prisma generate` |
| Estilos | Tailwind v4 (tokens `@theme` Cypher en `globals.css`) | Sin Shadcn instalado; `ui/` propio |
| Animaciones | `motion` (`motion/react`) | Solo presentación, jamás estado |
| Auth | NextAuth v5 (Google + Discord + Credentials solo `development`) | JWT con `profileId`/`onboarded` |
| Mapas | Leaflet | `Court.lat/lon Float @default(0)` |

Comandos: `npm run dev|build|preview`, `npm run check` (= `lint` + `tsc`), cierre de wave exige `rm -rf .next && npx tsc --noEmit` + `npx next build` con salida pegada. Sin framework de tests. Import alias `torneos/*` (NUNCA `@/*`).

---

## 3. Principios Rectores (inamovibles; prevalecen las LEYES de AGENTS.md)

### 3.1. DRY
Tipos, validaciones y lógica se definen una sola vez. Prisma → tRPC → Frontend, sin sincronización manual.

### 3.2. Cero CSS inline (con excepciones de AGENTS.md)
Prohibido `style={{ }}` salvo: CSS vars dinámicos, `columns`/`gridTemplateColumns`, slots posicionales (`left/top`, `% width`, `transformOrigin`).

### 3.3. No barrel exports · imports explícitos con `torneos/*`
Nada de `index.ts` re-exportadores. Ej: `from "torneos/components/ui/button/button"`.

### 3.4. Manipulación de información
BD = verdad, nunca fuente de render. UI = fusión caché + overlay. Reconcilia por entidad; gruesa solo ante cascadas. Nada viaja sin camino (sin push: polling/pull + optimistic). RBAC prohibido = deshabilitado desde servidor. Servidor autoritativo en escritura (transacción), cliente en intención (mismo frame). Fallo = rollback animado + toast de UNA línea abajo.

---

## 4. Estructura real (regenerada desde disco, 2026-09)

```
proyecto-torneos
├── context/            # docs por sistema (este archivo + SISTEMA_*_REFACTOR.md)
├── prisma/             # schema.prisma + seed.ts (determinista, idempotente)
├── src/
│   ├── app/
│   │   ├── (anon)/     # vitrina pública: page, torneos, canchas (JAMÁS mover a (app))
│   │   ├── (app)/      # shell: admin, equipos, gestor, invitaciones, onboarding, perfil, reclutamiento, torneos
│   │   ├── (auth)/     # login, login-dev (solo development)
│   │   ├── design/     # escenas por wave (pt-14 pb-28)
│   │   └── api/        # auth/[...nextauth] + trpc/[trpc] (nunca redirect)
│   ├── components/
│   │   ├── ui/         # puros, SIN tRPC/hooks (16 dirs + átomos raíz)
│   │   ├── features/   # templates 'use client' por dominio
│   │   ├── app-shell/  # header, bottom-nav (intocable), notification-center
│   │   ├── providers/  # providers globales
│   │   └── templates/  # templates compartidos (onboarding)
│   ├── domain/         # puras isomórficas: availability/conflict, standings/sort,
│   │                   # stats/fair-play, tournament-slots, schedule/labels,
│   │                   # match/format, stat-fields, status-labels
│   ├── lib/            # anon-access.ts (edge-safe), utils.ts, session.ts, hub.ts
│   ├── server/
│   │   ├── api/routers/ # 15 routers delgados (admin, availability, capitaincy,
│   │   │               # court, delegation, enrollment, match, notification,
│   │   │               # post [stub muerto, no registrado], profile,
│   │   │               # recruitment, result, stats, team, tournament)
│   │   ├── core/       # 12 engines: admin, availability, court, delegation,
│   │   │               # match, notification, profile, rbac, recruitment,
│   │   │               # stats, team, tournament
│   │   └── auth/       # config.ts (providers+callbacks), index.ts (createUser)
│   ├── styles/globals.css # tokens Cypher, z-ladder, tiles Leaflet
│   └── trpc/           # react.tsx (cliente), server.ts (RSC), query-client.ts
├── opencode.json       # MCP apify (OAuth)
└── AGENTS.md           # LEYES DEL PROYECTO (prevalecen sobre este doc)
```

### 4.1. Capas de estado
1. Verdad autoritativa (Postgres). 2. Caché cliente (TanStack Query por entidad). 3. Overlay de intenciones (optimistic + rollback). 4. Efímero UI (useState local). `ui/` recibe datos fusionados por props.

### 4.2. Canales
Sin push. RSC materializa, mutación tRPC escribe, reconciliación al foco/post-mutación lee. Polling solo: badge notificaciones 30s + contador hall. La Sala de Cine no necesita tiempo real: atomicidad, no velocidad de canal.

### 4.3. Protocolo de clic
Prevención (RBAC→deshabilitado) → intención por entidad → overlay mismo frame → mutación (Zod + engine en tx) → éxito: convergencia silenciosa / gruesa si hubo cascadas; fallo: rollback animado + toast una línea.

---

## 5. Frontera frontend
`ui/` = Server Components por defecto, cero JS. `features/` = cruce a cliente (`'use client'`, siembra `initialData` en Query). RSC nunca llama tRPC por HTTP: usa engines o caller directo. Nunca importar `server/` desde cliente (tipos: `import type` o `domain/`).

---

## 6. Backend
Routers delgados (Zod→engine) registrados en `root.ts`. Procedures: `publicProcedure` (vitrina), `protectedProcedure`, `permissionProcedure(code)` (RBAC), `managerProcedure` (inyecta Manager activo; ownership fino en engine). Mutación con colaterales = UNA transacción (dato + derivados + notificaciones). TTL por purga perezosa (`expiresAt > now`), sin crons. `timingMiddleware` mete 100–500ms aleatorios en dev (no es bug).

---

## 7. Reglas por sistema (código-as-is)

### 7.1. Auth & RBAC (S01)
Roles `admin/manager/player/captain`. Todo usuario nace `Player` (+84 slots AVAILABLE + fila `player`). JWT/sesión llevan `profileId` + `onboarded` (gate en `middleware.ts`). **Gestor SÍ delega** vía `ManagerDelegate` (W11-E3; gestor y admin designan). Anon-allowlist exacta: `/`, `/torneos`, `/canchas/[id]`, `/torneos/[id]`. Dev Login crea `onboarded:true` (bypass); OAuth `onboarded:false`.

### 7.2. Perfiles / matriz 7×12 (S02)
`displayName 1-50, phone ≤20, bio ≤500`. `dayOfWeek 0-6 / timeSlot 0-11`, `AVAILABLE/UNAVAILABLE`. Solo existen `availability.getMine/toggleSlot` (NO `setSlots`/`getByPlayerId`). `CONFLICT` = runtime en `domain/`, nunca persistido. Teléfono visible según `getVisiblePhone` (parcial: multi-equipo y `manager.isActive` son deuda).

### 7.3. Equipos (S03)
`createDraft` nace con el creador como capitán (1 miembro); ACTIVE al aceptar el 2º. Capitán = `isCaptain + leftAt=null`, único por jugador. `isStarter` (máx 5, solo capitán). **Borrado = soft `INACTIVE`, nunca físico; sin bloqueo por torneo activo (→Horizonte).** Consenso 3+ vía `TeamDeletionRequest/Vote`. Sin expiraciones ni `update/removeMember`.

### 7.4. Reclutamiento (S04)
Solo capitanes invitan (unidireccional). 15 miembros/equipo, 15 equipos/jugador (aceptar no revalida al jugador: deuda). PENDING única por (equipo,jugador); **cooldown 24h post-REJECTED**; REVOKED por capitán; saturación→resto REJECTED (sin notificar: TODO S11). Doble camino accept `team.*` vs `recruitment.*` (delimitar en S03/S04).

### 7.5. Canchas (S05)
Writes admin-only (`court:create/edit/disable`). Franjas 2h 0-11, ventana 14d generada al crear; **DISABLED total vs UNAVAILABLE por franja**. `lat/lon` existen (default 0,0). Vitrina: `getMap/getBubble/getPublicById`. **Cascada W10 "Cancha Manda": partidos SCHEDULED/IN_PROGRESS→POSTPONED + franja nulada + notifica; torneos NUNCA→SUSPENDED; FINISHED/WALKOVER/CANCELLED intocados.** Sin cron (`maintainAvailabilityWindow` manual/futuro).

### 7.6. Torneos / Sala de Cine (S06)
`maxTeams` potencia de 2. Cupos = `maxTeams − APPROVED − PENDING_PAYMENT − holds vigentes`. Hold 5min, renueva; `check()` → `{expiresAt, secondsRemaining}`. **Sin cooldown, sin chequeo cross-torneo, sin timestamp de servidor (→Horizonte).** Factor 1 (≥5 AVAILABLE = clasificador informativo, jamás gate) → `PENDING_PAYMENT`/`PENDING_AVAILABILITY` (+`reevaluate` como camino principal). **Regla no-bloqueo:** approve desde cualquier estado; ni approve, ni cierre, ni nada se condiciona a disponibilidad. **Rojo obliga sin bloquear:** si hay duro, se notifica y el jugador escoge cancha (auto-ausencia); la operación nunca se frena. Factor 2: approve / disapprove (APPROVED + SCHEDULED/GRACE_PERIOD, motivo hardcodeado) / reject (motivo ≥10). `closeAndDraw` manual: ≥2 APPROVED potencia de 2, Fisher-Yates, fases + `generateFromDraw` en tx, →IN_PROGRESS. Cancel: todo menos IN_PROGRESS, solo el gestor creador (sin rama admin). **Estados muertos (nadie los escribe): `GRACE_PERIOD`, `SUSPENDED`.** `TournamentTeamInvite` existe en schema sin consumidor. Multi-franja aditiva; scheduler/holds/enroll usan escalares principales. **Reservas por partidos (S06 v3.0):** al publicar se apartan `maxTeams−1` franjas concretas (requiere tabla/estado nuevo); asignación por fase post-sorteo con encadenamiento; liberación automática + notifica; aplazar = cancelar + redistribuir en matriz; resultado cargable en vencidos/sin iniciar.

### 7.7. Partidos (S07)
Bracket: fase 1 con equipos, resto vacías; avance por índice; fechas +7×fase. Postpone (SCHEDULED/IN_PROGRESS, motivo `min(10)`, libera franja, notifica). Reschedule (solo POSTPONED, exige franja AVAILABLE, preserva ausentes, notifica). Ausentes: capitán de su equipo vigente, informativo; bloqueado en FINISHED/WALKOVER/CANCELLED. **Walkover (regla del dueño): gana el contrario, el ausente queda marcado.** ⚠️ Bug P0 documentado: `markWalkover` guarda al GANADOR en `walkoverTeamId` (fix pendiente en S07, Clase C). `markedBy` = User. Árbitros en `adminRouter` (`referee:manage`); resultado vive en `resultRouter`. Sin schedule manual, sin `winnerId` manual.

### 7.8. Resultados & stats (S10)
Solo `result.load` + `getByMatch` (sin update/remove). Scores requeridos sin default; `loadedBy` = User; `winnerId` auto-calculado; `isWalkover` siempre `false`. Agregados en tx: ventana últimos-10 por `scheduledAt` DESC. Fair Play `(y×1+r×3+b×0.5+f×0.25)/PJ`. Orden Pts→DG→GF→FP. Quirk: `fairPlayScore` de standings siempre 0. Vitrina: `getTournamentStandingsPublic`.

### 7.9. Notificaciones (S11)
In-app único. 16 tipos reales en schema (no ~40). `create`/`createManyForMatch` en tx del evento. **Engine actual (gap): familia desactivada = NO se genera** (`engine:26,57-61`); `list` filtra muted + `take: 50` fijo; `unreadCount` aún no filtra muted. **Regla del dueño (decidida 2026-09): ocultar, NO destruir** — la familia apagada se genera en BD y se oculta de bandeja/badge; al reactivar, el historial aparece. ⚠️ Gap: el engine actual NO genera si muted (`engine:26,57-61`) → cambio pendiente en S11 (ver Horizonte 9). `SYSTEM` no desactivable (lock pendiente con el cambio). **Tab Configuración en perfil:** el usuario silencia familias desde una tab en su perfil (reto UI/UX: switches por familia con copy honesta "oculto, no perdido" + SYSTEM bloqueado visible) — especificación pendiente en S11/S12.

### 7.10. Mapa / UI (S12, el más maduro)
Leaflet + tiles oscuros, pines por `lat/lon`, hub filtra 100% en cliente. Toast abajo (`bottom-6`). `z-map 0 … notif-panel 45, header 46, nav 50, toast 70`. `ui/` sin tRPC (verificado). Escenas `/design` por wave.

---

## 8. Jerarquía
Cancha → Torneo → (inscripción) Equipo → Partido. Equipos persistentes, plantilla global única.

## 9. Sistemas y estado v3.0

| # | Sistema | Archivo | Estado |
|---|---|---|---|
| 0 | Stack/leyes | `AGENTS.md` | Vigente (prevalece) |
| 1 | Auth & RBAC | `SISTEMA_01_AUTH_RBAC_REFACTOR.md` | Pendiente refactor (detalles falsos) |
| 2 | Perfiles | `SISTEMA_02_USUARIOS_PERFILES_REFACTOR.md` | Pendiente (§7.2 inventado) |
| 3 | Equipos | `SISTEMA_03_EQUIPOS_PLANTILLAS_REFACTOR.md` | Pendiente (motor > doc) |
| 4 | Reclutamiento | `SISTEMA_04_RECLUTAMIENTO_REFACTOR.md` | Pendiente (sin expiración) |
| 5 | Canchas | `SISTEMA_05_CANCHAS_SEDES_REFACTOR.md` | Pendiente (cascada sin doc) |
| 6 | Torneos | `SISTEMA_06_TORNEOS_REFACTOR.md` | Rediseñado v3.0 (reservas por partidos; no-bloqueo) |
| 7 | Partidos | `SISTEMA_07_PARTIDOS_APLAZAMIENTOS_REFACTOR.md` | Refactorizado v2.0 (+bug P0 walkover) |
| 10 | Stats | `SISTEMA_10_RESULTADOS_ESTADISTICAS_REFACTOR.md` | Pendiente (router recortado) |
| 11 | Notificaciones | `SISTEMA_11_NOTIFICACIONES.md` | Pendiente (silencio decidido: ocultar; gap engine + tab perfil) |
| 12 | UI/UX + Pantallas | `SISTEMA_12_FRONTEND_UI_UX.md`, `SISTEMA_12_PANTALLAS_UI_ESTRUCTURA.md` | Más maduros (enmiendas menores) |

Sistemas 8–9 eliminados (árbitros→S07, resto→S06/S10).

## 11. Fuera de este doc
Roadmap, diseño visual detallado, webhooks/pagos, testing, CI/CD, detalle por sistema (sus `.md`).

## 12. Horizonte (deseado, NO implementado — requiere diseño + aprobación antes de código)

1. Cooldown anti-acaparamiento Sala (~2min) + re-prereserva en 1 clic tras EXPIRED.
2. Chequeo cross-torneo en `holdSlot` (una prereserva activa por usuario).
3. Bloqueo de eliminación de equipo con torneo en curso.
4. Revalidar límite 15-equipos del jugador al aceptar invitación.
5. Walkover real end-to-end (aclarar Fair Play). Decisión del dueño: sin `result.update/remove` — el resultado cargado es definitivo.
6. Notificaciones TODO: saturación, rechazo/aceptación, transferencia capitanía, bienvenida AUTH.
7. Cron o trigger para `maintainAvailabilityWindow` + limpieza física de holds.
8. Push opt-in (requiere justificar dato a dato contra §4.2).
9. Notificaciones generar-ocultar: `create`/`createManyForMatch` persisten siempre; `list` + `unreadCount` filtran muted; lock `SYSTEM` no desactivable; tab Configuración en perfil (switches por familia + copy "oculto, no perdido").
10. Reservas por partidos S06 v3.0/S07 v2.0: `TournamentSlotReservation`, asignación por fase + encadenamiento, liberación automática + notifica franja libre, aplazar redistribuye, resultado en vencidos, rojo-en-inscripción → "elige tu cancha".

## 13. Deuda P0–P3 (verificada)

- **P0:** `walkoverTeamId` invertido (`match.engine:374`); `use-onboarding` → `/dashboard` inexistente + `isSubmitting` muerto; `TournamentTeamInvite` huérfano; secreto commiteado en historia git (línea borrada aquí; rotar credencial).
- **P1:** Prisma directo en 6 routers (team.getMyTeams/getById, court.list/getById/getAvailability×2, match.markAbsent/getById×2, enrollment.listByTournament, availability.getMine); doble accept team/recruitment; doble `createUser` (OAuth vs Dev); `post.ts` stub muerto.
- **P2:** estados muertos `GRACE_PERIOD`/`SUSPENDED`/`EXPIRED`; permisos `match:*` fantasma en seed; standings FP=0; `unreadCount` sin filtro muted.
- **P3:** snapshots pegados en docs (citar `ruta:línea`); `status-labels.ts` triple vocabulario; `TournamentSlot` sin scheduler multi-franja; `setAvailability` base sin upsert.

> Documento versionado. Modificarlo requiere aprobación del dueño.
