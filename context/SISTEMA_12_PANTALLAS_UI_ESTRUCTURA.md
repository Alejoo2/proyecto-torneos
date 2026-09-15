# SISTEMA 12 — Pantallas UI: Especificación Estructural

> **Estado:** Especificación Actualizada  
> **Versión:** 2.0 (Post-Parches Backend)  
> **Propósito:** Guía para wireframes y construcción del frontend. Define qué datos necesita cada pantalla, qué procedimiento tRPC los entrega, cuándo se fetcha, cómo se actualiza el caché, y qué componentes son reutilizables.  
> **Prerequisito:** Leer `PROJECT_CONTEXT (1).md` secciones 4 y 5 antes de este documento.

---

## AUDITORÍA Y ESTADO DEL BACKEND

> Tras la resolución de las brechas críticas y de soporte, el backend cuenta con contratos de datos 100% sólidos para la construcción de las pantallas.

### ✅ Estado de Brechas (Actualizado)

| Nº | Brecha | Estado | Solución Aplicada en Backend |
|---|---|---|---|
| **B-01** | `match.getById` no incluye `player.profile` en `callUps` ni `playerStats` | ✅ **Resuelto** | Se actualizó el `include` de `match.getById` en `match.ts` para devolver `profile.displayName` y `user.image`. |
| **B-02** | No existe `enrollment.getMyStatusInTournament({ tournamentId })` | ✅ **Resuelto** | Creado `enrollment.getMyStatus` en `enrollment.ts`. Devuelve el arreglo de inscripciones del usuario para adaptar los CTAs. |
| **B-03** | `stats.getTournamentStandings` es `protectedProcedure` | 🟡 *Pendiente* | Se mantiene bloqueado para anónimos hasta definir si la tabla de posiciones es pública. |
| **B-04** | `court.getAvailability` es `protectedProcedure` | 🟡 *Pendiente* | Se mantiene bloqueado para anónimos. |
| **B-05** | `reschedule` no regenera convocatorias | 🟡 *Pendiente* | Afecta partidos reagendados post-aplazamiento. |
| **B-06a**| No existe `match.markAbsent` | ✅ **Resuelto** | Creado `match.markAbsent` en `match.ts`. Permite al capitán marcar ausentes con notas. |
| **B-06b**| No existe `match.assignReferee` ni `match.listReferees` | ✅ **Resuelto** | Creados `match.assignReferee` y `match.listReferees` en `match.ts`. |
| **B-07** | Fórmula de `fairPlayScore` en `stats.engine` incorrecta | ✅ **Resuelto** | Corregida en `stats.engine.ts` a `(yellow×1 + red×3 + blue×0.5 + fouls×0.25) / partidos`. |
| **B-08** | `enrollment.reject` usa tipo de notificación incorrecto | ✅ **Resuelto** | Corregido en `enrollment.engine.ts` para emitir `ENROLLMENT_REJECTED` y migrado en Prisma. |
| **B-09** | `slotHoldEngine.check` sin `serverTimestamp` | 🟡 *Pendiente* | El servidor calcula `secondsRemaining`. |
| **B-10** | No existe `src/domain/` | ✅ **Resuelto** | Creados `src/domain/availability/conflict.ts`, `standings/sort.ts` y `stats/fair-play.ts`. |
| **B-11** | `enrollment.reevaluate` no expuesto en router | ✅ **Resuelto** | Expuesta mutación `reevaluate` en `enrollment.ts`. |
| **B-12** | `enrollment.reject` no expuesto en router | ✅ **Resuelto** | Expuesta mutación `reject` en `enrollment.ts` con motivo obligatorio (`min(10)`). |

---

## MODELO MENTAL PARA EL FRONT

Antes de las pantallas, los tres patrones que aplican a TODA la app:

### Patrón A — "Materializar → Sembrar → Vivir"

```
RSC (Server Component)
  │  llama directo al engine, sin HTTP
  │  devuelve datos serializables como props
  ▼
Template ('use client')
  │  recibe props del RSC como `initialData`
  │  los siembra en TanStack Query:
  │    api.x.useQuery(input, { initialData: props.data })
  │  A partir de aquí: el dato vive en Capa 2
  ▼
Componentes UI
  │  reciben datos como props, sin hooks de datos
  │  son renders puros (pueden ser Server Components)
```

