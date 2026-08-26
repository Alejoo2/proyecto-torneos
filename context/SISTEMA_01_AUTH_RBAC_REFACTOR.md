# Sistema 1: Auth & RBAC

> **Estado:** Especificado (Iterando)  
> **Propósito:** Documento de diseño técnico del sistema de autenticación y control de acceso basado en roles. Sujeto a revisión conforme se especifiquen los demás sistemas.

---

## 1. Visión del Sistema

Sistema de autenticación OAuth (Google + Discord) con control de acceso granular basado en permisos normalizados. Un usuario tiene un único perfil, múltiples roles asignados, y cada rol agrupa un conjunto de permisos. La autorización se valida en tres capas: sesión JWT firmada, middleware de permisos en tRPC, y verificación de ownership en el motor de negocio.

**Regla fundamental:** Todo usuario que se registra en la plataforma se crea automáticamente como **jugador** (`Player`). No existe elección de rol en el registro. Los roles adicionales (`manager`, `captain`, `admin`) se asignan manualmente por un administrador o por el flujo de negocio (capitanía por transferencia).

---

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Auth provider** | NextAuth.js + Prisma Adapter | Estándar en el ecosistema Next.js. Soporta múltiples OAuth providers con account linking automático por email. |
| **Providers OAuth** | Google, Discord | Google para usuarios generales. Discord como alternativa para comunidades de jugadores. Ambos permiten account linking cuando comparten email. |
| **Modelo usuario-perfil** | 1 User : 1 Profile | Un usuario = una identidad OAuth. Un perfil = datos personales + roles + contexto en la plataforma. Sin perfiles múltiples. |
| **RBAC** | Matriz normalizada en tablas | Tablas `Role`, `Permission`, `RolePermission`, `RoleAssignment`. Permite queries eficientes, integridad referencial y auditoría. |
| **Jerarquía de roles** | Plana (sin jerarquía) | Admin, Manager, Player, Captain son roles de dominio al mismo nivel. Admin tiene permisos específicos de gestión global. |
| **Capitanía** | Transferencia con aceptación obligatoria | Un jugador solo puede ser capitán de **un equipo activo a la vez**. No puede abandonar la capitanía sin transferirla. El receptor debe aceptar. |
| **Datos personales** | Post-registro (onboarding) | El registro OAuth es mínimo. El usuario completa datos adicionales (teléfono, fecha de nacimiento, etc.) en su perfil después. |
| **Registro de usuario** | Siempre como jugador | Todo nuevo usuario se crea con rol `player` automáticamente. Los demás roles se asignan manualmente por admin o por flujo de negocio. |
| **Sin carga de archivos** | Ningún sistema permite upload | No hay fotos de perfil personalizadas. El avatar viene del provider OAuth (`User.image`). |

---

## 3. Modelo de Datos (Prisma Schema)

### 3.1. Auth (NextAuth.js — estándar, no modificar)

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

### 3.2. Usuario y Perfil

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified DateTime?
  name          String?   // Nombre del provider OAuth
  image         String?   // Avatar del provider OAuth (Google/Discord)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts Account[]
  sessions Session[]
  profile  Profile?
}

model Profile {
  id          String   @id @default(cuid())
  userId      String   @unique
  displayName String?  // Nombre que elige mostrar en la plataforma
  phone       String?  // Ver reglas de visibilidad en Sistema 2
  bio         String?  @db.Text
  birthDate   DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  roleAssignments RoleAssignment[]
  player          Player?
  manager         Manager?
}
```

> **Nota:** `Profile` no tiene campo `image`. El avatar se toma de `User.image` (provider OAuth). No hay carga de archivos en ningún sistema.

### 3.3. RBAC — Matriz de Permisos Normalizada

```prisma
model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())

  permissions RolePermission[]
  assignments RoleAssignment[]
}

model Permission {
  id          String   @id @default(cuid())
  code        String   @unique
  name        String
  module      String
  description String?
  createdAt   DateTime @default(now())

  roles RolePermission[]
}

model RolePermission {
  roleId       String
  permissionId String
  assignedAt   DateTime @default(now())

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}

