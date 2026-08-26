# Sistema 6: Torneos

> **Estado:** Especificado (Aprobado)  
> **Propósito:** Documento de diseño técnico del sistema de creación, gestión, inscripción y sorteo de torneos de microfútbol. Incluye el motor "Sala de Cine" de prereserva de cupos y el flujo de 2 factores de aprobación de inscripciones. Sujeto a revisión conforme se especifiquen los demás sistemas.

---

## 1. Visión del Sistema

Sistema de gestión de torneos de microfútbol donde los **gestores** crean y publican torneos **sin aprobación del admin**. Los torneos se organizan en canchas públicas (Sistema 5) y siguen un flujo de inscripción de equipos persistentes (Sistema 3) con un sistema de **2 factores de aprobación**:

1. **Factor 1 — Disponibilidad Horaria:** Al inscribirse, el sistema evalúa automáticamente que al menos 5 jugadores de la plantilla del equipo estén disponibles en las franjas horarias del torneo. Si no se cumple, la inscripción queda en estado `PENDING_AVAILABILITY` y se notifica al capitán que fue "aprobada pero sin horario disponible".
2. **Factor 2 — Verificación de Pago:** El gestor aprueba manualmente la inscripción tras verificar que el equipo pagó la cuota.

El sistema incluye el **motor "Sala de Cine"**: cuando un capitán visualiza los detalles de un torneo, se prereserva un cupo por **5 minutos** con cooldown visible en la UI. Si no confirma la inscripción en ese plazo, el cupo se libera automáticamente. Esto evita condiciones de carrera cuando queda una única plaza disponible.

Los torneos exigen **cupos en potencia de 2** (8, 16, 32...). No hay byes ni preliminares. Al cerrar inscripciones, el sistema ejecuta el **sorteo automático** de fases. Si llega la fecha límite de inscripción con conflictos de disponibilidad sin resolver, el sorteo se ejecuta de todas maneras.

Los **gestores no pueden cancelar** un torneo que ya pasó a fase `IN_PROGRESS`. Deben reagendarlo o reubicarlo. Los permisos granulares de asistentes/vástagos los asigna el **admin**, no el gestor.

Las franjas horarias del torneo son de **2 horas** (coherentes con el sistema de disponibilidad del jugador y de la cancha). La reserva atómica interna es de 1h45m (colchón para penales y transiciones), pero la cancha libera la franja si el partido termina antes de lo previsto.

---

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Sin aprobación de admin** | Sí | El gestor crea y publica torneos directamente. El admin solo interviene en asignación de permisos granulares. |
| **2 factores de aprobación** | Sí | Factor 1 automático (disponibilidad ≥5 jugadores). Factor 2 manual (gestor verifica pago). |
| **Factor 1 fallido = PENDING_AVAILABILITY** | Sí | La inscripción no se rechaza; queda pendiente con motivo. Se notifica al capitán de "aprobada sin horario". |
| **Cupos potencia de 2** | Sí | Obligatorio. No hay byes ni preliminares. El gestor define el máximo al crear el torneo. |
| **Sala de Cine — Prereserva 5min** | Sí | Al ver detalles del torneo, se bloquea un cupo por 5 min. Visible en UI como "pendiente de confirmación". Evita race conditions. |
| **Franjas de 2h** | Sí | Coherentes con `PlayerAvailability` (Sistema 2) y `CourtAvailability` (Sistema 5). Reserva atómica interna de 1h45m. |
| **Sorteo automático al cierre** | Sí | Al cerrar inscripciones (manual o por fecha límite), el sistema sortea equipos en fases automáticamente. |
| **Cierre forzado con conflictos** | Sí | Si llega la fecha límite con inscripciones `PENDING_AVAILABILITY`, el sorteo se ejecuta igual. Se notifica al gestor. |
| **Desaprobación reversible** | Sí | El gestor puede desaprobar un equipo aprobado antes del cierre. Se libera el cupo y notifica al capitán. |
| **Gestor no cancela en progreso** | Sí | Un torneo `IN_PROGRESS` no puede ser cancelado por el gestor. Debe reagendar/reubicar. |
| **Permisos granulares por admin** | Sí | El admin asigna permisos de asistente/vástago. El gestor no delega permisos. |
| **Formato inicial: eliminación simple** | Sí | MVP con eliminación directa. Extensible a liga y liga+eliminación en futuras iteraciones. |
| **Sorteo puro azar** | Sí | Para MVP, sorteo aleatorio sin sembrado. Extensible a sembrado por ranking futuro. |
| **Torneo recurrente en franja única** | Sí | El torneo se juega siempre el mismo día de la semana y franja horaria. Simplifica el motor de scheduling. |
| **Sin nuevas tablas de asistente** | Sí | Los asistentes se manejan vía `RoleAssignment` (Sistema 1). Este sistema no agrega tabla de delegación. |

---

## 3. Modelo de Datos (Prisma Schema)

### 3.1. Torneo

```prisma
model Tournament {
  id                String              @id @default(cuid())
  name              String
  description       String?             @db.Text
  courtId           String
  managerId         String              // Gestor creador
  status            TournamentStatus    @default(DRAFT)
  format            TournamentFormat    @default(SINGLE_ELIMINATION)
  maxTeams          Int                 // Debe ser potencia de 2
  type              TournamentType      @default(PUBLIC)
  startDate         DateTime?           // Fecha de primera jornada
  enrollmentDeadline DateTime           // Fecha límite de inscripción
  dayOfWeek         Int                 // 0-6, día de la semana del torneo
  timeSlot          Int                 // 0-11, franja horaria del torneo
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  court         Court                @relation(fields: [courtId], references: [id], onDelete: Restrict)
  manager       Manager              @relation(fields: [managerId], references: [id], onDelete: Restrict)
  enrollments   TournamentEnrollment[]
  phases        TournamentPhase[]
  slotHolds     TournamentSlotHold[]
  matches       Match[]              // Sistema 7

  @@index([status, enrollmentDeadline])
  @@index([courtId, status])
}

enum TournamentStatus {
  DRAFT        // Configurando, no visible públicamente
  SCHEDULED    // Publicado, abierto a inscripciones
  GRACE_PERIOD // Tiempo de gracia: inscripciones cerradas, pendiente de sorteo
  IN_PROGRESS  // Fases sorteadas, partidos activos
  FINISHED     // Torneo completado
  CANCELLED    // Cancelado (gestor antes de IN_PROGRESS, o admin en cualquier estado)
  SUSPENDED    // Cancha deshabilitada, requiere reagendamiento
}

enum TournamentFormat {
  SINGLE_ELIMINATION      // Eliminación directa (MVP)
  LEAGUE                  // Todos contra todos (futuro)
  LEAGUE_PLUS_ELIMINATION // Fase de grupos + eliminación (futuro)
}

enum TournamentType {
  PUBLIC   // Cualquier equipo puede inscribirse
  PRIVATE  // Solo equipos invitados por el gestor
}
```