### Patrón B — "El ciclo de todo clic" (Protocolo 4.4)

```
Clic del usuario
  │
  ├─ 1. ¿RBAC local lo prohíbe? → botón ya estaba disabled → FIN
  │
  ├─ 2. Aplicar overlay al caché (queryClient.setQueryData)
  │      → UI cambia en el mismo frame, sin spinner
  │
  ├─ 3. Enviar mutación tRPC
  │
  ├─ 4a. ÉXITO: convergencia silenciosa
  │       Si hubo cascadas (resultado cargado → stats recalculadas):
  │       → invalidar segmento: api.stats.getTournamentStandings.invalidate()
  │
  └─ 4b. FALLO: rollback animado SOLO de esa entidad
           toast de una línea con ctx.error.message del servidor
```

### Patrón C — "Datos aproximados, honestamente presentados"

Para datos con polling (cupos, notificaciones), la UI siempre muestra la edad del dato:

```tsx
// Incorrecto:
<span>8 cupos disponibles</span>

// Correcto:
<span>8 cupos · <Age dataUpdatedAt={dataUpdatedAt} /></span>
```

---

## COMPONENTES REUTILIZABLES — CATÁLOGO (DRY)

> Principio: un componente UI nunca importa hooks de datos. Recibe props y renderiza.
> Los Templates son los únicos puntos de conexión con tRPC.

### Nivel Átomo (src/components/ui/)

| Componente | Props clave | Reutilizado en |
|---|---|---|
| `<Badge variant status>` | `variant: "success"\|"warning"\|"error"\|"neutral"`, `status: string` | Inscripciones, partidos, equipos, notificaciones |
| `<Age dataUpdatedAt>` | `dataUpdatedAt: number` (timestamp) | Cupos de torneo, bandeja de notificaciones |
| `<CountdownTimer expiresAt serverTimestamp>` | `expiresAt: Date`, `serverTimestamp: Date` | Sala de Cine, cooldown anti-acaparamiento |
| `<TeamChip team>` | `team: { name, abbreviation, primaryColor }` | Cards de partido, tabla de posiciones, inscripciones |
| `<PlayerAvatar profile size>` | `profile: { displayName, image }`, `size: "sm"\|"md"\|"lg"` | Convocatoria, perfil, directorio |
| `<StatBadge label value>` | `label: string`, `value: number\|string` | Stats de jugador, tabla de posiciones |
| `<EmptyState icon title description action?>` | autoexplicativo | Todas las listas vacías |
| `<LoadingSkeleton rows? variant?>` | `variant: "card"\|"row"\|"grid"` | Todos los estados de carga |
| `<ToastMessage>` | Manejado por el store de toasts | Errores y confirmaciones de mutación |

### Nivel Molécula (src/components/features/*/)

| Componente | Datos que recibe | Eventos que emite | Reutilizado en |
|---|---|---|---|
| `<TournamentCard tournament>` | `tournament: PublicTournament` | `onEnroll?`, `onClick` | Hub burbuja, lista de torneos, detalle de cancha |
| `<MatchRow match>` | `match: MatchWithTeams` | `onManage?` | Planilla, bracket, detalle de torneo |
| `<EnrollmentRow enrollment>` | `enrollment: EnrollmentWithTeam` | `onApprove`, `onReject`, `onDisapprove` | Gestión de inscripciones |
| `<PlayerRow player stats?>` | `player: PlayerWithProfile`, `stats?: PlayerStats` | `onInvite?`, `onMarkAbsent?`, `onClick` | Directorio, convocatoria, perfil de equipo |
| `<AvailabilityGrid cells onToggle?>` | `cells: AvailCell[][]`, `onToggle?: (day, slot) => void` | `onToggle` | Perfil jugador, Directorio (readonly) |
| `<BracketView phases matches>` | `phases: Phase[]`, `matches: MatchWithTeams[]` | — | Detalle de torneo, Sorteo |
| `<StandingsTable standings>` | `standings: TournamentStanding[]` | — | Detalle de torneo |
| `<NotificationItem notification>` | `notification: Notification` | `onRead` | Bandeja de notificaciones |
| `<CourtBubble bubble>` | `bubble: BubbleData` | — | Hub mapa |

