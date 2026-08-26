# Sistema 7: Partidos / Aplazamientos

> **Estado:** Especificado (Aprobado)  
> **Propósito:** Documento de diseño técnico del sistema de programación, gestión, aplazamiento y carga de resultados de partidos de microfútbol. Sujeto a revisión conforme se especifiquen los demás sistemas.

---

## 1. Visión del Sistema

Sistema de gestión de partidos que orquesta el ciclo completo de un encuentro: desde la generación automática tras el sorteo de un torneo (Sistema 6), pasando por la programación en franjas horarias de la cancha, hasta la carga de resultados y estadísticas por parte del gestor (o su asistente). Los capitanes no intervienen en la logística del partido: no confirman asistencia, no cargan resultados, no pueden aplazar. Su única interacción es marcar jugadores como "ausentes" en la convocatoria de su equipo, lo cual es puramente informativo y no afecta el sistema de horarios ni el motor de reagendamiento.

El **gestor** (o su asistente con permisos delegados por el admin) es la única figura operativa del partido: programa fechas, aplaza, reagenda, carga resultados, asigna árbitros, y marca walkovers. La programación de partidos se calcula automáticamente en base a la cantidad de equipos del torneo y la disponibilidad de franjas de la cancha. Si son 4 equipos, se necesitan 3 partidos; el sistema reserva franjas consecutivas que sumen el tiempo total requerido (ej: 3 partidos × 2h = 6h de franjas reservadas).

El aplazamiento es unilateral del gestor con motivo obligatorio. El reagendamiento consulta la disponibilidad de la cancha y presenta opciones al gestor, quien elige manualmente la nueva franja. No hay confirmación cruzada con disponibilidad de equipos: el gestor decide basándose en la información que tiene.

---

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Sin confirmación de capitanes** | Sí | Los partidos se juegan automáticamente según programación. No hay flujo de confirmación previa. |
| **Convocatoria global** | Sí | Toda la plantilla del equipo está convocada automáticamente. No hay selección de jugadores por partido. |
| **Ausente = informativo** | Sí | El capitán marca ausentes, pero esto no afecta horarios ni reagendamiento. Es referencia visual para el gestor. |
| **Aplazamiento solo gestor/asistente** | Sí | Ningún capitán puede aplazar. El gestor o su asistente (con permisos del admin) son los únicos operadores. |
| **Motivo de aplazamiento obligatorio** | Sí | Texto libre obligatorio. Registro de auditoría. |
| **Reagendamiento manual sobre disponibilidad** | Sí | El sistema muestra franjas disponibles de la cancha. El gestor elige manualmente. No hay cálculo cruzado con equipos. |
| **Programación automática por cantidad de equipos** | Sí | El sistema calcula cuántos partidos necesita (ej: 4 equipos = 3 partidos) y reserva franjas consecutivas que sumen el tiempo total. |
| **Resultados solo gestor** | Sí | El gestor (o asistente) carga goles, tarjetas (azul, amarilla, roja) y faltas sin tarjeta. |
| **Walkover manual por gestor** | Sí | Si un equipo no se presenta o está incompleto, el gestor marca W y asigna derrota. También puede optar por aplazar. |
| **Árbitros asignados manualmente** | Sí | El gestor elige árbitro de un directorio pasivo por partido. |
| **Partidos de fases subsiguientes** | Se crean vacíos | Al sortear se crean todos los partidos de todas las fases. Los de fases >1 tienen `homeTeamId`/`awayTeamId` null hasta que se definen por resultados previos. |
| **Franjas de 2h por partido** | Sí | Coherente con Sistema 5. Reserva atómica interna de 1h45m. |
| **Penalización walkover en Fair Play** | Sí | El walkover afecta la métrica de Fair Play del equipo (informativo, no algorítmico). |

---

## 3. Modelo de Datos (Prisma Schema)

### 3.1. Partido

```prisma
model Match {
  id              String        @id @default(cuid())
  tournamentId    String
  phaseId         String
  homeTeamId      String?       // Null en fases subsiguientes hasta definirse
  awayTeamId      String?       // Null en fases subsiguientes hasta definirse
  scheduledAt     DateTime      // Fecha y hora exacta del partido
  timeSlot        Int           // Franja horaria (0-11)
  status          MatchStatus   @default(SCHEDULED)
  postponedReason String?       @db.Text // Motivo del aplazamiento
  postponedAt     DateTime?     // Cuándo se aplazó
  postponedBy     String?       // ManagerId que aplazó
  walkoverTeamId  String?       // Equipo que no se presentó (para W)
  refereeId       String?       // Árbitro asignado (directorio pasivo)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  tournament    Tournament       @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  phase         TournamentPhase  @relation(fields: [phaseId], references: [id], onDelete: Cascade)
  homeTeam      Team?            @relation("HomeTeam", fields: [homeTeamId], references: [id], onDelete: SetNull)
  awayTeam      Team?            @relation("AwayTeam", fields: [awayTeamId], references: [id], onDelete: SetNull)
  referee       Referee?         @relation(fields: [refereeId], references: [id], onDelete: SetNull)
  callUps       MatchCallUp[]
  result        MatchResult?
  rescheduledFrom Match?         @relation("RescheduledFrom")
  rescheduledTo   Match?         @relation("RescheduledFrom")

  @@index([tournamentId, status])
  @@index([phaseId, status])
  @@index([scheduledAt])
}

enum MatchStatus {
  SCHEDULED       // Programado, aún no jugado
  IN_PROGRESS     // En curso (marcado manualmente por gestor)
  FINISHED        // Finalizado, resultado cargado
  POSTPONED       // Aplazado, pendiente de reagendamiento
  CANCELLED       // Cancelado definitivamente
  WALKOVER        // Un equipo no se presentó, victoria por W
}
```