model RoleAssignment {
  id         String   @id @default(cuid())
  profileId  String
  roleId     String
  assignedBy String?
  assignedAt DateTime @default(now())

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  role    Role    @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@unique([profileId, roleId])
}
```

### 3.4. Datos Específicos por Tipo de Usuario

```prisma
model Player {
  id        String   @id @default(cuid())
  profileId String   @unique
  createdAt DateTime @default(now())

  profile         Profile              @relation(fields: [profileId], references: [id], onDelete: Cascade)
  availabilities  PlayerAvailability[]
  teamMemberships TeamMembership[]
  teamInvitations TeamInvitation[]
}

model PlayerAvailability {
  id        String            @id @default(cuid())
  playerId  String
  dayOfWeek Int               // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  timeSlot  Int               // 0 = 00:00-02:00, 1 = 02:00-04:00, ..., 11 = 22:00-00:00
  status    AvailabilityStatus @default(AVAILABLE)

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@unique([playerId, dayOfWeek, timeSlot])
}

enum AvailabilityStatus {
  AVAILABLE
  UNAVAILABLE
}

model Manager {
  id        String   @id @default(cuid())
  profileId String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  profile     Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  tournaments Tournament[]
}
```

> **Nota sobre `PlayerAvailability`:** El sistema de disponibilidad usa una matriz de 7 días × 12 franjas de 2h (24h). El usuario habilita/deshabilita franjas con tap. El estado `CONFLICT` (amarillo) se calcula en runtime cruzando disponibilidad con partidos programados. Ver detalle en Sistema 2.
>
> **Nota sobre `Manager`:** Las canchas son entidades públicas creadas y gestionadas por el admin (Sistema 5). No existe relación de propiedad entre `Manager` y `Court`. Los gestores operan libremente en cualquier cancha habilitada para crear torneos.

### 3.5. Capitanía

```prisma
model TeamMembership {
  id        String    @id @default(cuid())
  playerId  String
  teamId    String
  isCaptain Boolean   @default(false)
  joinedAt  DateTime  @default(now())
  leftAt    DateTime?

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  team   Team   @relation(fields: [teamId], references: [id], onDelete: Cascade)

  incomingTransfers CaptaincyTransfer[] @relation("IncomingTransfer")
  outgoingTransfers CaptaincyTransfer[] @relation("OutgoingTransfer")

  @@unique([playerId, teamId])
}

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

---

## 4. Seguridad — Estrategia de Defensa en Profundidad

### 4.1. Capa 1: Sesión (JWT firmado)

- El token JWT se firma con `NEXTAUTH_SECRET` (variable de entorno server-side).
- El payload contiene únicamente: `user.id`, `email`, `name`.
- **Nunca** contiene roles ni permisos.
- El atacante no puede falsificar el JWT sin conocer el secret.

### 4.2. Capa 2: Autorización en tRPC

Cada procedimiento protegido consulta la base de datos para verificar permisos. No se confía en el frontend.

```typescript
// Middleware de autenticación
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { session: ctx.session } });
});

// Middleware de autorización por permiso
const requirePermission = (permissionCode: string) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" });

    const hasPermission = await ctx.prisma.roleAssignment.findFirst({
      where: {
        profile: { userId: ctx.session.user.id },
        role: { permissions: { some: { permission: { code: permissionCode } } } }
      }
    });

    if (!hasPermission) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return next({ ctx });
  });

export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);
export const permissionProcedure = (code: string) =>
  t.procedure.use(requirePermission(code));
```

### 4.3. Capa 3: Validación de Ownership

El motor de negocio verifica que el usuario tenga derecho sobre el recurso específico.

```typescript
// Ejemplo: crear torneo en una cancha específica
export async function create(
  prisma: PrismaClient,
  input: CreateTournamentInput,
  userId: string
) {
  const isOwner = await prisma.court.findFirst({
    where: {
      id: input.courtId,
      manager: { profile: { userId } }
    }
  });

  if (!isOwner) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No eres gestor de esta cancha"
    });
  }

  // ... lógica de creación
}
```

### 4.4. Regla de Oro