---

## ESPECIFICACIÓN POR PANTALLA

### PANTALLA 0 — Hub / Mapa Principal

**Ruta:** `/` (pública, anónima)  
**Acceso:** Todos. Anónimo incluido.

#### Datos necesarios
| Dato | Procedimiento | Canal | Actualización |
|---|---|---|---|
| Pines de canchas | `court.getMap` | RSC → semilla | Reconciliación al foco |
| Datos de burbuja al clickear | `court.getBubble({ courtId })` | `useQuery` lazy (al clickear) | Reconciliación al foco |
| Torneos de vitrina de cancha | `tournament.listByCourtPublic({ courtId })` | Incluido en `getBubble` | Mismo que burbuja |

#### Estructura de pantalla
```
┌─────────────────────────────────────────┐
│  [NavBar: Logo + Botón Login]           │ ← RSC fijo
├─────────────────────────────────────────┤
│                                         │
│   [MapCanvas]                           │ ← 'use client'
│     Fondo: aurora animada (CSS)         │   Motion One para pan/zoom
│     Pines: SVG sobre canvas             │   initialData desde RSC
│                                         │
│   [SearchBar flotante — top]            │ ← filtra sobre initialData local
│   [FilterChips flotantes — bajo search] │   sin fetch adicional
│                                         │
│   [CourtBubble — aparece al clickear]   │ ← useQuery lazy
│     Header: nombre + estado             │
│     AvailabilityMatrix 7×12 (readonly)  │
│     Lista: TournamentCard[] (vitrina)   │
│     CTA: "Ver cancha completa"          │
│                                         │
└─────────────────────────────────────────┘
```

---

### PANTALLA 2 — Detalle de Torneo

**Ruta:** `/torneos/[tournamentId]` (pública para info base, autenticada para acciones)  
**Acceso:** Anónimo ve info + tabla básica. Capitán ve CTA de inscripción. Gestor ve acciones de gestión.

#### Datos necesarios
| Dato | Procedimiento | Canal | Actualización |
|---|---|---|---|
| Info del torneo | `tournament.getById` | RSC | Reconciliación al foco |
| Tabla de posiciones | `stats.getTournamentStandings({ tournamentId })` | RSC (si auth) | Reconciliación gruesa post-resultado |
| Partidos / fixture | `match.listByTournament({ tournamentId })` | RSC (si auth) | Reconciliación al foco |
| Mi hold activo | `tournament.checkHold({ tournamentId })` | `useQuery` (si capitán) | Semilla para countdown |
| Mi estado de inscripción | `enrollment.getMyStatus({ tournamentId })` | `useQuery` | Renderizado dinámico de CTAs |

#### Estructura de pantalla
```
┌─────────────────────────────────────────┐
│  [NavBar]                               │
├─────────────────────────────────────────┤
│  [TournamentHero]                       │ ← RSC
│    Nombre + cancha + formato + fechas   │
│    Badge de estado del torneo           │
│    Contador de cupos (con <Age/>)       │ ← polling 15s si vista montada
├─────────────────────────────────────────┤
│  [CTA de inscripción — zona dinámica]   │ ← 'use client'
│                                         │
│  Estado A — anónimo:                   │
│    "Inicia sesión para inscribirte"     │
│                                         │
│  Estado B — capitán sin hold:           │
│    Botón "Reservar cupo" → Sala de Cine │
│                                         │
│  Estado C — capitán con hold activo:    │
│    <CountdownTimer/> + Form inscripción │
│    Selección de equipo a inscribir      │
│    Botón "Confirmar inscripción"        │
│                                         │
│  Estado D — ya inscrito:                │
│    Badge de estado de mi inscripción    │
│    (PENDING_PAYMENT / APPROVED / etc.)  │
│    [Reevaluar Horario] (si PENDING_AVAIL)│ ← usa enrollment.reevaluate
├─────────────────────────────────────────┤
│  [TabBar: "Fixture" | "Posiciones"]    │ ← efímero
│                                         │
│  Tab Fixture:                           │
│    BracketView (eliminación)            │
│    o Lista de MatchRow (liga)           │
│                                         │
│  Tab Posiciones:                        │
│    StandingsTable                       │
│                                         │
└─────────────────────────────────────────┘
```

---