> **Nota:** `homeTeamId` y `awayTeamId` son nullable para soportar partidos de fases subsiguientes que se crean vacíos al sortear. Se completan cuando los resultados de la fase anterior definen los clasificados.

### 3.2. Convocatoria (Ausentes)

```prisma
model MatchCallUp {
  id        String   @id @default(cuid())
  matchId   String
  teamId    String   // Equipo al que pertenece la convocatoria
  playerId  String   // Jugador convocado
  isAbsent  Boolean  @default(false) // Marcado por el capitán como ausente
  markedBy  String?  // PlayerId del capitán que marcó ausente
  markedAt  DateTime?
  notes     String?  @db.Text // Nota opcional del capitán (ej: "Lesión", "Trabajo")

  match  Match  @relation(fields: [matchId], references: [id], onDelete: Cascade)
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([matchId, teamId, playerId])
  @@index([matchId, teamId])
}
```

> **Nota:** Las filas de `MatchCallUp` se generan automáticamente para todos los miembros activos de ambos equipos al crear el partido. El capitán solo marca `isAbsent = true` con `markedBy`/`markedAt`. Es puramente informativo.

### 3.3. Resultado del Partido

```prisma
model MatchResult {
  id            String   @id @default(cuid())
  matchId       String   @unique
  homeScore     Int      @default(0)
  awayScore     Int      @default(0)
  winnerId      String?  // Equipo ganador (null si empate o W)
  isWalkover    Boolean  @default(false)
  loadedAt      DateTime @default(now())
  loadedBy      String   // ManagerId que cargó el resultado
  notes         String?  @db.Text
  externalLinks String?  @db.Text // Links externos separados por salto de línea
  updatedAt     DateTime @updatedAt

  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)
}
```

### 3.4. Estadísticas Individuales del Partido

```prisma
model MatchPlayerStat {
  id          String      @id @default(cuid())
  matchId     String
  playerId    String
  teamId      String
  goals       Int         @default(0)
  blueCards   Int         @default(0)
  yellowCards Int         @default(0)
  redCards    Int         @default(0)
  fouls       Int         @default(0) // Faltas sin tarjeta
  ownGoals    Int         @default(0)
  createdAt   DateTime    @default(now())

  match  Match  @relation(fields: [matchId], references: [id], onDelete: Cascade)
  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([matchId, playerId])
  @@index([matchId, teamId])
}
```

### 3.5. Árbitro (Directorio Pasivo)

```prisma
model Referee {
  id          String   @id @default(cuid())
  name        String
  phone       String?
  email       String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  matches Match[]
}
```

> **Nota:** `Referee` es un directorio pasivo sin login ni relación con `User`/`Profile`. El admin o gestor lo gestiona manualmente.

### 3.6. Relaciones en entidades existentes

```prisma
// En Team (Sistema 3) — agregar relaciones
model Team {
  // ... campos existentes ...
  matchesAsHome     Match[] @relation("HomeTeam")
  matchesAsAway     Match[] @relation("AwayTeam")
  matchCallUps      MatchCallUp[]
  matchPlayerStats  MatchPlayerStat[]
}

// En Tournament (Sistema 6) — agregar relación
model Tournament {
  // ... campos existentes ...
  matches Match[]
}

// En TournamentPhase (Sistema 6) — agregar relación
model TournamentPhase {
  // ... campos existentes ...
  matches Match[]
}

// En Player (Sistema 2) — agregar relaciones
model Player {
  // ... campos existentes ...
  matchCallUps     MatchCallUp[]
  matchPlayerStats MatchPlayerStat[]
}
```

---

## 4. Flujo Principal

### 4.1. Generación de Partidos (Post-Sorteo)

```
Torneo cierra inscripciones y sortea (Sistema 6)
    ↓
SISTEMA: Para cada fase del torneo:
  - Fase 1: crear partidos con homeTeamId/awayTeamId asignados del sorteo
  - Fases >1: crear partidos vacíos (homeTeamId/awayTeamId = null)
    ↓
SISTEMA: Calcular franjas necesarias
  - N equipos → M partidos totales en el torneo
  - M partidos × 2h = total de franjas horarias requeridas
    ↓
SISTEMA: Asignar fechas consecutivas en la franja del torneo
  - Ej: torneo martes 18:00-20:00, 3 partidos
  - Partido 1: martes 18/8 18:00-20:00
  - Partido 2: martes 25/8 18:00-20:00
  - Partido 3: martes 1/9 18:00-20:00
    ↓
SISTEMA: Generar MatchCallUp para todos los miembros activos de ambos equipos
    ↓
Notificar a capitanes de partidos programados
```

