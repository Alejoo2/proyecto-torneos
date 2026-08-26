# Sistema 4: Reclutamiento

> **Estado:** Especificado (Reescrito)  
> **Propósito:** Documento de diseño técnico del sistema de descubrimiento e invitación de jugadores a equipos. Los jugadores son pasivos: solo los capitanes inician el contacto. Sujeto a revisión conforme se especifiquen los demás sistemas.

---

## 1. Visión del Sistema

Sistema de **descubrimiento unidireccional** de jugadores. Un capitán navega un directorio de jugadores registrados, aplica filtros, y envía invitaciones para unirse a su equipo. El jugador es completamente pasivo: no puede solicitar ingreso, no puede "postularse", no puede rechazar recibir invitaciones. Solo recibe, y decide aceptar o rechazar.

**No hay conflicto de horario** en la invitación. La disponibilidad del jugador se muestra como información de referencia, pero no bloquea ni automátiza nada en el reclutamiento. Los conflictos de horario se manejan en el contexto de partidos y convocatorias (Sistema 7).

**No hay elección múltiple.** Si un jugador recibe invitaciones de dos equipos, acepta una y la otra queda pendiente de su respuesta individual. No hay mecanismo de "elegir entre equipos".

---

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Unidireccional** | Sí | Solo capitanes invitan. Los jugadores no pueden solicitar ingreso a equipos. |
| **Sin conflicto de horario** | Sí | La invitación no verifica ni bloquea por disponibilidad. La disponibilidad se muestra como dato informativo. |
| **Jugador siempre disponible** | Sí | No existe estado "no quiero recibir invitaciones". Todo jugador registrado puede ser invitado. |
| **Límite de plantilla** | 15 miembros activos | Cap lógico para equipos de microfútbol. Evita plantillas desproporcionadas. |
| **Sin estado de prueba** | Sí | Aceptar invitación = membresía directa. No hay período de evaluación. |
| **Revocación de invitación** | Sí | El capitán puede cancelar una invitación `PENDING` antes de que el jugador responda. |
| **Descubrimiento con filtro** | Sí | Directorio de jugadores con filtros por nombre y disponibilidad horaria. |
| **Jugadores saturados ocultos** | Sí | Si un jugador ya está en 15 equipos, no aparece en el buscador. |
| **Sin carga de archivos** | Ningún sistema | Avatares vienen de `User.image` (OAuth). |
| **Reutilización de entidad** | `TeamInvitation` | Se usa la misma tabla definida en Sistema 3. Este sistema no agrega nuevas tablas. |

---

## 3. Modelo de Datos (Prisma Schema)

Este sistema **no agrega nuevas tablas**. Reutiliza `TeamInvitation` (Sistema 3) y consulta `Player`, `Profile`, `PlayerAvailability` (Sistema 2).

### 3.1. Entidades consultadas (referencia)

```prisma
// Definidas en otros sistemas — incluidas aquí para contexto

model TeamInvitation {
  id          String              @id @default(cuid())
  teamId      String?             // Null durante creación inicial (Sistema 3)
  playerId    String              // Jugador invitado
  invitedBy   String              // PlayerId del invitador (capitán)
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
  REVOKED        // ← Nuevo estado: cancelado por el capitán antes de respuesta
}

model Player {
  id        String   @id @default(cuid())
  profileId String   @unique
  createdAt DateTime @default(now())

  profile         Profile              @relation(fields: [profileId], references: [id], onDelete: Cascade)
  availabilities  PlayerAvailability[]
  teamMemberships TeamMembership[]
  teamInvitations TeamInvitation[]
  sentInvitations TeamInvitation[]     @relation("SentInvitations")
}

model Profile {
  id          String   @id @default(cuid())
  userId      String   @unique
  displayName String?
  phone       String?
  bio         String?  @db.Text
  birthDate   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  player Player?
}

model PlayerAvailability {
  id        String            @id @default(cuid())
  playerId  String
  dayOfWeek Int               // 0-6
  timeSlot  Int               // 0-11
  status    AvailabilityStatus @default(AVAILABLE)

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([playerId, dayOfWeek, timeSlot])
}

enum AvailabilityStatus {
  AVAILABLE
  UNAVAILABLE
}
```

> **Nota:** Se agrega el estado `REVOKED` a `InvitationStatus` para distinguir las invitaciones canceladas por el capitán de las rechazadas por el jugador o expiradas.

---

## 4. Flujo de Reclutamiento

