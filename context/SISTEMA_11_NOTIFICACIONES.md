# Sistema 11: Notificaciones

> **Estado:** Especificado (Aprobado)  
> **Propósito:** Documento de diseño técnico del sistema de notificaciones in-app de la plataforma. Emisión automática ante eventos de dominio, persistencia en base de datos, lectura/estado por usuario, y preferencias de suscripción por familia de notificación. Sujeto a revisión conforme se especifiquen los demás sistemas.

---

## 1. Visión del Sistema

Sistema de notificaciones **exclusivamente in-app**. No hay canales externos (email, push, SMS, WhatsApp, Discord). Cada notificación se genera automáticamente como respuesta a un evento de dominio en otro sistema (invitación, aplazamiento, sorteo, resultado, etc.), se persiste en base de datos, y se presenta al usuario en una bandeja de notificaciones dentro de la aplicación.

El usuario puede **desactivar familias completas de notificaciones** desde su panel de preferencias. Las familias se agrupan por dominio funcional (equipos, torneos, partidos, sistema). Una familia desactivada silencia todos los eventos de esa familía sin dejar de generarlos en base de datos (para historial), pero no se muestran en la bandeja ni se contabilizan como no leídas.

Las notificaciones tienen **estado de lectura** (`READ`/`UNREAD`), **timestamp de creación**, **timestamp de lectura**, y **payload estructurado** con metadatos del evento que permiten navegación directa a la pantalla relevante. No hay límite de retención; todas las notificaciones se conservan indefinidamente.

Los **árbitros no reciben notificaciones** — son un directorio pasivo sin cuenta en la plataforma.

---

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Canal único: in-app** | Sí | Solo bandeja de notificaciones dentro de la plataforma. Sin email, push, SMS ni otros canales. |
| **Persistencia obligatoria** | Sí | Toda notificación se guarda en BD con payload completo. Historial ilimitado. |
| **Sin retención temporal** | Sí | No se eliminan notificaciones por antigüedad. El usuario tiene acceso a todo su historial. |
| **Familias de notificación** | Sí | Agrupadas por dominio funcional. El usuario desactiva/activa por familia completa. |
| **Desactivación = silencio visual** | Sí | Al desactivar una familía, las notificaciones siguen generándose en BD pero no se muestran en la bandeja ni incrementan el contador de no leídas. |
| **Sin preferencias granulares por evento** | Sí | No se puede desactivar evento individual. Solo a nivel de familia. |
| **Payload estructurado** | Sí | Cada notificación incluye metadatos (IDs, tipos, acciones) que permiten navegación directa al contexto relevante. |
| **Árbitros sin notificaciones** | Sí | Directorio pasivo, sin cuenta, sin notificaciones. |
| **Generación síncrona con transacción** | Sí | La notificación se crea dentro de la misma transacción de Prisma que el evento que la dispara. Garantiza consistencia. |
| **Sin tiempo real (WebSocket/SSE)** | Sí | Bandeja se actualiza por polling cada 30 segundos o al navegar. WebSocket es extensión futura. |
| **Badge de no leídas** | Sí | Contador global de notificaciones `UNREAD` por usuario, visible en el layout principal. |
| **Acciones inline** | Sí | Algunas notificaciones incluyen botones de acción directa (aceptar invitación, ver partido, etc.) sin salir de la bandeja. |

---

## 3. Modelo de Datos (Prisma Schema)

### 3.1. Notificación

