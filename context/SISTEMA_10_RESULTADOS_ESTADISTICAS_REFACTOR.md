# Sistema 10: Resultados & Estadísticas

> **Estado:** Especificado (Aprobado)  
> **Propósito:** Documento de diseño técnico del sistema de carga de resultados de partidos, persistencia de estadísticas agregadas por jugador y equipo, y cálculo de tablas de posición de torneo. Sujeto a revisión conforme se especifiquen los demás sistemas.

---

## 1. Visión del Sistema

Sistema de carga y consulta de resultados y estadísticas de microfútbol. El gestor (o su asistente con permisos) carga los resultados de cada partido finalizado: goles por equipo, estadísticas individuales de jugadores (goles, tarjetas azul/amarilla/roja, faltas sin tarjeta, autogoles), y observaciones o links externos como referencia. Al cargarse un resultado, el sistema actualiza automáticamente las tablas de estadísticas agregadas de jugadores y equipos, y recalcula la tabla de posiciones del torneo.

Las estadísticas se **persisten en tablas agregadas** (`PlayerStats`, `TeamStats`, `TournamentStanding`) para garantizar consultas instantáneas en la UI. No se calculan en runtime. Cada vez que se carga o edita un resultado, un motor de recálculo actualiza los valores agregados de forma atómica.

Un partido sin estadísticas cargadas **no cuenta** para los cálculos de promedio. Es decir: si un jugador tiene 12 partidos jugados pero solo 8 tienen estadísticas individuales cargadas, el "promedio de goles en los últimos 10 partidos" se calcula sobre esos 8 partidos con stats (tomando los más recientes), no sobre 10 partidos forzados con ceros. Lo mismo aplica para tarjetas y faltas.

El Fair Play se calcula como métrica informativa a partir de las tarjetas y faltas acumuladas en los últimos 10 partidos con estadísticas cargadas. No interviene en algoritmos de sugerencias ni en sorteos.

No hay subida de archivos ni fotos de planillas. El gestor carga datos numéricos manualmente y puede agregar observaciones de texto libre o links externos en un campo dedicado.

---

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Persistencia agregada** | Sí | Tablas `PlayerStats`, `TeamStats`, `TournamentStanding` se actualizan post-partido. Consultas instantáneas. |
| **Sin cálculo en runtime** | Sí | Los promedios y totales se leen de tablas agregadas, no se calculan con joins complejos en cada request. |
| **Partido sin stats no cuenta** | Sí | Si un partido no tiene `MatchPlayerStat`, se excluye del cálculo de "últimos 10 partidos con stats". |
| **Ventana de 10 partidos** | Sí | Los promedios y tarjetas se calculan sobre los últimos 10 partidos del jugador/equipo que tengan estadísticas cargadas. |
| **Fair Play informativo** | Sí | Métrica calculada a partir de tarjetas y faltas. No interviene en algoritmos. |
| **Sin upload de archivos** | Sí | No hay fotos de planillas. Solo datos numéricos + observaciones/links de texto. |
| **Observaciones y links** | Sí | Campo `notes` y `externalLinks` en `MatchResult` para referencias externas. |
| **Recálculo atómico** | Sí | Al cargar/editar/eliminar un resultado, se recalculan todas las agregaciones afectadas en la misma transacción. |
| **Edición permitida** | Sí | El gestor puede editar resultados y estadísticas mientras el torneo no esté `FINISHED`. |
| **Eliminación de resultado** | Sí | Si se elimina un resultado, se revierten las agregaciones correspondientes. |
| **Tabla de posiciones persistente** | Sí | `TournamentStanding` se actualiza tras cada resultado. Campos estándar: PJ, PG, PE, PP, GF, GC, DG, Pts. |
| **Estadísticas del equipo** | Sí | Goles a favor/en contra, diferencia, partidos jugados/ganados/empatados/perdidos, Fair Play. |
| **Estadísticas del jugador** | Sí | Partidos con stats, total de goles, promedio goles últimos 10, tarjetas últimos 10, faltas últimos 10. |

---

## 3. Modelo de Datos (Prisma Schema)

### 3.1. Resultado del Partido (ya definido en Sistema 7)

```prisma
model MatchResult {
  id            String   @id @default(cuid())
  matchId       String   @unique
  homeScore     Int      @default(0)
  awayScore     Int      @default(0)
  winnerId      String?  // null si empate
  isWalkover    Boolean  @default(false)
  notes         String?  @db.Text // Observaciones del partido
  externalLinks String?  @db.Text // Links externos separados por salto de línea
  loadedAt      DateTime @default(now())
  loadedBy      String   // ManagerId
  updatedAt     DateTime @updatedAt

  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)
}
```

