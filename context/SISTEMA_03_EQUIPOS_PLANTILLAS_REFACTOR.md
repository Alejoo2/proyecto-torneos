# Sistema 3: Equipos & Plantillas

> **Estado:** Especificado (Iterando)  
> **Propósito:** Documento de diseño técnico del sistema de equipos persistentes, plantillas globales, creación con invitación mínima y gestión de membresía. Sujeto a revisión conforme se especifiquen los demás sistemas.

---

## 1. Visión del Sistema

Un **equipo** es una entidad persistente e independiente del torneo: un grupo de amigos que se mantiene activo con o sin competencias en curso. Cualquier jugador puede crear un equipo, pero la creación solo se hace efectiva cuando al menos un segundo jugador acepta la invitación. El creador se convierte automáticamente en capitán.

La **plantilla** es única y global: todos los miembros activos del equipo conforman el roster. No existen plantillas por torneo. Al inscribirse a un torneo, se lleva la plantilla completa. La aprobación horaria la evalúa el gestor en el momento de inscripción (Sistema 6).

**Patrón de UI:** Card Maestra con 5 slots placeholder (puramente visual, sin modelo de posiciones en BD).

---

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Equipo persistente** | Sí | El equipo existe fuera de cualquier torneo. Es un grupo de amigos, no una entidad temporal. |
| **Creación con mínimo 2 jugadores** | Sí | El creador + al menos 1 aceptación. Evita equipos fantasma de 1 persona. |
| **Plantilla única global** | Sí | Un solo roster por equipo. Se lleva entero a cada torneo. Los 5 slots de la Card Maestra son placeholder de UI. |
| **Capitán único por equipo activo** | Sí | Heredado de Sistema 1. Un jugador solo puede ser capitán de un equipo activo a la vez. |
| **Miembro en múltiples equipos** | Sí | Un jugador puede ser miembro (no capitán) de varios equipos simultáneamente. |
| **Eliminación con consenso** | 3+ miembros requieren confirmación de todos | Con 2 miembros, el capitán elimina libremente. |
| **Eliminación bloqueada en torneo activo** | Sí | No se puede eliminar si el equipo está inscrito en un torneo en curso. Sí se puede si está pendiente de aprobación. |
| **Sin co-capitán en modelo** | Sí | Figuras delegadas se manejan vía RBAC (Sistema 1), no en el modelo de equipo. |
| **Sin carga de archivos** | Ningún sistema | No hay escudo personalizado. Los colores se definen por valores hex. |
| **Estadísticas del equipo** | Calculadas en runtime | No se persisten en `Team`. Se agregan cruzando datos de partidos/resultados (Sistemas 7 y 10). |

---

## 3. Modelo de Datos (Prisma Schema)

### 3.1. Equipo

```prisma
model Team {
  id            String      @id @default(cuid())
  name          String      // Nombre completo del equipo
  abbreviation  String      @db.VarChar(10) // Tag corto, ej: "LSP"
  primaryColor  String      @db.VarChar(7)  // Hex, ej: "#FF5733"
  secondaryColor String?    @db.VarChar(7)  // Hex opcional
  description   String?     @db.Text
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  status        TeamStatus  @default(DRAFT)

  memberships     TeamMembership[]
  invitations     TeamInvitation[]
  outgoingTransfers CaptaincyTransfer[] @relation("OutgoingTeamTransfer")
  incomingTransfers CaptaincyTransfer[] @relation("IncomingTeamTransfer")
  // Relaciones con otros sistemas (se definen en sus respectivos schemas)
  // tournamentEnrollments TournamentEnrollment[]  // Sistema 6
  // matchesAsHome       Match[] @relation("HomeTeam")  // Sistema 7
  // matchesAsAway       Match[] @relation("AwayTeam")  // Sistema 7
}

enum TeamStatus {
  DRAFT       // En proceso de creación, aún no tiene 2+ miembros confirmados
  ACTIVE      // Equipo operativo con 2+ miembros
  INACTIVE    // Todos los miembros salieron, equipo archivado (no eliminado)
}
```