### 4.2. Programación Manual por Gestor (Alternativa)

```
Gestor accede al panel del torneo IN_PROGRESS
    ↓
Vee lista de partidos sin fecha asignada (fases subsiguientes)
    ↓
Selecciona partido → ve franjas disponibles de la cancha
    ↓
Elige fecha/timeSlot de la lista de disponibles
    ↓
SISTEMA: Asigna scheduledAt y timeSlot al partido
    ↓
Genera MatchCallUp para equipos ya definidos
    ↓
Notifica a capitanes
```

### 4.3. Aplazamiento

```
Gestor (o asistente con permisos) accede a partido programado
    ↓
Clickea "Aplazar partido"
    ↓
Ingresa motivo obligatorio (texto libre)
    ↓
SISTEMA:
  - status = POSTPONED
  - postponedAt = now()
  - postponedBy = managerId
  - postponedReason = motivo
  - Libera franja de cancha (CourtAvailability vuelve a AVAILABLE)
    ↓
Notifica a capitanes de ambos equipos
    ↓
Gestor accede a reagendar:
  - Sistema muestra franjas AVAILABLE de la cancha
  - Gestor elige nueva franja manualmente
    ↓
SISTEMA: Asigna nueva fecha/timeSlot, status = SCHEDULED
    ↓
Notifica a capitanes de nueva fecha
```

### 4.4. Carga de Resultados

```
Partido finaliza (o el gestor lo marca como finalizado)
    ↓
Gestor accede a panel de carga de resultados
    ↓
Ingresa:
  - homeScore, awayScore
  - winnerId (o empate)
  - MatchPlayerStat por jugador: goles, tarjetas (azul, amarilla, roja), faltas, autogoles
    ↓
SISTEMA: Crea MatchResult + MatchPlayerStat
    ↓
SISTEMA: Si es fase eliminatoria:
  - Determina ganador
  - Asigna ganador al partido vacío de la siguiente fase (homeTeamId o awayTeamId)
    ↓
Notifica a capitanes de resultado cargado
    ↓
Actualiza estadísticas del torneo (Sistema 10)
```

### 4.5. Walkover

```
Equipo no se presenta o está incompleto en la fecha del partido
    ↓
Gestor accede al partido
    ↓
Opción A: Marcar Walkover
  - Selecciona equipo que no se presentó (walkoverTeamId)
  - SISTEMA: status = WALKOVER
  - SISTEMA: MatchResult con isWalkover = true, winnerId = equipo presente
  - Penaliza Fair Play del equipo ausente
    ↓
Opción B: Aplazar
  - Gestor aplaza el partido con motivo "Equipo incompleto"
  - Sigue flujo de aplazamiento normal
    ↓
Notifica a capitanes
```

### 4.6. Marcar Ausentes (Capitán)

```
Capitán accede a detalle del partido de su equipo
    ↓
Vee lista de convocados (toda la plantilla)
    ↓
Marca jugadores como "Ausente" con nota opcional
    ↓
SISTEMA: Actualiza MatchCallUp.isAbsent = true, markedBy, markedAt, notes
    ↓
UI muestra badge de ausente en la convocatoria
    ↓
Gestor ve la lista de ausentes como referencia informativa
```

---

## 5. Reglas de Negocio Críticas

### 5.1. Creación y Programación

| Regla | Comportamiento |
|-------|----------------|
| Generación automática | Al sortear (Sistema 6), se crean todos los partidos de todas las fases. |
| Fase 1 | Partidos con `homeTeamId` y `awayTeamId` asignados del sorteo. |
| Fases >1 | Partidos creados vacíos (`homeTeamId`/`awayTeamId` = null). Se completan cuando los resultados de la fase anterior definen clasificados. |
| Franjas consecutivas | Los partidos se asignan a franjas consecutivas del torneo (mismo `dayOfWeek` + `timeSlot`). Ej: todos los martes 18:00-20:00. |
| Cálculo de franjas | N partidos = total de franjas necesarias. Ej: 4 equipos eliminación simple = 3 partidos = 6h de franjas. |
| Validación de cancha | Al asignar fecha, se verifica que la franja esté AVAILABLE en `CourtAvailability`. |
| Convocatoria automática | Al crear/actualizar un partido con equipos definidos, se generan `MatchCallUp` para todos los miembros activos de ambos equipos. |
| Solo gestor programa | El gestor puede reasignar fecha de cualquier partido. Los capitanes no intervienen. |

### 5.2. Aplazamiento