> **Nota:** `notes` y `externalLinks` son campos de texto libre para observaciones y referencias externas. No hay validación estructurada de URLs.

### 3.2. Estadísticas Individuales del Partido (ya definido en Sistema 7)

```prisma
model MatchPlayerStat {
  id          String   @id @default(cuid())
  matchId     String
  playerId    String
  teamId      String
  goals       Int      @default(0)
  blueCards   Int      @default(0)
  yellowCards Int      @default(0)
  redCards    Int      @default(0)
  fouls       Int      @default(0)
  ownGoals    Int      @default(0)
  createdAt   DateTime @default(now())

  match  Match  @relation(fields: [matchId], references: [id], onDelete: Cascade)
  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([matchId, playerId])
  @@index([matchId, teamId])
  @@index([playerId, createdAt])
}
```

### 3.3. Estadísticas Agregadas del Jugador

```prisma
model PlayerStats {
  id                  String   @id @default(cuid())
  playerId            String   @unique
  matchesWithStats    Int      @default(0) // Partidos donde se cargaron stats de este jugador
  totalGoals          Int      @default(0)
  avgGoalsLast10      Float    @default(0) // Promedio de goles en últimos 10 partidos con stats
  totalBlueCardsLast10 Int     @default(0)
  totalYellowCardsLast10 Int   @default(0)
  totalRedCardsLast10 Int      @default(0)
  totalFoulsLast10    Int      @default(0)
  fairPlayScore       Float    @default(0) // Métrica informativa
  lastCalculatedAt    DateTime @default(now())
  updatedAt           DateTime @updatedAt

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@index([playerId])
}
```

> **Nota:** `fairPlayScore` se calcula como: `(yellowCards × 1 + redCards × 3 + blueCards × 0.5 + fouls × 0.25) / matchesWithStats` sobre los últimos 10 partidos con stats. Menor es mejor. Es informativo.

### 3.4. Estadísticas Agregadas del Equipo

```prisma
model TeamStats {
  id              String   @id @default(cuid())
  teamId          String   @unique
  matchesPlayed   Int      @default(0) // Partidos con resultado cargado
  matchesWon      Int      @default(0)
  matchesDrawn    Int      @default(0)
  matchesLost     Int      @default(0)
  goalsFor        Int      @default(0)
  goalsAgainst    Int      @default(0)
  goalDifference  Int      @default(0)
  fairPlayScore   Float    @default(0) // Suma de fairPlay de jugadores / partidos
  lastCalculatedAt DateTime @default(now())
  updatedAt       DateTime @updatedAt

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([teamId])
}
```

### 3.5. Tabla de Posiciones del Torneo

```prisma
model TournamentStanding {
  id             String   @id @default(cuid())
  tournamentId   String
  teamId         String
  position       Int      @default(0) // 1, 2, 3...
  matchesPlayed  Int      @default(0) // PJ
  matchesWon     Int      @default(0) // PG
  matchesDrawn   Int      @default(0) // PE
  matchesLost    Int      @default(0) // PP
  goalsFor       Int      @default(0) // GF
  goalsAgainst   Int      @default(0) // GC
  goalDifference Int      @default(0) // DG
  points         Int      @default(0) // Pts (PG=3, PE=1, PP=0)
  fairPlayScore  Float    @default(0)
  updatedAt      DateTime @updatedAt

  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)
  team       Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([tournamentId, teamId])
  @@index([tournamentId, position])
}
```

> **Nota:** `position` se recalcula y reordena tras cada resultado cargado. En caso de empate de puntos, el desempate es: 1) DG, 2) GF, 3) Fair Play (menor es mejor), 4) orden alfabético.

### 3.6. Relaciones en entidades existentes

```prisma
// En Player (Sistema 2) — agregar relación
model Player {
  // ... campos existentes ...
  playerStats PlayerStats?
}

// En Team (Sistema 3) — agregar relación
model Team {
  // ... campos existentes ...
  teamStats TeamStats?
  tournamentStandings TournamentStanding[]
}

// En Tournament (Sistema 6) — agregar relación
model Tournament {
  // ... campos existentes ...
  standings TournamentStanding[]
}
```

---

## 4. Flujo Principal

### 4.1. Carga de Resultado y Estadísticas (Gestor)