> **Nota:** `Team` no tiene campo `captainId`. El capitán se determina por `TeamMembership.isCaptain = true`. Esto evita datos duplicados y mantiene integridad referencial.

### 3.2. Membresía

```prisma
model TeamMembership {
  id        String    @id @default(cuid())
  playerId  String
  teamId    String
  isCaptain Boolean   @default(false)
  joinedAt  DateTime  @default(now())
  leftAt    DateTime? // Null = miembro activo

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)

  incomingTransfers CaptaincyTransfer[] @relation("IncomingTransfer")
  outgoingTransfers CaptaincyTransfer[] @relation("OutgoingTransfer")

  @@unique([playerId, teamId])
  @@index([teamId, leftAt])
  @@index([playerId, leftAt])
}
```

### 3.3. Invitación al Equipo

```prisma
model TeamInvitation {
  id          String              @id @default(cuid())
  teamId      String?             // Null durante creación inicial (equipo aún no existe)
  playerId    String              // Jugador invitado
  invitedBy   String              // PlayerId del invitador (capitán o creador)
  status      InvitationStatus    @default(PENDING)
  createdAt   DateTime            @default(now())
  respondedAt DateTime?

  team   Team?   @relation(fields: [teamId], references: [id], onDelete: Cascade)
  player Player  @relation(fields: [playerId], references: [id], onDelete: Cascade)
  inviter Player @relation("SentInvitations", fields: [invitedBy], references: [id], onDelete: Cascade)

  @@unique([teamId, playerId])
  @@index([playerId, status])
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
}
```

> **Nota:** `teamId` es nullable para soportar invitaciones durante la fase `DRAFT` de creación. Una vez el equipo pasa a `ACTIVE`, las invitaciones posteriores tienen `teamId` definido.

### 3.4. Transferencia de Capitanía

> Heredado de Sistema 1. Se incluye aquí por completitud del dominio de equipos.

```prisma
model CaptaincyTransfer {
  id          String                  @id @default(cuid())
  fromId      String
  toId        String
  status      CaptaincyTransferStatus @default(PENDING)
  requestedAt DateTime                @default(now())
  respondedAt DateTime?

  from TeamMembership @relation("OutgoingTransfer", fields: [fromId], references: [id], onDelete: Cascade)
  to   TeamMembership @relation("IncomingTransfer", fields: [toId], references: [id], onDelete: Cascade)

  @@unique([fromId, toId, status])
}

enum CaptaincyTransferStatus {
  PENDING
  ACCEPTED
  REJECTED
}
```

### 3.5. Relaciones adicionales en Player

```prisma
model Player {
  id        String   @id @default(cuid())
  profileId String   @unique
  createdAt DateTime @default(now())

  profile         Profile              @relation(fields: [profileId], references: [id], onDelete: Cascade)
  availabilities  PlayerAvailability[]
  teamMemberships TeamMembership[]
  invitations     TeamInvitation[]
  sentInvitations TeamInvitation[]     @relation("SentInvitations")
}
```

---

## 4. Flujo de Creación de Equipo

### 4.1. Secuencia

```
Jugador A (creador) inicia creación
    ↓
Ingresa: nombre, abreviatura, primaryColor, secondaryColor?, description?
    ↓
Sistema crea Team en estado DRAFT
    ↓
Jugador A invita a Jugador B (crea TeamInvitation con teamId = null)
    ↓
Jugador B recibe notificación (Sistema 11)
    ↓
Jugador B acepta la invitación
    ↓
Sistema:
  - Crea TeamMembership para Jugador A (isCaptain = true)
  - Crea TeamMembership para Jugador B (isCaptain = false)
  - Actualiza Team.status = ACTIVE
  - Vincula TeamInvitation.teamId al Team creado
    ↓
Equipo operativo. Jugador A es capitán.
```

### 4.2. Reglas de Creación

