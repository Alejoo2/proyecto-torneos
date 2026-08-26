# Sistema 5: Canchas / Sedes

> **Estado:** Especificado (Iterando)  
> **Propósito:** Documento de diseño técnico del sistema de gestión de canchas/sedes, franjas de disponibilidad horaria y relación con torneos. Sujeto a revisión conforme se especifiquen los demás sistemas.

---

## 1. Visión del Sistema

Sistema de administración de sedes deportivas (canchas). Las canchas son entidades públicas creadas y gestionadas por el **admin**. Los **gestores** operan libremente en cualquier cancha habilitada para crear torneos, pero no pueden editarlas.

La disponibilidad de una cancha se define por **franjas horarias de 2h** (mismo sistema de franjas que la disponibilidad del jugador: 0-11, 00:00-02:00 a 22:00-00:00). El admin habilita/deshabilita franjas específicas. Si todas las franjas de un día están deshabilitadas, la cancha está cerrada ese día. Si se necesita la cancha para un evento externo, se deshabilitan las franjas correspondientes — esto dispara la lógica de aplazamiento/reubicación de torneos afectados.

Los horarios se configuran con una **ventana de 2 semanas** de anticipación. Esto permite planificación sin problemas de límite de semana (lunes a domingo).

La cancha es el nivel superior de la jerarquía de datos: `Cancha → Torneo → Equipo → Partido`.

---

## 2. Decisiones de Diseño

| Decisión | Valor | Justificación |
|----------|-------|---------------|
| **Canchas públicas** | Sí | Creadas por admin. Cualquier gestor habilitado puede usarlas. |
| **Gestores no editan** | Sí | Solo admin tiene `court:edit`. Los gestores son usuarios, no propietarios. |
| **Franjas de 2h** | Sí | Coherente con el sistema de disponibilidad del jugador (Sistema 2). 12 franjas por día. |
| **Deshabilitación por franja** | Sí | El admin deshabilita franjas específicas, no "horario de cierre". Si todas las franjas de un día están deshabilitadas, la cancha está cerrada ese día. |
| **Ventana de 2 semanas** | Sí | Los horarios se configuran con 2 semanas de anticipación. Evita problemas de planificación en el límite de semana. |
| **Inventario informativo** | String libre | No es estructurado ni bloqueante. Solo descripción de implementos. |
| **Deshabilitación de franja suspende torneos** | Sí | Si una franja con torneo programado se deshabilita, el torneo/partido afectado pasa a pendiente de reubicación. |
| **Sin coordenadas geográficas** | Sí | El mapa (Sistema 12) usa posiciones relativas al frontend. La BD no guarda lat/lng ni posiciones de pin. |
| **Sin categorías de cancha** | Sí | No hay tipos (5, 7, 11, techada, etc.). Todas las canchas son iguales en el modelo. |
| **Sin carga de archivos** | Ningún sistema | No hay fotos de cancha. Descripción textual + mapa vectorizado. |

---

## 3. Modelo de Datos (Prisma Schema)

### 3.1. Cancha

```prisma
model Court {
  id          String      @id @default(cuid())
  name        String      @unique
  address     String      // Dirección textual
  description String?     @db.Text
  inventory   String?     @db.Text // Inventario de implementos (informativo)
  status      CourtStatus @default(ENABLED)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  availability CourtAvailability[]
  // tournaments Tournament[]  // Sistema 6
}

enum CourtStatus {
  ENABLED
  DISABLED
}
```

> **Nota:** `CourtStatus.DISABLED` deshabilita la cancha **completamente** (todas las franjas, todos los días). Es diferente de deshabilitar franjas específicas via `CourtAvailability`.

### 3.2. Disponibilidad por Franja