> **Nota:** `onDelete: Restrict` en `courtId` y `managerId` para preservar historial. Un torneo no se elimina en cascada si se elimina la cancha o el gestor.

### 3.2. Inscripción de Equipo

```prisma
model TournamentEnrollment {
  id                  String            @id @default(cuid())
  tournamentId        String
  teamId              String
  status              EnrollmentStatus  @default(PENDING_AVAILABILITY)
  availabilityNote    String?           @db.Text // Motivo si falla Factor 1
  enrolledAt          DateTime          @default(now())
  approvedAt          DateTime?         // Factor 2 completado
  approvedBy          String?           // ManagerId que aprobó
  disapprovedAt       DateTime?         // Si el gestor desaprueba después
  disapprovedBy       String?
  disapprovedReason   String?           @db.Text

  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  team       Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, teamId])
  @@index([tournamentId, status])
  @@index([teamId, status])
}

enum EnrollmentStatus {
  PENDING_AVAILABILITY  // Esperando Factor 1 (disponibilidad horaria)
  PENDING_PAYMENT       // Factor 1 OK, esperando Factor 2 (pago verificado por gestor)
  APPROVED              // Ambos factores OK, equipo confirmado en el torneo
  REJECTED              // Rechazado por gestor (Factor 2 negativo)
  DISAPPROVED           // Desaprobado después de estar APPROVED (antes del cierre)
}
```

### 3.3. Fases del Torneo

```prisma
model TournamentPhase {
  id           String   @id @default(cuid())
  tournamentId String
  name         String   // "Octavos de Final", "Cuartos de Final", etc.
  order        Int      // 1, 2, 3, 4... para ordenar progresión
  createdAt    DateTime @default(now())

  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  matches    Match[]    // Sistema 7

  @@index([tournamentId, order])
}
```

### 3.4. Prereserva de Cupo (Sala de Cine)

```prisma
model TournamentSlotHold {
  id            String   @id @default(cuid())
  tournamentId  String
  heldBy        String   // PlayerId del capitán que inició la prereserva
  teamId        String?  // Null si el capitán aún no eligió equipo (raro, pero posible)
  expiresAt     DateTime // now + 5 minutes
  createdAt     DateTime @default(now())

  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)

  @@index([tournamentId, expiresAt])
  @@index([heldBy])
}
```

### 3.5. Relaciones en entidades existentes

```prisma
// En Court (Sistema 5) — agregar relación
model Court {
  // ... campos existentes ...
  tournaments Tournament[]
}

// En Manager (Sistema 1) — agregar relación
model Manager {
  // ... campos existentes ...
  tournaments Tournament[]
}

// En Team (Sistema 3) — agregar relación
model Team {
  // ... campos existentes ...
  tournamentEnrollments TournamentEnrollment[]
}
```

---

## 4. Flujo Principal

### 4.1. Creación de Torneo (Gestor)

```
Gestor accede a panel de creación de torneo
    ↓
Selecciona cancha de la lista de canchas ENABLED
    ↓
Sistema muestra franjas AVAILABLE de la cancha (ventana 2 semanas)
    ↓
Gestor configura:
  - Nombre, descripción
  - Día de la semana + franja horaria (timeSlot)
  - Máximo de equipos (potencia de 2)
  - Fecha límite de inscripción
  - Tipo (PÚBLICO / PRIVADO)
  - Formato (eliminación simple como MVP)
    ↓
Sistema valida:
  - La franja está AVAILABLE en la cancha
  - maxTeams es potencia de 2
  - enrollmentDeadline es futura
    ↓
Torneo creado en estado DRAFT
    ↓
Gestor publica → status = SCHEDULED
    ↓
Torneo visible para inscripciones
```

### 4.2. Inscripción de Equipo — Sala de Cine (Capitán)

```
Capitán navega lista de torneos SCHEDULED
    ↓
Capitán clickea "Ver detalles" del Torneo X
    ↓
SISTEMA (Sala de Cine):
  - Verifica que hay cupos disponibles (maxTeams - APPROVED - PENDING_PAYMENT - active SlotHolds)
  - Crea TournamentSlotHold (expiresAt = now + 5min)
  - Devuelve detalles del torneo + tiempo restante de hold
    ↓
UI muestra modal de confirmación con countdown de 5min
    ↓
Capitán confirma inscripción
    ↓
SISTEMA:
  - Elimina SlotHold
  - Evalúa Factor 1: ¿≥5 jugadores de la plantilla disponibles en dayOfWeek/timeSlot?
      ├── SÍ → status = PENDING_PAYMENT
      └── NO → status = PENDING_AVAILABILITY + availabilityNote
  - Notifica al capitán del resultado
    ↓
Si el capitán NO confirma en 5min:
  - SlotHold expira (cron job o validación lazy)
  - Cupo liberado, disponible para otros
```

### 4.3. Aprobación por Gestor (Factor 2)

```
Gestor accede a panel de inscripciones del torneo
    ↓
Vee lista de inscripciones por estado:
  - PENDING_AVAILABILITY: muestra motivo del conflicto horario
  - PENDING_PAYMENT: equipos listos para verificar pago
    ↓
Para cada PENDING_PAYMENT:
  - Gestor verifica pago externamente (fuera del sistema)
  - Gestor clickea "Aprobar" → status = APPROVED
  - O "Rechazar" → status = REJECTED + notificación al capitán
    ↓
Para inscripciones APPROVED:
  - Gestor puede "Desaprobar" antes del cierre
  - status = DISAPPROVED + notificación + cupo liberado
```

### 4.4. Cierre de Inscripciones y Sorteo

```
Trigger: Llega enrollmentDeadline
    ↓
SISTEMA:
  - Torneo pasa a status = GRACE_PERIOD
    ↓
Gestor accede al panel y decide ejecutar sorteo
    ↓
SISTEMA:
  - Cuenta inscripciones APPROVED
  - Si < 2: error, no se puede sortear
  - Si no es potencia de 2: error (no debería pasar por validación previa)
  - Si hay PENDING_AVAILABILITY sin resolver:
      → Notifica al gestor: "Conflictos sin resolver, sorteo se ejecutará de todas maneras"
      → El gestor puede posponer el cierre o proceder
    ↓
Sorteo automático:
  - Lista de equipos APPROVED se baraja (Fisher-Yates)
  - Se asignan a fases según el formato
  - Para SINGLE_ELIMINATION: se crean fases log2(N) y se emparejan
    ↓
Torneo status = IN_PROGRESS
    ↓
Se generan partidos (Sistema 7) en las franjas horarias del torneo
    ↓
Notificaciones a capitanes de equipos sorteados
```