| Regla | Comportamiento |
|-------|----------------|
| Mínimo 2 jugadores | El equipo no pasa de `DRAFT` a `ACTIVE` sin al menos 2 miembros confirmados. |
| Creador = capitán | El jugador que inicia la creación se convierte automáticamente en capitán al activarse. |
| Invitación previa | Solo el creador puede invitar durante la fase `DRAFT`. |
| Timeout de draft | Si después de 7 días no hay 2+ miembros, el draft se cancela y las invitaciones expiran. |
| Nombre único | El nombre del equipo debe ser único en la plataforma (case-insensitive). |
| Abreviatura única | La abreviatura debe ser única en la plataforma (case-insensitive). |

---

## 5. Reglas de Negocio Críticas

### 5.1. Membresía

| Regla | Comportamiento |
|-------|----------------|
| Múltiples equipos | Un jugador puede ser miembro de N equipos simultáneamente. |
| Capitanía única | Un jugador solo puede ser capitán (`isCaptain = true` + `leftAt = null`) de **un** equipo a la vez. |
| Salida del equipo | Un miembro puede abandonar el equipo en cualquier momento (set `leftAt = now()`). |
| Capitán no puede salir sin transferir | Un capitán debe transferir la capitanía antes de abandonar. Ver Sistema 1, sección 6.2. |
| Reingreso | Un jugador que salió puede ser reinvitado y reingresar (nueva fila en `TeamMembership`). |

### 5.2. Invitaciones

| Regla | Comportamiento |
|-------|----------------|
| Solo capitán invita | Durante `ACTIVE`, solo el capitán puede enviar invitaciones. |
| Invitación única | No se puede invitar a un jugador que ya tiene invitación `PENDING` para ese equipo. |
| Expiración | Las invitaciones `PENDING` expiran después de 7 días (status = `EXPIRED`). |
| Rechazo | Si un jugador rechaza, puede ser reinvitado después de 24h. |
| Jugador ya en equipo | No se puede invitar a un jugador que ya es miembro activo del equipo. |

### 5.3. Eliminación de Equipo

| Regla | Comportamiento |
|-------|----------------|
| Solo capitán elimina | Solo el capitán puede iniciar la eliminación. |
| Bloqueo por torneo activo | No se puede eliminar si el equipo está inscrito en un torneo con estado `IN_PROGRESS` o `SCHEDULED`. |
| Permitido si no iniciado | Sí se puede eliminar si el torneo aún no ha comenzado (estados `DRAFT`, `SCHEDULED` o `GRACE_PERIOD` del torneo). |
| Consenso 3+ miembros | Si el equipo tiene 3 o más miembros activos, se requiere confirmación de **todos** los integrantes. |
| Eliminación directa (2 miembros) | Con exactamente 2 miembros, el capitán elimina sin confirmación adicional. |
| Eliminación permanente | El equipo se elimina físicamente de la BD (cascade a memberships, invitations, transfers). |
| Historial preservado | Los partidos jugados y resultados se mantienen (relaciones con `Match` no usan `onDelete: Cascade`). |

### 5.4. Capitanía

| Regla | Comportamiento |
|-------|----------------|
| Transferencia | El capitán inicia transferencia a otro miembro activo del equipo. |
| Aceptación obligatoria | El receptor debe aceptar. Si rechaza, no ocurre nada. |
| Unicidad | Al aceptar, el sistema verifica que el receptor no sea capitán de otro equipo activo. |
| Sin auto-degradación | Un capitán no puede quitarse el rol sin designar sucesor. |

### 5.5. Estado del Equipo

| Estado | Condición |
|--------|-----------|
| `DRAFT` | En proceso de creación. < 2 miembros confirmados. |
| `ACTIVE` | 2+ miembros. Operativo. |
| `INACTIVE` | Todos los miembros han abandonado (`leftAt != null`). No se elimina, pero no es operativo. Se puede reactivar si un ex-miembro reingresa. |

---

## 6. Endpoints tRPC Sugeridos

### 6.1. Router `team`