| Regla | Comportamiento |
|-------|----------------|
| Actor | Solo gestor o asistente con permisos `match:postpone` (asignados por admin). |
| Motivo obligatorio | Texto libre obligatorio. Se guarda en `postponedReason`. |
| Estado | `status = POSTPONED`. `postponedAt = now()`. `postponedBy = managerId`. |
| Liberación de franja | La franja de `CourtAvailability` vuelve a `AVAILABLE`. |
| Partido no jugado | Si el partido ya tenía `MatchResult`, se preserva el historial pero se invalida para estadísticas del torneo. |
| Reagendamiento | El gestor elige nueva franja de la lista de disponibles de la cancha. No hay cálculo cruzado con equipos. |
| Múltiples aplazamientos | Sin límite estricto, pero cada aplazamiento genera notificación y queda registrado. |
| Fases subsiguientes | Si se aplaza un partido de fase 1, los partidos de fases >1 que dependen de su resultado mantienen su fecha programada (pueden quedar con equipos indefinidos por más tiempo). |

### 5.3. Reagendamiento

| Regla | Comportamiento |
|-------|----------------|
| Consulta | El sistema muestra todas las franjas `AVAILABLE` de la cancha en la ventana de 2 semanas (Sistema 5). |
| Selección | El gestor elige manualmente la nueva franja. No hay recomendación automática. |
| Validación | La franja elegida no debe estar ocupada por otro partido `SCHEDULED` o `IN_PROGRESS` del mismo torneo. |
| Actualización | Se actualiza `scheduledAt` y `timeSlot`. `status = SCHEDULED`. |
| Notificación | Se notifica a capitanes de ambos equipos de la nueva fecha. |
| Re-evaluación | No se re-evalúa disponibilidad de jugadores. El gestor asume la responsabilidad de la nueva fecha. |

### 5.4. Carga de Resultados

| Regla | Comportamiento |
|-------|----------------|
| Actor | Solo gestor o asistente con permisos `match:result` (asignados por admin). |
| Datos obligatorios | `homeScore`, `awayScore`, `winnerId` (o indicador de empate). |
| Estadísticas individuales | `MatchPlayerStat` por jugador: goles, blueCards, yellowCards, redCards, fouls, ownGoals. Todos default 0. |
| Jugadores disponibles | Solo jugadores con `MatchCallUp` en ese partido pueden tener estadísticas. |
| Carga parcial | El gestor puede cargar solo resultado sin estadísticas individuales, y completar después. |
| Fase eliminatoria | Al cargar resultado, el sistema determina ganador y lo asigna al partido vacío de la siguiente fase. |
| Empate en eliminatoria | Si hay empate en fase eliminatoria, el gestor debe definir ganador (penales, sorteo, etc.) manualmente. |
| Edición | El gestor puede editar resultado y estadísticas mientras el torneo no esté `FINISHED`. |

### 5.5. Walkover

| Regla | Comportamiento |
|-------|----------------|
| Trigger | Equipo no se presenta o está incompleto en la fecha del partido. |
| Actor | Gestor marca walkover manualmente. No es automático. |
| Estado | `status = WALKOVER`. `walkoverTeamId` = equipo ausente. |
| Resultado | `MatchResult` con `isWalkover = true`, `winnerId` = equipo presente, `homeScore`/`awayScore` = 0-0 (o configurable). |
| Fair Play | El Walkover (perder por 'W') no afecta las estadísticas numéricas (goles, tarjetas, faltas) ni el cálculo del Fair Play. Es un resultado administrativo. |
| Alternativa | El gestor puede optar por aplazar en lugar de walkover. |
| Fase eliminatoria | El equipo presente avanza a la siguiente fase automáticamente. |

### 5.6. Convocatoria y Ausentes

| Regla | Comportamiento |
|-------|----------------|
| Convocatoria | Todos los miembros activos (`TeamMembership.leftAt = null`) de ambos equipos se generan automáticamente en `MatchCallUp`. |
| Capitán marca ausentes | El capitán puede marcar `isAbsent = true` con nota opcional. |
| Informativo | El ausente no afecta horarios, reagendamiento, ni carga de resultados. Es referencia visual. |
| Gestor ve ausentes | El gestor consulta `MatchCallUp` para saber quién no asistirá, como contexto. |
| Edición | El capitán puede desmarcar ausente hasta el inicio del partido. |
| No bloqueante | Un equipo con todos los jugadores marcados como ausentes igual puede jugar (el gestor decide walkover o aplazar). |

### 5.7. Árbitros

| Regla | Comportamiento |
|-------|----------------|
| Directorio | El admin o gestor gestiona el directorio de árbitros (`Referee`). |
| Sin login | Los árbitros no tienen cuenta ni acceso a la plataforma. |
| Asignación | El gestor asigna un árbitro a cada partido manualmente. |
| Opcional | Un partido puede no tener árbitro asignado. |
| Contacto | Se muestra nombre y teléfono del árbitro en el detalle del partido. |

---

## 6. Endpoints tRPC Sugeridos

### 6.1. Router `match`

