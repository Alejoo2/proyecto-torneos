# Sistema 2: Usuarios / Perfiles

> **Estado:** Especificado (Iterando)  
> **Propósito:** Documento de diseño técnico del sistema de perfiles de usuario, onboarding post-OAuth, disponibilidad horaria y reglas de visibilidad de datos. Sujeto a revisión conforme se especifiquen los demás sistemas.

---

## 1. Visión del Sistema

Sistema de gestión del perfil personal del jugador. Cubre el flujo de onboarding post-autenticación, la edición de datos personales, la configuración de disponibilidad horaria mediante una matriz interactiva (7 días × 12 franjas de 2h), y las reglas de visibilidad de información sensible (teléfono). Todo usuario registrado es automáticamente un jugador; este sistema gestiona su identidad dentro de la plataforma.

**Patrón de UI:** Optimistic UI. Las mutaciones de disponibilidad horaria reflejan cambios inmediatamente en la interfaz mientras se sincronizan con el servidor.

---

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Onboarding obligatorio** | Sí | El usuario debe completar datos mínimos antes de acceder a funcionalidades principales. |
| **Registro automático como jugador** | Sí | Todo `User` nuevo crea automáticamente `Profile` + `Player`. No hay elección de rol. |
| **Sin carga de archivos** | Ningún sistema | No hay fotos de perfil personalizadas. El avatar viene del provider OAuth (`User.image`). |
| **Disponibilidad horaria** | Matriz 7×12, franjas de 2h | Tap para habilitar/deshabilitar. Estados expandibles (3 ahora, 4-5 previsibles). |
| **Horario 24h** | 12 franjas por día | 00:00-02:00, 02:00-04:00, ..., 22:00-00:00. |
| **Estado CONFLICT** | Calculado en runtime | Se determina cruzando `AVAILABLE` con partidos programados del jugador. No se guarda en BD. |
| **Disponibilidad NO restringe invitación** | Sí | El sistema marca conflicto (amarillo) pero no bloquea. El capitán decide igual. |
| **Perfil público** | Sí | Todos los autenticados ven nombre, bio, etc. del perfil. |
| **Teléfono jugador** | Solo capitanes de SU equipo | Si no está en equipo, nadie ve su teléfono. |
| **Teléfono capitán** | Visible para gestores de torneo | Los gestores necesitan contactar capitanes para coordinación. |
| **Gestores** | Admin asigna rol manualmente | No hay flujo de solicitud. El admin conoce presencialmente a los gestores y les asigna el rol. |
| **Asistentes/vástagos** | Diferido a Sistema 6 (Torneos) | Se definirá cuando se especifique el sistema de gestión de torneos y sus funciones de secretaría. |

---

## 3. Modelo de Datos (Prisma Schema)

### 3.1. Perfil

```prisma
model Profile {
  id          String   @id @default(cuid())
  userId      String   @unique
  displayName String?  // Nombre público en la plataforma
  phone       String?  // Reglas de visibilidad en sección 6
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

### 3.2. Jugador

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
```

> **Nota:** El campo `teamInvitations` se renombró desde `invitations` para coincidir exactamente con la entidad `TeamInvitation` definida en los Sistemas 3 y 4, eliminando cualquier ambigüedad con otras posibles entidades de invitación.

### 3.3. Disponibilidad Horaria

```prisma
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
  AVAILABLE      // Verde (o sin color) — el jugador puede jugar en esta franja
  UNAVAILABLE    // Gris/Apagado — el jugador no puede jugar
}
```

> **Nota:** El estado `CONFLICT` no existe en la base de datos. Se calcula en runtime al renderizar la matriz, cruzando las franjas `AVAILABLE` con los horarios de los partidos programados del jugador.

### 3.4. Mapa de Franjas Horarias

| `timeSlot` | Rango horario |
|------------|---------------|
| 0 | 00:00 - 02:00 |
| 1 | 02:00 - 04:00 |
| 2 | 04:00 - 06:00 |
| 3 | 06:00 - 08:00 |
| 4 | 08:00 - 10:00 |
| 5 | 10:00 - 12:00 |
| 6 | 12:00 - 14:00 |
| 7 | 14:00 - 16:00 |
| 8 | 16:00 - 18:00 |
| 9 | 18:00 - 20:00 |
| 10 | 20:00 - 22:00 |
| 11 | 22:00 - 00:00 |

---

## 4. Flujo de Onboarding

### 4.1. Secuencia