### 4.5. Cancelación y Suspensión

```
Gestor intenta cancelar torneo:
  - Si status = DRAFT/SCHEDULED/GRACE_PERIOD: cancela directamente → CANCELLED
  - Si status = IN_PROGRESS: BLOQUEADO. Debe reagendar o reubicar.
    ↓
Admin puede cancelar en CUALQUIER estado → CANCELLED
    ↓
Cancha deshabilitada (Sistema 5):
  - Torneos SCHEDULED/GRACE_PERIOD/IN_PROGRESS en esa cancha → SUSPENDED
  - Gestor debe reubicar a otra cancha con franjas disponibles
```

---

## 5. Reglas de Negocio Críticas

### 5.1. Creación de Torneo

| Regla | Comportamiento |
|-------|----------------|
| Creador | Solo gestores habilitados (`Manager.isActive = true`) con permiso `tournament:create`. |
| Sin aprobación admin | El gestor publica directamente. No hay flujo de aprobación del admin. |
| Cancha habilitada | Solo canchas `ENABLED` con franjas `AVAILABLE` en el día/timeSlot elegido. |
| Franja única recurrente | El torneo se juega siempre el mismo `dayOfWeek` + `timeSlot`. |
| maxTeams potencia de 2 | Validación estricta: 2, 4, 8, 16, 32... Error si no cumple. |
| Prelación de franja | Si la franja está ocupada por otro torneo `SCHEDULED`, `GRACE_PERIOD` o `IN_PROGRESS` → Error Duro. No hay lista de espera. |
| Fecha límite futura | `enrollmentDeadline` debe ser posterior a `now()`. |
| Draft → Scheduled | El gestor puede editar en `DRAFT`. Una vez `SCHEDULED`, edición limitada (solo descripción, deadline). |

### 5.2. Sala de Cine — Prereserva

| Regla | Comportamiento |
|-------|----------------|
| Trigger | Clickear "Ver detalles" del torneo. |
| Duración | 5 minutos exactos (`expiresAt = now + 5min`). |
| Visualización | La UI muestra el hold como "1 plaza pendiente de confirmación". No resta del contador público de cupos disponibles. |
| Unicidad | Un capitán solo puede tener un `SlotHold` activo por torneo a la vez. |
| Confirmación | Al confirmar, se elimina el `SlotHold` y se crea la `TournamentEnrollment`. |
| Expiración | Si no confirma, el `SlotHold` se invalida. Cron job limpia expirados cada minuto. |
| Cupo real | Cupos disponibles = `maxTeams` - `APPROVED` - `PENDING_PAYMENT` - `active SlotHolds`. |
| Race condition | Si dos capitanes clickean simultáneamente y queda 1 cupo, el primero en crear `SlotHold` gana. El segundo recibe error de "cupos agotados". |

### 5.3. Factor 1 — Disponibilidad Horaria

| Regla | Comportamiento |
|-------|----------------|
| Evaluación | Al confirmar inscripción, el sistema cruza `PlayerAvailability` de todos los miembros activos del equipo con `dayOfWeek` + `timeSlot` del torneo. |
| Umbral | Mínimo 5 jugadores con `status = AVAILABLE` en esa franja. |
| Cálculo | Se excluyen jugadores con `UNAVAILABLE` o `CONFLICT` (calculado en runtime). |
| Éxito | `status = PENDING_PAYMENT`. El equipo pasa a esperar Factor 2. |
| Fallo | `status = PENDING_AVAILABILITY`. Se registra `availabilityNote` con lista de jugadores no disponibles. Se notifica al capitán: "Inscripción aprobada pero sin horario disponible". |
| Re-evaluación | El capitán puede actualizar la disponibilidad de su plantilla (Sistema 2) y solicitar re-evaluación. |

### 5.4. Factor 2 — Aprobación por Gestor

| Regla | Comportamiento |
|-------|----------------|
| Requiere | `status = PENDING_PAYMENT` (Factor 1 OK). |
| Acción | Gestor verifica pago externamente y aprueba/rechaza manualmente. |
| Aprobar | `status = APPROVED`. `approvedAt = now()`, `approvedBy = managerId`. Notificación al capitán. |
| Rechazar | `status = REJECTED`. Notificación al capitán con motivo opcional. |
| Desaprobar | Si `status = APPROVED` y el torneo aún no cerró inscripciones, el gestor puede desaprobar. `status = DISAPPROVED`. Cupo liberado. Notificación al capitán. |
| Solo gestor del torneo | Solo el `managerId` del torneo puede aprobar/rechazar/desaprobar inscripciones. |

### 5.5. Cierre de Inscripciones y Sorteo

| Regla | Comportamiento |
|-------|----------------|
| Trigger manual | Gestor clickea "Cerrar inscripciones y sortear". |
| Trigger automático | Llega `enrollmentDeadline` y el gestor no cerró manualmente. |
| Validación previa | Mínimo 2 equipos `APPROVED`. `APPROVED count` debe ser potencia de 2. |
| Conflictos sin resolver | Si hay inscripciones `PENDING_AVAILABILITY`, se notifica al gestor: "Sorteo se ejecutará de todas maneras". El gestor puede posponer o proceder. |
| Sorteo | Fisher-Yates shuffle de equipos `APPROVED`. Asignación a fases según formato. |
| Fases | Para `SINGLE_ELIMINATION`: se crean fases `log2(N)` (ej: 16 equipos → 4 fases: Octavos, Cuartos, Semis, Final). |
| Emparejamiento | Fase 1: posición 1 vs 2, 3 vs 4, etc. Fase 2: ganador(1vs2) vs ganador(3vs4), etc. |
| Post-sorteo | `status = IN_PROGRESS`. Se generan `Match` (Sistema 7) en las franjas del torneo. |

### 5.6. Cancelación y Suspensión

| Regla | Comportamiento |
|-------|----------------|
| Gestor cancela | Solo si `status = DRAFT`, `SCHEDULED` o `GRACE_PERIOD`. `IN_PROGRESS` está bloqueado. |
| Admin cancela | En CUALQUIER estado. `status = CANCELLED`. |
| Efecto cancelación | Todas las inscripciones se archivan. Partidos no jugados se cancelan. Notificación a capitanes. |
| Cancha deshabilitada | `Court.status = DISABLED` o franjas `UNAVAILABLE` → torneos afectados pasan a `SUSPENDED`. |
| Reagendamiento | Gestor debe mover el torneo a otra cancha con franjas disponibles. Status vuelve a `SCHEDULED`, `GRACE_PERIOD` o `IN_PROGRESS`. |
| Reubicación | Si la nueva cancha tiene diferente `dayOfWeek`/`timeSlot`, se re-evalúa disponibilidad de equipos inscritos. |