```prisma
model CourtAvailability {
  id        String   @id @default(cuid())
  courtId   String
  date      DateTime @db.Date // Fecha específica (con ventana de 2 semanas)
  timeSlot  Int      // 0 = 00:00-02:00, ..., 11 = 22:00-00:00
  status    CourtAvailabilityStatus @default(AVAILABLE)

  court Court @relation(fields: [courtId], references: [id], onDelete: Cascade)

  @@unique([courtId, date, timeSlot])
  @@index([courtId, date])
}

enum CourtAvailabilityStatus {
  AVAILABLE    // La cancha puede usarse en esta franja
  UNAVAILABLE  // La cancha está reservada/cerrada en esta franja
}
```

> **Regla:** Las filas de `CourtAvailability` se generan automáticamente para las próximas 2 semanas al crear la cancha. El admin solo modifica las que quiere deshabilitar. Las fechas pasadas se pueden archivar/purgar periódicamente.

### 3.3. Mapa de Franjas Horarias

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

## 4. Flujo de Administración de Cancha

### 4.1. Creación (Admin)

```
Admin accede a panel de canchas
    ↓
Ingresa: nombre, dirección, descripción, inventario
    ↓
Sistema crea Court con status = ENABLED
    ↓
Sistema genera automáticamente CourtAvailability para las próximas 2 semanas
    (84 franjas por semana × 2 = 168 filas, todas AVAILABLE por defecto)
    ↓
Admin puede deshabilitar franjas específicas según necesidad
    ↓
Cancha disponible para gestores
```

### 4.2. Edición de Disponibilidad (Admin)

```
Admin accede a matriz de disponibilidad de la cancha
    ↓
Vista de 2 semanas (14 días × 12 franjas)
    ↓
Admin tap/clic en una franja para toggle AVAILABLE ↔ UNAVAILABLE
    ↓
Si la franja tiene torneo programado:
  - Sistema alerta: "Esta franja tiene torneo programado. ¿Deseas deshabilitar y suspender?"
  - Si confirma: franja pasa a UNAVAILABLE + torneo/partido afectado pasa a PENDING_RELOCATION
    ↓
Sistema actualiza CourtAvailability
```

### 4.3. Deshabilitación Total (Admin)

```
Admin deshabilita una cancha completamente (Court.status = DISABLED)
    ↓
Sistema:
  - Todas las franjas pasan a UNAVAILABLE
  - Todos los torneos activos pasan a SUSPENDED
  - Notifica a gestores afectados (Sistema 11)
    ↓
Gestores deben reubicar/reasignar horarios (Sistema 6)
```

### 4.4. Ventana de 2 Semanas

```
Hoy: 2026-08-25 (Martes)
Ventana activa: 2026-08-25 a 2026-09-07 (14 días)
    ↓
Cada día a las 00:00, el sistema:
  - Elimina/purga filas de CourtAvailability para fechas pasadas
  - Genera nuevas filas para mantener siempre 14 días hacia adelante
    ↓
El admin siempre ve y puede planificar 2 semanas adelante
```

---

## 5. Reglas de Negocio Críticas

### 5.1. Cancha

| Regla | Comportamiento |
|-------|----------------|
| Nombre único | El nombre de la cancha debe ser único en la plataforma (case-insensitive). |
| Solo admin crea | Requiere permiso `court:create`. |
| Solo admin edita | Requiere permiso `court:edit`. |
| Solo admin deshabilita totalmente | Requiere permiso `court:disable`. Cambia `Court.status = DISABLED`. |
| Gestor usa libremente | Cualquier gestor habilitado (`Manager.isActive = true`) puede crear torneos en cualquier cancha `ENABLED` con franjas `AVAILABLE`. |
| Sin propiedad | Las canchas no tienen "dueño". No hay relación `Court.managerId`. |

### 5.2. Disponibilidad por Franja