```
Partido finaliza
    ↓
Gestor accede a panel de carga de resultados
    ↓
Ingresa:
  - homeScore, awayScore
  - winnerId (o empate)
  - MatchPlayerStat por jugador: goals, blueCards, yellowCards, redCards, fouls, ownGoals
  - notes: observaciones de texto libre
  - externalLinks: links externos (uno por línea)
    ↓
SISTEMA (en transacción atómica):
  1. Crea/actualiza MatchResult
  2. Crea/actualiza MatchPlayerStat para cada jugador
  3. Recalcula PlayerStats para cada jugador afectado
  4. Recalcula TeamStats para ambos equipos
  5. Recalcula TournamentStanding para el torneo
  6. Si es fase eliminatoria, asigna ganador al partido de siguiente fase
    ↓
Notifica a capitanes (Sistema 11)
```

### 4.2. Recálculo de PlayerStats

```
Trigger: Se cargan/edita/elimina MatchPlayerStat para un jugador
    ↓
SISTEMA:
  1. Buscar los últimos 10 partidos del jugador con MatchPlayerStat existente
     (ordenados por Match.scheduledAt DESC, excluyendo partidos sin stats)
  2. Si < 10 partidos con stats, usar los disponibles
  3. Calcular:
     - matchesWithStats: total de partidos con stats del jugador
     - totalGoals: suma de goals de esos partidos
     - avgGoalsLast10: totalGoals / count(partidos considerados)
     - totalBlueCardsLast10: suma de blueCards
     - totalYellowCardsLast10: suma de yellowCards
     - totalRedCardsLast10: suma de redCards
     - totalFoulsLast10: suma de fouls
     - fairPlayScore: (yellow×1 + red×3 + blue×0.5 + fouls×0.25) / count(partidos considerados)
  4. Upsert PlayerStats con valores recalculados
```

### 4.3. Recálculo de TeamStats

```
Trigger: Se cargan/edita/elimina resultado de un partido del equipo
    ↓
SISTEMA:
  1. Contar todos los partidos FINISHED/WALKOVER donde el equipo fue home o away
  2. Contar victorias, empates, derrotas
  3. Sumar goalsFor y goalsAgainst
  4. Calcular goalDifference = GF - GC
  5. Calcular fairPlayScore: promedio de fairPlayScore de jugadores del equipo
  6. Upsert TeamStats
```

### 4.4. Recálculo de TournamentStanding

```
Trigger: Se cargan/edita/elimina resultado de un partido del torneo
    ↓
SISTEMA:
  1. Para cada equipo inscrito en el torneo:
     - Contar partidos FINISHED/WALKERO de fases de liga (o todos si es liga pura)
     - Para eliminación simple: solo partidos jugados hasta el momento
     - Calcular PJ, PG, PE, PP, GF, GC, DG, Pts
  2. Ordenar por: Pts DESC, DG DESC, GF DESC, fairPlay ASC, nombre ASC
  3. Asignar position = 1, 2, 3...
  4. Upsert TournamentStanding para cada equipo
```

### 4.5. Edición de Resultado

```
Gestor accede a partido ya cargado
    ↓
Modifica scores, stats individuales, notes, links
    ↓
SISTEMA (en transacción):
  1. Actualiza MatchResult y MatchPlayerStat
  2. Recalcula PlayerStats (jugadores con stats anteriores y nuevos)
  3. Recalcula TeamStats (ambos equipos)
  4. Recalcula TournamentStanding
  5. Si cambió el ganador en eliminatoria, reasigna siguiente fase
    ↓
Notifica a capitanes de actualización
```

### 4.6. Eliminación de Resultado

```
Gestor elimina resultado de un partido
    ↓
SISTEMA (en transacción):
  1. Elimina MatchResult y MatchPlayerStat
  2. Recalcula PlayerStats (revirtiendo contribución)
  3. Recalcula TeamStats (revirtiendo contribución)
  4. Recalcula TournamentStanding
  5. Si era eliminatoria, vacía el slot de siguiente fase
    ↓
Notifica a capitanes
```

---

## 5. Reglas de Negocio Críticas

### 5.1. Carga de Resultados