### 5.7. Franjas Horarias y Reserva

| Regla | Comportamiento |
|-------|----------------|
| Franja del torneo | `dayOfWeek` + `timeSlot` (2h). Ej: todos los martes de 18:00-20:00. |
| Reserva atómica | 1h45m dentro de la franja de 2h. Los 15 min restantes son colchón de transición. |
| Liberación temprana | Si el partido termina antes de 1h45m, la cancha libera el resto de la franja. No hay penalización. |
| Prelación | Si un torneo nuevo solicita una franja ocupada por otro torneo `SCHEDULED`, `GRACE_PERIOD` o `IN_PROGRESS` → Error Duro. |
| Ventana de planificación | El torneo debe caber dentro de la ventana de 2 semanas de disponibilidad de la cancha (Sistema 5). |

---

## 6. Endpoints tRPC Sugeridos

### 6.1. Router `tournament`

```typescript
export const tournamentRouter = createTRPCRouter({
  // ─── CRUD ───

  // Crear torneo en estado DRAFT
  create: permissionProcedure("tournament:create")
    .input(z.object({
      name: z.string().min(2).max(100),
      description: z.string().max(2000).optional(),
      courtId: z.string(),
      maxTeams: z.number().refine(n => Number.isInteger(Math.log2(n)) && n >= 2, {
        message: "maxTeams debe ser potencia de 2 (mínimo 2)"
      }),
      type: z.enum(["PUBLIC", "PRIVATE"]),
      format: z.enum(["SINGLE_ELIMINATION", "LEAGUE", "LEAGUE_PLUS_ELIMINATION"]).default("SINGLE_ELIMINATION"),
      enrollmentDeadline: z.date().refine(d => d > new Date(), {
        message: "La fecha límite debe ser futura"
      }),
      dayOfWeek: z.number().min(0).max(6),
      timeSlot: z.number().min(0).max(11),
      startDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.create(ctx.prisma, input, ctx.session.user.id);
    }),

  // Publicar torneo (DRAFT → SCHEDULED)
  publish: permissionProcedure("tournament:manage")
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.publish(ctx.prisma, input.tournamentId, ctx.session.user.id);
    }),

  // Actualizar datos básicos (solo en DRAFT o SCHEDULED)
  update: permissionProcedure("tournament:manage")
    .input(z.object({
      tournamentId: z.string(),
      name: z.string().min(2).max(100).optional(),
      description: z.string().max(2000).optional().nullable(),
      enrollmentDeadline: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.update(ctx.prisma, input, ctx.session.user.id);
    }),

  // Cancelar torneo (gestor solo si DRAFT/SCHEDULED; admin siempre)
  cancel: protectedProcedure
    .input(z.object({ tournamentId: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.cancel(ctx.prisma, input, ctx.session.user.id);
    }),

  // ─── Consulta ───

  // Listar torneos públicos (para capitanes)
  listPublic: protectedProcedure
    .input(z.object({
      status: z.enum(["SCHEDULED", "GRACE_PERIOD", "IN_PROGRESS", "FINISHED"]).optional(),
      courtId: z.string().optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return tournamentEngine.listPublic(ctx.prisma, input);
    }),

  // Listar torneos del gestor actual
  listMine: permissionProcedure("tournament:manage")
    .input(z.object({
      status: z.enum(["DRAFT", "SCHEDULED", "GRACE_PERIOD", "IN_PROGRESS", "FINISHED", "CANCELLED", "SUSPENDED", "ALL"]).default("ALL"),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return tournamentEngine.listByManager(ctx.prisma, ctx.session.user.id, input);
    }),

  // Obtener detalle de torneo (con prereserva Sala de Cine)
  getById: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return tournamentEngine.getById(ctx.prisma, input.tournamentId, ctx.session.user.id);
    }),

  // ─── Sala de Cine ───

  // Iniciar prereserva de cupo (al ver detalles)
  holdSlot: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return slotHoldEngine.hold(ctx.prisma, input.tournamentId, ctx.session.user.id);
    }),

  // Verificar estado de un hold
  checkHold: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return slotHoldEngine.check(ctx.prisma, input.tournamentId, ctx.session.user.id);
    }),

  // ─── Cierre y Sorteo ───

  // Cerrar inscripciones y ejecutar sorteo
  closeAndDraw: permissionProcedure("tournament:manage")
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.closeAndDraw(ctx.prisma, input.tournamentId, ctx.session.user.id);
    }),

  // Reagendar torneo suspendido a otra cancha/franja
  reschedule: permissionProcedure("tournament:manage")
    .input(z.object({
      tournamentId: z.string(),
      newCourtId: z.string(),
      newDayOfWeek: z.number().min(0).max(6),
      newTimeSlot: z.number().min(0).max(11),
    }))
    .mutation(async ({ ctx, input }) => {
      return tournamentEngine.reschedule(ctx.prisma, input, ctx.session.user.id);
    }),
});
```

### 6.2. Router `enrollment`

```typescript
export const enrollmentRouter = createTRPCRouter({
  // ─── Inscripción (Capitán) ───

  // Confirmar inscripción (después de prereserva)
  enroll: protectedProcedure
    .input(z.object({
      tournamentId: z.string(),
      teamId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return enrollmentEngine.enroll(ctx.prisma, input, ctx.session.user.id);
    }),

  // Solicitar re-evaluación de disponibilidad (si quedó PENDING_AVAILABILITY)
  requestReevaluation: protectedProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return enrollmentEngine.reevaluate(ctx.prisma, input.enrollmentId, ctx.session.user.id);
    }),

  // ─── Gestión (Gestor) ───

  // Listar inscripciones de un torneo
  listByTournament: permissionProcedure("tournament:manage")
    .input(z.object({
      tournamentId: z.string(),
      status: z.enum(["PENDING_AVAILABILITY", "PENDING_PAYMENT", "APPROVED", "REJECTED", "DISAPPROVED", "ALL"]).default("ALL"),
    }))
    .query(async ({ ctx, input }) => {
      return enrollmentEngine.listByTournament(ctx.prisma, input, ctx.session.user.id);
    }),

  // Aprobar inscripción (Factor 2)
  approve: permissionProcedure("tournament:manage")
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return enrollmentEngine.approve(ctx.prisma, input.enrollmentId, ctx.session.user.id);
    }),

  // Rechazar inscripción
  reject: permissionProcedure("tournament:manage")
    .input(z.object({
      enrollmentId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return enrollmentEngine.reject(ctx.prisma, input, ctx.session.user.id);
    }),

  // Desaprobar inscripción previamente aprobada
  disapprove: permissionProcedure("tournament:manage")
    .input(z.object({
      enrollmentId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return enrollmentEngine.disapprove(ctx.prisma, input, ctx.session.user.id);
    }),

  // ─── Consulta (Capitán) ───

  // Listar inscripciones de mis equipos
  listMyEnrollments: protectedProcedure
    .input(z.object({
      status: z.enum(["PENDING_AVAILABILITY", "PENDING_PAYMENT", "APPROVED", "REJECTED", "DISAPPROVED", "ALL"]).default("ALL"),
    }).optional())
    .query(async ({ ctx, input }) => {
      return enrollmentEngine.listByCaptain(ctx.prisma, ctx.session.user.id, input);
    }),
});
```