```
OAuth login (Google/Discord)
    ↓
NextAuth crea User + Profile (mínimo) + Player (automático)
    ↓
Redirección a /onboarding
    ↓
Paso 1: Completar datos personales
    - displayName (obligatorio)
    - phone (opcional)
    - bio (opcional)
    - birthDate (opcional)
    ↓
Paso 2: Configurar disponibilidad horaria
    - Matriz 7×12 interactiva
    - Tap para toggle AVAILABLE/UNAVAILABLE
    - Todos los slots default a AVAILABLE
    ↓
Onboarding completo → Redirección a dashboard
```

### 4.2. Reglas del Onboarding

| Regla | Comportamiento |
|-------|----------------|
| Obligatorio | El usuario no puede navegar la app hasta completar el onboarding. |
| `displayName` obligatorio | Es el único campo requerido. El resto es opcional. |
| Disponibilidad default | Todas las franjas inician como `AVAILABLE`. El usuario desmarca las que no puede. |
| Re-entrada | Si el usuario abandona el onboarding a mitad, al volver a entrar retoma donde quedó. |
| Edición posterior | Todos los datos del onboarding pueden editarse después desde el perfil. |

---

## 5. Disponibilidad Horaria — Comportamiento de UI

### 5.1. Matriz Visual

```
        Dom   Lun   Mar   Mié   Jue   Vie   Sáb
00-02   [ ]   [✓]   [✓]   [✓]   [✓]   [✓]   [ ]
02-04   [ ]   [✓]   [✓]   [✓]   [✓]   [✓]   [ ]
04-06   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]   [ ]
...     ...   ...   ...   ...   ...   ...   ...
22-00   [✓]   [✓]   [✓]   [✓]   [✓]   [✓]   [✓]
```

### 5.2. Estados Visuales

| Estado | Color UI | Significado | Fuente |
|--------|----------|-------------|--------|
| `AVAILABLE` | Verde (o sin color destacado) | El jugador puede jugar | BD: `PlayerAvailability.status = AVAILABLE` |
| `UNAVAILABLE` | Gris / Apagado | El jugador no puede jugar | BD: `PlayerAvailability.status = UNAVAILABLE` |
| `CONFLICT` | Amarillo (color por definir) | El jugador tiene partido programado en esta franja | Calculado en runtime: `AVAILABLE` + partido en ese horario |

### 5.3. Interacción

- **Tap simple:** Toggle entre `AVAILABLE` ↔ `UNAVAILABLE`.
- **Optimistic UI:** El cambio se refleja inmediatamente en la matriz. La mutación tRPC se ejecuta en background. Si falla, se revierte visualmente y se muestra toast de error.
- **CONFLICT no es editable:** Las franjas en conflicto se muestran en amarillo pero el usuario no puede interactuar con ellas directamente. El conflicto desaparece cuando el partido se juega, aplaza o cancela.

### 5.4. Cálculo de Conflicto (Runtime)

```typescript
// Pseudocódigo del cálculo en el frontend o en una query tRPC
function getSlotStatus(
  availability: PlayerAvailability,
  matches: Match[]
): "AVAILABLE" | "UNAVAILABLE" | "CONFLICT" {
  if (availability.status === "UNAVAILABLE") return "UNAVAILABLE";

  const hasMatch = matches.some(match => {
    const matchDay = match.scheduledAt.getDay(); // 0-6
    const matchSlot = timeToSlot(match.scheduledAt); // 0-11
    return matchDay === availability.dayOfWeek && matchSlot === availability.timeSlot;
  });

  if (hasMatch) return "CONFLICT";
  return "AVAILABLE";
}
```

---

## 6. Reglas de Visibilidad de Datos

### 6.1. Perfil Público

Todos los usuarios autenticados pueden ver:
- `displayName`
- `bio`
- `birthDate` (opcional, si el usuario lo completó)

### 6.2. Teléfono — Reglas Granulares

```
¿Quién ve el teléfono de un jugador?

SI el jugador es capitán de un equipo activo:
    → Gestores de torneo: SÍ (cualquier gestor autenticado)
    → Capitanes de otros equipos: NO
    → Jugadores (incluyendo su equipo): NO

SI el jugador NO es capitán pero está en un equipo activo:
    → Capitanes de SU equipo: SÍ
    → Otros jugadores de SU equipo: NO
    → Gestores de torneo: NO
    → Capitanes de otros equipos: NO

SI el jugador NO está en ningún equipo:
    → Nadie ve su teléfono
```

### 6.3. Implementación de Visibilidad