```typescript
export const matchRouter = createTRPCRouter({
  // ─── Gestor ───

  // Listar partidos de un torneo
  listByTournament: permissionProcedure("tournament:manage")
    .input(z.object({
      tournamentId: z.string(),
      status: z.enum(["SCHEDULED", "IN_PROGRESS", "FINISHED", "POSTPONED", "CANCELLED", "WALKOVER", "ALL"]).default("ALL"),
      phaseId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return matchEngine.listByTournament(ctx.prisma, input, ctx.session.user.id);
    }),

  // Obtener detalle de partido
  getById: protectedProcedure
    .input(z.object({ matchId: z.string() }))
    .query(async ({ ctx, input }) => {
      return matchEngine.getById(ctx.prisma, input.matchId);
    }),

  // Programar/actualizar fecha de partido
  schedule: permissionProcedure("tournament:manage")
    .input(z.object({
      matchId: z.string(),
      scheduledAt: z.date(),
      timeSlot: z.number().min(0).max(11),
    }))
    .mutation(async ({ ctx, input }) => {
      return matchEngine.schedule(ctx.prisma, input, ctx.session.user.id);
    }),

  // Aplazar partido
  postpone: permissionProcedure("match:postpone")
    .input(z.object({
      matchId: z.string(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      return matchEngine.postpone(ctx.prisma, input, ctx.session.user.id);
    }),

  // Reagendar partido aplazado
  reschedule: permissionProcedure("match:postpone")
    .input(z.object({
      matchId: z.string(),
      newScheduledAt: z.date(),
      newTimeSlot: z.number().min(0).max(11),
    }))
    .mutation(async ({ ctx, input }) => {
      return matchEngine.reschedule(ctx.prisma, input, ctx.session.user.id);
    }),

  // Cargar resultado
  loadResult: permissionProcedure("match:result")
    .input(z.object({
      matchId: z.string(),
      homeScore: z.number().min(0),
      awayScore: z.number().min(0),
      winnerId: z.string().optional(), // null si empate
      playerStats: z.array(z.object({
        playerId: z.string(),
        teamId: z.string(),
        goals: z.number().min(0).default(0),
        blueCards: z.number().min(0).default(0),
        yellowCards: z.number().min(0).default(0),
        redCards: z.number().min(0).default(0),
        fouls: z.number().min(0).default(0),
        ownGoals: z.number().min(0).default(0),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return matchEngine.loadResult(ctx.prisma, input, ctx.session.user.id);
    }),

  // Marcar walkover
  markWalkover: permissionProcedure("match:result")
    .input(z.object({
      matchId: z.string(),
      walkoverTeamId: z.string(), // Equipo que no se presentó
    }))
    .mutation(async ({ ctx, input }) => {
      return matchEngine.markWalkover(ctx.prisma, input, ctx.session.user.id);
    }),

  // Asignar árbitro
  // Nota: El permiso tournament:manage cubre tanto a gestores como a asistentes
  // con permisos delegados por el admin.
  assignReferee: permissionProcedure("tournament:manage")
    .input(z.object({
      matchId: z.string(),
      refereeId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return matchEngine.assignReferee(ctx.prisma, input, ctx.session.user.id);
    }),

  // ─── Capitán ───

  // Listar partidos de mis equipos
  listMyMatches: protectedProcedure
    .input(z.object({
      status: z.enum(["SCHEDULED", "IN_PROGRESS", "FINISHED", "POSTPONED", "CANCELLED", "WALKOVER", "ALL"]).default("ALL"),
    }).optional())
    .query(async ({ ctx, input }) => {
      return matchEngine.listByCaptain(ctx.prisma, ctx.session.user.id, input);
    }),

  // Marcar ausentes en convocatoria
  // Nota: El endpoint usa protectedProcedure, pero el motor (match.engine.ts) debe validar
  // estrictamente que el usuario que realiza la acción tiene isCaptain = true en el teamId
  // del jugador marcado como ausente.
  markAbsent: protectedProcedure
    .input(z.object({
      matchId: z.string(),
      playerId: z.string(),
      notes: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return matchEngine.markAbsent(ctx.prisma, input, ctx.session.user.id);
    }),

  // Desmarcar ausente
  unmarkAbsent: protectedProcedure
    .input(z.object({
      matchId: z.string(),
      playerId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return matchEngine.unmarkAbsent(ctx.prisma, input, ctx.session.user.id);
    }),

  // ─── Árbitros (Admin/Gestor) ───

  // Listar árbitros
  listReferees: permissionProcedure("tournament:manage")
    .input(z.object({
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return matchEngine.listReferees(ctx.prisma, input);
    }),

  // Crear árbitro
  createReferee: permissionProcedure("tournament:manage")
    .input(z.object({
      name: z.string().min(1).max(100),
      phone: z.string().max(20).optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return matchEngine.createReferee(ctx.prisma, input);
    }),
});
```

---

## 7. Motores de Negocio (Core)

### 7.1. `match.engine.ts` — Estructura

