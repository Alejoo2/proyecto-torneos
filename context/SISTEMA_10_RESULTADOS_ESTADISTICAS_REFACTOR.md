# Sistema 10: Resultados & Estadísticas

> **Estado:** Refactorizado v2.0 (auditoría post-W11 + decisiones del dueño, 2026-09)
> **Naturaleza:** descriptiva en motor, prescriptiva en FINISHED automático (§6)
> y desambiguación mismo-torneo (§5).

## 1. Visión

Carga de resultados + agregados persistidos en la misma tx (jugadores→equipos→
standings) + avance de eliminatoria. Sin cálculo en runtime. Sin update/remove
(decisión del dueño: resultado definitivo, promesa podada).

## 2. Router y schema reales (delta vs v1)

- `result`: solo `load` + `getByMatch`, `protectedProcedure` (ownership
  gestor/delegado, NO `match:result`). `winnerId` auto-calculado, `isWalkover`
  siempre `false`, `notes`≤500, `playerStats` requerido. Sin `update/remove`.
- `stats`: `getPlayerStats/getTeamStats/getTournamentStandings` +
  `getTournamentStandingsPublic` (vitrina) + `getMyStats/getMyMatchHistory`.
  NO existen `getPlayerMatchHistory/getTeamMatchHistory/getTeamTournamentStats`.
- `MatchResult`: `loadedBy`=User, scores sin default, sin `updatedAt`.
  `MatchPlayerStat`: sin `createdAt`.
- Load valida **estado** (equipos definidos + no-terminal, `result.engine:37`)
  + **no-empate** (penales, decisión del dueño: `homeScore≠awayScore`),
  no fecha: vencidos y nunca-iniciados cargables (regla S07).
- Desempate: Pts→DG→GF→FP (4 criterios, sin alfabético). Quirk: `fairPlayScore`
  de standings siempre 0.

## 3. Fórmulas (verificadas, se conservan)

Ventana últimos-10 por `scheduledAt` DESC con divisor dinámico; partido sin
stats no cuenta; Fair Play `(y×1+r×3+b×0.5+f×0.25)/PJ`, informativo.
`PlayerStats.fairPlayScore` = fuente del filtro S04.

## 4. Walkover + Fair Play (regla definitiva, cierra contradicción S07)

Walkover = administrativo: no genera stats, no toca FP de nadie. `TeamStats` y
standings hacen `skip walkover`. Vale S10 sobre S07 §2/§5.5. Badge 'W': spec UI
sin verificar. Bug P0 `walkoverTeamId` invertido vive en S07 (fix Clase C).

## 5. Desambiguación mismo-torneo (encargo S02/S06)

"Ahí se ve en qué partido jugó": cada `MatchPlayerStat` es `(matchId,playerId)`,
así que la carga traza en qué partido jugó cada uno aunque sus dos equipos
estén en el mismo torneo. Sin modelo nuevo: el rojo mismo-torneo se resuelve
leyendo stats/calls por partido. Si un jugador aparece con stats en dos
partidos solapados del mismo torneo → dato a revisar (reporte, no bloqueo).

## 6. FINISHED automático del torneo (decisión del dueño, prescriptiva)

`maybeFinishTournament` (helper compartido): al completarse el cuadro —
última fase con resultado (eliminatoria y liga de una fase) — el torneo pasa
solo a FINISHED dentro de la tx de `result.load` o `markWalkover`,
**libera sus reservas** (→AVAILABLE) y notifica cierre a gestor + capitanes.
Sin botón, sin cron.

## 7. Checklist real

- [x] Agregados en tx + ventana-10 + orden + vitrina + avance por índice + seed
- [x] Podado por decisión del dueño: sin `result.update/remove` — resultado definitivo · FP standings ≠ 0
- [ ] FINISHED automático + liberación (§6) · notifs resultado/walkover (S11)

## 8. Dependencias

S01 (ownership, no permiso) · S02 (`Player.stats`) · S03 (`TeamStats`) ·
S06 (standings, FINISHED) · S07 (fixture, walkover, vencidos) · S04 (FP) ·
S11 (resultado/walkover/cierre/franja libre) · S05 (franjas liberadas).

> Versionado. Modificarlo requiere aprobación del dueño.
