# Sistema 6: Torneos

> **Estado:** Rediseñado v3.0 (decisiones del dueño, 2026-09 — aún NO implementado)
> **Cambio central:** de franja recurrente única a **reservas por cantidad de
> partidos** (1 franja ≈ 1 partido). Convive con `dayOfWeek/timeSlot` semanal.

## 1. Visión

Reclutar → publicar (fecha aprox + reservas) → sortear (franjas a partidos por
fase) → jugar (encadenar/liberar) → finalizar (libera sobrantes). La
disponibilidad informa, jamás bloquea (§5 v2.0 vigente: equipo pagado compite).

## 2. Modelo de reservas (decidido)

- **Al publicar:** se apartan `maxTeams−1` franjas concretas (`courtId/date/timeSlot`)
  consecutivas desde la fecha aprox (ej. 8 cupos = 7 franjas). Ocupan
  `CourtAvailability` (reservadas, no AVAILABLE). Requiere tabla nueva
  (ej. `TournamentSlotReservation`) o estado reservado en disponibilidad.
- **Convive** la franja semanal (`dayOfWeek/timeSlot` = patrón de juego); las
  reservas son las fechas reales. Escalares nunca mueren del todo (vitrina,
  Factor 1, compatibilidad).
- **Franja 2h:** cubre imprevistos; partido máx 1h30 con penales/extra. Termina
  en 30 min (W o inasistencia) → se marca jugado, **la reserva sigue** hasta
  liberación.
- **Sorteo:** por fase se asignan las franjas reservadas a los partidos; la
  primera es la reserva base de la cancha. Tooltip obligatorio: si un partido
  acaba antes de las 2h, el siguiente continúa con el tiempo de la franja
  (encadenamiento).
- **Aplazar:** cancela las franjas apartadas del partido y las mueve a cupo
  disponible: el gestor distribuye en la matriz de horario (manual, con vista
  de las N franjas del torneo). Con torneo en curso, mismo mecanismo.
- **Liberación automática:** al marcar jugados todos los partidos de una
  franja/reserva (o finalizar el torneo rápido), el sistema libera las
  sobrantes → AVAILABLE + **notifica a equipos y a gestores con torneos en esa
  franja** (pueden tomarla). Sin validación horaria estricta: resultado cargable
  aunque la fecha venciera o el partido nunca se iniciara (iniciar = opcional).

## 3. Inscripción (delta v2.0)

Sin corroboración bloqueante. **Al inscribirse se genera corroboración
informativa** (nota visible, sin error duro). **Rojo sí obliga:** si jugadores
del equipo quedan en duro (dos torneos distintos, misma franja), deben escoger
en qué cancha juegan → auto-ausencia en el otro torneo (S02 §8). Ojo: obliga
sin bloquear — se notifica y el jugador resuelve, pero inscripción, approve y
cierre nunca se frenan por ello (si no resuelve, ambos torneos lo cuentan:
dato sucio que igual puede ganar). Umbral ≥5 =
clasificador informativo. Approve desde cualquier estado (regla no-bloqueo).

## 4. Motor vigente (código-as-is, no tocado por el rediseño)

Cine 5 min · enroll + hold + cupos · Factor 2 · `closeAndDraw` manual (≥2
potencia de 2, Fisher-Yates, fase 1 con equipos) · cancel (menos IN_PROGRESS,
creador) · vitrina separada · multi-franja aditiva · prelación dura.
Deuda P1: listados con Prisma directo. Muertos: GRACE_PERIOD/SUSPENDED.
`TournamentTeamInvite` huérfano → Horizonte.

## 5. Trabajo pendiente (diseño→código)

1. `TournamentSlotReservation` (o estado) + apartar `maxTeams−1` al publicar.
2. Asignación de franjas por fase post-sorteo + tooltip encadenamiento.
3. Liberación automática + notificaciones de franja libre (S11).
4. Aplazar = cancelar + redistribuir en matriz (UI gestor con las N franjas).
5. Resultado cargable en vencidos/sin iniciar (quitar validaciones de fecha).
6. Rojo en inscripción → flujo "elige tu cancha" (auto-ausencia).
7. Approve desde PENDING_AVAILABILITY (engine + row) — ya decidido v2.0.

## 6. Dependencias

S01 · S02 (matriz vacía, auto-ausencia, rojo) · S03 (plantilla) · S05 (franjas
físicas; `create` aún no valida disponibilidad: gap) · S07 (fixture, encadenar,
liberar, aplazar) · S10 · S11 (franja libre, sorteo, resultados) · S12.

> Versionado. Modificarlo requiere aprobación del dueño.