```typescript
// server/core/match/match.engine.ts

// Generar partidos tras sorteo
export async function generateFromDraw(
  prisma: PrismaClient,
  tournamentId: string,
  drawResult: DrawResult // Del Sistema 6
) {
  // 1. Para cada fase del torneo, crear partidos
  // 2. Fase 1: asignar homeTeamId/awayTeamId del sorteo
  // 3. Fases >1: crear vacíos
  // 4. Calcular fechas consecutivas en la franja del torneo
  // 5. Validar disponibilidad de cancha para cada fecha
  // 6. Generar MatchCallUp para equipos definidos
  // 7. Retornar lista de partidos creados
}

// Programar partido
export async function schedule(
  prisma: PrismaClient,
  input: { matchId: string; scheduledAt: Date; timeSlot: number },
  userId: string
) {
  // 1. Verificar que el usuario es gestor del torneo del partido
  // 2. Verificar que la franja está AVAILABLE en CourtAvailability
  // 3. Verificar que no hay otro partido del mismo torneo en esa franja
  // 4. Si había fecha anterior, liberar franja previa
  // 5. Actualizar scheduledAt, timeSlot
  // 6. Generar/actualizar MatchCallUp si hay equipos definidos
  // 7. Notificar a capitanes
}

// Aplazar partido
export async function postpone(
  prisma: PrismaClient,
  input: { matchId: string; reason: string },
  userId: string
) {
  // 1. Verificar permiso match:postpone
  // 2. Verificar que el partido está SCHEDULED o IN_PROGRESS
  // 3. Actualizar status = POSTPONED, postponedAt, postponedBy, postponedReason
  // 4. Liberar franja de cancha (CourtAvailability → AVAILABLE)
  // 5. Notificar a capitanes
}

// Reagendar partido
export async function reschedule(
  prisma: PrismaClient,
  input: { matchId: string; newScheduledAt: Date; newTimeSlot: number },
  userId: string
) {
  // 1. Verificar que el partido está POSTPONED
  // 2. Verificar que la nueva franja está AVAILABLE
  // 3. Actualizar scheduledAt, timeSlot, status = SCHEDULED
  // 4. Notificar a capitanes
}

// Cargar resultado
export async function loadResult(
  prisma: PrismaClient,
  input: LoadResultInput,
  userId: string
) {
  // 1. Verificar permiso match:result
  // 2. Verificar que el partido tiene equipos definidos
  // 3. Crear/actualizar MatchResult
  // 4. Crear MatchPlayerStat para cada jugador
  // 5. Si es fase eliminatoria, asignar ganador al partido de siguiente fase
  // 6. Actualizar status = FINISHED
  // 7. Notificar a capitanes
  // 8. Actualizar estadísticas del torneo (Sistema 10)
}

// Marcar walkover
export async function markWalkover(
  prisma: PrismaClient,
  input: { matchId: string; walkoverTeamId: string },
  userId: string
) {
  // 1. Verificar permiso match:result
  // 2. Verificar que walkoverTeamId es home o away del partido
  // 3. Crear MatchResult con isWalkover = true
  // 4. Actualizar status = WALKOVER, walkoverTeamId
  // 5. Asignar ganador al partido de siguiente fase (si aplica)
  // 6. Notificar a capitanes
  // Nota: El Walkover no afecta estadísticas numéricas ni Fair Play.
}

// Marcar/desmarcar ausente
export async function markAbsent(
  prisma: PrismaClient,
  input: { matchId: string; playerId: string; notes?: string },
  userId: string
) {
  // 1. Verificar que el usuario es capitán del equipo del playerId
  // 2. Verificar que existe MatchCallUp para ese jugador en ese partido
  // 3. Actualizar isAbsent = true, markedBy, markedAt, notes
}
```

### 7.2. `match.helpers.ts`

```typescript
// server/core/match/match.helpers.ts

// Calcular fechas consecutivas para partidos de un torneo
export function calculateMatchDates(
  startDate: Date,
  dayOfWeek: number,
  timeSlot: number,
  matchCount: number
): Date[] {
  const dates: Date[] = [];
  let currentDate = new Date(startDate);

  // Ajustar al primer día de la semana correspondiente
  while (currentDate.getDay() !== dayOfWeek) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  for (let i = 0; i < matchCount; i++) {
    const matchDate = new Date(currentDate);
    matchDate.setHours(timeSlot * 2, 0, 0, 0); // timeSlot 0 = 00:00, 1 = 02:00, etc.
    dates.push(matchDate);
    currentDate.setDate(currentDate.getDate() + 7); // Siguiente semana
  }

  return dates;
}

// Determinar ganador de un partido
export function determineWinner(
  homeScore: number,
  awayScore: number,
  homeTeamId: string,
  awayTeamId: string
): { winnerId: string | null; isDraw: boolean } {
  if (homeScore > awayScore) return { winnerId: homeTeamId, isDraw: false };
  if (awayScore > homeScore) return { winnerId: awayTeamId, isDraw: false };
  return { winnerId: null, isDraw: true };
}

// Asignar ganador al partido de siguiente fase
export async function advanceWinner(
  prisma: PrismaClient,
  currentMatchId: string,
  winnerId: string
) {
  // 1. Buscar partido de siguiente fase que tenga null en homeTeamId o awayTeamId
  // 2. Asignar winnerId al slot vacío
  // 3. Si ambos equipos de la siguiente fase ya están definidos, generar MatchCallUp
}
```

---

## 8. Seguridad y Validaciones

### 8.1. Capa 1: Autenticación

- Todos los endpoints requieren sesión activa (`protectedProcedure`).

### 8.2. Capa 2: Autorización por Permiso

