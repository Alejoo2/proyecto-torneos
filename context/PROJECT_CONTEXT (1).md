# Contexto del Proyecto: Plataforma de Gestión de Torneos de Barrio

> **Estado:** Aprobado y Bloqueado (Fase de Conocimiento)  
> **Última actualización:** 2026-08-26  
> **Propósito:** Fuente única de verdad de contexto para cualquier asistente de IA o desarrollador. Antes de generar código, revisar este documento en su totalidad. Para detalle técnico, consultar los `.md` de cada sistema.

---

## 1. Visión del Producto

Plataforma web **mobile-first** para la gestión de torneos de microfútbol en canchas barriales. La estética es urbana: inspirada en HipHop, Graffiti y FIFA Street. El objetivo es digitalizar la organización de torneos de barrio — desde la creación de canchas y torneos, pasando por reclutamiento de jugadores, hasta la gestión de partidos, aplazamientos y estadísticas.

---

## 2. Stack Tecnológico Base

| Tecnología | Decisión | Justificación |
|---|---|---|
| **Framework** | Next.js (App Router) | SSR/SSG nativo, optimización de imágenes, límites estrictos Server/Client para rendimiento mobile-first. |
| **Lenguaje** | TypeScript (Strict) | Tipado end-to-end. Previene errores en runtime y sirve como documentación viva. |
| **API** | tRPC | Elimina la fricción de REST. Los tipos del backend se infieren automáticamente en el frontend (DRY máximo). |
| **Validación** | Zod | Se usa en el backend (tRPC) y en el frontend (formularios). Un solo schema, doble propósito. |
| **ORM / DB** | Prisma + PostgreSQL | Prisma genera tipos TS desde el schema. PostgreSQL garantiza integridad relacional para lógicas de horarios y cruces. |
| **Estilos** | Tailwind CSS + Shadcn/UI | Tailwind acelera el desarrollo UI. Shadcn da componentes accesibles y customizables (no es una dependencia bloqueante). |
| **Animaciones** | Motion One | Ligero, orientado a performance. No Framer Motion por peso. |
| **Auth** | NextAuth.js | Solución estándar para Next.js. Permite Social Login (Google + Discord) rápido, vital para UX mobile. |
| **Deploy** | Vercel | Integración nativa con Next.js. Serverless functions para tRPC y cero configuración de infraestructura. |

---

## 3. Principios Rectores (Reglas Inamovibles)

### 3.1. Filosofía DRY (Don't Repeat Yourself)
- Tipos, validaciones y lógica de negocio se definen **una sola vez**.
- Si la BD cambia, Prisma avisa a tRPC, que avisa al Frontend. No hay sincronización manual.

### 3.2. Cero CSS Inline
- **Prohibido** el uso de la prop `style={{ }}` en React.
- Inline styles rompen la especificidad de Tailwind, imposibilitan la gestión de estados (hover, focus) y violan el principio de estilos centralizados.
- Todo se resuelve con clases Tailwind o variantes `cva`.

### 3.3. No Barrel Exports (Prohibidos)
- No se crean archivos `index.ts` que re-exportan componentes o hooks.
- **Por qué:** enmascaran la fuente real, confunden los límites Server/Client de Next.js App Router, y pueden generar problemas de Tree-shaking y dependencias circulares.
- **Corolario:** Los imports serán explícitos: `from "@/components/ui/button/button"`.

---

## 4. Estructura de Directorios

```
src/
├─ app/                     # Next.js App Router
│  └─ Route Groups: (auth), (public), (app)
├─ components/
│  ├─ ui/                   # Componentes de presentación pura (átomos/moléculas/organismos)
│  │                        #   - Sin lógica de negocio
│  │                        #   - Sin hooks de tRPC
│  │                        #   - Sin conocimiento de roles
│  │                        #   - Pueden ser Server Components por defecto
│  └─ templates/            # Composición de páginas (Smart components)
│                            #   - Conectan datos/roles con componentes ui/
│                            #   - Inyectan props a los componentes ui/
├─ components/features/     # Features con hooks co-localizados
│  └─ [feature]/
│      └─ use-[feature].ts  # Hooks de dominio/tRPC específicos de la feature
├─ server/
│  ├─ api/
│  │  ├─ routers/           # tRPC Routers (auth, team, tournament, match, etc.)
│  │  │                    #   - Solo validan inputs (Zod) y devuelven outputs
│  │  ├─ root.ts
│  │  └─ trpc.ts
│  ├─ core/                 # Lógica de Negocio Pura (Motores/Engines)
│  │  ├─ rbac/              # Motor de permisos
│  │  ├─ court/             # Motor de canchas
│  │  ├─ team/              # Motor de equipos
│  │  ├─ recruitment/       # Motor de reclutamiento
│  │  ├─ tournament/        # Motor de torneos (incluye Sala de Cine)
│  │  ├─ match/             # Motor de partidos y aplazamientos
│  │  ├─ stats/             # Motor de resultados y estadísticas
│  │  └─ notification/      # Motor de notificaciones
│  ├─ db/                   # Prisma client & Schema
│  └─ auth.ts
├─ hooks/                   # Solo hooks genéricos de React (useDebounce, useMediaQuery)
└─ trpc/                    # Config tRPC client/server
```