---

## 7. Motores de Negocio (Core)

### 7.1. `tournament.engine.ts`

```typescript
// server/core/tournament/tournament.engine.ts

export async function create(
  prisma: PrismaClient,
  input: CreateTournamentInput,
  userId: string
) {
  // 1. Verificar que el usuario es gestor activo con permiso tournament:create
  const manager = await prisma.manager.findFirst({
    where: { profile: { userId }, isActive: true },
    include: { profile: { include: { roleAssignments: { include: { role: { include: { permissions: true } } } } } } },
  });
  if (!manager) throw new TRPCError({ code: "FORBIDDEN", message: "No eres gestor activo" });

  // 2. Verificar que la cancha existe y está ENABLED
  const court = await prisma.court.findUnique({
    where: { id: input.courtId, status: "ENABLED" },
  });
  if (!court) throw new TRPCError({ code: "NOT_FOUND", message: "Cancha no encontrada o deshabilitada" });

  // 3. Verificar que maxTeams es potencia de 2
  if (!Number.isInteger(Math.log2(input.maxTeams)) || input.maxTeams < 2) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "maxTeams debe ser potencia de 2" });
  }

  // 4. Verificar que la franja está disponible (no hay torneo SCHEDULED/GRACE_PERIOD/IN_PROGRESS en esa franja)
  const conflictingTournament = await prisma.tournament.findFirst({
    where: {
      courtId: input.courtId,
      dayOfWeek: input.dayOfWeek,
      timeSlot: input.timeSlot,
      status: { in: ["SCHEDULED", "GRACE_PERIOD", "IN_PROGRESS"] },
    },
  });
  if (conflictingTournament) {
    throw new TRPCError({ code: "CONFLICT", message: "Franja horaria ocupada por otro torneo" });
  }

  // 5. Verificar que enrollmentDeadline es futura
  if (input.enrollmentDeadline <= new Date()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Fecha límite debe ser futura" });
  }

  // 6. Verificar que la franja está AVAILABLE en la cancha para las próximas 2 semanas
  const availability = await prisma.courtAvailability.findMany({
    where: {
      courtId: input.courtId,
      dayOfWeek: input.dayOfWeek, // Nota: CourtAvailability usa Date, no dayOfWeek. 
      // Se debe calcular las fechas con ese dayOfWeek en la ventana de 2 semanas
      timeSlot: input.timeSlot,
      status: "AVAILABLE",
    },
  });
  // Validar que hay al menos algunas franjas disponibles

  // 7. Crear torneo en estado DRAFT
  const tournament = await prisma.tournament.create({
    data: {
      ...input,
      managerId: manager.id,
      status: "DRAFT",
    },
  });

  return tournament;
}

export async function publish(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string
) {
  // 1. Verificar ownership (gestor del torneo)
  // 2. Verificar que está en DRAFT
  // 3. Actualizar status = SCHEDULED
}

export async function closeAndDraw(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string
) {
  // 1. Verificar ownership
  // 2. Verificar que está en SCHEDULED
  // 3. Contar APPROVED enrollments
  // 4. Validar que count >= 2 y es potencia de 2
  // 5. Si hay PENDING_AVAILABILITY, notificar al gestor pero proceder
  // 6. Fisher-Yates shuffle de equipos APPROVED
  // 7. Crear fases según formato (SINGLE_ELIMINATION)
  // 8. Crear emparejamientos iniciales (Match en Sistema 7)
  // 9. Actualizar status = IN_PROGRESS
  // 10. Notificar a capitanes de equipos sorteados
}

export async function cancel(
  prisma: PrismaClient,
  input: { tournamentId: string; reason?: string },
  userId: string
) {
  // 1. Verificar que el usuario es gestor del torneo O admin
  // 2. Si es gestor: solo puede cancelar si status = DRAFT, SCHEDULED o GRACE_PERIOD
  // 3. Si es admin: puede cancelar en cualquier estado
  // 4. Actualizar status = CANCELLED
  // 5. Cancelar partidos no jugados (Sistema 7)
  // 6. Notificar a capitanes
}

export async function reschedule(
  prisma: PrismaClient,
  input: RescheduleInput,
  userId: string
) {
  // 1. Verificar ownership
  // 2. Verificar que está SUSPENDED (o SCHEDULED si el gestor quiere cambiar antes)
  // 3. Verificar nueva cancha/franja disponible
  // 4. Actualizar courtId, dayOfWeek, timeSlot
  // 5. Si hay equipos inscritos, re-evaluar disponibilidad (Factor 1)
  // 6. Notificar a capitanes de cambio de horario
}
```

### 7.2. `enrollment.engine.ts`