```typescript
export const teamRouter = createTRPCRouter({
  // ─── Creación ───

  // Iniciar creación de equipo (estado DRAFT)
  createDraft: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(50),
      abbreviation: z.string().min(2).max(10),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      description: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.createDraft(ctx.prisma, input, ctx.session.user.id);
    }),

  // Invitar jugador durante DRAFT o ACTIVE
  invitePlayer: protectedProcedure
    .input(z.object({
      teamId: z.string().optional(), // undefined si es durante DRAFT
      playerId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.invitePlayer(ctx.prisma, input, ctx.session.user.id);
    }),

  // Aceptar invitación (convierte DRAFT en ACTIVE si es el segundo miembro)
  acceptInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.acceptInvitation(ctx.prisma, input.invitationId, ctx.session.user.id);
    }),

  // Rechazar invitación
  rejectInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.rejectInvitation(ctx.prisma, input.invitationId, ctx.session.user.id);
    }),

  // ─── Consulta ───

  // Obtener equipo por ID (público para autenticados)
  getById: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      return teamEngine.getById(ctx.prisma, input.teamId);
    }),

  // Listar equipos del jugador actual
  getMyTeams: protectedProcedure.query(async ({ ctx }) => {
    return teamEngine.getByPlayerId(ctx.prisma, ctx.session.user.id);
  }),

  // Listar miembros de un equipo
  getMembers: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      return teamEngine.getMembers(ctx.prisma, input.teamId);
    }),

  // Listar invitaciones pendientes del equipo (solo capitán)
  getPendingInvitations: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      return teamEngine.getPendingInvitations(ctx.prisma, input.teamId, ctx.session.user.id);
    }),

  // ─── Gestión ───

  // Actualizar datos del equipo (solo capitán)
  update: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      name: z.string().min(2).max(50).optional(),
      abbreviation: z.string().min(2).max(10).optional(),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
      description: z.string().max(500).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.update(ctx.prisma, input, ctx.session.user.id);
    }),

  // Abandonar equipo (miembro no capitán)
  leave: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.leave(ctx.prisma, input.teamId, ctx.session.user.id);
    }),

  // Expulsar miembro (solo capitán)
  removeMember: protectedProcedure
    .input(z.object({ teamId: z.string(), playerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.removeMember(ctx.prisma, input, ctx.session.user.id);
    }),

  // ─── Eliminación ───

  // Iniciar proceso de eliminación
  // - 2 miembros: elimina inmediatamente
  // - 3+ miembros: crea votaciones de confirmación
  requestDelete: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.requestDelete(ctx.prisma, input.teamId, ctx.session.user.id);
    }),

  // Confirmar eliminación (para miembros cuando hay 3+)
  confirmDelete: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return teamEngine.confirmDelete(ctx.prisma, input.teamId, ctx.session.user.id);
    }),
});
```

### 6.2. Router `captaincy` (extensión de Sistema 1)

```typescript
export const captaincyRouter = createTRPCRouter({
  // Iniciar transferencia de capitanía
  requestTransfer: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      toPlayerId: z.string(), // Debe ser miembro activo del equipo
    }))
    .mutation(async ({ ctx, input }) => {
      return captaincyEngine.requestTransfer(ctx.prisma, input, ctx.session.user.id);
    }),

  // Aceptar transferencia
  acceptTransfer: protectedProcedure
    .input(z.object({ transferId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return captaincyEngine.acceptTransfer(ctx.prisma, input.transferId, ctx.session.user.id);
    }),

  // Rechazar transferencia
  rejectTransfer: protectedProcedure
    .input(z.object({ transferId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return captaincyEngine.rejectTransfer(ctx.prisma, input.transferId, ctx.session.user.id);
    }),

  // Obtener transferencias pendientes del jugador
  getPendingTransfers: protectedProcedure.query(async ({ ctx }) => {
    return captaincyEngine.getPendingForPlayer(ctx.prisma, ctx.session.user.id);
  }),
});
```

---

## 7. Motores de Negocio (Core)

### 7.1. `team.engine.ts`