### 4.1. Secuencia

```
Capitán accede a /reclutamiento
    ↓
Sistema muestra directorio de jugadores disponibles
    ↓
Capitán aplica filtros (nombre, disponibilidad horaria)
    ↓
Capitán selecciona jugador → ve perfil público
    ↓
Capitán envía invitación (TeamInvitation)
    ↓
Sistema valida: ¿equipo < 15? ¿no hay PENDING previa? ¿jugador < 15 equipos?
    ↓
Jugador recibe notificación (Sistema 11)
    ↓
Jugador acepta → TeamMembership creada (Sistema 3)
    ↓
Equipo actualiza plantilla
```

### 4.2. Reglas del Flujo

| Regla | Comportamiento |
|-------|----------------|
| Solo capitán | Solo un jugador con `isCaptain = true` en un equipo `ACTIVE` puede acceder al reclutamiento. |
| Jugadores visibles | Solo se muestran jugadores con `< 15` equipos activos (`TeamMembership.leftAt = null`). |
| Límite de equipo | No se puede enviar invitación si el equipo ya tiene 15 miembros activos. |
| Invitación única | No se puede enviar invitación `PENDING` a un jugador que ya tiene una `PENDING` para ese equipo. |
| Expiración | Las invitaciones `PENDING` expiran después de 7 días → `EXPIRED`. |
| Rechazo con cooldown | Si un jugador rechaza, puede ser reinvitado después de 24 horas. |
| Revocación | El capitán puede cancelar una invitación `PENDING` → `REVOKED`. |
| Saturación automática | Si el equipo alcanza 15 miembros, todas las invitaciones `PENDING` de ese equipo se rechazan automáticamente. |

---

## 5. Reglas de Negocio Críticas

### 5.1. Invitación

| Regla | Comportamiento |
|-------|----------------|
| Emisor | Solo el capitán de un equipo `ACTIVE`. |
| Receptor | Cualquier jugador registrado con `< 15` equipos activos. |
| Duplicidad | Una invitación `PENDING` por par (equipo, jugador). No se reenvía hasta que la anterior se resuelva. |
| Capacidad del equipo | Bloqueo si el equipo tiene 15 miembros activos al momento de enviar. |
| Capacidad del jugador | El jugador no aparece en el buscador si ya tiene 15 membresías activas. |
| Datos mostrados | Perfil público + disponibilidad horaria (como referencia, no como bloqueo). |

### 5.2. Aceptación y Rechazo

| Regla | Comportamiento |
|-------|----------------|
| Aceptación | Crea `TeamMembership`. El jugador pasa a ser miembro del equipo inmediatamente. |
| Rechazo | El jugador rechaza la invitación → `REJECTED`. Puede ser reinvitado después de 24h. |
| Expiración | Si no responde en 7 días → `EXPIRED`. Puede ser reinvitado inmediatamente. |
| Revocación | El capitán cancela → `REVOKED`. Puede reinvitar inmediatamente. |
| Múltiples invitaciones | Un jugador puede tener invitaciones `PENDING` de múltiples equipos simultáneamente. Responde cada una individualmente. |

### 5.3. Saturación de Equipo

| Regla | Comportamiento |
|-------|----------------|
| Trigger | Un jugador acepta invitación y el equipo pasa a tener 15 miembros. |
| Efecto | Todas las invitaciones `PENDING` de ese equipo se marcan como `REJECTED` automáticamente. |
| Notificación | Los jugadores con invitaciones rechazadas reciben notificación (Sistema 11). |
| Reinvitación | Si un miembro abandona el equipo y baja de 15, se pueden enviar nuevas invitaciones. |

### 5.4. Disponibilidad como Dato Informativo

| Regla | Comportamiento |
|-------|----------------|
| Visualización | El capitán ve la matriz de disponibilidad del jugador en su perfil público. |
| No bloqueante | La disponibilidad no impide enviar la invitación. |
| Sin conflicto | No se calcula `CONFLICT` en el contexto de reclutamiento. |
| Referencia | El capitán usa la información para decidir si invita, pero la decisión es humana. |

---

## 6. Endpoints tRPC Sugeridos

### 6.1. Router `recruitment`