| Regla | Comportamiento |
|-------|----------------|
| Actor | Solo gestor o asistente con permiso `match:result` (Sistema 1). |
| Partido elegible | Debe tener `homeTeamId` y `awayTeamId` definidos. Status `SCHEDULED` o `IN_PROGRESS`. |
| Datos obligatorios | `homeScore`, `awayScore`. `winnerId` obligatorio si no es empate. |
| Stats individuales | Opcionales. Solo jugadores con `MatchCallUp` en el partido pueden tener stats. |
| Valores default | Todo stat individual default 0 si no se especifica. |
| Observaciones | Texto libre en `notes`. Máximo 2000 caracteres. |
| Links externos | Texto libre en `externalLinks`. Uno por línea. Sin validación de URL. |
| Edición | Permitida mientras el torneo no esté `FINISHED`. |
| Eliminación | Permitida mientras el torneo no esté `FINISHED`. Revierte todas las agregaciones. |
| Walkover | Si `isWalkover = true`, no se cargan stats individuales. El equipo que pierde por 'W' no acumula stats negativas y el resultado no afecta goles, tarjetas, faltas ni el cálculo del Fair Play. |

### 5.2. Agregaciones — Partido sin Stats

| Regla | Comportamiento |
|-------|----------------|
| Exclusión de promedios | Un partido sin `MatchPlayerStat` para un jugador no se considera en el cálculo de "últimos 10 partidos con stats". |
| Ventana deslizante | Se toman los últimos 10 partidos (por `Match.scheduledAt` DESC) donde el jugador tenga `MatchPlayerStat`. Si hay menos de 10, se usan los disponibles. |
| Divisor dinámico | El promedio se divide por la cantidad de partidos con stats considerados, no por 10 fijo. Ej: 8 partidos con stats → promedio = total / 8. |
| Aplicación | Regla aplica a: avgGoalsLast10, totalBlueCardsLast10, totalYellowCardsLast10, totalRedCardsLast10, totalFoulsLast10, fairPlayScore. |
| matchesWithStats | Cuenta el total histórico de partidos con stats del jugador, no solo los últimos 10. |

### 5.3. PlayerStats

| Regla | Comportamiento |
|-------|----------------|
| Recálculo | Se recalcula completo tras cada carga, edición o eliminación de `MatchPlayerStat`. |
| Fair Play | Fórmula: `(yellowCards × 1 + redCards × 3 + blueCards × 0.5 + fouls × 0.25) / partidosConsiderados`. Menor es mejor. |
| Informativo | Fair Play no afecta sorteos, sugerencias ni algoritmos. Solo visualización. |
| Jugador sin stats | Si un jugador nunca tuvo stats cargadas, no tiene fila en `PlayerStats`. Se muestra como "Sin estadísticas". |

### 5.4. TeamStats

| Regla | Comportamiento |
|-------|----------------|
| Partidos contados | Solo partidos `FINISHED` o `WALKOVER` donde el equipo participó. |
| Victoria | `homeScore > awayScore` y equipo es home, o viceversa. Walkover cuenta como victoria para el equipo presente. |
| Derrota | `homeScore < awayScore` y equipo es home, o viceversa. Walkover cuenta como derrota para el equipo ausente. |
| Empate | `homeScore === awayScore`. No aplica en eliminatoria. |
| Fair Play del equipo | Promedio de `fairPlayScore` de todos los jugadores del equipo con `PlayerStats`. Los partidos con Walkover no intervienen en este cálculo. |

### 5.5. TournamentStanding

| Regla | Comportamiento |
|-------|----------------|
| Equipos incluidos | Todos los equipos `APPROVED` del torneo. |
| Partidos contados | En fase de liga: todos los partidos `FINISHED`/`WALKOVER` de la fase. En eliminatoria: todos los partidos jugados hasta el momento (incluyendo fases previas). |
| Puntos | PG = 3 pts, PE = 1 pt, PP = 0 pts. Walkover = 3 pts para el presente, 0 para el ausente. |
| Desempate | 1) Puntos, 2) DG, 3) GF, 4) Fair Play (menor), 5) Nombre alfabético. El Fair Play no se ve afectado por partidos con Walkover. |
| Eliminados | En eliminatoria, los equipos eliminados mantienen su posición histórica. No bajan en la tabla. |
| Actualización | Se recalcula tras cada resultado cargado. No se calcula en runtime. |

---

## 6. Endpoints tRPC Sugeridos

### 6.1. Router `result` (Gestor)