| Regla | Comportamiento |
|-------|----------------|
| Default AVAILABLE | Al crear la cancha, todas las franjas de las próximas 2 semanas se generan como `AVAILABLE`. |
| Deshabilitación por franja | El admin toggle una franja a `UNAVAILABLE`. Esto "cierra" la cancha solo en esa franja específica. |
| Franja con torneo | Si se deshabilita una franja que tiene torneo/partido programado, el sistema alerta y suspende el torneo/partido afectado. |
| Cierre de día | Si las 12 franjas de un día están `UNAVAILABLE`, la cancha está cerrada ese día. No hay estado de "cierre" separado. |
| Ventana de 2 semanas | Siempre se mantienen 14 días de disponibilidad generados. Las fechas pasadas se purgan automáticamente. |
| Generación automática | Un cron job o trigger diario genera las franjas del día 15 y purga las del día -1. |
| Coherencia con jugador | Mismo sistema de franjas (0-11, 2h) que `PlayerAvailability` (Sistema 2). |

### 5.3. Deshabilitación Total

| Regla | Comportamiento |
|-------|----------------|
| Trigger | Admin cambia `Court.status` a `DISABLED`. |
| Efecto en franjas | Todas las `CourtAvailability` pasan a `UNAVAILABLE`. |
| Efecto en torneos | Todos los torneos con estado `IN_PROGRESS` o `SCHEDULED` pasan a `SUSPENDED`. |
| Notificación | Gestores afectados reciben notificación (Sistema 11). |
| Re-habilitación | Al volver a `ENABLED`, las franjas no se reactivan automáticamente. El admin debe re-habilitarlas manualmente. |
| No eliminación | Las canchas no se eliminan físicamente. Se deshabilitan para preservar historial. |

### 5.4. Ventana de 2 Semanas

| Regla | Comportamiento |
|-------|----------------|
| Alcance | Siempre hay disponibilidad generada para hoy + 13 días (total 14 días). |
| Generación | Al crear la cancha, se generan 168 filas (14 días × 12 franjas). |
| Mantenimiento | Diariamente a las 00:00, se purgan fechas pasadas y se genera el día 15. |
| Planificación | El gestor solo puede crear torneos dentro de la ventana de 2 semanas. |
| Límite de semana | La ventana de 2 semanas evita el problema de "qué pasa el domingo a la noche" — siempre hay 2 semanas de buffer. |

---

## 6. Endpoints tRPC Sugeridos

### 6.1. Router `court` (Admin)

```typescript
export const courtRouter = createTRPCRouter({
  // ─── CRUD ───

  // Crear cancha (genera automáticamente 2 semanas de disponibilidad)
  create: permissionProcedure("court:create")
    .input(z.object({
      name: z.string().min(2).max(100),
      address: z.string().min(5).max(300),
      description: z.string().max(1000).optional(),
      inventory: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.create(ctx.prisma, input);
    }),

  // Actualizar datos básicos de cancha
  update: permissionProcedure("court:edit")
    .input(z.object({
      courtId: z.string(),
      name: z.string().min(2).max(100).optional(),
      address: z.string().min(5).max(300).optional(),
      description: z.string().max(1000).optional().nullable(),
      inventory: z.string().max(1000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.update(ctx.prisma, input);
    }),

  // Deshabilitar cancha completamente
  disable: permissionProcedure("court:disable")
    .input(z.object({ courtId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.disable(ctx.prisma, input.courtId);
    }),

  // Habilitar cancha completamente
  enable: permissionProcedure("court:disable")
    .input(z.object({ courtId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.enable(ctx.prisma, input.courtId);
    }),

  // ─── Disponibilidad ───

  // Obtener matriz de disponibilidad de una cancha (2 semanas)
  getAvailability: protectedProcedure
    .input(z.object({
      courtId: z.string(),
      startDate: z.date().optional(), // Default: hoy
    }))
    .query(async ({ ctx, input }) => {
      return courtEngine.getAvailability(ctx.prisma, input);
    }),

  // Toggle franja de disponibilidad (admin)
  toggleAvailability: permissionProcedure("court:edit")
    .input(z.object({
      courtId: z.string(),
      date: z.date(),
      timeSlot: z.number().min(0).max(11),
    }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.toggleAvailability(ctx.prisma, input);
    }),

  // Setear múltiples franjas de golpe
  setAvailability: permissionProcedure("court:edit")
    .input(z.object({
      courtId: z.string(),
      slots: z.array(z.object({
        date: z.date(),
        timeSlot: z.number().min(0).max(11),
        status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      return courtEngine.setAvailability(ctx.prisma, input);
    }),

  // ─── Consulta ───

  // Listar todas las canchas (público para autenticados)
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["ENABLED", "DISABLED", "ALL"]).default("ALL"),
      page: z.number().min(1).default(1),
      pageSize: z.number().min(1).max(50).default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      return courtEngine.list(ctx.prisma, input);
    }),

  // Obtener cancha por ID (público para autenticados)
  getById: protectedProcedure
    .input(z.object({ courtId: z.string() }))
    .query(async ({ ctx, input }) => {
      return courtEngine.getById(ctx.prisma, input.courtId);
    }),
});
```

