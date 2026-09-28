# Sistema 5: Canchas / Sedes

> **Estado:** Refactorizado v2.0 (auditoría post-W11 + decisiones del dueño, 2026-09)
> **Naturaleza:** descriptiva en motor, prescriptiva en `lat/lon` (§3) y matriz
> en detalle (§8). Sin cron ni timers (regla del dueño): la ventana se mantiene
> manual o por trigger explícito futuro, jamás como verdad actual.

## 1. Visión

Canchas públicas admin-only. Gestores las usan, no las editan ni las poseen.
Franjas 2h 0-11 con ventana 14d generada al crear. `DISABLED` total vs
`UNAVAILABLE` por franja. La cancha es la fuente física del rojo S02: cada
partido vive en una franja (`courtId/date/timeSlot`); si la franja cae, la
cascada aplaza el partido y el rojo del jugador muere con él.

## 2. Decisiones (verificadas + dueño)

| Decisión | Valor |
|---|---|
| Writes | Solo admin (`court:create/edit/disable`; `enable` reutiliza `court:disable`) |
| Franjas | 12/día, 168 filas AVAILABLE al crear; cierre-de-día = 12×UNAVAILABLE |
| `lat/lon` | **Obligatorios e imperativos**: fijan la ubicación exacta de los pines en el mapa. El `@default(0)` actual es deuda: cancha sin geo real apunta al Atlántico → exigir coords reales al crear (Horizonte + backfill) |
| Sin categorías, sin fotos, inventario string libre | Vigente |
| Suspensión | Torneos NUNCA→SUSPENDED. Cascada W10 "Cancha Manda": partidos SCHEDULED/IN_PROGRESS→POSTPONED + franja nulada + notifica convocados/capitán/gestor; FINISHED/WALKOVER/CANCELLED intocados |
| Ventana | `maintainAvailabilityWindow` existe sin invocador: manual por ahora |
| Matriz en UI | **Detalle SÍ, modal NO** (§8): el bubble del mapa resume; la matriz completa vive en la página de detalle |

## 3. Modelo real (delta vs v1)

`Court` + `lat/lon Float @default(0)` (deuda §2) + `CourtAvailability`
(`courtId/date @db.Date/timeSlot`, `@@unique`, `@@index[courtId,date]`).
Sin `mapPosition`, sin `court.helpers.ts` (§7.2 v1 proponía un archivo que no
existe). Podado del doc: `PENDING_RELOCATION`, torneo→SUSPENDED, cron diario,
paginación de `list`, `startDate` de `getAvailability`.

## 4. Motor (código-as-is)

- `court.engine`: create (unicidad insensitive + 168 filas en tx), update,
  toggleAvailability (bloquea DISABLED y fuera de ventana; **no toca
  partidos**: placeholder + comentario), `setAvailability` bulk (falla si la
  fila no existe: sin upsert, deuda), disable (DISABLED + franjas→UNAVAILABLE +
  notifica gestores SCHEDULED/GRACE_PERIOD/IN_PROGRESS), enable (solo status,
  no reactiva franjas).
- `cascade.engine` (`courtCascadeEngine`): `getBlockImpact` (lectura previa
  obligatoria antes de tocar), `disableWithCascade` / `setAvailabilityWithCascade`
  (upsert + POSTPONED + nulación + notifica). `findAffectedTx` muerto (borrar).
- `hub.engine` (vitrina): `getMap/getBubble/getPublicById` + `getAvailabilityPublic`.
- Router: delega writes; **lecturas con Prisma directo** (`list/getById/
  getAvailability×2`, ventana 14d duplicada: deuda P1). `slots` zod sin
  min/max (higiene). **Regla operativa:** toggle/set base jamás en producción
  sin `getBlockImpact` previo; usar variantes `*WithCascade`.

## 5. Fuente del rojo S02 (vínculo declarado)

El rojo duro se deriva del fixture (S07) anclado a franjas S05. Deshabilitar →
cascada → POSTPONED → el rojo desaparece al siguiente contacto con la matriz
(diseño perezoso asumido, coherente con §4 PROJECT_CONTEXT).

## 6. Seguridad

Admin (`court:*`) en writes; `enable` bajo `court:disable`. Lecturas
autenticadas + vitrina pública. Capa 3: cancha ENABLED, ventana válida,
unicidad de nombre al crear/renombrar.

## 7. Checklist real

- [x] Schema + seed + engines + cascada + vitrina + matriz admin/grid + Leaflet
- [ ] Bajar lecturas a engine + upsert en set base + borrar `findAffectedTx`
- [ ] `lat/lon` obligatorios al crear + backfill 3 canchas seed (Horizonte)
- [ ] Trigger explícito de ventana (Horizonte, sin cron silencioso)

## 8. UI (reglas vigentes)

Matriz admin (`court-availability-matrix`, edición) vs lectura (`grid`):
split intencional. Cierre-de-día manual. **Matriz completa solo en la página de
detalle de la cancha; el modal/bubble del mapa muestra resumen** (nombre,
estado, mini-stats) sin matriz. Mapa Leaflet con pines en `lat/lon` exactos.

## 9. Dependencias

S01 (`court:*`) · S06 (torneos anclan franja; `create` NO valida
`CourtAvailability`: gap) · S07 (fixture consume franjas; cascada lo aplaza) ·
S02 (rojo físico) · S11 (COURT_DISABLED + cascada) · S12 (mapa consume
`getMap/getBubble`, pines `lat/lon`).

> Versionado. Modificarlo requiere aprobación del dueño.