---

## 5. Arquitectura Frontend (UI/UX)

### 5.1. Patrón: "UI Tonto / Template Inteligente"
- Se abandona Atomic Design puro.
- **`ui/`**: Componentes de presentación pura. Solo renderizan props. NO usan hooks de tRPC. NO saben de roles.
- **`templates/`**: Composición de páginas. Hidratan los componentes `ui/` con datos y permisos.
- **Por qué:** Next.js App Router empuja los Server Components. Los componentes `ui/` al ser "tontos", pueden ser Server Components por defecto y solo hidratarse en el cliente cuando el Template lo requiere. Maximiza la reutilización.

### 5.2. Gestión de Estilos: Variantes Separadas (cva)
- Para componentes complejos, la definición de variantes de Tailwind (`cva`) se extrae a un archivo `.variants.ts` hermano del componente.
- **Ejemplo:** `button.tsx` + `button.variants.ts`
- **Por qué:** Meter `cva` inline en el componente lo hace ilegible cuando hay muchas variantes. Separar responsabilidades mantiene el JSX limpio.

### 5.3. Librería de Componentes Base
- Usar **Shadcn/UI** como base atómica.
- No es una librería npm instalada; el código se copia al proyecto.
- Permite modificar la base a la estética "Urbana/FIFA Street" sin pelear contra el API de una librería externa.

### 5.4. Hooks: Clasificación y Co-localización
- **Hooks Genéricos** (`useDebounce`, `useMediaQuery`): Viven en `src/hooks/`.
- **Hooks de Dominio/Datos** (tRPC queries/mutations, lógica específica): Se usan en los Templates o se co-localizan en la carpeta de la Feature correspondiente (`src/components/features/team/use-team.ts`).
- **Prohibición:** Los componentes en `ui/` **NUNCA** consumen hooks de datos (`api.team.useQuery`). Los datos se inyectan desde el Template vía Props.
- **Por qué:** Una carpeta global `src/hooks/` se convierte en un "cajón de sastre" donde hooks de UI se mezclan con lógica de negocio. Co-localizando, si se borra una feature, se borra su hook asociado.

---

## 6. Arquitectura Backend (Lógica y Datos)

### 6.1. Patrón: Routers tRPC + Motores de Dominio (Core)
- **`server/api/routers/`**: Validan inputs (Zod) y devuelven outputs. Son delgados.
- **`server/core/`**: Contienen la lógica de negocio pura (ej. `tournament.engine.ts`).
- **Por qué:** Evitar el patrón "God Router" donde tRPC acumula lógica compleja. Aislando la lógica en `core/`, las funciones se pueden testear unitariamente sin levantar Next.js ni mockear tRPC. tRPC es solo el transportador.

### 6.2. No REST Interno
- Toda comunicación Front <-> Back se hace vía **tRPC**.
- **Por qué:** REST requiere definir URLs, controladores y tipar manualmente respuestas. tRPC hace esto automático.
- **Excepción:** Solo se expondrá REST si un servicio externo (ej. Webhook de MercadoPago) lo requiere.

---

## 7. Módulos del Dominio y Reglas de Negocio Críticas

> **Nota:** Para especificación técnica completa de cada sistema, consultar su `.md` correspondiente. Este documento describe las reglas de negocio de alto nivel.

### 7.1. Auth & RBAC (Sistema 1)
- **Roles:** Admin, Gestor, Jugador/Capitán.
- **Registro:** Todo usuario se crea automáticamente como **jugador** (`Player`). No hay elección de rol en el registro.
- **Capitanía:** Un jugador solo puede ser **Capitán de 1 equipo activo a la vez**. La capitanía es transferible con aceptación obligatoria.
- **Gestores:** El admin asigna el rol `manager` manualmente a cuentas existentes. No hay flujo de solicitud.
- **Asistentes/Vástagos:** El **admin** asigna permisos granulares (ej: `match:postpone`, `match:result`). El gestor **no** delega permisos.
- Motor de permisos en `server/core/rbac/`.

