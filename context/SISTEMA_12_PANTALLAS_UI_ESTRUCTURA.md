# S12 — Pantallas: contratos por ruta (no wireframes)

> **Estado:** v3.0 (2026-09). Cambio de formato decidido por el dueño: este doc
> NO dibuja pantallas (los wireframes se pudren con cada wave). Fija **contratos
> por ruta** (acceso, dato, procedure, estados) + patrones. El detalle visual
> vive en el código. Regenerar inventario al cierre de cada wave
> (`glob src/app/**/page.tsx`).

## 1. Patrones vigentes (se conservan de v2.0)

**A — Materializar→Sembrar→Vivir:** RSC llama engine/caller directo, pasa
`initialData`, template `'use client'` siembra en Query, `ui/` recibe props.
**B — Ciclo del clic:** RBAC→disabled; overlay mismo frame; mutación;
convergencia silenciosa o rollback animado + toast una línea abajo.
**C — Dato aproximado honesto:** cupos/polling siempre con edad (`<Age/>`).

## 2. Reglas de catálogo (sin tablas que se pudran)

- `ui/` nunca importa datos (verificado). Átomo en raíz, molécula de dominio en
  subcarpeta. Nuevo componente reutilizable 3+ veces → `ui/`; si no, co-localizado.
- Badges: mapa central en `domain/status-labels.ts` (triple vocabulario = deuda P3).
- Toast abajo (`bottom-6`); `LoadingSkeleton` sin texto; BottomNav intocable;
  escenas `/design` con `pt-14 pb-28`.

## 3. Inventario de rutas (generado desde disco, 2026-09)

| Ruta | Grupo | Contrato |
|---|---|---|
| `/` hub/mapa | anon | `court.getMap` (RSC) + `getBubble` lazy; filtrado 100% cliente; bubble = resumen (regla S05: sin matriz en modal) |
| `/torneos` | anon | `tournament.listPublic`; hall con edad + refetch moderado |
| `/torneos/[t]` | anon | `getPublicById`/`getById` + standings (si auth) + fixture; CTA A/B/C/D + `checkHold` si capitán |
| `/torneos/[t]/partidos/[m]` | anon | `match.getByIdPublic` + `result.getByMatch`; solo lectura |
| `/canchas/[id]` | anon | `getPublicById` + `getAvailabilityPublic`; **matriz completa aquí** (detalle SÍ) |
| `/equipos`, `/equipos/[t]` | app | `team.getMyTeams/getById`; Card Maestra; player-grid en checks |
| `/perfil` | app | `profile.me` + matriz propia (4 estados S02) + **tab Configuración** (notifs, Horizonte S11) |
| `/invitaciones` | app | `recruitment.getMyInvitations` (+ team); deep-link S11 |
| `/reclutamiento/[team]` | app | `searchPlayers` (nombre, día+franja, fairPlay §5 S04) + `getPlayerProfile` |
| `/torneos/[t]/gestion` | app gestor | `enrollment.listByTournament`; approve desde cualquier estado (S06 §5); sorteo si potencia de 2 |
| `/gestor/torneos/nuevo` | app gestor | wizard (P0: árbol fantasma — mover a raíz del dominio) |
| `/gestor/torneos/[t]/partidos/[m]` | app gestor | `match.getById` + `assignReferee` + `result.load` + ausentes |
| `/admin`, `/admin/canchas` | app admin | courts + matriz admin (matrix) + árbitros |
| `/onboarding` | app | Legacy sin nacimientos (S02 v2.0); decidir retirar/reciclar |
| `/login`, `/login-dev` | auth | OAuth + Dev (solo development) |

## 4. Brechas v2.0 (estado real)

B-03 resuelta (`getTournamentStandingsPublic`). B-04/B-05/B-09 pendientes sin
re-verificar en esta pasada. Countdown con `expiresAt+secondsRemaining` (sin
`serverTimestamp`: no existe). `match.listByTournament` existe (Prisma directo,
P1). Ruta doc `/gestor/.../inscripciones` no existe: es `/torneos/[t]/gestion`.

## 5. Mantenimiento (regla anti-pudrición)

1. Al cierre de wave: regenerar §3 desde disco; tocar solo filas de pantallas
   del batch. 2. Prohibido wireframes ASCII y tablas de props. 3. Cambios de
   ruta/grupo → este doc en el mismo batch. 4. UI nueva de sistemas → su S-doc,
   no aquí (aquí solo contrato de ruta).

> Versionado. Modificarlo requiere aprobación del dueño.