| Endpoint | Requiere |
|----------|----------|
| `match.listByTournament` | `tournament:manage` + ser gestor del torneo |
| `match.schedule` | `tournament:manage` + ser gestor del torneo |
| `match.postpone` | `match:postpone` + ser gestor/asistente del torneo |
| `match.reschedule` | `match:postpone` + ser gestor/asistente del torneo |
| `match.loadResult` | `match:result` + ser gestor/asistente del torneo |
| `match.markWalkover` | `match:result` + ser gestor/asistente del torneo |
| `match.assignReferee` | `tournament:manage` + ser gestor del torneo |
| `match.listReferees` | `tournament:manage` |
| `match.createReferee` | `tournament:manage` |
| `match.listMyMatches` | Cualquier usuario autenticado |
| `match.getById` | Cualquier usuario autenticado |
| `match.markAbsent` | Ser capitán del equipo del jugador |
| `match.unmarkAbsent` | Ser capitán del equipo del jugador |

### 8.3. Capa 3: Validación de Estado y Ownership

| Acción | Validación |
|--------|------------|
| Programar partido | Ser gestor del torneo. Franja AVAILABLE. No conflicto con otro partido del torneo. |
| Aplazar | Permiso `match:postpone`. Partido en `SCHEDULED` o `IN_PROGRESS`. Motivo obligatorio. |
| Reagendar | Partido en `POSTPONED`. Nueva franja AVAILABLE. |
| Cargar resultado | Permiso `match:result`. Partido con equipos definidos. Jugadores en `MatchCallUp`. |
| Walkover | Permiso `match:result`. Partido con equipos definidos. `walkoverTeamId` debe ser home o away. |
| Marcar ausente | Ser capitán del equipo. Partido `SCHEDULED`. Jugador en `MatchCallUp` de ese equipo. |
| Asignar árbitro | Ser gestor del torneo. `Referee.isActive = true` (si se asigna). |

---

## 9. UI / UX

### 9.1. Panel de Gestor — Lista de Partidos