### 7.2. Usuarios / Perfiles (Sistema 2)
- Datos personales, onboarding post-OAuth obligatorio.
- **Disponibilidad Horaria:** Matriz 7×12 franjas de 2h. El usuario tap para toggle AVAILABLE/UNAVAILABLE.
- **Conflicto:** Estado `CONFLICT` (amarillo) calculado en runtime cruzando disponibilidad con partidos programados. No se guarda en BD.
- **Teléfono:** Visibilidad granular. Capitanes visibles para gestores. Jugadores visibles solo para capitán de su equipo.

### 7.3. Equipos & Plantillas (Sistema 3)
- Equipos persistentes e independientes del torneo.
- **Creación:** Mínimo 2 jugadores (creador + invitación aceptada). Creador = capitán.
- **Plantilla única global:** Un solo roster por equipo. No hay plantillas por torneo.
- **Eliminación:** Consenso si 3+ miembros. Bloqueada si torneo en curso.
- **Card Maestra:** 5 slots placeholder puramente visuales.

### 7.4. Reclutamiento (Sistema 4)
- **Unidireccional:** Solo capitanes invitan. Los jugadores son pasivos.
- **Sin conflicto de horario:** La disponibilidad se muestra como dato informativo, no bloquea la invitación.
- **Límite:** 15 miembros activos por equipo. 15 equipos activos máximo por jugador.
- **Sala de Cine:** No aplica aquí. La prereserva es del torneo (Sistema 6).

### 7.5. Canchas / Sedes (Sistema 5)
- Canchas públicas creadas por admin. Gestores las usan libremente.
- **Disponibilidad:** Franjas de 2h (0-11), generadas automáticamente para 2 semanas. Admin toggle AVAILABLE/UNAVAILABLE.
- **Sin coordenadas geográficas:** El mapa usa posiciones relativas al frontend.
- **Deshabilitación total:** Pasa todos los torneos activos a `SUSPENDED`.

### 7.6. Torneos (Sistema 6)
- **Sin aprobación de admin:** El gestor crea y publica directamente.
- **Sala de Cine / Prereserva:** Al ver detalles del torneo, se prereserva un cupo por **5 minutos**. Cooldown visible en UI. Evita race conditions.
- **Inscripción — 2 factores:**
  1. **Disponibilidad:** Mínimo 5 jugadores de la plantilla disponibles en la franja del torneo. Si falla: `PENDING_AVAILABILITY`.
  2. **Pago:** El gestor aprueba manualmente tras verificar pago. Si falla: `REJECTED`.
- **Cupos:** Obligatorio potencia de 2 (2, 4, 8, 16...). No hay byes ni preliminares.
- **Cierre:** Al cerrar inscripciones, sorteo automático de fases. Si hay conflictos sin resolver, el sorteo se ejecuta igual.
- **Franjas:** El torneo se juega en franja única recurrente (mismo día de semana + timeSlot). Reserva atómica interna de 1h45m dentro de franja de 2h.
- **Desaprobación:** El gestor puede desaprobar un equipo aprobado antes del cierre, liberando el cupo.
- **Cancelación:** Gestor solo puede cancelar torneos `DRAFT` o `SCHEDULED`. Si está `IN_PROGRESS`, debe reagendar o reubicar.

### 7.7. Partidos / Aplazamientos (Sistema 7)
- **Sin confirmación de asistencia:** Los partidos se juegan automáticamente según programación.
- **Convocatoria:** Toda la plantilla convocada automáticamente. El capitán marca ausentes (puramente informativo, no afecta horarios).
- **Programación:** Automática al sortear (fechas consecutivas en franja del torneo). El gestor puede reprogramar manualmente.
- **Fases subsiguientes:** Partidos creados vacíos al sortear. Se completan automáticamente al cargar resultados previos.
- **Aplazamiento:** Solo gestor o asistente con permisos. Motivo obligatorio. Capitán **no** puede solicitar.
- **Reagendamiento:** El gestor elige manualmente de franjas disponibles de la cancha. **No** se cruza con disponibilidad de equipos.
- **Resultados:** Cargados por gestor o asistente. Goles + estadísticas individuales (tarjetas azul/amarilla/roja, faltas, autogoles) + observaciones/links.
- **Walkover:** Marcado manualmente por gestor. Penaliza Fair Play. Alternativa: aplazar.
- **Árbitros:** Directorio pasivo (sin login). Asignación manual por gestor a cada partido.

### 7.8. Resultados & Estadísticas (Sistema 10)
- **Persistencia agregada:** Tablas `PlayerStats`, `TeamStats`, `TournamentStanding` se actualizan post-partido. Consultas instantáneas.
- **Partido sin stats no cuenta:** Si un partido no tiene estadísticas individuales cargadas, no entra en el cálculo de "últimos 10 partidos con stats".
- **Fair Play:** `(yellow×1 + red×3 + blue×0.5 + fouls×0.25) / partidosConsiderados`. Métrica informativa. No interviene en algoritmos.
- **Tabla de posiciones:** PJ, PG, PE, PP, GF, GC, DG, Pts. Desempate: Pts → DG → GF → Fair Play → Nombre.
- **Sin upload de archivos:** No hay fotos de planillas. Solo datos numéricos + observaciones/links de texto.

