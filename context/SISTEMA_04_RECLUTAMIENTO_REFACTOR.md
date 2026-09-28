# Sistema 4: Reclutamiento

> **Estado:** Refactorizado v2.0 (auditoría post-W11 + decisiones del dueño, 2026-09)
> **Naturaleza:** descriptiva en motor, prescriptiva en fairPlay (§5) y panel de
> enviadas (Horizonte). §1 y §2 se conservan intactos (filosofía del sistema).

## 1. Visión del Sistema

Sistema de **descubrimiento unidireccional** de jugadores. Un capitán navega un directorio de jugadores registrados, aplica filtros, y envía invitaciones para unirse a su equipo. El jugador es completamente pasivo: no puede solicitar ingreso, no puede "postularse", no puede rechazar recibir invitaciones. Solo recibe, y decide aceptar o rechazar.

**No hay conflicto de horario** en la invitación. La disponibilidad del jugador se muestra como información de referencia, pero no bloquea ni automátiza nada en el reclutamiento. Los conflictos de horario se manejan en el contexto de partidos y convocatorias (Sistema 7).

**No hay elección múltiple.** Si un jugador recibe invitaciones de dos equipos, acepta una y la otra queda pendiente de su respuesta individual. No hay mecanismo de "elegir entre equipos".

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Unidireccional** | Sí | Solo capitanes invitan. Los jugadores no pueden solicitar ingreso a equipos. |
| **Sin conflicto de horario** | Sí | La invitación no verifica ni bloquea por disponibilidad. La disponibilidad se muestra como dato informativo. |
| **Jugador siempre disponible** | Sí | No existe estado "no quiero recibir invitaciones". Todo jugador registrado puede ser invitado. |
| **Límite de plantilla** | 15 miembros activos | Cap lógico para equipos de microfútbol. Evita plantillas desproporcionadas. |
| **Sin estado de prueba** | Sí | Aceptar invitación = membresía directa. No hay período de evaluación. |
| **Revocación de invitación** | Sí | El capitán puede cancelar una invitación `PENDING` antes de que el jugador responda. |
| **Descubrimiento con filtro** | Sí | Directorio con filtros por nombre, disponibilidad horaria y fairPlay (§5). |
| **Jugadores saturados ocultos** | Sí | Si un jugador ya está en 15 equipos, no aparece en el buscador. |
| **Sin carga de archivos** | Ningún sistema | Avatares vienen de `User.image` (OAuth). |
| **Reutilización de entidad** | `TeamInvitation` | Se usa la misma tabla de Sistema 3. Sin tablas nuevas. |

## 3. Motor real (delta vs v1)

`searchPlayers`: exige capitanía (DRAFT y ACTIVE: comportamiento real, no bug),
excluye miembros + PENDING del equipo, nombre insensitive, filtro disponibilidad
`some{dayOfWeek,timeSlot,AVAILABLE}` (exige ambos o ignora el filtro),
paginación `page/pageSize`. Filtro `<15 equipos` post-query (rompe paginación:
deuda P1). `invite`: capitanía + límites + PENDING única + **cooldown 24h
post-REJECTED** + tx con `RECRUITMENT_REQUEST_SENT`. `revokeInvitation` →
`REVOKED` (capitán emisor). `acceptInvitation`: exige `teamId` presente, tx
membership + **saturación: a 15 tumba el resto a REJECTED** (sin notificar:
TODO S11). `rejectInvitation` simple. TODOs S11 ×3 (`revoke/accept/reject` no
notifican). `permissionProcedure("team:invite")` en todo el router.

**Frontera doble accept (declarada):** team-router = legacy DRAFT
(`teamId=null`); recruitment = flujo ACTIVE (rechaza null). No unificar ahora.
**Sin expiración 7d/cron** (podado; regla sin-timers). **Sin `getTeamInvitations`**
(panel de enviadas del capitán → Horizonte). **Race:** accept no revalida
jugador<15 (fix pendiente en tx). Zods flojos: `query` sin max/trim,
`page/pageSize` sin int (higiene P3).

## 4. Matriz vacía: efecto emergente (encargo S02)

Con default `UNAVAILABLE`, un jugador nuevo jamás matchea un filtro de
disponibilidad hasta habilitar franjas: correcto por diseño, documentado aquí
para que nadie lo reporte como bug. 4 estados (verde/gris/amarillo/rojo) en el
buscador: pendiente de definir (Horizonte: ¿mostrar sugeridos/rojo del
candidato al capitán?).

## 5. Búsqueda por fairPlay (nuevo, prescriptivo)

El fairPlay (`PlayerStats.fairPlayScore`, vía `Player.stats`) entra al
reclutamiento como criterio de capitán: filtro mínimo (`fairPlay >= X`),
orden opcional por fairPlay y display en la tarjeta (`X/15` + score). El engine
actual jamás lo toca (verificado: 0 refs): requiere join `player.stats` en
`searchPlayers`/`getPlayerProfile` + zod (`minFairPlay?`, `orderBy?`). Sin
efecto en reglas: no bloquea, solo ordena/filtra a ojo del capitán.

## 6. UI (spec vigente + fairPlay)

Buscador con nombre + día/franja + mínimo fairPlay; tarjeta con avatar,
disponibilidad resumida, `X/15` y score; invititar optimistic ("Invitado" +
rollback). `getPlayerProfile` capitán-only con matriz.

## 7. Checklist real

- [x] Engine + router + `REVOKED` + cooldown + saturación + buscador + `/invitaciones`
- [ ] Notificaciones saturación/rechazo/aceptación/revoca (TODO S11)
- [ ] Revalidar jugador<15 en accept (tx) + filtro <15 en BD + zods estrictos
- [ ] FairPlay en buscador (§5) · panel enviadas (Horizonte) · 4 estados (Horizonte)

## 8. Dependencias

S01 (capitanía) · S02 (matriz/filtros; emergente §4) · S03 (mismo motor,
frontera accept) · S07 (ausencias, no reclutamiento) · S10 (`fairPlayScore`
fuente de §5) · S11 (4 TODOs).

> Versionado. Modificarlo requiere aprobación del dueño.
