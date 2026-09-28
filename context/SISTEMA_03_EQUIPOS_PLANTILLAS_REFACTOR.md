# Sistema 3: Equipos & Plantillas

> **Estado:** Refactorizado v2.0 (auditoría post-W11 + decisiones del dueño, 2026-09)
> **Naturaleza:** descriptiva en motor, prescriptiva en matriz sugerida (§7) y
> cruces (§8). Sin timers en ninguna validación (regla del dueño).

## 1. Visión

Equipo persistente, plantilla global única, capitán único por jugador. Tres
checks inamovibles: **crear exige 1 aceptación** (DRAFT→ACTIVE con el 2º
miembro), **eliminar con consenso** (<3 directo a `INACTIVE`, ≥3 unanimidad vía
`TeamDeletionRequest/Vote`), **transferir capitanía con aceptación**.
Borrado siempre soft (`INACTIVE`), nunca físico; sin bloqueo por torneo
(→Horizonte). Sin expiraciones ni timeouts en ningún flujo.

## 2. Modelo real (delta vs v1)

`Team` (name/abbr `@unique`, hex 7, `status` DRAFT default, `deletionRequest`).
`TeamMembership` (`isCaptain`, `isStarter`, `leftAt`, `@@unique[playerId,teamId]`,
índices `[teamId,leftAt]/[playerId,leftAt]`). `TeamInvitation` (`teamId?`,
`invitedBy`, `PENDING` default, `EXPIRED/REVOKED` existen en enum pero nadie los
escribe). `CaptaincyTransfer` (+`teamId` FK). Capitán = `isCaptain + leftAt=null`
(sin `captainId` en Team). DRAFT nace con el creador como capitán (1 miembro);
el camino `teamId=null` de `acceptInvitation` es legacy casi inalcanzable.
`INACTIVE` sin transición de vuelta: reingreso = nueva invitación.

## 3. Flujos (código-as-is)

- **Crear:** `createDraft` (unicidad insensitive + no-capitán-en-otro-equipo) →
  `invitePlayer` (capitanía si hay `teamId`; PENDING única; notifica
  `INVITATION_RECEIVED`) → `acceptInvitation` (2º miembro → ACTIVE + notifica).
- **Eliminar:** `requestDelete` (<3: `INACTIVE` + `leftAt` masivo; ≥3:
  `TeamDeletionRequest PENDING` + autovoto + `TEAM_DELETE_REQUESTED`) →
  `confirmDelete({requestId, approved})` (`!approve`→`CANCELLED`,
  unanimidad→`INACTIVE`+`EXECUTED`).
- **Capitanía:** `requestTransfer` (`permissionProcedure("team:manage")`,
  receptor miembro activo, no-capitán-otra-parte, una PENDING por emisor) →
  accept (swap atómico) / reject. **Gap:** no sincroniza `RoleAssignment`
  captain ni notifica (fix pendiente aquí).
- **Rechazo/revoke de invitaciones:** vive en recruitment (S04), no en team
  router. Doble camino accept (team vs recruitment) pendiente de delimitar.

## 4. Router real

`createDraft, invitePlayer, acceptInvitation, getMyTeams, getById,
requestDelete, confirmDelete, leaveTeam, setStarter` (capitán-only, máx 5).
NO existen `update/removeMember/getMembers/getPendingInvitations/rejectInvitation`.
Deuda P1: `getMyTeams/getById` con Prisma directo (bajar a engine).

## 5. Checks con player-grid (regla del dueño)

Las selecciones de miembros para los checks usan el componente `player-grid`
(ya existe aprox en `features/match/player-grid.tsx`): elegir receptor de
transferencia, ver votantes del consenso, marcar `isStarter`. Mismo componente,
tres checks. Sin timers: toda validación es estado, no tiempo.

## 6. Card Maestra (spec UI vigente)

5 slots placeholder visuales (sin modelo), hasta 5 avatares, `primaryColor`
fondo. Badge 'W' walkover: spec sin verificar en código.

## 7. Matriz sugerida del capitán (nuevo, prescriptivo — encargo S02)

El capitán publica el horario sugerido de SU equipo **reutilizando el componente
availability matrix** (mismo grid, modo `suggested`: tap escribe sugerencia, no
disponibilidad). Permiso `team:manage` (ya existe). Requiere tabla nueva
(`TeamSuggestedSlot(teamId,dayOfWeek,timeSlot)`, `@@unique[teamId,dayOfWeek,timeSlot]`)
+ endpoints gestionar/limpiar + lectura agregada por jugador (unión
multi-equipo). Notificación de sugerencia nueva → S11 pendiente.

## 8. Cruces en los modelos de la grid (nuevo, prescriptivo)

Amarillo (sugerencias) y rojo (duro) se calculan en los modelos de la
availability grid (`domain/availability/` + grid UI), no en routers ni en cada
feature: son los checks grandes de la app y viven una sola vez. Fuentes: BD
propia (verde/gris) + `TeamSuggestedSlot` de sus equipos (amarillo) + fixture
de sus equipos en torneos distintos (rojo; mismo torneo ≠ rojo, desambigua S10).
`conflict.ts` actual (0 consumidores) se extiende o reemplaza aquí.

## 9. Checklist real

- [x] Schema + seed + engines + routers + Card Maestra base + `isStarter`
- [ ] Sync `RoleAssignment` captain + notificaciones capitanía/eliminación (S11)
- [ ] Bajar `getMyTeams/getById` a engine
- [ ] `TeamSuggestedSlot` + endpoints + matriz sugerida del capitán (§7)
- [ ] Cruces amarillo/rojo en modelos grid (§8)
- [ ] Delimitar doble accept con S04 · `match:*` cablear/eliminar (S07)

## 10. Dependencias

S01 (roles/capitanía) · S02 (matriz+sugerencias: provee/consumen) · S04 (mismo
motor de invitación) · S06 (plantilla completa a inscripción; Factor 1) ·
S07 (fixture fuente del rojo; `Match` home/away) · S10 (`TeamStats`) ·
S11 (invitaciones, transferencias, eliminación, sugerencias).

> Versionado. Modificarlo requiere aprobación del dueño.
