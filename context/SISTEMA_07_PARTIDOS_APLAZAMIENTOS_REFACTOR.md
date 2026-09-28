# Sistema 7: Partidos / Aplazamientos

> **Estado:** Refactorizado v2.0 (auditoría post-W11 + rediseño de reservas S06
> v3.0, 2026-09 — parcialmente implementado)
> **Naturaleza:** descriptiva en operador/flujos, prescriptiva en reservas,
> encadenamiento y liberación.

## 1. Visión

El partido vive sobre reservas, no sobre una franja fija: se le asigna fecha
post-sorteo por fase, puede encadenarse dentro de la franja, terminar antes sin
perder la reserva, aplazarse moviendo franjas, y cargarse aunque venciera o
nunca se iniciara. Operador: gestor o delegado (ownership fail-closed W11-E3).
El "asistente con permisos del admin" no existe en routers (`match:*`
sembrados sin consumidor).

## 2. Fixture y reservas (rediseño S06 v3.0, pendiente)

- Asignación **por fase**: sorteado el torneo, cada fase recibe sus franjas de
  las apartadas. Tooltip: si un partido acaba antes de las 2h, el siguiente
  continúa con el tiempo restante.
- Partido corto (W, inasistencia, 30 min) → FINISHED/WALKOVER, **reserva sigue**
  hasta liberación automática (todas jugadas → AVAILABLE + notifica equipos y
  gestores en esa franja).
- **Iniciar es opcional**: SCHEDULED→FINISHED directo válido. Resultado cargable
  en vencidos y nunca-iniciados (quitar validaciones de fecha: cambio pendiente).
- **Aplazar = cancelar franja + redistribuir**: la franja vuelve a AVAILABLE y
  el gestor la reubica en la matriz con vista de las N franjas del torneo
  (manual). Postpone actual ya libera + notifica; falta la redistribución.
- Fixture programado = fuente del rojo S02 (aplazar lo mata al siguiente contacto).

## 3. Flujos vigentes (código-as-is)

- **Bracket:** fase 1 con equipos, resto vacías; avance por índice; fechas
  +7×fase; callUps + `MATCH_SCHEDULED` ronda 1.
- **Postpone:** SCHEDULED/IN_PROGRESS, motivo `min(10)`, libera franja, notifica.
- **Reschedule:** solo POSTPONED, exige `courtId` + franja AVAILABLE (la marca
  UNAVAILABLE), preserva ausentes, notifica. Usa `z.coerce.date()`
  (fix aplicado) + matriz de la cancha como selector (misma piel del detalle).
- **Ausentes:** capitán de su equipo vigente, informativo; toggle hasta terminal
  (sin chequeo de hora-inicio: documentado, no exigido). **Frontera:** esto ≠
  auto-ausencia del jugador por torneo (S02 §8: potestad del jugador, efecto
  Factor 1).
- **Walkover:** manual; avanza al presente. `walkoverTeamId` = el AUSENTE
  (fix aplicado: gana el contrario, ausente marcado). Crea `MatchResult`
  0-0 con `winnerId` + `isWalkover:true`, avanza por índice y dispara
  FINISHED (`match.engine:359`). `isWalkover` siempre false desde
  `result.load`; FP no se calcula aquí (S10).
- **Árbitros:** directorio pasivo, CRUD en `adminRouter` (`referee:manage`),
  opcional por partido.
- **Resultado:** en `resultRouter` (`winnerId` auto, `playerStats` requerido,
  `notes`≤500; sin update/remove). Postpone no toca `MatchResult`.

## 4. Schema real (delta vs v1)

`scheduledAt/timeSlot/date/courtId` opcionales; sin `rescheduledFrom/To`;
índices `[tournamentId,phaseId]/[status]/[courtId,date,timeSlot]`;
`markedBy`=User; `MatchResult` sin defaults/`updatedAt`, `loadedBy`=User;
`MatchPlayerStat` sin `createdAt`. Reservas (`TournamentSlotReservation`)
existen (Fase 1): publish reserva, FINISHED libera, seed coherente.

## 5. Deuda y gaps

EDITABLE_BLOCKERS y `markAbsent` con lógica en router (P1, vigente) ·
notifs en batch vía `createManyForMatch` (postpone/reschedule/sorteo/resultado;
`inviteTeam` conserva loop de capitanes, N pequeño) · `Match.date` vs
`scheduledAt` duplicados · walkover sin notificación propia (resultado sí,
S11) · mismo-torneo desambigua en S10.

## 6. Checklist real

- [x] Bracket + postpone/reschedule + ausentes + walkover manual + árbitros + resultado + delegación E3
- [x] Fix walkoverTeamId + `z.coerce.date` (aplicados) · [ ] bajar lógica a engine (markAbsent/BLOCKERS en router)
- [ ] Reservas por fase + encadenamiento + liberación automática + redistribuir al aplazar (§2)
- [ ] Resultado en vencidos/sin iniciar · desambiguación mismo-torneo (S10)

## 7. Dependencias

S01 (delegación) · S02 (rojo/amarillo) · S03 (plantilla/callUps) · S05 (franjas,
cascada) · S06 (sorteo, reservas, liberación) · S10 (stats, desambiguación) ·
S11 (SCHEDULED/POSTPONED/RESCHEDULED; faltan resultado/walkover/franja libre).

> Versionado. Modificarlo requiere aprobación del dueño.