```prisma
model Notification {
  id          String              @id @default(cuid())
  userId      String              // Destinatario (User.id)
  family      NotificationFamily  // Familia de la notificación
  type        NotificationType    // Tipo específico del evento
  title       String              // Título corto (máx 100 caracteres)
  body        String              // Cuerpo descriptivo (máx 500 caracteres)
  payload     Json                // Metadatos estructurados para navegación
  status      NotificationStatus  @default(UNREAD)
  actionTaken String?             // Acción que el usuario ejecutó desde la notificación (si aplica)
  createdAt   DateTime            @default(now())
  readAt      DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([userId, family, status])
  @@index([createdAt])
}

enum NotificationFamily {
  AUTH        // Eventos de autenticación y roles
  TEAM        // Invitaciones, membresía, capitanía
  RECRUITMENT // Reclutamiento de jugadores
  TOURNAMENT  // Torneos e inscripciones
  MATCH       // Partidos, aplazamientos, resultados
  COURT       // Canchas y disponibilidad
  SYSTEM      // Notificaciones del sistema (mantenimiento, anuncios)
}

enum NotificationType {
  // ─── AUTH ───
  ROLE_ASSIGNED
  ROLE_REVOKED

  // ─── TEAM ───
  INVITATION_RECEIVED
  INVITATION_ACCEPTED
  INVITATION_REJECTED
  INVITATION_REVOKED
  INVITATION_EXPIRED
  MEMBERSHIP_JOINED
  MEMBERSHIP_LEFT
  CAPTAINCY_TRANSFER_REQUESTED
  CAPTAINCY_TRANSFER_ACCEPTED
  CAPTAINCY_TRANSFER_REJECTED
  TEAM_DELETE_REQUESTED
  TEAM_DELETE_CONFIRMED
  TEAM_SATURATED

  // ─── RECRUITMENT ───
  RECRUITMENT_INVITATION_SENT
  RECRUITMENT_INVITATION_ACCEPTED
  RECRUITMENT_INVITATION_REJECTED

  // ─── TOURNAMENT ───
  TOURNAMENT_PUBLISHED
  ENROLLMENT_SUBMITTED
  ENROLLMENT_APPROVED
  ENROLLMENT_REJECTED
  ENROLLMENT_DISAPPROVED
  ENROLLMENT_PENDING_AVAILABILITY
  TOURNAMENT_CLOSED_AND_DRAWN
  TOURNAMENT_CANCELLED
  TOURNAMENT_RESCHEDULED
  CONFLICT_UNRESOLVED

  // ─── MATCH ───
  MATCH_SCHEDULED
  MATCH_POSTPONED
  MATCH_RESCHEDULED
  MATCH_RESULT_LOADED
  MATCH_WALKOVER
  MATCH_REMINDER

  // ─── COURT ───
  COURT_DISABLED
  COURT_SLOT_DISABLED

  // ─── SYSTEM ───
  SYSTEM_ANNOUNCEMENT
}

enum NotificationStatus {
  UNREAD
  READ
}
```

> **Nota:** El campo `payload` es de tipo `Json` y contiene un objeto estructurado con los IDs y parámetros necesarios para construir el link de navegación y las acciones inline. Ejemplo: `{ "teamId": "abc", "invitationId": "xyz", "action": "accept" }`.

### 3.2. Preferencias de Notificación por Usuario

```prisma
model NotificationPreference {
  id        String              @id @default(cuid())
  userId    String              @unique
  family    NotificationFamily
  isEnabled Boolean             @default(true)
  updatedAt DateTime            @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, family])
  @@index([userId])
}
```

> **Nota:** Al crear un usuario, se generan automáticamente registros de `NotificationPreference` para todas las familias con `isEnabled = true`. El usuario puede desactivar familias individuales desde su perfil.

### 3.3. Relación en User

```prisma
model User {
  // ... campos existentes (Sistema 1) ...
  notifications           Notification[]
  notificationPreferences NotificationPreference[]
}
```

---

## 4. Flujo Principal

### 4.1. Generación de Notificación (Síncrona)

```
Evento de dominio ocurre (ej: capitán acepta invitación a equipo)
    ↓
Motor de negocio ejecuta transacción Prisma:
  - Actualiza entidad principal (ej: TeamInvitation.status = ACCEPTED)
  - Crea TeamMembership
  - Crea Notification para el invitador:
      family: TEAM
      type: INVITATION_ACCEPTED
      title: "Jugador aceptó tu invitación"
      body: "Juan Pérez aceptó unirse a Los Pibes"
      payload: { teamId: "abc", playerId: "xyz", invitationId: "def" }
  - Crea Notification para el jugador (confirmación):
      family: TEAM
      type: MEMBERSHIP_JOINED
      title: "Te uniste a Los Pibes"
      body: "Ahora eres miembro del equipo Los Pibes"
      payload: { teamId: "abc", membershipId: "ghi" }
    ↓
Transacción commit → todas las operaciones son atómicas
    ↓
UI del destinatario muestra badge incrementado (en próximo polling)
```

### 4.2. Consulta de Bandeja