```typescript
export const resultRouter = createTRPCRouter({
  // ─── Carga y Edición ───

  // Cargar resultado completo (resultado + stats individuales)
  load: permissionProcedure("match:result")
    .input(z.object({
      matchId: z.string(),
      homeScore: z.number().min(0),
      awayScore: z.number().min(0),
      winnerId: z.string().optional(), // null si empate
      isWalkover: z.boolean().default(false),
      notes: z.string().max(2000).optional(),
      externalLinks: z.string().optional(),
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
      return resultEngine.load(ctx.prisma, input, ctx.session.user.id);
    }),

  // Editar resultado ya cargado
  update: permissionProcedure("match:result")
    .input(z.object({
      matchId: z.string(),
      homeScore: z.number().min(0).optional(),
      awayScore: z.number().min(0).optional(),
      winnerId: z.string().optional().nullable(),
      isWalkover: z.boolean().optional(),
      notes: z.string().max(2000).optional().nullable(),
      externalLinks: z.string().optional().nullable(),
      playerStats: z.array(z.object({
        playerId: z.string(),
        teamId: z.string(),
        goals: z.number().min(0).optional(),
        blueCards: z.number().min(0).optional(),
        yellowCards: z.number().min(0).optional(),
        redCards: z.number().min(0).optional(),
        fouls: z.number().min(0).optional(),
        ownGoals: z.number().min(0).optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return resultEngine.update(ctx.prisma, input, ctx.session.user.id);
    }),

  // Eliminar resultado
  remove: permissionProcedure("match:result")
    .input(z.object({ matchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return resultEngine.remove(ctx.prisma, input.matchId, ctx.session.user.id);
    }),

  // ─── Consulta ───

  // Obtener resultado de un partido
  getByMatch: protectedProcedure
    .input(z.object({ matchId: z.string() }))
    .query(async ({ ctx, input }) => {
      return resultEngine.getByMatch(ctx.prisma, input.matchId);
    }),
});
```

### 6.2. Router `stats` (Público)

```typescript
export const statsRouter = createTRPCRouter({
  // ─── Jugador ───

  // Estadísticas agregadas de un jugador
  getPlayerStats: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ ctx, input }) => {
      return statsEngine.getPlayerStats(ctx.prisma, input.playerId);
    }),

  // Historial de stats por partido de un jugador
  getPlayerMatchHistory: protectedProcedure
    .input(z.object({
      playerId: z.string(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      return statsEngine.getPlayerMatchHistory(ctx.prisma, input.playerId, input.limit);
    }),

  // ─── Equipo ───

  // Estadísticas agregadas de un equipo
  getTeamStats: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      return statsEngine.getTeamStats(ctx.prisma, input.teamId);
    }),

  // Historial de resultados de un equipo
  getTeamMatchHistory: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      return statsEngine.getTeamMatchHistory(ctx.prisma, input.teamId, input.limit);
    }),

  // ─── Torneo ───

  // Tabla de posiciones de un torneo
  getTournamentStandings: protectedProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ ctx, input }) => {
      return statsEngine.getTournamentStandings(ctx.prisma, input.tournamentId);
    }),

  // Estadísticas de un equipo dentro de un torneo específico
  getTeamTournamentStats: protectedProcedure
    .input(z.object({
      tournamentId: z.string(),
      teamId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      return statsEngine.getTeamTournamentStats(ctx.prisma, input.tournamentId, input.teamId);
    }),
});
```

---

## 7. Motores de Negocio (Core)

### 7.1. `result.engine.ts` — Estructura

```typescript
// server/core/stats/result.engine.ts

// Cargar resultado completo
export async function load(
  prisma: PrismaClient,
  input: LoadResultInput,
  userId: string
) {
  // 1. Verificar permiso match:result y ownership del torneo
  // 2. Verificar que el partido tiene equipos definidos
  // 3. Iniciar transacción:
  //    a. Crear MatchResult
  //    b. Crear MatchPlayerStat para cada jugador (si no es walkover)
  //    c. Llamar statsEngine.recalculatePlayerStats para cada jugador afectado
  //    d. Llamar statsEngine.recalculateTeamStats para ambos equipos
  //    e. Llamar statsEngine.recalculateTournamentStandings para el torneo
  //    f. Si es eliminatoria, asignar ganador a siguiente fase
  // 4. Commit transacción
  // 5. Notificar a capitanes (Sistema 11)
}

// Editar resultado
export async function update(
  prisma: PrismaClient,
  input: UpdateResultInput,
  userId: string
) {
  // 1. Verificar permisos y que torneo no esté FINISHED
  // 2. Obtener resultado anterior para saber qué revertir
  // 3. Transacción:
  //    a. Actualizar MatchResult
  //    b. Actualizar/eliminar/crear MatchPlayerStat según nuevo input
  //    c. Recalcular PlayerStats (jugadores afectados anterior y nuevo)
  //    d. Recalcular TeamStats (ambos equipos)
  //    e. Recalcular TournamentStandings
  //    f. Si cambió ganador en eliminatoria, reasignar siguiente fase
  // 4. Notificar actualización
}

// Eliminar resultado
export async function remove(
  prisma: PrismaClient,
  matchId: string,
  userId: string
) {
  // 1. Verificar permisos y que torneo no esté FINISHED
  // 2. Transacción:
  //    a. Eliminar MatchResult (cascade a MatchPlayerStat)
  //    b. Recalcular PlayerStats (revirtiendo)
  //    c. Recalcular TeamStats (revirtiendo)
  //    d. Recalcular TournamentStandings
  //    e. Si era eliminatoria, vaciar slot de siguiente fase
  // 3. Notificar eliminación
}
```