```typescript
export const recruitmentRouter = createTRPCRouter({
  // ─── Descubrimiento ───

  // Buscar jugadores disponibles para invitar
  searchPlayers: protectedProcedure
    .input(z.object({
      teamId: z.string(),                    // Equipo desde el que se recluta
      query: z.string().optional(),          // Búsqueda por nombre
      availabilityFilter: z.object({
        dayOfWeek: z.number().min(0).max(6).optional(),
        timeSlot: z.number().min(0).max(11).optional(),
      }).optional(),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      return recruitmentEngine.searchPlayers(ctx.prisma, input, ctx.session.user.id);
    }),

  // Obtener perfil público de un jugador para evaluación
  getPlayerProfile: protectedProcedure
    .input(z.object({
      playerId: z.string(),
      teamId: z.string(), // Para contexto de si ya está invitado
    }))
    .query(async ({ ctx, input }) => {
      return recruitmentEngine.getPlayerProfile(ctx.prisma, input, ctx.session.user.id);
    }),

  // ─── Invitación ───

  // Enviar invitación a un jugador
  invite: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      playerId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return recruitmentEngine.invite(ctx.prisma, input, ctx.session.user.id);
    }),

  // Revocar invitación pendiente
  revokeInvitation: protectedProcedure
    .input(z.object({
      invitationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return recruitmentEngine.revokeInvitation(ctx.prisma, input.invitationId, ctx.session.user.id);
    }),

  // ─── Consulta de invitaciones (para el jugador pasivo) ───

  // Listar invitaciones pendientes del jugador actual
  getMyInvitations: protectedProcedure.query(async ({ ctx }) => {
    return recruitmentEngine.getPendingForPlayer(ctx.prisma, ctx.session.user.id);
  }),

  // Aceptar invitación
  acceptInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return recruitmentEngine.acceptInvitation(ctx.prisma, input.invitationId, ctx.session.user.id);
    }),

  // Rechazar invitación
  rejectInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return recruitmentEngine.rejectInvitation(ctx.prisma, input.invitationId, ctx.session.user.id);
    }),

  // ─── Gestión del capitán ───

  // Listar invitaciones enviadas por el equipo (pendientes y resueltas)
  getTeamInvitations: protectedProcedure
    .input(z.object({
      teamId: z.string(),
      status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "REVOKED"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return recruitmentEngine.getTeamInvitations(ctx.prisma, input, ctx.session.user.id);
    }),
});
```

---

## 7. Motores de Negocio (Core)

### 7.1. `recruitment.engine.ts`

```typescript
// server/core/recruitment/recruitment.engine.ts

export async function searchPlayers(
  prisma: PrismaClient,
  input: SearchPlayersInput,
  userId: string
) {
  // 1. Verificar que el solicitante es capitán del equipo
  const membership = await prisma.teamMembership.findFirst({
    where: {
      teamId: input.teamId,
      isCaptain: true,
      leftAt: null,
      player: { profile: { userId } },
    },
  });
  if (!membership) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No eres capitán de este equipo" });
  }

  // 2. Verificar que el equipo no está saturado
  const memberCount = await prisma.teamMembership.count({
    where: { teamId: input.teamId, leftAt: null },
  });
  if (memberCount >= 15) {
    throw new TRPCError({ code: "FORBIDDEN", message: "El equipo ya tiene 15 miembros" });
  }

  // 3. Buscar jugadores con < 15 equipos, excluyendo miembros actuales e invitados pendientes
  const players = await prisma.player.findMany({
    where: {
      // Excluir miembros actuales del equipo
      teamMemberships: { none: { teamId: input.teamId, leftAt: null } },
      // Excluir jugadores con invitación PENDING para este equipo
      invitations: { none: { teamId: input.teamId, status: "PENDING" } },
      // Solo jugadores con < 15 equipos activos
      teamMemberships: {
        none: {
          leftAt: null,
          // Este filtro se aplica en HAVING a nivel de grupo, no directamente en Prisma
        },
      },
      // Filtro por nombre
      profile: {
        displayName: input.query
          ? { contains: input.query, mode: "insensitive" }
          : undefined,
      },
      // Filtro por disponibilidad (si se especifica)
      availabilities: input.availabilityFilter
        ? {
            some: {
              dayOfWeek: input.availabilityFilter.dayOfWeek,
              timeSlot: input.availabilityFilter.timeSlot,
              status: "AVAILABLE",
            },
          }
        : undefined,
    },
    include: {
      profile: { include: { user: { select: { image: true } } } },
      availabilities: {
        where: input.availabilityFilter
          ? {
              dayOfWeek: input.availabilityFilter.dayOfWeek,
              timeSlot: input.availabilityFilter.timeSlot,
            }
          : undefined,
      },
      _count: {
        select: { teamMemberships: { where: { leftAt: null } } },
      },
    },
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
  });

  // Filtrar post-query: solo jugadores con < 15 equipos
  const availablePlayers = players.filter(
    (p) => p._count.teamMemberships < 15
  );

  return availablePlayers;
}

export async function invite(
  prisma: PrismaClient,
  input: { teamId: string; playerId: string },
  userId: string
) {
  // 1. Verificar capitanía
  // 2. Verificar equipo < 15 miembros
  // 3. Verificar jugador < 15 equipos
  // 4. Verificar que no existe invitación PENDING previa
  // 5. Verificar que el jugador no es miembro activo
  // 6. Crear TeamInvitation con status PENDING
  // 7. Emitir notificación (Sistema 11)
}

export async function revokeInvitation(
  prisma: PrismaClient,
  invitationId: string,
  userId: string
) {
  // 1. Verificar que la invitación es PENDING
  // 2. Verificar que el revocador es el capitán del equipo emisor
  // 3. Actualizar status a REVOKED
  // 4. Notificar al jugador (Sistema 11)
}

export async function acceptInvitation(
  prisma: PrismaClient,
  invitationId: string,
  userId: string
) {
  // 1. Verificar que la invitación es para este usuario y está PENDING
  // 2. Verificar que el equipo aún tiene < 15 miembros (race condition)
  // 3. Verificar que el jugador aún tiene < 15 equipos (race condition)
  // 4. Crear TeamMembership
  // 5. Actualizar invitación a ACCEPTED
  // 6. Si el equipo llega a 15, rechazar automáticamente las demás PENDING
  // 7. Notificar al capitán (Sistema 11)
}

export async function rejectInvitation(
  prisma: PrismaClient,
  invitationId: string,
  userId: string
) {
  // 1. Verificar que la invitación es para este usuario y está PENDING
  // 2. Actualizar status a REJECTED
  // 3. Notificar al capitán (Sistema 11)
}
```

