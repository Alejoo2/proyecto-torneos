# Sistema 11: Notificaciones

> **Estado:** Refactorizado v2.0 (auditoría post-W11 + decisiones del dueño, 2026-09)
> **Naturaleza:** descriptiva en motor, prescriptiva en deep-link (§5) y
> generar-ocultar (gap engine). Filosofía del doc v1 conservada: ya decía
> ocultar-no-destruir.

## 1. Visión

In-app único, transaccional, con payload navegable. Regla decidida: **ocultar,
no destruir** — la familia apagada se genera igual y se oculta de bandeja/badge;
al reactivar, el historial aparece. `SYSTEM` no desactivable.

## 2. Motor real (delta vs v1)

`create`/`createManyForMatch` en tx · `list` (filtra muted, `take: 50` fijo, sin
paginación) · `unreadCount` (**sin** filtro muted: gap) · `markAsRead/markAllAsRead` ·
`getPreferences` (sintetiza defaults, sin filas al crear usuario) ·
`updatePreference` (**sin** lock SYSTEM: gap). Sin `executeAction` (convención
front con mutaciones existentes). Panel en shell (sin página dedicada);
polling badge 30s; `signOut` punto único.
**Gap central:** `create` retorna null si muted — debe persistir siempre (§1).

## 3. Tipos reales (16, no ~40)

TEAM: `INVITATION_RECEIVED/ACCEPTED`, `MEMBERSHIP_JOINED`, `TEAM_DELETE_REQUESTED` ·
RECRUITMENT: `REQUEST_SENT/ACCEPTED` · TOURNAMENT: `PUBLISHED`,
`ENROLLMENT_SUBMITTED/APPROVED/REJECTED`, `CLOSED_AND_DRAWN` · MATCH:
`SCHEDULED/POSTPONED/RESCHEDULED/RESULT_LOADED` · COURT: `DISABLED`.
Backlog (Horizonte): saturación, rechazo/revoca recruitment, transferencia
capitanía, bienvenida AUTH, resultado/walkover como tipos propios, franja
libre, sugerencia nueva, rojo detectado, cierre/FINISHED.

## 4. Emisión por sistema (estado)

Team ✓ · recruitment (solo invite) · court/cascada ✓ · enrollment ✓ ·
match (SCHEDULED ronda 1, POSTPONED, RESCHEDULED) · result.load ✓ (MATCH genérico).
Faltan: todos los del backlog §3.

## 5. Deep-link: la notificación redirige a su apartado (nuevo, prescriptivo)

Hoy el clic solo marca leída (0 navegación en `app-shell/`); los payloads ya
traen IDs pero nadie los resuelve. Contrato nuevo:

| Tipo | Destino |
|---|---|
| `INVITATION_*` (team/recruitment) | `/invitaciones` (aceptar/rechazar inline donde aplique) |
| `MEMBERSHIP_JOINED`, `TEAM_DELETE_*` | `/equipos/[teamId]` |
| `ENROLLMENT_*`, `TOURNAMENT_CLOSED_AND_DRAWN`, `TOURNAMENT_PUBLISHED` | `/torneos/[tournamentId]` (+ tab inscripción si `enrollmentId`) |
| `MATCH_*` | `/torneos/[t]/partidos/[m]` |
| `COURT_DISABLED`, franja libre | `/canchas/[courtId]` |
| `SYSTEM` | donde indique el payload o bandeja |

Clic = navegar + `markAsRead`. Acción inline = mutación existente + navegar +
`actionTaken`. Requiere mapa central `type→ruta` (domain o lib, testeable) que
el panel consume; payload sin IDs suficientes = gap del engine emisor.

## 6. Tab Configuración en perfil (Horizonte S11/S12)

Switches por familia + copy "oculto, no perdido" + `SYSTEM` bloqueado visible.
Endpoints ya existen (`getPreferences/updatePreference` + lock SYSTEM pendiente).

## 7. Checklist real

- [x] Schema + engine + router + panel + badge + observer-tx
- [ ] Generar-ocultar real + `unreadCount` filtrado + lock SYSTEM + paginación
- [ ] Deep-link (§5) · tipos backlog (§3) · emisores faltantes (§4) · tab perfil (§6)

## 8. Dependencias

Todos los sistemas emiten; S12 consume (panel + rutas + tab). Sin S11 no hay
Cine, ni cascada, ni cierre que se entienda.

> Versionado. Modificarlo requiere aprobación del dueño.
