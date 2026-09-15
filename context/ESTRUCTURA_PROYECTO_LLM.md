# 🗺️ Mapa de Arquitectura y Estructura del Proyecto (`proyecto-torneos`)

> **Propósito para LLMs:** Este documento describe la estructura exacta de archivos del proyecto, la responsabilidad de cada capa de software, las convenciones de desarrollo y el estado actual de implementación para que cualquier modelo de lenguaje pueda comprender la arquitectura sin hacer suposiciones.

---

## 🏗️ 1. Arquitectura General y Tecnologías

El proyecto es un **Stack T3 (Next.js 15 App Router + tRPC v11 + Prisma + NextAuth v5)** para la gestión de torneos de microfútbol con estética Street/Urban (Sistema de Color *Cypher*).

### Principios Fundamentales para LLMs:
1. **Sin REST / Solo tRPC:** Todas las mutaciones y consultas Front ↔ Back se realizan vía procedimientos tRPC (`src/server/api/routers/`).
2. **Capa Core Aislada:** La lógica de negocio NO vive en los routers. Los routers son delgados y delegan inmediatamente a motores en `src/server/core/<modulo>/`.
3. **Persistencia Agregada Atómica:** Los datos derivados (goles, promedios de los últimos 10 partidos, fair play, tablas de posiciones) se calculan y guardan en `$transaction` atómicas en PostgreSQL; NO se calculan con joins dinámicos en runtime.
4. **Patrón UI "Materializar → Sembrar → Vivir":**
   - **RSC (`page.tsx`)**: Lee directamente del backend y pasa `initialData`.
   - **Template (`'use client'`)**: Siembra en TanStack Query (`api.<router>.<procedure>.useQuery`).
   - **Componentes UI (`src/components/ui/`)**: Son renderizadores puros que reciben props y NUNCA importan hooks de datos o tRPC.
5. **No hay Cron Jobs activos:** La expiración de cupos (Sala de Cine) y limpiezas funcionan por purga perezosa (*lazy purge*) en runtime.

---

## 📂 2. Arbol de Directorios del Proyecto