---

## 8. Seguridad y Validaciones

### 8.1. Capa 1: Autenticación

- Todos los endpoints requieren sesión activa (`protectedProcedure`).

### 8.2. Capa 2: Autorización por Rol

| Endpoint | Requiere |
|----------|----------|
| `searchPlayers` | Ser capitán del `teamId` proporcionado |
| `getPlayerProfile` | Ser capitán del `teamId` proporcionado |
| `invite` | Ser capitán del `teamId` proporcionado |
| `revokeInvitation` | Ser capitán del equipo emisor de la invitación |
| `getMyInvitations` | Ser el jugador autenticado (cualquiera) |
| `acceptInvitation` | Ser el jugador destinatario de la invitación |
| `rejectInvitation` | Ser el jugador destinatario de la invitación |
| `getTeamInvitations` | Ser capitán del `teamId` proporcionado |

### 8.3. Capa 3: Validación de Estado y Límites

| Acción | Validación |
|--------|------------|
| Buscar jugadores | Equipo `ACTIVE`. Equipo `< 15` miembros. |
| Enviar invitación | Capitán. Equipo `< 15`. Jugador `< 15` equipos. Sin `PENDING` previa. Jugador no miembro activo. |
| Revocar invitación | Capitán. Invitación en estado `PENDING`. |
| Aceptar invitación | Destinatario. Invitación `PENDING`. Equipo aún `< 15`. Jugador aún `< 15`. |
| Rechazar invitación | Destinatario. Invitación `PENDING`. |
| Saturación automática | Al aceptar y llegar a 15, rechazar todas las `PENDING` restantes del equipo. |

---

## 9. UI / UX

### 9.1. Buscador de Jugadores

```
┌─────────────────────────────────────────────┐
│  Reclutamiento — Los Pibes                  │
│  [Buscar por nombre...    ] [🔍]            │
│                                             │
│  Filtrar disponibilidad:                    │
│  [Lun ▼] [18-20h ▼] [Aplicar]             │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ 👤 Juan Pérez                       │    │
│  │ Disponible: Lun, Mié, Vie (noche)   │    │
│  │ Equipos: 3/15                       │    │
│  │ [Ver perfil]  [Invitar]             │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ 👤 María García                     │    │
│  │ Disponible: Todos los días          │    │
│  │ Equipos: 12/15                      │    │
│  │ [Ver perfil]  [Invitar]             │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [← Anterior]  Página 1 de 5  [Siguiente →]│
└─────────────────────────────────────────────┘
```