### 7.2. `stats.engine.ts` — Estructura

```typescript
// server/core/stats/stats.engine.ts

// Recalcular estadísticas de un jugador
export async function recalculatePlayerStats(
  tx: PrismaTransaction,
  playerId: string
) {
  // 1. Buscar últimos 10 partidos con MatchPlayerStat para este jugador
  //    (ordenados por Match.scheduledAt DESC)
  const matchesWithStats = await tx.matchPlayerStat.findMany({
    where: { playerId },
    include: { match: true },
    orderBy: { match: { scheduledAt: "desc" } },
    take: 10,
  });

  const count = matchesWithStats.length;
  if (count === 0) {
    // Eliminar PlayerStats si existe (jugador sin stats)
    await tx.playerStats.deleteMany({ where: { playerId } });
    return;
  }

  const totals = matchesWithStats.reduce((acc, stat) => ({
    goals: acc.goals + stat.goals,
    blueCards: acc.blueCards + stat.blueCards,
    yellowCards: acc.yellowCards + stat.yellowCards,
    redCards: acc.redCards + stat.redCards,
    fouls: acc.fouls + stat.fouls,
  }), { goals: 0, blueCards: 0, yellowCards: 0, redCards: 0, fouls: 0 });

  const totalMatchesWithStats = await tx.matchPlayerStat.count({ where: { playerId } });

  const fairPlay = (totals.yellowCards * 1 + totals.redCards * 3 + totals.blueCards * 0.5 + totals.fouls * 0.25) / count;

  // 2. Upsert PlayerStats
  await tx.playerStats.upsert({
    where: { playerId },
    create: {
      playerId,
      matchesWithStats: totalMatchesWithStats,
      totalGoals: totals.goals,
      avgGoalsLast10: totals.goals / count,
      totalBlueCardsLast10: totals.blueCards,
      totalYellowCardsLast10: totals.yellowCards,
      totalRedCardsLast10: totals.redCards,
      totalFoulsLast10: totals.fouls,
      fairPlayScore: fairPlay,
    },
    update: {
      matchesWithStats: totalMatchesWithStats,
      totalGoals: totals.goals,
      avgGoalsLast10: totals.goals / count,
      totalBlueCardsLast10: totals.blueCards,
      totalYellowCardsLast10: totals.yellowCards,
      totalRedCardsLast10: totals.redCards,
      totalFoulsLast10: totals.fouls,
      fairPlayScore: fairPlay,
      lastCalculatedAt: new Date(),
    },
  });
}

// Recalcular estadísticas de un equipo
export async function recalculateTeamStats(
  tx: PrismaTransaction,
  teamId: string
) {
  // 1. Buscar todos los partidos FINISHED/WALKOVER donde el equipo participó
  // 2. Contar PJ, PG, PE, PP
  // 3. Sumar GF, GC
  // 4. Calcular fairPlayScore promedio de jugadores del equipo
  // 5. Upsert TeamStats
}

// Recalcular tabla de posiciones de un torneo
export async function recalculateTournamentStandings(
  tx: PrismaTransaction,
  tournamentId: string
) {
  // 1. Para cada equipo del torneo, calcular PJ, PG, PE, PP, GF, GC, DG, Pts
  // 2. Obtener fairPlayScore de TeamStats
  // 3. Ordenar por criterios de desempate
  // 4. Asignar position
  // 5. Upsert TournamentStanding para cada equipo
}

// Consultas públicas
export async function getPlayerStats(prisma: PrismaClient, playerId: string) {
  return prisma.playerStats.findUnique({ where: { playerId } });
}

export async function getPlayerMatchHistory(
  prisma: PrismaClient,
  playerId: string,
  limit: number
) {
  return prisma.matchPlayerStat.findMany({
    where: { playerId },
    include: { match: { include: { homeTeam: true, awayTeam: true } } },
    orderBy: { match: { scheduledAt: "desc" } },
    take: limit,
  });
}

export async function getTeamStats(prisma: PrismaClient, teamId: string) {
  return prisma.teamStats.findUnique({ where: { teamId } });
}

export async function getTournamentStandings(prisma: PrismaClient, tournamentId: string) {
  return prisma.tournamentStanding.findMany({
    where: { tournamentId },
    include: { team: true },
    orderBy: { position: "asc" },
  });
}
```