---

## 7. Motores de Negocio (Core)

### 7.1. `court.engine.ts`

```typescript
// server/core/court/court.engine.ts

export async function create(
  prisma: PrismaClient,
  input: CreateCourtInput
) {
  // 1. Verificar unicidad de nombre
  const exists = await prisma.court.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });
  if (exists) {
    throw new TRPCError({ code: "CONFLICT", message: "Ya existe una cancha con ese nombre" });
  }

  // 2. Crear cancha + generar 2 semanas de disponibilidad en transacción
  const court = await prisma.$transaction(async (tx) => {
    const created = await tx.court.create({
      data: {
        name: input.name,
        address: input.address,
        description: input.description,
        inventory: input.inventory,
        status: "ENABLED",
      },
    });

    // Generar 14 días × 12 franjas = 168 filas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const availabilityData = [];

    for (let day = 0; day < 14; day++) {
      const date = new Date(today);
      date.setDate(today.getDate() + day);
      for (let slot = 0; slot < 12; slot++) {
        availabilityData.push({
          courtId: created.id,
          date,
          timeSlot: slot,
          status: "AVAILABLE",
        });
      }
    }

    await tx.courtAvailability.createMany({ data: availabilityData });

    return created;
  });

  return court;
}

export async function toggleAvailability(
  prisma: PrismaClient,
  input: { courtId: string; date: Date; timeSlot: number }
) {
  // 1. Verificar que la cancha existe y está ENABLED
  // 2. Buscar la franja específica
  // 3. Si la franja tiene torneo programado y se va a deshabilitar:
  //    - Alertar o suspender torneo/partido (Sistema 6/7)
  // 4. Toggle status AVAILABLE ↔ UNAVAILABLE
}

export async function disable(
  prisma: PrismaClient,
  courtId: string
) {
  // 1. Verificar que la cancha existe y está ENABLED
  // 2. En transacción:
  //    a. Court.status = DISABLED
  //    b. Todas las CourtAvailability → UNAVAILABLE
  //    c. Torneos IN_PROGRESS/SCHEDULED → SUSPENDED
  //    d. Notificar gestores (Sistema 11)
}

export async function maintainAvailabilityWindow(
  prisma: PrismaClient
) {
  // Cron job diario:
  // 1. Eliminar CourtAvailability para fechas < hoy
  // 2. Para cada cancha ENABLED, generar filas para el día 15
  // 3. Todas las nuevas franjas → AVAILABLE por defecto
}
```

### 7.2. Helpers de disponibilidad

```typescript
// server/core/court/court.helpers.ts

export function isCourtAvailableAt(
  availability: CourtAvailability[],
  date: Date,
  timeSlot: number
): boolean {
  const slot = availability.find(
    (a) => a.date.toDateString() === date.toDateString() && a.timeSlot === timeSlot
  );
  return slot?.status === "AVAILABLE" ?? false;
}

export function getAvailableSlotsForDate(
  availability: CourtAvailability[],
  date: Date
): number[] {
  return availability
    .filter((a) => a.date.toDateString() === date.toDateString() && a.status === "AVAILABLE")
    .map((a) => a.timeSlot);
}
```