```
Usuario accede a /notificaciones
    ↓
Sistema consulta:
  - NotificationPreference del usuario para saber qué familias están activas
  - Notification donde userId = usuario, family IN (familias activas)
  - Ordenado por createdAt DESC
  - Paginado (20 por página)
    ↓
Retorna lista con:
  - Datos de la notificación
  - Indicador de leída/no leída
  - Acciones inline disponibles (según payload.type)
    ↓
Usuario marca como leída (individual o "marcar todas")
    ↓
Sistema actualiza status = READ, readAt = now()
```

### 4.3. Acción Inline desde Notificación

```
Usuario recibe notificación de invitación a equipo
    ↓
En la bandeja, la notificación muestra botones:
  [Aceptar] [Rechazar] [Ver equipo]
    ↓
Usuario clickea [Aceptar]
    ↓
Sistema ejecuta la misma lógica que el endpoint team.acceptInvitation
    ↓
Si éxito:
  - Actualiza Notification.actionTaken = "ACCEPTED"
  - Marca notificación como READ
  - Genera nuevas notificaciones derivadas (MEMBERSHIP_JOINED para el jugador, INVITATION_ACCEPTED para el capitán)
    ↓
UI actualiza la bandeja sin recargar la página
```

### 4.4. Desactivación de Familia

```
Usuario accede a Configuración → Notificaciones
    ↓
Vee lista de familias con toggles:
  [✓] Equipos        [✓] Torneos
  [✓] Partidos       [✗] Canchas
  [✓] Reclutamiento  [✓] Sistema
    ↓
Usuario desactiva "Canchas"
    ↓
Sistema actualiza NotificationPreference:
  userId, family: COURT, isEnabled: false
    ↓
A partir de ahora:
  - Las notificaciones COURT siguen generándose en BD (para historial completo)
  - No se muestran en la bandeja
  - No incrementan el badge de no leídas
    ↓
Si el usuario reactiva la familía, las notificaciones generadas durante el período de silencio aparecen en la bandeja como no leídas
```

---

## 5. Reglas de Negocio Críticas

### 5.1. Generación

| Regla | Comportamiento |
|-------|----------------|
| Transaccional | La notificación se crea dentro de la misma transacción Prisma que el evento que la dispara. Si falla la notificación, falla toda la operación. |
| Múltiples destinatarios | Un evento puede generar notificaciones para múltiples usuarios (ej: saturación de equipo notifica a todos los capitanes con invitaciones pendientes). |
| Sin duplicados | Un mismo evento no genera notificación duplicada para el mismo usuario. Se usa `upsert` o validación previa. |
| Payload obligatorio | Toda notificación debe incluir `payload` con suficiente información para construir el link de navegación. |
| Familia obligatoria | Toda notificación pertenece a una `NotificationFamily`. No hay notificaciones sin familia. |
| Tipo obligatorio | Toda notificación tiene un `NotificationType` específico dentro de su familia. |

### 5.2. Consulta y Visualización

| Regla | Comportamiento |
|-------|----------------|
| Filtrado por familia activa | La bandeja solo muestra notificaciones cuya familía esté habilitada en `NotificationPreference`. |
| Orden cronológico | Ordenadas por `createdAt` DESC (más recientes primero). |
| Paginación | 20 notificaciones por página. Cursor-based para performance. |
| Badge de no leídas | Contador de `Notification.status = UNREAD` cuya familía esté activa. Se muestra en el layout principal. |
| Marcar como leída | Individual (clic en notificación) o masiva ("Marcar todas como leídas"). |
| Acciones inline | Según el `NotificationType`, se muestran botones de acción que ejecutan mutaciones tRPC sin salir de la bandeja. |
| Navegación | Clickear el cuerpo de la notificación navega a la pantalla relevante según el `payload`. |

### 5.3. Preferencias

| Regla | Comportamiento |
|-------|----------------|
| Default activado | Al crear usuario, todas las familias se crean con `isEnabled = true`. |
| Desactivación por familia | El usuario puede desactivar/activar cada familía individualmente. |
| Sin granularidad por tipo | No se puede desactivar `INVITATION_RECEIVED` pero mantener `INVITATION_ACCEPTED`. Solo a nivel de familía `TEAM`. |
| Silencio, no eliminación | Al desactivar, las notificaciones siguen generándose en BD. Solo se ocultan de la bandeja. |
| Reactivación restaura historial | Al reactivar una familía, todas las notificaciones generadas durante el silencio aparecen en la bandeja como `UNREAD`. |
| Familia SYSTEM no desactivable | Las notificaciones de familía `SYSTEM` (anuncios, mantenimiento) siempre se muestran. No aparecen en preferencias. |