```typescript
// server/core/team/team.engine.ts

export async function createDraft(
  prisma: PrismaClient,
  input: CreateDraftInput,
  userId: string
) {
  // 1. Verificar unicidad de nombre y abreviatura
  const exists = await prisma.team.findFirst({
    where: {
      OR: [
        { name: { equals: input.name, mode: "insensitive" } },
        { abbreviation: { equals: input.abbreviation, mode: "insensitive" } },
      ],
    },
  });
  if (exists) throw new TRPCError({ code: "CONFLICT", message: "Nombre o abreviatura ya existe" });

  // 2. Verificar que el usuario no sea capitán de otro equipo activo
  const isCaptainElsewhere = await prisma.teamMembership.findFirst({
    where: {
      player: { profile: { userId } },
      isCaptain: true,
      leftAt: null,
    },
  });
  if (isCaptainElsewhere) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ya eres capitán de otro equipo" });
  }

  // 3. Crear equipo en estado DRAFT
  const team = await prisma.team.create({
    data: {
      ...input,
      status: "DRAFT",
    },
  });

  return team;
}

export async function invitePlayer(
  prisma: PrismaClient,
  input: { teamId?: string; playerId: string },
  userId: string
) {
  // 1. Verificar que el invitador es capitán (o creador en DRAFT)
  // 2. Verificar que no existe invitación PENDING previa
  // 3. Verificar que el jugador no es miembro activo
  // 4. Crear TeamInvitation
}

export async function acceptInvitation(
  prisma: PrismaClient,
  invitationId: string,
  userId: string
) {
  // 1. Verificar que la invitación es para este usuario
  // 2. Actualizar invitación a ACCEPTED
  // 3. Si teamId es null (DRAFT):
  //    a. Buscar el Team DRAFT del invitador
  //    b. Crear memberships para creador (captain) e invitado
  //    c. Actualizar Team.status = ACTIVE
  //    d. Vincular invitation.teamId
  // 4. Si teamId existe (ACTIVE):
  //    a. Crear membership para el invitado
}

export async function requestDelete(
  prisma: PrismaClient,
  teamId: string,
  userId: string
) {
  // 1. Verificar que el solicitante es capitán
  // 2. Verificar que no hay torneos activos (IN_PROGRESS o SCHEDULED)
  //    - Torneos PENDING_APPROVAL no bloquean
  // 3. Contar miembros activos
  // 4. Si <= 2: eliminar equipo directamente
  // 5. Si >= 3: crear registros de confirmación, notificar a todos
}
```

### 7.2. `captaincy.engine.ts`

> Heredado de Sistema 1. Se extiende aquí para incluir validación de que el receptor es miembro activo del equipo.

```typescript
export async function requestTransfer(
  prisma: PrismaClient,
  input: { teamId: string; toPlayerId: string },
  userId: string
) {
  // 1. Verificar que from es capitán del equipo
  // 2. Verificar que to es miembro activo del mismo equipo
  // 3. Verificar que to no es capitán de otro equipo activo
  // 4. Verificar que no hay transferencia PENDING previa
  // 5. Crear CaptaincyTransfer
}
```

---

## 8. Seguridad y Validaciones

### 8.1. Capa 1: Autenticación

- Todos los endpoints requieren sesión activa (`protectedProcedure`).

### 8.2. Capa 2: Autorización por Rol

- `invitePlayer`, `update`, `removeMember`, `requestDelete`: Requieren ser capitán del equipo.
- `leave`: Requiere ser miembro activo (no capitán).
- `acceptInvitation`, `rejectInvitation`: Requieren ser el jugador invitado.

### 8.3. Capa 3: Validación de Ownership y Estado

| Acción | Validación |
|--------|------------|
| Crear draft | Nombre/abreviatura únicos. No ser capitán en otro equipo activo. |
| Invitar | Ser capitán. Invitado no miembro activo. No invitación pendiente previa. |
| Aceptar invitación | Ser el jugador invitado. Invitación en estado `PENDING`. |
| Actualizar equipo | Ser capitán. Equipo en estado `ACTIVE`. |
| Abandonar | Ser miembro activo. No ser capitán (sin transferencia previa). |
| Expulsar | Ser capitán. No expulsar a uno mismo. |
| Eliminar | Ser capitán. No torneos `IN_PROGRESS` ni `SCHEDULED`. Consenso si 3+ miembros. |
| Transferir capitanía | Ser capitán. Receptor miembro activo del equipo. Receptor no capitán en otro equipo. |