---

## 8. Seguridad y Validaciones

### 8.1. Capa 1: Autenticación

- Todos los endpoints requieren sesión activa (`protectedProcedure`).

### 8.2. Capa 2: Autorización por Permiso

| Endpoint | Requiere |
|----------|----------|
| `court.create` | `court:create` (admin) |
| `court.update` | `court:edit` (admin) |
| `court.disable` | `court:disable` (admin) |
| `court.enable` | `court:disable` (admin) |
| `court.toggleAvailability` | `court:edit` (admin) |
| `court.setAvailability` | `court:edit` (admin) |
| `court.getAvailability` | Cualquier usuario autenticado |
| `court.list` | Cualquier usuario autenticado |
| `court.getById` | Cualquier usuario autenticado |

### 8.3. Capa 3: Validación de Estado

| Acción | Validación |
|--------|------------|
| Crear | Nombre único. Generación automática de 168 franjas. |
| Editar datos | Cancha existe. Si cambia nombre: único. |
| Toggle franja | Cancha `ENABLED`. Fecha dentro de la ventana de 2 semanas. Si deshabilita con torneo: alerta/suspensión. |
| Deshabilitar total | Cancha existe y está `ENABLED`. Suspender torneos activos. |
| Habilitar total | Cancha existe y está `DISABLED`. |
| Consultar disponibilidad | Cancha existe. Fecha opcional (default hoy). |

---

## 9. UI / UX (Anotación Flexible)

> Esta sección es orientativa. El diseño visual detallado se define en documentos aparte. Aquí se describen patrones y comportamientos clave.

### 9.1. Panel de Admin — Matriz de Disponibilidad

```
┌─────────────────────────────────────────────────────────────┐
│  Cancha El Parque — Disponibilidad                          │
│  Semana: 25 Ago - 7 Sep  [◀ Semana anterior] [Siguiente ▶] │
│                                                             │
│         Dom   Lun   Mar   Mié   Jue   Vie   Sáb             │
│  00-02   ✓     ✓     ✓     ✓     ✓     ✓     ✓             │
│  02-04   ✓     ✓     ✓     ✓     ✓     ✓     ✓             │
│  04-06   ✓     ✗     ✓     ✓     ✓     ✓     ✓             │
│  ...     ...   ...   ...   ...   ...   ...   ...           │
│  18-20   ✓     ✗     ✗     ✓     ✓     ✓     ✓             │
│  20-22   ✓     ✗     ✗     ✓     ✓     ✓     ✓             │
│  22-00   ✓     ✓     ✓     ✓     ✓     ✓     ✓             │
│                                                             │
│  ✓ = Disponible  ✗ = No disponible  🏆 = Torneo programado │
│                                                             │
│  [Guardar cambios]                                          │
└─────────────────────────────────────────────────────────────┘
```

### 9.2. Comportamiento de la Matriz

- **Tap/clic en celda:** Toggle `AVAILABLE` ↔ `UNAVAILABLE`.
- **Celdas con torneo:** Se marcan con un ícono (🏆). Si se intenta deshabilitar, aparece alerta de confirmación.
- **Navegación por semanas:** Flechas para moverse entre semanas dentro de la ventana de 2 semanas.
- **Deshabilitar día completo:** Botón "Cerrar día" que deshabilita las 12 franjas de un día.
- **Deshabilitar cancha:** Botón separado para deshabilitar la cancha completamente (afecta todos los torneos).

### 9.3. Vista Pública de Cancha