La lógica de visibilidad del teléfono vive en el motor de negocio, no en el router tRPC:

```typescript
// server/core/profile/profile.engine.ts
export async function getVisiblePhone(
  prisma: PrismaClient,
  targetProfileId: string,
  viewerUserId: string
): Promise<string | null> {
  const targetProfile = await prisma.profile.findUnique({
    where: { id: targetProfileId },
    include: {
      player: {
        include: {
          teamMemberships: {
            where: { leftAt: null },
            include: { team: true }
          }
        }
      }
    }
  });

  if (!targetProfile?.phone) return null;

  const viewerProfile = await prisma.profile.findUnique({
    where: { userId: viewerUserId },
    include: {
      player: {
        include: {
          teamMemberships: {
            where: { leftAt: null, isCaptain: true },
            include: { team: true }
          }
        }
      },
      manager: true
    }
  });

  // Caso 1: El target es capitán → gestores lo ven
  const targetIsCaptain = targetProfile.player?.teamMemberships.some(tm => tm.isCaptain);
  if (targetIsCaptain && viewerProfile?.manager) {
    return targetProfile.phone;
  }

  // Caso 2: El target está en un equipo → solo su capitán lo ve
  const targetTeamId = targetProfile.player?.teamMemberships[0]?.teamId;
  const viewerIsCaptainOfTargetTeam = viewerProfile?.player?.teamMemberships.some(
    tm => tm.teamId === targetTeamId
  );
  if (viewerIsCaptainOfTargetTeam) {
    return targetProfile.phone;
  }

  return null;
}
```

---

## 7. Endpoints tRPC Sugeridos

### 7.1. Router `profile`

```typescript
export const profileRouter = createTRPCRouter({
  // Obtener perfil propio
  me: protectedProcedure.query(async ({ ctx }) => {
    return profileEngine.getByUserId(ctx.prisma, ctx.session.user.id);
  }),

  // Obtener perfil público de otro usuario
  getById: protectedProcedure
    .input(z.object({ profileId: z.string() }))
    .query(async ({ ctx, input }) => {
      return profileEngine.getPublicProfile(ctx.prisma, input.profileId, ctx.session.user.id);
    }),

  // Actualizar datos personales
  update: protectedProcedure
    .input(z.object({
      displayName: z.string().min(1).max(50).optional(),
      phone: z.string().max(20).optional(),
      bio: z.string().max(500).optional(),
      birthDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return profileEngine.update(ctx.prisma, ctx.session.user.id, input);
    }),

  // Completar onboarding
  completeOnboarding: protectedProcedure
    .input(z.object({
      displayName: z.string().min(1).max(50),
      phone: z.string().max(20).optional(),
      bio: z.string().max(500).optional(),
      birthDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return profileEngine.completeOnboarding(ctx.prisma, ctx.session.user.id, input);
    }),
});
```

### 7.2. Router `availability`

```typescript
export const availabilityRouter = createTRPCRouter({
  // Obtener matriz de disponibilidad del jugador actual
  getMine: protectedProcedure.query(async ({ ctx }) => {
    return availabilityEngine.getByPlayerId(ctx.prisma, ctx.session.user.id);
  }),

  // Obtener matriz de disponibilidad de otro jugador (para capitanes al invitar)
  getByPlayerId: protectedProcedure
    .input(z.object({ playerId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verificar que el viewer es capitán (ownership check)
      return availabilityEngine.getByPlayerId(ctx.prisma, input.playerId);
    }),

  // Toggle una franja (optimistic UI)
  toggleSlot: protectedProcedure
    .input(z.object({
      dayOfWeek: z.number().min(0).max(6),
      timeSlot: z.number().min(0).max(11),
    }))
    .mutation(async ({ ctx, input }) => {
      return availabilityEngine.toggleSlot(ctx.prisma, ctx.session.user.id, input);
    }),

  // Setear múltiples franjas de golpe (configuración inicial)
  setSlots: protectedProcedure
    .input(z.object({
      slots: z.array(z.object({
        dayOfWeek: z.number().min(0).max(6),
        timeSlot: z.number().min(0).max(11),
        status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      return availabilityEngine.setSlots(ctx.prisma, ctx.session.user.id, input.slots);
    }),
});
```

---

## 8. Reglas de Negocio Críticas

### 8.1. Onboarding