### 5.4. Eventos y Familias

| Familia | Eventos que la disparan | Sistemas de origen |
|---------|------------------------|-------------------|
| `AUTH` | Asignación/revocado de rol | Sistema 1 |
| `TEAM` | Invitaciones, membresías, capitanía, eliminación, saturación | Sistemas 3, 4 |
| `RECRUITMENT` | Invitaciones de reclutamiento | Sistema 4 |
| `TOURNAMENT` | Inscripciones, aprobaciones, sorteos, cancelaciones, reagendamientos, conflictos | Sistema 6 |
| `MATCH` | Programación, aplazamientos, resultados, walkovers, recordatorios | Sistema 7 |
| `COURT` | Deshabilitación de cancha o franja | Sistema 5 |
| `SYSTEM` | Anuncios de plataforma, mantenimiento | Sistema 11 |

---

## 6. Endpoints tRPC Sugeridos

### 6.1. Router `notification`

```typescript
export const notificationRouter = createTRPCRouter({
  // ─── Bandeja ───

  // Listar notificaciones del usuario (solo familias activas)
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["UNREAD", "READ", "ALL"]).default("ALL"),
      family: z.enum(["AUTH", "TEAM", "RECRUITMENT", "TOURNAMENT", "MATCH", "COURT", "SYSTEM"]).optional(),
      cursor: z.string().optional(),
      pageSize: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return notificationEngine.list(ctx.prisma, ctx.session.user.id, input);
    }),

  // Contador de no leídas (para badge)
  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return notificationEngine.unreadCount(ctx.prisma, ctx.session.user.id);
  }),

  // ─── Acciones ───

  // Marcar una notificación como leída
  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return notificationEngine.markAsRead(ctx.prisma, input.notificationId, ctx.session.user.id);
    }),

  // Marcar todas como leídas (de familias activas)
  markAllAsRead: protectedProcedure
    .input(z.object({
      family: z.enum(["AUTH", "TEAM", "RECRUITMENT", "TOURNAMENT", "MATCH", "COURT", "SYSTEM"]).optional(),
    }).optional())
    .mutation(async ({ ctx, input }) => {
      return notificationEngine.markAllAsRead(ctx.prisma, ctx.session.user.id, input);
    }),

  // Ejecutar acción inline de una notificación
  executeAction: protectedProcedure
    .input(z.object({
      notificationId: z.string(),
      action: z.string(), // Ej: "ACCEPT", "REJECT", "VIEW"
      payload: z.record(z.unknown()).optional(), // Datos adicionales para la acción
    }))
    .mutation(async ({ ctx, input }) => {
      return notificationEngine.executeAction(ctx.prisma, input, ctx.session.user.id);
    }),

  // ─── Preferencias ───

  // Obtener preferencias del usuario
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    return notificationEngine.getPreferences(ctx.prisma, ctx.session.user.id);
  }),

  // Actualizar preferencia de una familia
  updatePreference: protectedProcedure
    .input(z.object({
      family: z.enum(["AUTH", "TEAM", "RECRUITMENT", "TOURNAMENT", "MATCH", "COURT"]), // SYSTEM excluido
      isEnabled: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      return notificationEngine.updatePreference(ctx.prisma, ctx.session.user.id, input);
    }),
});
```

---

## 7. Motores de Negocio (Core)

### 7.1. `notification.engine.ts` — Estructura