### 7.9. Notificaciones (Sistema 11)
- **Canal único in-app.** Sin email, push, SMS, WhatsApp, Discord.
- **Familias:** `AUTH`, `TEAM`, `RECRUITMENT`, `TOURNAMENT`, `MATCH`, `COURT`, `SYSTEM`.
- **Preferencias:** El usuario puede desactivar familias completas. Las notificaciones siguen generándose en BD pero se ocultan de la bandeja.
- **SYSTEM no desactivable:** Anuncios y mantenimiento siempre visibles.
- **Generación síncrona:** Se crean dentro de la misma transacción Prisma que el evento que las dispara.
- **Badge:** Contador de no leídas, actualizado por polling cada 30 segundos.
- **Árbitros:** No reciben notificaciones (directorio pasivo, sin cuenta).

### 7.10. Mapa / Landing UI (Sistema 12)
- Mapa interactivo **custom** (Canvas/SVG).
- **Sin Google Maps / Mapbox** (dependencias externas innecesarias).
- **Sin coordenadas geográficas en BD:** Posiciones relativas al frontend (%, vw/vh).
- Tags interactivos en las canchas con **long-press** para mobile.
- Tres capas (background, SVG, UI) con `isolate` para stacking contexts independientes.
- Motion One maneja animaciones de zoom/pan y apertura de modal.

---

## 8. Jerarquía de Datos

```
Cancha (Sede)
  └── Torneo
        └── Equipo
              └── Partido
```

- Un **Torneo** pertenece a **1 Cancha**.
- Un **Equipo** se inscribe a **1 Torneo** (por inscripción).
- Un **Partido** involucra equipos de un mismo torneo.

---

## 9. Sistemas Especificados

| # | Sistema | Archivo | Estado |
|---|---------|---------|--------|
| 1 | Auth & RBAC | `SISTEMA_01_AUTH_RBAC.md` | Especificado |
| 2 | Usuarios / Perfiles | `SISTEMA_02_USUARIOS_PERFILES.md` | Especificado |
| 3 | Equipos & Plantillas | `SISTEMA_03_EQUIPOS_PLANTILLAS.md` | Especificado |
| 4 | Reclutamiento | `SISTEMA_04_RECLUTAMIENTO.md` | Especificado |
| 5 | Canchas / Sedes | `SISTEMA_05_CANCHAS_SEDES.md` | Especificado |
| 6 | Torneos | `SISTEMA_06_TORNEOS.md` | Especificado |
| 7 | Partidos / Aplazamientos | `SISTEMA_07_PARTIDOS_APLAZAMIENTOS.md` | Especificado |
| 10 | Resultados & Estadísticas | `SISTEMA_10_RESULTADOS_ESTADISTICAS.md` | Especificado |
| 11 | Notificaciones | `SISTEMA_11_NOTIFICACIONES.md` | Especificado |
| 12 | Mapa / Landing UI | Pendiente | Por especificar |

> **Nota:** Los sistemas 8 y 9 fueron eliminados. Su funcionalidad se integró en otros sistemas (Árbitros en Sistema 7, conceptos misceláneos en Sistemas 6 y 10).

---

## 10. Convenciones de Código (Checklist antes de entregar)

- [ ] ¿Usé `cva` para variantes complejas y las puse en un archivo `.variants.ts`?
- [ ] ¿Mi componente en `ui/` NO usa hooks de tRPC ni conoce roles?
- [ ] ¿Mi Template inyecta datos vía props a los componentes `ui/`?
- [ ] ¿Los hooks de dominio están co-localizados en `components/features/[feature]/`?
- [ ] ¿No creé un `index.ts` de barrel export?
- [ ] ¿No usé `style={{ }}` en ningún componente?
- [ ] ¿La lógica de negocio compleja está en `server/core/` y no en el router tRPC?
- [ ] ¿Usé Zod para validar inputs en tRPC y en formularios?
- [ ] ¿Los tipos se infieren de Prisma / Zod y no los dupliqué manualmente?

---

## 11. Qué NO está en este documento

- Plan de implementación ni roadmap.
- Diseño visual detallado (paleta de colores, tipografías, assets).
- Especificaciones de API externas (webhooks, pagos).
- Estrategia de testing.
- Configuración de CI/CD.
- Detalle técnico de cada sistema (ver `.md` individuales).

> Estos temas se tratan en documentos aparte.

---

> **Documento versionado.** Última actualización: 2026-08-26. Cualquier modificación requiere revisión y aprobación antes de implementar.

DBfutbolCinco