| Regla | Comportamiento |
|-------|----------------|
| Obligatorio | El usuario no puede acceder a rutas protegidas hasta completar el onboarding. |
| `displayName` requerido | Campo obligatorio. Mínimo 1 carácter, máximo 50. |
| Teléfono opcional | Puede dejarse vacío en onboarding y completarse después. |
| Disponibilidad default | Todas las 84 franjas (7×12) se crean como `AVAILABLE` al registrar el usuario. |
| Re-entrada | Si abandona, retoma donde quedó. Se guarda estado parcial en `Profile`. |

### 8.2. Disponibilidad Horaria

| Regla | Comportamiento |
|-------|----------------|
| Creación automática | Al crear `Player`, se generan las 84 filas de `PlayerAvailability` con `status = AVAILABLE`. |
| Toggle individual | Tap en una celda cambia `AVAILABLE` ↔ `UNAVAILABLE`. |
| No restringe invitación | Un jugador `UNAVAILABLE` en una franja igual puede ser invitado. El sistema marca conflicto (amarillo) pero no bloquea. |
| Conflicto automático | Si un jugador tiene `AVAILABLE` en una franja donde tiene partido programado, la UI muestra `CONFLICT` (amarillo). |
| Edición post-partido | Si un partido se aplaza o cancela, el conflicto desaparece automáticamente (se recalcula en runtime). |

### 8.3. Visibilidad de Teléfono

| Regla | Comportamiento |
|-------|----------------|
| Capitán → Gestores | Todo capitán de equipo activo tiene teléfono visible para cualquier gestor autenticado. |
| Jugador en equipo → Capitán de SU equipo | Solo el capitán de su propio equipo ve su teléfono. |
| Fuera de equipo | Nadie ve el teléfono. |
| Sin teléfono | Si el usuario no completó el campo, nadie ve nada. |

---

## 9. Estados de Disponibilidad (Expandibles)

Actualmente hay 2 estados en BD + 1 calculado:

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `AVAILABLE` | Persistido | Puede jugar en esta franja. |
| `UNAVAILABLE` | Persistido | No puede jugar en esta franja. |
| `CONFLICT` | Calculado | Tiene partido programado en esta franja (aunque esté AVAILABLE). |

**Estados previsibles para futuras expansiones:**

| Estado | Descripción |
|--------|-------------|
| `PREFERRED` | Franja preferida (para sugerencias de horario) |
| `TENTATIVE` | Podría jugar, pero no está confirmado |

> **Nota:** Para agregar un nuevo estado, modificar el enum `AvailabilityStatus` y actualizar la UI para reflejar el nuevo color/comportamiento.

---

## 10. Checklist de Implementación

- [ ] Implementar schema Prisma (`Profile`, `Player`, `PlayerAvailability`)
- [ ] Crear seed que genere las 84 franjas de disponibilidad al registrar un usuario
- [ ] Implementar middleware de redirección a `/onboarding` si el perfil está incompleto
- [ ] Crear página `/onboarding` con paso de datos personales
- [ ] Crear componente de matriz de disponibilidad (7×12, tap para toggle)
- [ ] Implementar mutations tRPC con optimistic updates
- [ ] Implementar motor `profile.engine.ts` (CRUD de perfil, visibilidad de teléfono)
- [ ] Implementar motor `availability.engine.ts` (toggle, set masivo, cálculo de conflicto)
- [ ] Crear hooks de feature: `useProfile`, `useAvailability`, `useOnboardingStatus`
- [ ] Implementar guardas de ruta para bloquear acceso pre-onboarding
- [ ] Definir paleta de colores para estados de disponibilidad (verde, gris, amarillo)

---

## 11. Dependencias con Otros Sistemas

| Sistema | Dependencia | Descripción |
|---------|-------------|-------------|
| Sistema 1: Auth & RBAC | Requiere | `User` y `Profile` son creados por el flujo de auth. Los roles determinan qué puede editar. |
| Sistema 3: Equipos | Provee datos | `TeamMembership` determina si un jugador está en equipo (afecta visibilidad de teléfono). |
| Sistema 4: Reclutamiento | Consume datos | Los capitanes consultan disponibilidad de jugadores al invitar. |
| Sistema 7: Partidos | Consume datos | Los partidos programados cruzan con disponibilidad para calcular `CONFLICT`. |
| Sistema 10: Resultados | Provee datos | Las estadísticas individuales se muestran en el perfil (vista, no almacenamiento). |
| Sistema 11: Notificaciones | Notifica | Cambios de disponibilidad no requieren notificación. Onboarding completo podría notificar. |

---

> **Documento versionado.** Cualquier modificación requiere revisión y aprobación antes de implementar.