---

## 8. Seguridad y Validaciones

### 8.1. Capa 1: Autenticación

- Todos los endpoints requieren sesión activa (`protectedProcedure`).

### 8.2. Capa 2: Autorización por Permiso

| Endpoint | Requiere |
|----------|----------|
| `result.load` | `match:result` + ser gestor/asistente del torneo del partido |
| `result.update` | `match:result` + ser gestor/asistente + torneo no `FINISHED` |
| `result.remove` | `match:result` + ser gestor/asistente + torneo no `FINISHED` |
| `result.getByMatch` | Cualquier usuario autenticado |
| `stats.getPlayerStats` | Cualquier usuario autenticado |
| `stats.getPlayerMatchHistory` | Cualquier usuario autenticado |
| `stats.getTeamStats` | Cualquier usuario autenticado |
| `stats.getTeamMatchHistory` | Cualquier usuario autenticado |
| `stats.getTournamentStandings` | Cualquier usuario autenticado |
| `stats.getTeamTournamentStats` | Cualquier usuario autenticado |

### 8.3. Capa 3: Validación de Estado

| Acción | Validación |
|--------|------------|
| Cargar resultado | Partido con equipos definidos. Torneo no `FINISHED`. |
| Editar resultado | Resultado existente. Torneo no `FINISHED`. |
| Eliminar resultado | Resultado existente. Torneo no `FINISHED`. |
| Stats individuales | Jugador debe tener `MatchCallUp` en el partido. |
| Walkover | No se cargan stats individuales. `winnerId` obligatorio. |
| Valores negativos | Prohibidos. Todos los stats >= 0. |
| Empate en eliminatoria | Permitido solo si el gestor define `winnerId` manualmente (penales). |

---

## 9. UI / UX

> **Nota:** El usuario tiene mockups propios. Esta sección describe comportamientos clave sin detalles visuales específicos.

### 9.1. Panel de Carga de Resultados (Gestor)

```
┌─────────────────────────────────────────────┐
│  Cargar Resultado — Los Pibes vs FC Central │
│  Copa Barrial — Octavos de Final            │
│                                             │
│  Resultado                                  │
│  Los Pibes      [3] - [1]      FC Central   │
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
│  Observaciones                              │
│  [Partido con mucha lluvia, cancha...  ]    │
│                                             │
│  Links externos                             │
│  [https://youtube.com/...               ]    │
│  [https://foto-partido.com/...          ]    │
│                                             │
│  [Guardar resultado]                        │
└─────────────────────────────────────────────┘
```

### 9.2. Reglas de UI

- **Cero CSS inline**: Todo con Tailwind o `cva`.
- **Stats opcionales**: Tabla de stats individuales puede quedar vacía. El gestor carga solo lo que tenga.
- **Validación en tiempo real**: Si `homeScore === awayScore` y no es empate permitido, alerta para definir ganador.
- **Walkover toggle**: Checkbox "Walkover" que oculta la tabla de stats individuales y muestra selector de equipo ausente.
- **Confirmación de guardado**: Modal de confirmación con resumen antes de guardar.
- **Edición**: Botón "Editar" visible solo para gestores, torneo no `FINISHED`.
- **Badge 'W' (Walkover):** Si un equipo pierde por 'W', se le asigna visualmente un Badge 'W' en su perfil y card maestra, indicando que su último partido se perdió por Walkover. Este badge es puramente visual y no altera las métricas de rendimiento ni Fair Play.

---

## 10. Checklist de Implementación