```typescript
// server/core/notification/notification.engine.ts

// Crear notificación (llamado desde otros motores dentro de transacciones)
export async function create(
  tx: PrismaTransaction, // Se recibe la transacción activa
  input: {
    userId: string;
    family: NotificationFamily;
    type: NotificationType;
    title: string;
    body: string;
    payload: Record<string, unknown>;
  }
) {
  // 1. Verificar que la familía no esté desactivada para este usuario
  const pref = await tx.notificationPreference.findUnique({
    where: { userId_family: { userId: input.userId, family: input.family } },
  });

  // 2. Crear notificación siempre (independientemente de la preferencia)
  const notification = await tx.notification.create({
    data: {
      userId: input.userId,
      family: input.family,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
      status: "UNREAD",
    },
  });

  return notification;
}

// Listar notificaciones (filtrando familias activas)
export async function list(
  prisma: PrismaClient,
  userId: string,
  input?: { status?: "UNREAD" | "READ" | "ALL"; family?: NotificationFamily; cursor?: string; pageSize?: number }
) {
  // 1. Obtener familias activas del usuario
  const activeFamilies = await prisma.notificationPreference.findMany({
    where: { userId, isEnabled: true },
    select: { family: true },
  });
  const families = activeFamilies.map(p => p.family);
  families.push("SYSTEM"); // SYSTEM siempre incluido

  // 2. Consultar notificaciones
  return prisma.notification.findMany({
    where: {
      userId,
      family: { in: families },
      status: input?.status && input.status !== "ALL" ? input.status : undefined,
      family: input?.family ? input.family : { in: families },
      ...(input?.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: input?.pageSize ?? 20,
  });
}

// Contador de no leídas (solo familias activas)
export async function unreadCount(prisma: PrismaClient, userId: string) {
  const activeFamilies = await prisma.notificationPreference.findMany({
    where: { userId, isEnabled: true },
    select: { family: true },
  });
  const families = activeFamilies.map(p => p.family);
  families.push("SYSTEM");

  return prisma.notification.count({
    where: { userId, family: { in: families }, status: "UNREAD" },
  });
}

// Marcar como leída
export async function markAsRead(
  prisma: PrismaClient,
  notificationId: string,
  userId: string
) {
  // 1. Verificar ownership
  // 2. Actualizar status = READ, readAt = now()
}

// Ejecutar acción inline
export async function executeAction(
  prisma: PrismaClient,
  input: { notificationId: string; action: string; payload?: Record<string, unknown> },
  userId: string
) {
  // 1. Verificar ownership de la notificación
  // 2. Según notification.type y action, enrutar a la lógica correspondiente:
  //    - INVITATION_RECEIVED + ACCEPT → llamar team.acceptInvitation
  //    - ENROLLMENT_APPROVED + VIEW → retornar link a torneo
  //    - etc.
  // 3. Actualizar notification.actionTaken
  // 4. Marcar como leída
}

// Actualizar preferencia
export async function updatePreference(
  prisma: PrismaClient,
  userId: string,
  input: { family: NotificationFamily; isEnabled: boolean }
) {
  // 1. Validar que no sea SYSTEM
  // 2. Upsert NotificationPreference
}
```

### 7.2. Integración con otros motores

El motor de notificaciones no se llama directamente desde los routers tRPC. Se invoca **desde otros motores de dominio** dentro de sus transacciones:

```typescript
// Ejemplo en team.engine.ts (Sistema 3)
export async function acceptInvitation(...) {
  return prisma.$transaction(async (tx) => {
    // ... lógica de aceptación ...

    // Notificar al invitador (capitán)
    await notificationEngine.create(tx, {
      userId: inviterUserId,
      family: "TEAM",
      type: "INVITATION_ACCEPTED",
      title: "Jugador aceptó tu invitación",
      body: `${playerName} aceptó unirse a ${teamName}`,
      payload: { teamId, playerId, invitationId },
    });

    // Notificar al jugador
    await notificationEngine.create(tx, {
      userId: playerUserId,
      family: "TEAM",
      type: "MEMBERSHIP_JOINED",
      title: `Te uniste a ${teamName}`,
      body: "Ahora eres miembro del equipo.",
      payload: { teamId, membershipId },
    });
  });
}
```

---

## 8. Seguridad y Validaciones

### 8.1. Capa 1: Autenticación

- Todos los endpoints requieren sesión activa (`protectedProcedure`).

### 8.2. Capa 2: Autorización

| Endpoint | Requiere |
|----------|----------|
| `notification.list` | Ser el usuario autenticado (solo ve sus notificaciones) |
| `notification.unreadCount` | Ser el usuario autenticado |
| `notification.markAsRead` | Ser el destinatario de la notificación |
| `notification.markAllAsRead` | Ser el usuario autenticado |
| `notification.executeAction` | Ser el destinatario de la notificación + permisos de la acción |
| `notification.getPreferences` | Ser el usuario autenticado |
| `notification.updatePreference` | Ser el usuario autenticado + familía ≠ SYSTEM |