```
┌─────────────────────────────────────────────┐
│  Copa Barrial 2026 — Partidos               │
│                                             │
│  Fase: Octavos de Final                     │
│  ┌─────────────────────────────────────┐    │
│  │ Los Pibes vs FC Central             │    │
│  │ 📅 Martes 18/8 — 18:00-20:00        │    │
│  │ 📍 Cancha El Parque                 │    │
│  │ 🏁 Árbitro: Juan Pérez              │    │
│  │ [Aplazar] [Cargar resultado]        │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ Equipo A vs Equipo B                │    │
│  │ 📅 Martes 25/8 — 18:00-20:00        │    │
│  │ 📍 Cancha El Parque                 │    │
│  │ 🏁 Sin árbitro asignado             │    │
│  │ [Programar] [Asignar árbitro]       │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ (Por definir) vs (Por definir)      │    │
│  │ 📅 Sin fecha asignada               │    │
│  │ [Programar]                         │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 9.2. Detalle de Partido — Capitán

```
┌─────────────────────────────────────────────┐
│  Los Pibes vs FC Central                    │
│  📅 Martes 18/8 — 18:00-20:00               │
│  📍 Cancha El Parque                        │
│                                             │
│  Convocatoria — Los Pibes                   │
│  ┌─────────────────────────────────────┐    │
│  │ 👤 Juan Pérez        [✓ Presente]  │    │
│  │ 👤 María García      [✓ Presente]  │    │
│  │ 👤 Carlos López      [✗ Ausente]   │    │
│  │   └ Nota: Lesión de tobillo         │    │
│  │ 👤 Ana Torres        [✓ Presente]  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Guardar cambios]                          │
└─────────────────────────────────────────────┘
```

### 9.3. Modal de Carga de Resultados

```
┌─────────────────────────────────────────────┐
│  Cargar Resultado                           │
│  Los Pibes vs FC Central                    │
│                                             │
│  Resultado: [3] - [1]                       │
│  Ganador: [Los Pibes ▼]                     │
│                                             │
│  Estadísticas — Los Pibes                   │
│  Jugador        Goles  Azul  Amar  Roja Fal │
│  Juan Pérez     [1]    [0]   [1]   [0]  [2]│
│  María García   [2]    [0]   [0]   [0]  [1]│
│  ...                                        │
│                                             │
│  Estadísticas — FC Central                  │
│  ...                                        │
│                                             │
│  [Guardar resultado]                        │
└─────────────────────────────────────────────┘
```

### 9.4. Reglas de UI

- **Cero CSS inline**: Todo con Tailwind o `cva`.
- **Partidos vacíos**: Fases subsiguientes muestran "(Por definir)" hasta que se carguen resultados previos.
- **Badge de estado**: `SCHEDULED` (azul), `IN_PROGRESS` (amarillo), `FINISHED` (verde), `POSTPONED` (naranja), `WALKOVER` (rojo).
- **Ausentes**: Checkbox toggle con nota opcional. Optimistic UI al marcar.
- **Acciones deshabilitadas**: Botón "Cargar resultado" deshabilitado si el partido no tiene equipos definidos o está en `POSTPONED`.
- **Confirmación de aplazamiento**: Modal con textarea obligatorio para motivo.
- **Badge 'W' (Walkover):** Si un equipo pierde por 'W', se le asigna visualmente un Badge 'W' en su perfil y card maestra, indicando que su último partido se perdió por Walkover. Este badge es puramente visual y no altera las métricas de rendimiento ni Fair Play.

---

## 10. Checklist de Implementación

- [ ] Implementar schema Prisma (`Match`, `MatchCallUp`, `MatchResult`, `MatchPlayerStat`, `Referee`)
- [ ] Ejecutar migración de base de datos
- [ ] Implementar motor `match.engine.ts` (generación, programación, aplazamiento, reagendamiento, resultados, walkover)
- [ ] Implementar motor `match.helpers.ts` (cálculo de fechas, determinación de ganador, avance de fases)
- [ ] Crear router `match` en tRPC
- [ ] Implementar middleware de verificación de gestor del torneo
- [ ] Integrar generación de partidos con cierre de inscripciones (Sistema 6)
- [ ] Implementar cron job para recordatorios de partido (opcional)
- [ ] Crear panel de gestor de partidos (lista, programar, aplazar, reagendar, cargar resultado)
- [ ] Crear página de detalle de partido para capitanes (convocatoria, marcar ausentes)
- [ ] Crear modal de carga de resultados con tabla de estadísticas individuales
- [ ] Crear directorio de árbitros (CRUD para gestor)
- [ ] Implementar notificaciones de partido programado, aplazado, reagendado, resultado cargado, walkover (Sistema 11)
- [ ] Crear hooks de feature: `useMatches`, `useMatch`, `useMatchCallUp`, `useMatchResult`
- [ ] Integrar con Sistema 10 para actualización de estadísticas post-resultado

---

## 11. Dependencias con Otros Sistemas

| Sistema | Dependencia | Descripción |
|---------|-------------|-------------|
| Sistema 1: Auth & RBAC | Requiere | Permisos `match:postpone`, `match:result`. Admin asigna permisos granulares a asistentes. |
| Sistema 2: Usuarios/Perfiles | Requiere | `Player` para convocatorias y estadísticas individuales. |
| Sistema 3: Equipos | Requiere | `Team`, `TeamMembership` para convocatoria automática y determinación de ganador. |
| Sistema 4: Reclutamiento | Ninguna directa | — |
| Sistema 5: Canchas | Requiere | `CourtAvailability` para programación y liberación de franjas al aplazar. |
| Sistema 6: Torneos | Requiere/Provee | Consume `Tournament`, `TournamentPhase` del sorteo. Provee resultados que alimentan avance de fases. |
| Sistema 10: Resultados | Provee datos | `MatchResult` y `MatchPlayerStat` alimentan estadísticas del torneo y del jugador. |
| Sistema 11: Notificaciones | Notifica | Partido programado, aplazado, reagendado, resultado cargado, walkover, recordatorio. |

---

## 12. Notas de Arquitectura

### 12.1. Separación de Responsabilidades

| Actor | Responsabilidad |
|-------|-----------------|
| **Gestor** | Programar, aplazar, reagendar, cargar resultados, asignar árbitros, marcar walkover. |
| **Asistente** | Mismo que gestor pero solo sobre torneos asignados, con permisos granulares definidos por admin. |
| **Capitán** | Marcar ausentes en convocatoria (informativo). Consultar partidos de su equipo. |
| **Jugador** | Ver partidos de sus equipos. Consultar convocatoria. |
| **Árbitro** | Sin interacción con la plataforma. Solo datos de contacto. |

### 12.2. Convocatoria como Dato Informativo

`MatchCallUp` es puramente informativa. No afecta:
- La programación del partido.
- El reagendamiento.
- La carga de resultados.
- El avance de fases.

Su único propósito es que el capitán comunique al gestor quién no asistirá, y que el gestor tenga contexto al decidir walkover o aplazamiento.

### 12.3. Avance de Fases

Los partidos de fases subsiguientes se crean vacíos al sortear. El sistema los completa automáticamente cuando se cargan resultados de la fase anterior:

```
Fase 1: Partido A (T1 vs T2) → T1 gana
Fase 1: Partido B (T3 vs T4) → T3 gana
    ↓
Fase 2: Partido C (null vs null) → Se asigna homeTeamId = T1, awayTeamId = T3
```

Si un partido de fase anterior es aplazado, los partidos de fases posteriores mantienen su fecha programada pero pueden quedar con equipos indefinidos por más tiempo.

### 12.4. Walkover

El Walkover (perder por 'W') es un resultado administrativo que no afecta las estadísticas numéricas del equipo: no se registran goles, tarjetas, faltas ni se interviene en el cálculo del Fair Play. El equipo que pierde por 'W' recibe un Badge 'W' visual en su perfil y Card Maestra como indicador de que su último partido se perdió por Walkover, pero este badge es puramente informativo y no altera métricas de rendimiento.

---

> **Documento versionado.** Cualquier modificación requiere revisión y aprobación antes de implementar.