```typescript
// server/core/tournament/enrollment.engine.ts

export async function enroll(
  prisma: PrismaClient,
  input: { tournamentId: string; teamId: string },
  userId: string
) {
  // 1. Verificar que el usuario es capitán del teamId
  const membership = await prisma.teamMembership.findFirst({
    where: {
      teamId: input.teamId,
      isCaptain: true,
      leftAt: null,
      player: { profile: { userId } },
    },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "No eres capitán de este equipo" });

  // 2. Verificar que el torneo está SCHEDULED o GRACE_PERIOD y tiene cupos
  const tournament = await prisma.tournament.findUnique({
    where: { id: input.tournamentId, status: { in: ["SCHEDULED", "GRACE_PERIOD"] } },
    include: {
      _count: {
        select: {
          enrollments: { where: { status: { in: ["APPROVED", "PENDING_PAYMENT"] } } },
          slotHolds: { where: { expiresAt: { gt: new Date() } } },
        },
      },
    },
  });
  if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no disponible" });

  const occupiedSlots = tournament._count.enrollments + tournament._count.slotHolds;
  if (occupiedSlots >= tournament.maxTeams) {
    throw new TRPCError({ code: "CONFLICT", message: "No hay cupos disponibles" });
  }

  // 3. Verificar que no existe enrollment previo para este equipo en este torneo
  const existing = await prisma.tournamentEnrollment.findUnique({
    where: { tournamentId_teamId: { tournamentId: input.tournamentId, teamId: input.teamId } },
  });
  if (existing) throw new TRPCError({ code: "CONFLICT", message: "Equipo ya inscrito" });

  // 4. Verificar SlotHold activo del capitán
  const hold = await prisma.tournamentSlotHold.findFirst({
    where: {
      tournamentId: input.tournamentId,
      heldBy: membership.playerId,
      expiresAt: { gt: new Date() },
    },
  });
  if (!hold) throw new TRPCError({ code: "FORBIDDEN", message: "No tienes una prereserva activa" });

  // 5. Evaluar Factor 1: disponibilidad horaria
  const teamMembers = await prisma.teamMembership.findMany({
    where: { teamId: input.teamId, leftAt: null },
    include: {
      player: {
        include: {
          availabilities: {
            where: {
              dayOfWeek: tournament.dayOfWeek,
              timeSlot: tournament.timeSlot,
            },
          },
        },
      },
    },
  });

  const availableCount = teamMembers.filter(
    tm => tm.player.availabilities.some(a => a.status === "AVAILABLE")
  ).length;

  // 6. Crear enrollment según resultado Factor 1
  const enrollment = await prisma.tournamentEnrollment.create({
    data: {
      tournamentId: input.tournamentId,
      teamId: input.teamId,
      status: availableCount >= 5 ? "PENDING_PAYMENT" : "PENDING_AVAILABILITY",
      availabilityNote: availableCount >= 5 
        ? null 
        : `Solo ${availableCount} de ${teamMembers.length} jugadores disponibles en la franja del torneo`,
    },
  });

  // 7. Eliminar SlotHold
  await prisma.tournamentSlotHold.delete({ where: { id: hold.id } });

  // 8. Notificar al capitán del resultado (Sistema 11)
  // 9. Si PENDING_PAYMENT, notificar al gestor para verificar pago

  return enrollment;
}

export async function approve(
  prisma: PrismaClient,
  enrollmentId: string,
  userId: string
) {
  // 1. Verificar que el enrollment está en PENDING_PAYMENT
  // 2. Verificar que el usuario es el gestor del torneo
  // 3. Actualizar status = APPROVED, approvedAt, approvedBy
  // 4. Notificar al capitán
}

export async function disapprove(
  prisma: PrismaClient,
  input: { enrollmentId: string; reason?: string },
  userId: string
) {
  // 1. Verificar que el enrollment está en APPROVED
  // 2. Verificar que el torneo aún no cerró inscripciones (status = SCHEDULED o GRACE_PERIOD)
  // 3. Verificar ownership del gestor
  // 4. Actualizar status = DISAPPROVED, disapprovedAt, disapprovedBy, disapprovedReason
  // 5. Notificar al capitán
}

export async function reevaluate(
  prisma: PrismaClient,
  enrollmentId: string,
  userId: string
) {
  // 1. Verificar que el enrollment está en PENDING_AVAILABILITY
  // 2. Verificar que el usuario es capitán del equipo
  // 3. Re-evaluar Factor 1 con disponibilidad actualizada
  // 4. Si ahora ≥5 disponibles → status = PENDING_PAYMENT
  // 5. Notificar al gestor
}
```

### 7.3. `slotHold.engine.ts` (Sala de Cine)

```typescript
// server/core/tournament/slotHold.engine.ts

export async function hold(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string
) {
  // 1. Verificar que el usuario es capitán de algún equipo
  const captainMemberships = await prisma.teamMembership.findMany({
    where: {
      isCaptain: true,
      leftAt: null,
      player: { profile: { userId } },
    },
  });
  if (captainMemberships.length === 0) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No eres capitán" });
  }

  // 2. Verificar que el torneo está SCHEDULED
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId, status: "SCHEDULED" },
    include: {
      _count: {
        select: {
          enrollments: { where: { status: { in: ["APPROVED", "PENDING_PAYMENT"] } } },
          slotHolds: { where: { expiresAt: { gt: new Date() } } },
        },
      },
    },
  });
  if (!tournament) throw new TRPCError({ code: "NOT_FOUND", message: "Torneo no disponible" });

  // 3. Verificar cupos disponibles
  const occupied = tournament._count.enrollments + tournament._count.slotHolds;
  if (occupied >= tournament.maxTeams) {
    throw new TRPCError({ code: "CONFLICT", message: "No hay cupos disponibles" });
  }

  // 4. Verificar que no hay hold activo de este capitán para este torneo
  const existingHold = await prisma.tournamentSlotHold.findFirst({
    where: {
      tournamentId,
      heldBy: captainMemberships[0].playerId,
      expiresAt: { gt: new Date() },
    },
  });
  if (existingHold) {
    // Renovar el hold existente
    return prisma.tournamentSlotHold.update({
      where: { id: existingHold.id },
      data: { expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
  }

  // 5. Crear nuevo hold
  const hold = await prisma.tournamentSlotHold.create({
    data: {
      tournamentId,
      heldBy: captainMemberships[0].playerId,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    },
  });

  return hold;
}

export async function check(
  prisma: PrismaClient,
  tournamentId: string,
  userId: string
) {
  // 1. Obtener playerId del usuario
  const player = await prisma.player.findFirst({
    where: { profile: { userId } },
  });
  if (!player) return null;

  // 2. Buscar hold activo
  const hold = await prisma.tournamentSlotHold.findFirst({
    where: {
      tournamentId,
      heldBy: player.id,
      expiresAt: { gt: new Date() },
    },
  });

  if (!hold) return null;

  return {
    expiresAt: hold.expiresAt,
    secondsRemaining: Math.max(0, Math.floor((hold.expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export async function cleanupExpired(prisma: PrismaClient) {
  // Cron job: eliminar holds expirados
  return prisma.tournamentSlotHold.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  });
}
```

### 7.4. Helpers de Sorteo

```typescript
// server/core/tournament/tournament.helpers.ts

export function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateEliminationPhases(teamCount: number): { name: string; order: number }[] {
  const phases = [];
  const rounds = Math.log2(teamCount);
  const phaseNames = ["Final", "Semifinal", "Cuartos de Final", "Octavos de Final", "Dieciseisavos de Final"];

  for (let i = 0; i < rounds; i++) {
    phases.push({
      name: phaseNames[i] || `Ronda ${rounds - i}`,
      order: i + 1,
    });
  }
  return phases.reverse(); // Ordenar de primera ronda a final
}

export function createBracketPairings(teams: { id: string }[]): { homeTeamId: string; awayTeamId: string }[] {
  const shuffled = fisherYatesShuffle(teams);
  const pairings = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairings.push({
      homeTeamId: shuffled[i].id,
      awayTeamId: shuffled[i + 1].id,
    });
  }
  return pairings;
}
```