> Los permisos se evalúan **dos veces**: una a nivel de acción (¿puede crear torneos?) y otra a nivel de recurso (¿puede crear torneos en **esta** cancha?).

---

## 5. Permisos Iniciales

### 5.1. Roles del Sistema

| Rol | Descripción | `isSystem` |
|-----|-------------|------------|
| `admin` | Administrador global. Crea canchas públicas, habilita/deshabilita gestores, asigna permisos. | `true` |
| `manager` | Gestor de torneos. Opera dentro de canchas existentes. Solo admin puede habilitar/deshabilitar. | `true` |
| `player` | Jugador base. Se asigna automáticamente al registrarse. Puede ser invitado a equipos, define disponibilidad horaria. | `true` |
| `captain` | Capitán de equipo. Tiene permisos de gestión sobre su equipo. Se asigna dinámicamente por transferencia. | `true` |

### 5.2. Permisos Sembrados

| Código | Nombre | Módulo | Roles con acceso |
|--------|--------|--------|------------------|
| `user:manage` | Gestionar usuarios | user | admin |
| `manager:create` | Crear gestores | user | admin |
| `manager:disable` | Habilitar/deshabilitar gestores | user | admin |
| `court:create` | Crear canchas públicas | court | admin |
| `court:edit` | Editar canchas públicas | court | admin |
| `court:disable` | Habilitar/deshabilitar canchas | court | admin |
| `court:view` | Ver canchas | court | admin, manager, player, captain |
| `tournament:create` | Crear torneos | tournament | manager |
| `tournament:manage` | Gestionar sus torneos | tournament | manager |
| `tournament:approve` | Aprobar/rechazar torneos | tournament | admin |
| `team:invite` | Invitar jugadores | team | captain |
| `team:manage` | Gestionar equipo | team | captain |
| `match:postpone` | Aplazar partidos | match | manager |
| `match:result` | Cargar resultados de partido | match | manager |

> **Nota:** El permiso `match:result` está asignado exclusivamente al rol `manager`. El capitán **no** puede cargar resultados de partido bajo ninguna circunstancia. Los asistentes/vástagos con permisos delegados por el admin también pueden cargar resultados si se les asigna este permiso de forma granular.

> **Nota:** Los permisos de estadísticas (`stats:load`), notificaciones y otros módulos se agregarán siguiendo el procedimiento definido en la sección 7.

---

## 6. Reglas de Negocio Críticas

### 6.1. Registro de Usuario

| Regla | Comportamiento |
|-------|----------------|
| Creación automática | Todo nuevo usuario se crea con rol `player` automáticamente. |
| Sin elección de rol | No existe flujo de "¿quieres ser jugador o gestor?" en el registro. |
| Asignación de manager | El admin asigna el rol `manager` manualmente a una cuenta existente. No hay solicitud. |
| Asignación de admin | El primer admin se crea por seed. Los demás admins se asignan manualmente. |

### 6.2. Capitanía

| Regla | Comportamiento |
|-------|----------------|
| Unicidad | Un jugador solo puede ser capitán de **un equipo activo a la vez**. |
| Transferencia | El capitán actual inicia la transferencia hacia otro miembro del equipo. |
| Aceptación | El receptor **debe aceptar** la transferencia. Si rechaza, no ocurre nada. |
| Abandono | Un capitán **no puede abandonar** la capitanía sin transferirla primero. |
| Historial | No se mantiene historial de capitanía. Solo el estado actual importa. |

### 6.3. Gestores

| Regla | Comportamiento |
|-------|----------------|
| Creación | Solo el admin puede asignar el rol de manager a una cuenta existente. |
| Activación | El admin puede habilitar o deshabilitar cuentas de gestores (`Manager.isActive`). |
| Alcance | Un gestor solo opera sus propios torneos. No puede ver ni modificar torneos de otros gestores. |
| Canchas | Las canchas son públicas, creadas y administradas por el admin. Los gestores las usan, no las poseen. |

---

## 7. Procedimiento para Agregar Nuevos Permisos

Cuando un nuevo sistema requiera permisos, seguir este procedimiento:

### Paso 1: Definir el permiso

Usar la convención de naming: `{modulo}:{accion}`