### 8.3. Capa 3: Validación de Estado

| Acción | Validación |
|--------|------------|
| Listar | Filtrar por familias activas + SYSTEM. Excluir notificaciones de familias desactivadas de la bandeja. |
| Marcar leída | Notificación pertenece al usuario autenticado. |
| Ejecutar acción | Notificación pertenece al usuario. La acción es válida para el `type`. El usuario tiene permisos para ejecutar la acción subyacente. |
| Actualizar preferencia | Familia no es `SYSTEM`. Usuario autenticado. |

---

## 9. UI / UX

### 9.1. Bandeja de Notificaciones

```
┌─────────────────────────────────────────────┐
│  🔔 Notificaciones                    (12)  │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ 👤 Juan Pérez aceptó tu invitación  │    │
│  │ Ahora es miembro de Los Pibes       │    │
│  │ Hace 5 min • [Ver equipo]           │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ⚽ Tu partido fue aplazado          │    │
│  │ Copa Barrial — Los Pibes vs FC Cen  │    │
│  │ Motivo: Lluvia intensa              │    │
│  │ Hace 1h • [Ver detalles]            │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ 🏆 Inscripción aprobada             │    │
│  │ Los Pibes está en Copa Barrial 2026 │    │
│  │ Ayer • [Ver torneo]                 │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [Marcar todas como leídas]                 │
└─────────────────────────────────────────────┘
```

### 9.2. Notificación con Acciones Inline

```
┌─────────────────────────────────────────────┐
│  👤 Nueva invitación a equipo               │
│  Los Pibes te quiere en su equipo           │
│  Hace 10 min                                │
│                                             │
│  [Aceptar]  [Rechazar]  [Ver perfil]       │
└─────────────────────────────────────────────┘
```

### 9.3. Panel de Preferencias

```
┌─────────────────────────────────────────────┐
│  Configuración de Notificaciones            │
│                                             │
│  Equipos        [==========ON]              │
│  Torneos        [==========ON]              │
│  Partidos       [==========ON]              │
│  Reclutamiento  [==========ON]              │
│  Canchas        [========OFF]               │
│  Sistema        [==========ON]  (no editable)│
│                                             │
│  Si desactivas una familia, dejarás de ver  │
│  notificaciones nuevas de esa categoría en  │
│  tu bandeja. Las notificaciones anteriores  │
│  seguirán disponibles en tu historial.      │
└─────────────────────────────────────────────┘
```

### 9.4. Reglas de UI

- **Cero CSS inline**: Todo con Tailwind o `cva`.
- **Badge flotante**: Contador de no leídas en el icono de campana del layout principal. Se actualiza cada 30 segundos.
- **Indicador visual**: Notificaciones `UNREAD` tienen fondo ligeramente diferente o barra lateral de color.
- **Agrupación por fecha**: "Hoy", "Ayer", "Esta semana", "Anteriores".
- **Skeleton loading**: Al cargar la bandeja, se muestra skeleton mientras se fetchean.
- **Empty state**: Si no hay notificaciones, mensaje "No tienes notificaciones" con ilustración.
- **Acciones inline**: Botones pequeños dentro de la card de notificación. Al ejecutar, se muestra spinner y luego se actualiza el estado de la notificación.

---

## 10. Checklist de Implementación

- [ ] Implementar schema Prisma (`Notification`, `NotificationPreference`)
- [ ] Ejecutar migración de base de datos
- [ ] Implementar motor `notification.engine.ts` (crear, listar, contar, marcar leída, ejecutar acción, preferencias)
- [ ] Crear router `notification` en tRPC
- [ ] Integrar `notificationEngine.create` en todos los motores de dominio que disparan eventos:
  - [ ] Sistema 1: Cambio de capitanía, transferencia
  - [ ] Sistema 3: Invitaciones, membresías, eliminación
  - [ ] Sistema 4: Reclutamiento, saturación
  - [ ] Sistema 5: Deshabilitación de cancha/franja
  - [ ] Sistema 6: Inscripciones, aprobaciones, sorteos, cancelaciones
  - [ ] Sistema 7: Partidos, aplazamientos, resultados, walkovers