---

## 8. Seguridad y Validaciones

### 8.1. Capa 1: Autenticación

- Todos los endpoints requieren sesión activa (`protectedProcedure`).

### 8.2. Capa 2: Autorización por Permiso

| Endpoint | Requiere |
|----------|----------|
| `tournament.create` | `tournament:create` (gestor activo) |
| `tournament.publish` | `tournament:manage` + ser gestor del torneo |
| `tournament.update` | `tournament:manage` + ser gestor del torneo |
| `tournament.cancel` | Ser gestor del torneo (solo DRAFT/SCHEDULED/GRACE_PERIOD) O ser admin |
| `tournament.listMine` | `tournament:manage` |
| `tournament.closeAndDraw` | `tournament:manage` + ser gestor del torneo |
| `tournament.reschedule` | `tournament:manage` + ser gestor del torneo |
| `enrollment.approve` | `tournament:manage` + ser gestor del torneo |
| `enrollment.reject` | `tournament:manage` + ser gestor del torneo |
| `enrollment.disapprove` | `tournament:manage` + ser gestor del torneo |
| `enrollment.listByTournament` | `tournament:manage` + ser gestor del torneo |
| `tournament.listPublic` | Cualquier usuario autenticado |
| `tournament.getById` | Cualquier usuario autenticado |
| `enrollment.enroll` | Ser capitán del equipo |
| `enrollment.requestReevaluation` | Ser capitán del equipo de la inscripción |
| `enrollment.listMyEnrollments` | Cualquier usuario autenticado |
| `tournament.holdSlot` | Ser capitán de algún equipo |
| `tournament.checkHold` | Ser capitán de algún equipo |

### 8.3. Capa 3: Validación de Estado y Ownership

| Acción | Validación |
|--------|------------|
| Crear torneo | Gestor activo. Cancha `ENABLED`. Franja disponible. `maxTeams` potencia de 2. Deadline futura. |
| Publicar torneo | Torneo en `DRAFT`. Ser gestor creador. |
| Actualizar torneo | Ser gestor creador. Solo editable en `DRAFT` o `SCHEDULED` (campos limitados). |
| Cancelar torneo | Gestor: solo `DRAFT`/`SCHEDULED`. Admin: cualquier estado. |
| Inscribir equipo | Torneo `SCHEDULED` o `GRACE_PERIOD`. Capitán del equipo. Cupos disponibles. Hold activo. Sin enrollment previo. |
| Aprobar inscripción | Enrollment en `PENDING_PAYMENT`. Ser gestor del torneo. |
| Desaprobar inscripción | Enrollment en `APPROVED`. Torneo en `SCHEDULED` o `GRACE_PERIOD`. Ser gestor del torneo. |
| Cerrar y sortear | Torneo en `SCHEDULED`. Ser gestor del torneo. `APPROVED` >= 2 y potencia de 2. |
| Reagendar | Torneo `SUSPENDED` (o `SCHEDULED`). Ser gestor del torneo. Nueva franja disponible. |
| Prereserva cupo | Torneo `SCHEDULED` o `GRACE_PERIOD`. Ser capitán. Cupos disponibles. |

---

## 9. UI / UX

### 9.1. Lista de Torneos (Vista Pública)