---

## 9. Card Maestra (UI)

### 9.1. Especificación Visual

```
┌─────────────────────────────────────┐
│  [primaryColor barra superior]      │
│                                     │
│  [Abreviatura]  Nombre del Equipo   │
│                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│  │  ?  │ │  ?  │ │  ?  │ │  ?  │   │  ← 5 slots placeholder
│  └─────┘ └─────┘ └─────┘ └─────┘   │     (solo visual, sin modelo BD)
│  ┌─────┐                            │
│  │  ?  │                            │
│  └─────┘                            │
│                                     │
│  👥 12 jugadores  🏆 3 torneos      │
│  [secondaryColor barra inferior]    │
└─────────────────────────────────────┘
```

### 9.2. Reglas de UI

- Los 5 slots son **puramente visuales**. No hay entidad `Position` ni `TeamPosition` en BD.
- Se muestran hasta 5 avatares de miembros activos (aleatorios o por antigüedad).
- Si hay menos de 5 miembros, los slots vacíos muestran un placeholder (`?` o silueta).
- El color de fondo de la card usa `primaryColor` del equipo.
- **Cero CSS inline**: las clases Tailwind se construyen con `cva` o clases dinámicas seguras (no concatenación de strings de color).
- **Badge 'W' (Walkover):** Si un equipo pierde por 'W' (Walkover), se le asigna visualmente un Badge 'W' en su perfil y Card Maestra, indicando que su último partido se perdió por Walkover. Este badge es puramente visual y no altera las métricas de rendimiento ni Fair Play.

---

## 10. Checklist de Implementación

- [ ] Implementar schema Prisma (`Team`, `TeamMembership`, `TeamInvitation`, actualizar `Player`)
- [ ] Ejecutar migración de base de datos
- [ ] Implementar motor `team.engine.ts` (creación, invitaciones, membresía, eliminación)
- [ ] Implementar motor `captaincy.engine.ts` (transferencia con validación de miembro activo)
- [ ] Crear router `team` en tRPC
- [ ] Crear router `captaincy` en tRPC
- [ ] Implementar middleware de verificación de capitanía
- [ ] Crear página de creación de equipo (formulario + invitación inicial)
- [ ] Crear componente Card Maestra (5 slots placeholder)
- [ ] Crear página de detalle del equipo (miembros, invitaciones, configuración)
- [ ] Implementar flujo de invitación con notificaciones (Sistema 11)
- [ ] Implementar flujo de eliminación con consenso (3+ miembros)
- [ ] Crear hooks de feature: `useTeam`, `useTeamMembers`, `useTeamInvitations`
- [ ] Implementar guardas de ruta para acciones de capitán

---

## 11. Dependencias con Otros Sistemas

| Sistema | Dependencia | Descripción |
|---------|-------------|-------------|
| Sistema 1: Auth & RBAC | Requiere | `User`, `Profile`, `Player`, `RoleAssignment`. Capitanía y transferencia definidas aquí. |
| Sistema 2: Usuarios/Perfiles | Requiere | `Player` es la entidad que se vincula a `TeamMembership`. Datos del perfil para la Card Maestra. |
| Sistema 4: Reclutamiento | Provee/Consume | El flujo de invitación a equipo es el mismo motor. Sistema 4 extiende con búsqueda de jugadores. |
| Sistema 5: Canchas | Ninguna directa | — |
| Sistema 6: Torneos | Consume/Provee | El equipo se inscribe a torneos. El gestor aprueba inscripción evaluando disponibilidad horaria. |
| Sistema 7: Partidos | Provee datos | `Match` referencia `Team` como home/away. El equipo participa en partidos. |
| Sistema 10: Resultados | Consume datos | Estadísticas del equipo se calculan cruzando partidos y resultados. |
| Sistema 11: Notificaciones | Notifica | Invitaciones, aceptaciones, rechazos, transferencias de capitanía, solicitudes de eliminación. |

---

> **Documento versionado.** Cualquier modificación requiere revisión y aprobación antes de implementar.