```
modulos:    user | court | tournament | team | match | player | stats | notification
acciones:   create | read | update | delete | manage | approve | invite | postpone | result | assign
```

### Paso 2: Sembrar en la base de datos

```typescript
// prisma/seed.ts o migración de datos
await prisma.permission.create({
  data: {
    code: "match:result",
    name: "Cargar resultado de partido",
    module: "match",
    description: "Permite cargar el resultado y estadísticas de un partido finalizado"
  }
});
```

### Paso 3: Asignar a roles

```typescript
await prisma.rolePermission.create({
  data: {
    roleId: roleManager.id,
    permissionId: permissionMatchResult.id
  }
});
```

### Paso 4: Proteger el endpoint tRPC

```typescript
export const matchRouter = createTRPCRouter({
  loadResult: permissionProcedure("match:result")
    .input(z.object({ matchId: z.string(), ... }))
    .mutation(async ({ ctx, input }) => {
      // Verificación de ownership
      return matchEngine.loadResult(ctx.prisma, input, ctx.session.user.id);
    }),
});
```

### Paso 5: Proteger la UI (frontend)

```typescript
// Hook de feature
export function useCanLoadResult(matchId: string) {
  return api.rbac.checkPermission.useQuery({ code: "match:result" });
}

// En el template
const { data: canLoad } = useCanLoadResult(matchId);
{canLoad && <Button>Cargar Resultado</Button>}
```

> **Advertencia:** El frontend solo **oculta** elementos. La protección real está en el backend (Capa 2 y 3).

---

## 8. Diagrama de Relaciones

```
┌─────────────┐     1:1      ┌───────────┐
│    User     │◄────────────►│  Profile  │
│  (OAuth)    │              │ (datos)   │
└─────────────┘              └─────┬─────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────▼─────┐  ┌────▼────┐   ┌────▼──────────┐
              │   Player  │  │ Manager │   │RoleAssignment │
              │(jugador)  │  │(gestor) │   │   (RBAC)      │
              └─────┬─────┘  └────┬────┘   └───────────────┘
                    │             │
              ┌─────▼─────┐  ┌────▼────┐
              │TeamMembership│ │Tournament│
              │ (capitanía)  │ │(torneo) │
              └─────┬─────┘  └────────┘
                    │
              ┌─────▼─────────┐
              │CaptaincyTransfer│
              │   (pendiente)   │
              └─────────────────┘
```

---

## 9. Checklist de Implementación

- [ ] Configurar `NEXTAUTH_SECRET` en variables de entorno
- [ ] Configurar Google OAuth credentials
- [ ] Configurar Discord OAuth credentials
- [ ] Implementar schema Prisma (Auth + RBAC)
- [ ] Ejecutar migración de base de datos
- [ ] Crear script de seed con roles y permisos iniciales
- [ ] Implementar middleware `enforceUserIsAuthed`
- [ ] Implementar middleware `requirePermission`
- [ ] Crear router `rbac` en tRPC para consulta de permisos
- [ ] Implementar motor de capitanía (`server/core/rbac/captaincy.engine.ts`)
- [ ] Crear hook `usePermission` en features
- [ ] Implementar flujo de onboarding post-OAuth (Sistema 2)
- [ ] Implementar transferencia de capitanía con aceptación
- [ ] Implementar asignación manual de rol manager por admin

---

## 10. Dependencias con Otros Sistemas

| Sistema | Dependencia | Descripción |
|---------|-------------|-------------|
| Sistema 2: Usuarios/Perfiles | Requiere | El perfil es la entidad central que conecta auth con datos personales |
| Sistema 3: Equipos | Requiere | TeamMembership y CaptaincyTransfer dependen de Team |
| Sistema 5: Canchas | Requiere | Manager administra courts; admin crea/habilita courts |
| Sistema 6: Torneos | Requiere | Permisos de tournament usan verificación de ownership con Court |
| Sistema 7: Partidos | Requiere | Permisos de match requieren verificación de gestor/capitán |
| Sistema 11: Notificaciones | Notifica | Cambios de capitanía, rechazos de transferencia |

---

> **Documento versionado.** Cualquier modificación requiere revisión y aprobación antes de implementar.