### 9.2. Reglas de UI

- **Cero CSS inline**: Todo con clases Tailwind o `cva`.
- **Disponibilidad como referencia**: Se muestra la matriz resumida (días con mayor disponibilidad), no la matriz completa 7×12.
- **Contador de equipos**: Se muestra `X/15` para que el capitán evalúe si el jugador está "saturado".
- **Botón Invitar deshabilitado** si el equipo ya tiene 15 miembros (validación previa en backend).
- **Optimistic UI** al enviar invitación: el botón cambia a "Invitado" inmediatamente, se revierte si falla.

---

## 10. Checklist de Implementación

- [ ] Agregar estado `REVOKED` al enum `InvitationStatus` (migración Prisma)
- [ ] Implementar motor `recruitment.engine.ts` (búsqueda, invitación, revocación, aceptación, rechazo)
- [ ] Crear router `recruitment` en tRPC
- [ ] Implementar endpoint `searchPlayers` con filtros y paginación
- [ ] Implementar endpoint `getPlayerProfile` con datos de disponibilidad
- [ ] Implementar lógica de saturación automática (15 miembros → rechazar PENDINGS)
- [ ] Implementar lógica de reinvitación post-rechazo (24h cooldown)
- [ ] Implementar expiración automática de invitaciones (7 días, cron job)
- [ ] Crear página `/reclutamiento/[teamId]` con buscador
- [ ] Crear componente de tarjeta de jugador (nombre, disponibilidad resumida, equipos, acciones)
- [ ] Crear modal de perfil público del jugador (con matriz de disponibilidad)
- [ ] Crear panel de invitaciones pendientes para el jugador (`/invitaciones`)
- [ ] Crear panel de invitaciones enviadas para el capitán (dentro de gestión de equipo)
- [ ] Implementar notificaciones de invitación/aceptación/rechazo/revocación (Sistema 11)
- [ ] Crear hooks de feature: `useRecruitmentSearch`, `useTeamInvitations`, `useMyInvitations`

---

## 11. Dependencias con Otros Sistemas

| Sistema | Dependencia | Descripción |
|---------|-------------|-------------|
| Sistema 1: Auth & RBAC | Requiere | Verificación de capitanía. `TeamMembership.isCaptain`. |
| Sistema 2: Usuarios/Perfiles | Requiere | `Profile` para datos públicos del jugador. `PlayerAvailability` para filtros de disponibilidad. |
| Sistema 3: Equipos & Plantillas | Requiere/Provee | Reutiliza `TeamInvitation` y `TeamMembership`. Provee el contexto de equipo (`teamId`). |
| Sistema 5: Canchas | Ninguna | — |
| Sistema 6: Torneos | Ninguna directa | El reclutamiento es independiente de la inscripción a torneos. |
| Sistema 7: Partidos | Futura dependencia | La gestión de "ausente/confirmado para partido" se definirá aquí, no en reclutamiento. |
| Sistema 10: Resultados | Ninguna | — |
| Sistema 11: Notificaciones | Notifica | Invitaciones enviadas, aceptadas, rechazadas, revocadas, expiradas, saturación. |

---

## 12. Notas de Arquitectura

### 12.1. Sin nuevas tablas

Este sistema es puramente **orquestación** sobre entidades existentes:
- `TeamInvitation` (Sistema 3)
- `TeamMembership` (Sistema 3)
- `Player`, `Profile`, `PlayerAvailability` (Sistema 2)

No se agregan tablas ni enums nuevos (salvo el valor `REVOKED` en `InvitationStatus`).

### 12.2. Separación de responsabilidades

| Sistema | Responsabilidad |
|---------|-----------------|
| Sistema 3 | Creación del equipo, membresía, capitanía, eliminación |
| Sistema 4 | Descubrimiento de jugadores, envío de invitaciones, aceptación/rechazo |
| Sistema 7 (futuro) | Convocatorias a partidos, confirmación de asistencia, estado ausente |

### 12.3. Race conditions

Las validaciones de límite (15 miembros, 15 equipos) deben manejarse con precaución:
- Validar en el backend justo antes de la mutación (no confiar en datos de la query previa).
- Usar transacciones de Prisma para crear `TeamMembership` + actualizar `TeamInvitation` atómicamente.
- La saturación automática (rechazo de PENDINGS al llegar a 15) debe ejecutarse dentro de la misma transacción.

---

> **Documento versionado.** Cualquier modificación requiere revisión y aprobación antes de implementar.