```
┌─────────────────────────────────────────────┐
│  🏟️ Cancha El Parque                        │
│  📍 Calle 123 #45-67, Barrio Central        │
│  ● Habilitada                               │
│                                             │
│  Descripción                                │
│  Lorem ipsum dolor sit amet...              │
│                                             │
│  Disponibilidad esta semana                 │
│  [Mini matriz resumida: días disponibles]   │
│                                             │
│  Implementos                                │
│  Arcos, redes, 4 pelotas, vestuarios        │
│                                             │
│  [Ver en mapa]  [Ver torneos activos]       │
└─────────────────────────────────────────────┘
```

### 9.4. Mapa (Sistema 12) — Nota de Integración

- La cancha **no guarda coordenadas** en la BD.
- El mapa es una imagen vectorizada (SVG) con pines posicionados por coordenadas relativas a la imagen (%, vw/vh).
- La posición del pin se define en el frontend, posiblemente hardcodeada en un archivo de configuración o asignada visualmente en un panel de admin futuro.
- Al hacer click en un pin, se abre un modal con datos de la cancha (fetched de `court.getById`).
- El modal se posiciona relativo al viewport, no al SVG, usando las coordenadas porcentuales del pin transformadas según el zoom/pan actual.
- Las tres capas (background, SVG, UI) usan `isolate` para stacking contexts independientes.
- Motion One maneja animaciones de zoom/pan y apertura de modal.

> **Nota técnica:** Si en el futuro se requiere un panel visual para posicionar pines, se puede agregar un campo `mapPosition` (JSON con `%x, %y`) a `Court` sin romper la arquitectura actual. Por ahora, no se persiste nada.

---

## 10. Checklist de Implementación

- [ ] Implementar schema Prisma (`Court`, `CourtAvailability`)
- [ ] Ejecutar migración de base de datos
- [ ] Implementar motor `court.engine.ts` (CRUD, generación de franjas, toggle, deshabilitación total)
- [ ] Implementar helpers `court.helpers.ts` (validación de disponibilidad, consulta de franjas)
- [ ] Crear router `court` en tRPC
- [ ] Implementar middleware de permisos para admin
- [ ] Crear cron job para mantenimiento de ventana de 2 semanas (`maintainAvailabilityWindow`)
- [ ] Crear panel de admin para gestión de canchas (lista, crear, editar datos básicos)
- [ ] Crear matriz de disponibilidad interactiva (14 días × 12 franjas, tap para toggle)
- [ ] Implementar alerta al deshabilitar franja con torneo programado
- [ ] Implementar suspensión automática de torneos al deshabilitar cancha totalmente
- [ ] Crear vista pública de cancha (perfil de sede + mini matriz)
- [ ] Implementar validación de disponibilidad en creación de torneos (Sistema 6 consume este motor)
- [ ] Crear hooks de feature: `useCourts`, `useCourt`, `useCourtAvailability`
- [ ] Integrar con Sistema 11 para notificaciones de suspensión

---

## 11. Dependencias con Otros Sistemas

| Sistema | Dependencia | Descripción |
|---------|-------------|-------------|
| Sistema 1: Auth & RBAC | Requiere | Permisos `court:create`, `court:edit`, `court:disable`. Verificación de admin. |
| Sistema 2: Usuarios/Perfiles | Ninguna directa | — |
| Sistema 3: Equipos | Ninguna directa | — |
| Sistema 4: Reclutamiento | Ninguna directa | — |
| Sistema 6: Torneos | Provee datos | Los torneos pertenecen a una cancha. Disponibilidad de franjas limita creación de torneos. |
| Sistema 7: Partidos | Ninguna directa | Los partidos heredan la cancha vía el torneo. |
| Sistema 10: Resultados | Ninguna directa | — |
| Sistema 11: Notificaciones | Notifica | Deshabilitación de franja/cancha notifica a gestores afectados. |
| Sistema 12: Mapa | Consume datos | El mapa muestra canchas habilitadas. Datos fetched de `court.list`. |

---

> **Documento versionado.** Cualquier modificación requiere revisión y aprobación antes de implementar.