- [ ] Crear página `/notificaciones` con bandeja completa
- [ ] Crear componente de bandeja dropdown (accesible desde cualquier página)
- [ ] Implementar polling cada 30 segundos para badge de no leídas
- [ ] Crear página de preferencias `/configuracion/notificaciones`
- [ ] Implementar acciones inline para cada tipo de notificación soportado
- [ ] Crear hooks de feature: `useNotifications`, `useUnreadCount`, `useNotificationPreferences`
- [ ] Implementar seed de `NotificationPreference` al crear usuario
- [ ] Documentar convención de integración para futuros sistemas

---

## 11. Dependencias con Otros Sistemas

| Sistema | Dependencia | Descripción |
|---------|-------------|-------------|
| Sistema 1: Auth & RBAC | Requiere | `User` es el destinatario de notificaciones. Eventos de capitanía generan notificaciones. |
| Sistema 2: Usuarios/Perfiles | Requiere | `Profile.displayName` se usa en el `body` de notificaciones. |
| Sistema 3: Equipos | Notifica | Invitaciones, aceptaciones, rechazos, membresías, capitanía, eliminación. |
| Sistema 4: Reclutamiento | Notifica | Invitaciones, aceptaciones, rechazos, revocaciones, expiraciones, saturación. |
| Sistema 5: Canchas | Notifica | Deshabilitación de cancha o franja con torneo programado. |
| Sistema 6: Torneos | Notifica | Inscripciones, aprobaciones, rechazos, desaprobaciones, sorteos, cancelaciones, reagendamientos, conflictos. |
| Sistema 7: Partidos | Notifica | Programación, aplazamientos, reagendamientos, resultados, walkovers, recordatorios. |
| Sistema 10: Resultados | Notifica | Resultados cargados, estadísticas actualizadas (si aplica). |
| Sistema 12: Mapa | Ninguna directa | — |

---

## 12. Notas de Arquitectura

### 12.1. Patrón de Integración

El sistema de notificaciones sigue un patrón **observer interno**: cada motor de dominio, al completar una transacción de negocio, invoca `notificationEngine.create` dentro de la misma transacción Prisma. Esto garantiza:

- **Atomicidad**: Si falla la notificación, falla toda la operación. No hay estados inconsistentes.
- **Consistencia**: La notificación siempre refleja el estado final de la transacción.
- **Sin acoplamiento circular**: El motor de notificaciones no conoce la lógica de otros motores. Solo recibe datos.

**Convención para futuros sistemas:**

```typescript
// Al final de cualquier motor que dispare notificaciones:
await notificationEngine.create(tx, {
  userId: destinatario,
  family: "FAMILIA",
  type: "EVENTO_ESPECIFICO",
  title: "Título corto",
  body: "Descripción",
  payload: { ids necesarios para navegación },
});
```

### 12.2. Acciones Inline

Las acciones inline son un **convenio de UI**, no una lógica de backend especial. El frontend, según el `NotificationType`, muestra botones que ejecutan mutaciones tRPC existentes:

| Tipo | Acciones disponibles | Mutación tRPC subyacente |
|------|---------------------|-------------------------|
| `INVITATION_RECEIVED` | Aceptar, Rechazar, Ver | `team.acceptInvitation`, `team.rejectInvitation` |
| `ENROLLMENT_APPROVED` | Ver torneo | Navegación a `/torneos/[id]` |
| `MATCH_POSTPONED` | Ver partido, Ver torneo | Navegación a `/partidos/[id]` |
| `CAPTAINCY_TRANSFER_REQUESTED` | Aceptar, Rechazar | `captaincy.acceptTransfer`, `captaincy.rejectTransfer` |

El backend no tiene endpoints especiales para acciones inline. El frontend usa las mutaciones existentes y luego marca la notificación como leída.

### 12.3. Escalabilidad del Badge

El contador de no leídas se consulta con polling cada 30 segundos. Para escalar:
- La query usa índice compuesto `[userId, family, status]`.
- El conteo se hace en PostgreSQL, no en memoria.
- Futura optimización: cachear en Redis el contador por usuario con invalidación al generar notificación.

### 12.4. Silencio vs. Eliminación

Al desactivar una familía, las notificaciones **no se eliminan**. Se siguen generando y almacenando. Esto permite:
- Reactivar la familía y recuperar todo el historial.
- Auditoría completa de eventos.
- Posible extensión futura: resumen semanal de notificaciones silenciadas.

---

> **Documento versionado.** Cualquier modificación requiere revisión y aprobación antes de implementar.