- [ ] Implementar schema Prisma (`PlayerStats`, `TeamStats`, `TournamentStanding`)
- [ ] Ejecutar migración de base de datos
- [ ] Implementar motor `result.engine.ts` (carga, edición, eliminación de resultados)
- [ ] Implementar motor `stats.engine.ts` (recálculo de agregaciones, consultas públicas)
- [ ] Crear router `result` en tRPC
- [ ] Crear router `stats` en tRPC
- [ ] Integrar recálculo automático en carga/edición/eliminación de resultados
- [ ] Implementar validación de torneo no `FINISHED` para mutaciones
- [ ] Implementar lógica de asignación de ganador a siguiente fase en eliminatoria
- [ ] Implementar lógica de vaciado de slot al eliminar resultado
- [ ] Crear panel de carga de resultados con tabla de stats individuales
- [ ] Crear vistas de consulta pública (stats de jugador, equipo, tabla de posiciones)
- [ ] Implementar notificaciones de resultado cargado/editado/eliminado (Sistema 11)
- [ ] Crear hooks de feature: `useResult`, `usePlayerStats`, `useTeamStats`, `useStandings`
- [ ] Implementar seed de fórmulas de Fair Play documentadas

---

## 11. Dependencias con Otros Sistemas

| Sistema | Dependencia | Descripción |
|---------|-------------|-------------|
| Sistema 1: Auth & RBAC | Requiere | Permisos `match:result`. Asistentes con permisos delegados. |
| Sistema 2: Usuarios/Perfiles | Requiere | `Player` para stats individuales. `Profile.displayName` para visualización. |
| Sistema 3: Equipos | Requiere | `Team` para TeamStats y TournamentStanding. |
| Sistema 5: Canchas | Ninguna directa | — |
| Sistema 6: Torneos | Requiere | `Tournament` para standings. Estados del torneo limitan edición. |
| Sistema 7: Partidos | Requiere | `Match`, `MatchResult`, `MatchPlayerStat` definidos aquí. Partidos como fuente de datos. |
| Sistema 11: Notificaciones | Notifica | Resultado cargado, editado, eliminado. |
| Sistema 12: Mapa | Ninguna directa | — |

---

## 12. Notas de Arquitectura

### 12.1. Persistencia vs. Runtime

Se optó por **persistencia en tablas agregadas** (`PlayerStats`, `TeamStats`, `TournamentStanding`) en lugar de cálculo en runtime por las siguientes razones:

- **Performance**: Las consultas de estadísticas son lecturas frecuentes en perfiles, páginas de equipo y torneos. Con tablas agregadas, son queries simples `SELECT * WHERE id = ?`.
- **Escalabilidad**: A medida que crece el volumen de partidos, un cálculo en runtime que agregue `MatchPlayerStat` con ventana de 10 partidos y joins múltiples se vuelve costoso.
- **Consistencia**: El recálculo atómico en transacción garantiza que las agregaciones siempre reflejan el estado actual de los datos fuente.
- **Complejidad de ventana**: La regla de "últimos 10 partidos con stats" requiere filtrar, ordenar y limitar. Persistir el resultado simplifica la query de lectura a una simple lectura de fila.

### 12.2. Transacción Atómica

Cada operación de carga, edición o eliminación de resultado ejecuta la siguiente secuencia dentro de una transacción Prisma:

```
1. Mutar MatchResult / MatchPlayerStat
2. Recalcular PlayerStats (jugadores afectados)
3. Recalcular TeamStats (equipos afectados)
4. Recalcular TournamentStanding (torneo)
5. Actualizar fase siguiente (si eliminatoria)
```

Si cualquier paso falla, toda la operación se revierte. No hay estados parciales.

### 12.3. Partidos sin Stats

La regla de exclusión de partidos sin stats es clave para la integridad de los promedios:

- Un torneo donde el gestor nunca cargó stats individuales no generará `PlayerStats` para ningún jugador.
- Los jugadores muestran "Sin estadísticas" en su perfil.
- El gestor puede cargar stats retroactivamente en cualquier momento (si el torneo no está `FINISHED`), y los promedios se recalculan correctamente.

### 12.4. Fair Play

El Fair Play es una métrica **informativa** por diseño:

- No afecta el sorteo de equipos (Sistema 6).
- No afecta las sugerencias de equipos (Sistema 6).
- Solo se muestra en tablas de posición y perfiles como dato de contexto.
- La fórmula es configurable: actualmente `(yellow×1 + red×3 + blue×0.5 + fouls×0.25) / partidosConsiderados`.
- **Walkover y Fair Play:** Los partidos con Walkover (perder por 'W') no intervienen en el cálculo del Fair Play. El equipo que pierde por 'W' no acumula tarjetas, faltas ni goles en contra para efectos de esta métrica. El Badge 'W' es puramente visual.

---

> **Documento versionado.** Cualquier modificación requiere revisión y aprobación antes de implementar.