### PANTALLA 3 — Gestión de Torneo (Inscripciones)

**Ruta:** `/gestor/torneos/[tournamentId]/inscripciones`  
**Acceso:** Solo Gestor con `tournament:manage`.

#### Datos necesarios
| Dato | Procedimiento | Canal | Actualización |
|---|---|---|---|
| Lista de inscripciones | `enrollment.listByTournament({ tournamentId, status })` | RSC → semilla | Optimistic tras aprobar/rechazar/desaprobar |

#### Estructura de pantalla
```
┌─────────────────────────────────────────┐
│  [NavBar Gestor]                        │
├─────────────────────────────────────────┤
│  [PageHeader: nombre torneo + estado]   │
│  [SubNav: Inscripciones | Fixture | ... │
├─────────────────────────────────────────┤
│  [FilterBar: ALL / PENDING_PAYMENT /    │
│   PENDING_AVAILABILITY / APPROVED]      │ ← filtro client-side sobre datos cargados
├─────────────────────────────────────────┤
│  [EnrollmentList]                       │
│    EnrollmentRow × N                    │
│      TeamChip + status badge            │
│      nota de disponibilidad (si aplica) │
│      [Aprobar] [Rechazar] [Desaprobar]  │ ← optimistic, con rollback (usa reject con motivo)
│                                         │
│  [EmptyState si lista vacía]            │
└─────────────────────────────────────────┘
```

---

### PANTALLA 6 — Detalle de Partido / Carga de Resultado y Convocatoria

**Ruta:** `/gestor/torneos/[tournamentId]/partidos/[matchId]` (gestión)  
**Ruta pública:** `/torneos/[tournamentId]/partidos/[matchId]` (solo lectura)  
**Acceso:** Todos para ver. Gestor para cargar resultado/árbitro. Capitán para marcar ausentes.

#### Datos necesarios
| Dato | Procedimiento | Canal | Actualización |
|---|---|---|---|
| Datos del partido + Convocatoria con Perfil | `match.getById({ id })` | RSC | Reconciliación al foco (B-01 resuelto) |
| Lista de Árbitros | `match.listReferees` | `useQuery` (Gestor) | Selector de árbitro (B-06b resuelto) |
| Resultado cargado | `result.getByMatch({ matchId })` | RSC (si existe) | Reconciliación gruesa post-carga |

#### Estructura de pantalla — Vista Gestor (carga de resultado y árbitro)
```
┌─────────────────────────────────────────┐
│  [NavBar Gestor]                        │
├─────────────────────────────────────────┤
│  [MatchHero]                            │
│    Selector: Árbitro (match.assignReferee)│
│  [FormularioCargaResultado]             │ ← 'use client'
│    Input: Goles Local / Visitante       │
│    Por cada jugador convocado:          │ ← Convocatoria con displayName + avatar (B-01)
│      PlayerRow con inputs inline:       │
│        Goles / Tarj.Azul / Amarilla /  │
│        Roja / Faltas / Autogoles        │
│    Observaciones (textarea)             │
│    Botón "Guardar Resultado"            │
└─────────────────────────────────────────┘
```

#### Estructura de pantalla — Vista Capitán (marcar ausencias)
```
┌─────────────────────────────────────────┐
│  [ConvocatoriaMiEquipo]                 │
│    PlayerRow × N (de mi equipo)         │
│      Avatar + Nombre                    │
│      Checkbox: "Ausente"                │ ← usa match.markAbsent
│      Input opcional: Nota ("Lesionado") │
└─────────────────────────────────────────┘
```

---

## REGLAS DRY PARA CONSTRUCCIÓN DE COMPONENTES

### Regla 5 — Mapeo de Badges de Estado Centralizado
```ts
// src/domain/status-labels.ts
export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING_AVAILABILITY: { label: "Disponibilidad insuficiente", variant: "warning" },
  PENDING_PAYMENT:      { label: "Pendiente de pago",          variant: "warning" },
  APPROVED:             { label: "Aprobado",                    variant: "success" },
  REJECTED:             { label: "Rechazado",                   variant: "error" },
  DISAPPROVED:          { label: "Desaprobado",                 variant: "error" },
};
```

---

> **Versión 2.0:** Documento de especificación listo y sincronizado con el estado real del backend.