```text
proyecto-torneos/
├── context/                             # 📄 Documentación formal de arquitectura (Sistemas 01 a 12)
│   ├── PROJECT_CONTEXT (1).md           # Reglas de negocio globales, contratos de datos y protocolos
│   ├── SISTEMA_01_AUTH_RBAC_REFACTOR.md # Especificación de Auth, Roles y Permisos
│   ├── SISTEMA_02_USUARIOS_PERFILES_REFACTOR.md # Perfiles de jugador y disponibilidad 7x12
│   ├── SISTEMA_03_EQUIPOS_PLANTILLAS_REFACTOR.md # Equipos, transferencias y disolución
│   ├── SISTEMA_04_RECLUTAMIENTO_REFACTOR.md      # Invitaciones y mercado de fichajes
│   ├── SISTEMA_05_CANCHAS_SEDES_REFACTOR.md      # Sedes, geolocalización y grilla de disponibilidad
│   ├── SISTEMA_06_TORNEOS_REFACTOR.md           # Torneos, Sala de Cine (hold 5min) y Sorteo
│   ├── SISTEMA_07_PARTIDOS_APLAZAMIENTOS_REFACTOR.md # Partidos, convocatorias, aplazamientos
│   ├── SISTEMA_10_RESULTADOS_ESTADISTICAS_REFACTOR.md # Carga de resultados, stats y standings
│   ├── SISTEMA_11_NOTIFICACIONES.md              # Sistema de notificaciones por familias
│   ├── SISTEMA_12_FRONTEND_UI_UX.md              # Sistema de color Cypher y App Shell (Marco móvil)
│   └── SISTEMA_12_PANTALLAS_UI_ESTRUCTURA.md     # Especificación de 11 pantallas + catálogo DRY
│
├── prisma/                              # 🗄️ Capa de Base de Datos
│   ├── schema.prisma                    # Esquema relacional PostgreSQL (Modelos completos)
│   └── seed.ts                          # Semilla de datos de desarrollo
│
├── public/                              # 🖼️ Assets estáticos públicos
│
├── src/
│   ├── app/                             # 🌐 Next.js App Router (Rutas y Server Components)
│   │   ├── (app)/                       # Rutas autenticadas y principales dentro del App Shell
│   │   │   ├── layout.tsx               # App Shell con Marco Móvil, Header y BottomNav
│   │   │   ├── page.tsx                 # Pantalla 0: Hub / Mapa principal (Landing)
│   │   │   ├── admin/                   # Pantalla 10: Panel de Administración
│   │   │   ├── canchas/                 # Pantalla 1: Detalle de Canchas y disponibilidad
│   │   │   ├── equipos/                 # Pantalla 8: Card Maestra de Equipo y gestión
│   │   │   ├── invitaciones/            # Bandeja de invitaciones pendientes
│   │   │   ├── perfil/                  # Pantalla 7: Perfil de Jugador y matriz 7x12
│   │   │   ├── reclutamiento/           # Pantalla 9: Buscador de jugadores para Capitanes
│   │   │   └── torneos/                 # Pantallas 2, 3, 4, 5, 6: Lista, Detalle, Sorteo, Planilla
│   │   │
│   │   ├── (auth)/                      # Rutas de Autenticación
│   │   │   ├── login/page.tsx           # Formulario de inicio de sesión
│   │   │   └── onboarding/page.tsx      # Configuración inicial del usuario
│   │   │
│   │   ├── api/                         # Endpoints API (HTTP/NextAuth/tRPC)
│   │   │   ├── auth/[...nextauth]/route.ts # Handler de NextAuth v5
│   │   │   └── trpc/[trpc]/route.ts     # Handler principal de tRPC
│   │   │
│   │   └── layout.tsx                   # Root Layout con Providers (TRPCReactProvider, Theme)
│   │
│   ├── components/                      # 🧩 Componentes React (Organizados en capas DRY)
│   │   ├── ui/                          # Componentes Puros de Presentación (Átomos / Jamás importan tRPC)
│   │   │   ├── badge.tsx                # Badges semánticos (success, warning, error, neutral)
│   │   │   ├── player-card/             # Tarjeta de jugador
│   │   │   ├── player-profile-modal/    # Modal de vista rápida de perfil
│   │   │   └── tournament/              # Componentes de torneos (create-modal, enrolled-card, sala-cine)
│   │   │
│   │   ├── features/                    # Componentes de Negocio / Templates ('use client')
│   │   │   ├── admin/                   # Templates de panel de admin
│   │   │   ├── auth/                    # Formulario de login
│   │   │   ├── court/                   # Vistas de canchas y mapa
│   │   │   ├── hub/                     # Template interactivo del Hub/Mapa principal
│   │   │   └── tournament/              # Templates de gestión de inscripciones, sorteo y detalle
│   │   │
│   │   └── app-shell/                   # Componentes del Marco Dispositivo (Header, BottomNav, Shell)
│   │
│   ├── domain/                          # 🧠 Funciones Puras de Dominio (Compartidas Front / Back)
│   │   ├── availability/
│   │   │   └── conflict.ts              # Proyección de conflictos horarios (disponibilidad vs partidos)
│   │   ├── standings/
│   │   │   └── sort.ts                  # Ordenamiento de tabla de posiciones (Pts, DG, GF, FP)
│   │   └── stats/
│   │       └── fair-play.ts             # Fórmula de Fair Play: (yellow*1 + red*3 + blue*0.5 + fouls*0.25) / partidos
│   │
│   ├── lib/                             # 🛠️ Utilidades del cliente
│   │   ├── anon-access.ts               # Utilidades de rutas y accesos
│   │   └── utils.ts                     # cn() para Tailwind (`clsx` + `tailwind-merge`)
│   │
│   ├── server/                          # ⚙️ CAPA BACKEND
│   │   ├── api/                         # Capa tRPC (Routers y Contexto)
│   │   │   ├── trpc.ts                  # Procedimientos base: `publicProcedure`, `protectedProcedure`, `permissionProcedure`, `managerProcedure`
│   │   │   ├── root.ts                  # AppRouter (Combinación de todos los routers)
│   │   │   └── routers/                 # Routers delgados por dominio
│   │   │       ├── admin.ts             # Procedimientos de admin (usuarios, gestores)
│   │   │       ├── availability.ts      # Matriz de disponibilidad 7x12 del jugador
│   │   │       ├── capitaincy.ts        # Transferencia de capitanía
│   │   │       ├── court.ts             # CRUD de canchas, geolocalización lat/lon y disponibilidad
│   │   │       ├── enrollment.ts       # Inscripción, Sala de Cine, Factor 1, Factor 2 (aprobar/rechazar)
│   │   │       ├── match.ts            # Partidos, convocatorias, ausentes, reagendamiento, árbitros
│   │   │       ├── notification.ts     # Notificaciones y preferencias
│   │   │       ├── post.ts              # Stub heredado
│   │   │       ├── profile.ts           # Perfil de usuario y onboarding
│   │   │       ├── recruitment.ts       # Buscador e invitaciones a jugadores
│   │   │       ├── result.ts            # Carga de resultados de partidos
│   │   │       ├── stats.ts             # Consultas de estadísticas agregadas y standings
│   │   │       ├── team.ts              # CRUD de equipos, plantillas y disolución
│   │   │       └── tournament.ts        # Torneos, publicación, sorteo y cierre
│   │   │
│   │   ├── core/                        # MOTORES DE NEGOCIO (Core Engines)
│   │   │   ├── admin/                   # admin.engine.ts
│   │   │   ├── availability/            # availability.engine.ts
│   │   │   ├── court/                   # court.engine.ts, hub.engine.ts
│   │   │   ├── match/                   # match.engine.ts
│   │   │   ├── notification/            # notification.engine.ts
│   │   │   ├── profile/                 # profile.engine.ts
│   │   │   ├── rbac/                    # rbac.engine.ts, captaincy.engine.ts
│   │   │   ├── recruitment/             # recruitment.engine.ts
│   │   │   ├── stats/                   # stats.engine.ts, result.engine.ts
│   │   │   ├── team/                    # team.engine.ts
│   │   │   └── tournament/              # tournament.engine.ts, enrollment.engine.ts, slotHold.engine.ts
│   │   │
│   │   ├── auth/                        # Configuración de NextAuth v5
│   │   │   ├── index.ts                 # Instancia auth() y handlers
│   │   │   └── config.ts                # Proveedores y callbacks
│   │   │
│   │   └── db.ts                        # Cliente de Prisma singleton
│   │
│   ├── styles/                          # 🎨 CSS Global y Tokens Cypher
│   │   └── globals.css                  # Variables CSS, colores Cypher y utilidades Tailwind v4
│   │
│   └── trpc/                            # 🔌 Configuración de Clientes tRPC
│       ├── react.tsx                    # Hooks de React Query (`api.useUtils()`, etc.)
│       └── server.ts                    # Llamador de tRPC para RSC (Server Components)
│
├── next.config.js                       # Configuración de Next.js
├── package.json                         # Dependencias del proyecto
└── tsconfig.json                        # Configuración de TypeScript (`torneos/*` alias)
```

---

## 🎯 3. Guía Rápida para el LLM: ¿Dónde escribir código?

| Si necesitas añadir / modificar... | Debes editar en... | Ejemplo |
|---|---|---|
| **Modelo de base de datos** | `prisma/schema.prisma` | Crear nueva tabla o relación Prisma |
| **Lógica de negocio / Algoritmo** | `src/server/core/<modulo>/<modulo>.engine.ts` | Reglas de sorteo, recálculos de promedios, validaciones de cupos |
| **Nuevo endpoint / API** | `src/server/api/routers/<modulo>.ts` | Exponer una mutación o query tRPC |
| **Función matemática pura** | `src/domain/<modulo>/` | Fórmulas de Fair Play, filtros de conflicto horario, ordenamiento |
| **Pantalla completa de usuario** | `src/app/(app)/<ruta>/page.tsx` + `src/components/features/` | Crear la página RSC + el Template 'use client' |
| **Elemento gráfico visual reutilizable** | `src/components/ui/<componente>.tsx` | Crear una card, botón, badge o modal puro sin tRPC |
| **Variables de diseño / Tokens** | `src/styles/globals.css` | Modificar los colores del sistema *Cypher* |

---

## 🟢 4. Estado de Avance del Proyecto

- **Backend (`src/server/`)**: **100% Sólido y Compilando**.
  - RBAC, Autenticación, Perfiles, Disponibilidad, Equipos, Reclutamiento, Canchas con lat/lon, Torneos, Sala de Cine (Prereserva), Sorteo, Convocatorias, Carga de Resultados, Recálculo de Estadísticas/Standings y Notificaciones totalmente funcionales.
- **Frontend UI (`src/components/` & `src/app/`)**: **En Proceso de Construcción / Refinamiento Visual**.
  - Las pantallas están definidas en `SISTEMA_12_PANTALLAS_UI_ESTRUCTURA.md`.
  - El sistema de color *Cypher* y el App Shell están especificados en `SISTEMA_12_FRONTEND_UI_UX.md`.