```
┌─────────────────────────────────────────────┐
│  🏆 Torneos Activos                         │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Copa Barrial 2026                   │    │
│  │ 📍 Cancha El Parque                 │    │
│  │ 🗓️ Martes 18:00-20:00               │    │
│  │ 👥 12/16 equipos inscritos          │    │
│  │ ⏳ Cierra inscripción: 2 días       │    │
│  │ [Ver detalles]                      │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ Liga de Verano                      │    │
│  │ 📍 Cancha La Esquina                │    │
│  │ 🗓️ Sábado 20:00-22:00               │    │
│  │ 👥 8/8 equipos • COMPLETO           │    │
│  │ [Ver detalles]                      │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 9.2. Detalle de Torneo con Sala de Cine

```
┌─────────────────────────────────────────────┐
│  Copa Barrial 2026                          │
│  📍 Cancha El Parque | Martes 18:00-20:00   │
│                                             │
│  Cupos: 12/16 confirmados                   │
│  2 plazas pendientes de confirmación        │
│  ⏳ Tu reserva expira en 4:32               │
│                                             │
│  [Confirmar inscripción con Los Pibes]      │
│  (Seleccionar equipo si eres capitán de +1) │
│                                             │
│  Equipos confirmados:                       │
│  • Los Pibes ✓                              │
│  • FC Central ✓                             │
│  • ...                                      │
│                                             │
│  Plazas pendientes:                         │
│  • (reservada hace 2 min)                   │
│  • (reservada hace 4 min)                   │
└─────────────────────────────────────────────┘
```

> **Nota:** Las plazas pendientes de confirmación se muestran como "reservadas" sin nombre de equipo, con indicador de tiempo restante. No restan del contador de "confirmados".

### 9.3. Panel de Gestor — Inscripciones

```
┌─────────────────────────────────────────────┐
│  Copa Barrial 2026 — Inscripciones          │
│                                             │
│  ┌─ PENDIENTE PAGO (3) ─────────────────┐   │
│  │ Los Pibes        [Aprobar] [Rechazar]│   │
│  │ FC Central       [Aprobar] [Rechazar]│   │
│  │ La Banda         [Aprobar] [Rechazar]│   │
│  └────────────────────────────────────────┘   │
│                                             │
│  ┌─ CONFLICTO HORARIO (2) ──────────────┐   │
│  │ Equipo Rojo      [Ver conflicto]     │   │
│  │   └ Solo 3/12 jugadores disponibles   │   │
│  │ Equipo Azul      [Ver conflicto]     │   │
│  │   └ Solo 2/10 jugadores disponibles   │   │
│  └────────────────────────────────────────┘   │
│                                             │
│  ┌─ APROBADOS (8) ───────────────────────┐   │
│  │ Los Pibes ✓    [Desaprobar]           │   │
│  │ FC Central ✓   [Desaprobar]           │   │
│  │ ...                                   │   │
│  └────────────────────────────────────────┘   │
│                                             │
│  [Cerrar inscripciones y sortear]           │
│  ⚠️ Hay 2 conflictos sin resolver           │
└─────────────────────────────────────────────┘
```

### 9.4. Reglas de UI

- **Cero CSS inline**: Todo con Tailwind o `cva`.
- **Countdown de prereserva**: Actualización en tiempo real (1s interval) usando `useEffect` + `setInterval`.
- **Optimistic UI**: Al confirmar inscripción, la UI muestra el equipo en "PENDIENTE PAGO" inmediatamente mientras se sincroniza.
- **Badge de conflictos**: Los equipos con `PENDING_AVAILABILITY` muestran badge rojo con tooltip de detalle.
- **Deshabilitar acciones**: Botón "Cerrar y sortear" se deshabilita si `APPROVED` no es potencia de 2 o < 2.
- **Modal de confirmación**: Al clickear "Confirmar inscripción", modal con resumen del torneo, franja horaria, y checklist de disponibilidad de la plantilla.

---

## 10. Checklist de Implementación

- [ ] Implementar schema Prisma (`Tournament`, `TournamentEnrollment`, `TournamentPhase`, `TournamentSlotHold`)
- [ ] Ejecutar migración de base de datos
- [ ] Implementar motor `tournament.engine.ts` (CRUD, publicación, cancelación, reagendamiento)
- [ ] Implementar motor `enrollment.engine.ts` (inscripción, 2 factores, aprobación, desaprobación, re-evaluación)
- [ ] Implementar motor `slotHold.engine.ts` (prereserva 5min, verificación, cleanup)
- [ ] Implementar helpers `tournament.helpers.ts` (Fisher-Yates, generación de fases, emparejamientos)
- [ ] Crear router `tournament` en tRPC
- [ ] Crear router `enrollment` en tRPC
- [ ] Implementar middleware de verificación de gestor del torneo
- [ ] Implementar cron job para limpieza de `TournamentSlotHold` expirados (cada minuto)
- [ ] Implementar cron job para cierre automático al `enrollmentDeadline` + sorteo
- [ ] Implementar cron job para notificación de conflictos sin resolver al gestor
- [ ] Crear página de lista de torneos públicos (`/torneos`)
- [ ] Crear página de detalle de torneo con Sala de Cine (`/torneos/[id]`)
- [ ] Crear modal de confirmación de inscripción con countdown
- [ ] Crear panel de gestor de inscripciones (`/gestor/torneos/[id]/inscripciones`)
- [ ] Crear página de creación de torneo (`/gestor/torneos/nuevo`)
- [ ] Crear componente de bracket/visualización de fases (futuro)
- [ ] Implementar notificaciones de inscripción, aprobación, rechazo, desaprobación, sorteo, cierre (Sistema 11)
- [ ] Crear hooks de feature: `useTournaments`, `useTournament`, `useEnrollment`, `useSlotHold`
- [ ] Integrar con Sistema 7 para generación de partidos post-sorteo
- [ ] Integrar con Sistema 5 para validación de disponibilidad de cancha

---

## 11. Dependencias con Otros Sistemas

| Sistema | Dependencia | Descripción |
|---------|-------------|-------------|
| Sistema 1: Auth & RBAC | Requiere | Permisos `tournament:create`, `tournament:manage`. Admin asigna permisos granulares de asistente. |
| Sistema 2: Usuarios/Perfiles | Requiere | `PlayerAvailability` para evaluar Factor 1 (disponibilidad horaria de plantilla). |
| Sistema 3: Equipos | Requiere | `Team`, `TeamMembership`, capitanía. Plantilla completa se inscribe al torneo. |
| Sistema 4: Reclutamiento | Ninguna directa | — |
| Sistema 5: Canchas | Requiere | `Court`, `CourtAvailability`. El torneo se asigna a una cancha y franja específica. Prelación estricta de franjas. |
| Sistema 7: Partidos | Provee datos | Al cerrar inscripciones, se generan `Match` y `TournamentPhase`. Los partidos heredan la franja del torneo. |
| Sistema 10: Resultados | Consume datos | Estadísticas del torneo, tabla de posiciones. |
| Sistema 11: Notificaciones | Notifica | Inscripción, aprobación, rechazo, desaprobación, sorteo, cierre, conflicto sin resolver, cancelación. |
| Sistema 12: Mapa | Consume datos | El mapa puede mostrar torneos activos en cada cancha. |

---

## 12. Notas de Arquitectura

### 12.1. Sala de Cine — Diseño de Concurrencia

El motor `slotHold` resuelve el problema clásico de "último cupo disponible" sin locks pesados:

1. **Prereserva ligera**: Un `TournamentSlotHold` es una fila liviana en BD con `expiresAt`. No bloquea transacciones ni usa advisory locks.
2. **Conteo optimista**: El cálculo de cupos disponibles incluye holds activos: `maxTeams - (APPROVED + PENDING_PAYMENT + activeHolds)`.
3. **Cleanup eventual**: Un cron job limpia holds expirados cada minuto. También se valida `expiresAt > now()` en cada query.
4. **Race condition mínima**: Si dos capitanes clickean exactamente al mismo tiempo, el primero en crear el registro gana. El segundo recibe error de "cupos agotados" en la segunda validación.
5. **UI transparente**: El usuario ve el countdown y sabe que su plaza está reservada. No hay ambigüedad.

### 12.2. Factor 1 — Disponibilidad vs. Conflicto

La evaluación de disponibilidad horaria (Factor 1) usa `PlayerAvailability.status = AVAILABLE` directamente. No usa el estado `CONFLICT` calculado en runtime (Sistema 2) porque:

- El `CONFLICT` se calcula cruzando con partidos programados del jugador.
- Al momento de inscripción, el jugador aún no tiene partidos en este torneo (no existe el torneo en su calendario).
- Por lo tanto, solo se evalúa `AVAILABLE` vs `UNAVAILABLE`.

Si un jugador tiene `UNAVAILABLE` en la franja del torneo, se cuenta como no disponible. Si tiene `AVAILABLE`, se cuenta como disponible.

### 12.3. Sorteo y Generación de Partidos

El sorteo se ejecuta en una transacción atómica:
1. Validar estado y condiciones.
2. Shuffle de equipos `APPROVED`.
3. Crear `TournamentPhase` en orden.
4. Crear `Match` de la primera fase con `homeTeamId` y `awayTeamId` asignados.
5. Actualizar `Tournament.status = IN_PROGRESS`.

Los partidos de fases subsiguientes se crean "vacíos" (sin equipos asignados) y se completan a medida que se cargan resultados (Sistema 7 y 10).

### 12.4. Reagendamiento vs. Reubicación

- **Reagendamiento**: Cambiar `dayOfWeek`/`timeSlot` dentro de la misma cancha. Requiere re-evaluar Factor 1 de todos los equipos inscritos.
- **Reubicación**: Cambiar a otra cancha. Requiere validar disponibilidad de la nueva cancha y re-evaluar Factor 1.

Ambos se manejan vía `tournament.reschedule` con validaciones de estado (`SUSPENDED`, `SCHEDULED` o `GRACE_PERIOD`).

---

> **Documento versionado.** Cualquier modificación requiere revisión y aprobación antes de implementar.
