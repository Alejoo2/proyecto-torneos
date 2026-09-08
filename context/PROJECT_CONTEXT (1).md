# Contexto del Proyecto: Plataforma de Gestión de Torneos de Barrio

> **Estado:** Aprobado (Fase de Conocimiento)
> **Versión:** 2.0
> **Última actualización:** 2026-09
> **Propósito:** Fuente única de verdad de contexto para cualquier asistente de IA o desarrollador.
> Antes de generar código, revisar este documento en su totalidad.

## CHANGELOG v2.0
- Añadida Sección 4: Arquitectura de Información (capas de estado, canales, tabla de decisión por dato).
- Añadida Sección 5: Frontera React (RSC explícito, reglas de frontera, enmienda src/domain/).
- Reescrita 7.6: Protocolo completo de Sala de Cine.
- Ampliada 7.2: Protocolo de matriz de disponibilidad en dos capas.
- Ampliado checklist (Sección 10) con auditoría de manipulación de información.

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

TanStack Query es dependencia implícita de tRPC y es el dueño del caché de datos del cliente. No es un detalle de implementación: es la capa 2 del modelo de estado (Sección 4.1).
Motion One es exclusivamente para animación de presentación (transiciones, feedback visual). Jamás para lógica de estado. Si una animación necesita saber algo del servidor, ese algo llega por los canales de la Sección 4 — la animación solo decora.

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

3.4. Principios de Manipulación de Información (NUEVO — inamovibles)
Estos principios rigen TODO flujo de datos del proyecto. Ante cualquier duda sobre un dato, se resuelve con esta lista en orden:

La BD es la verdad; nunca la fuente del render. La UI renderiza la fusión de caché + overlay local. La BD solo reconcilia. Prohibido refetchear "para pintar" — el refetch es para auditar o para rellenar huecos de primera carga.
Reconcilia por entidad, jamás por colección. Un cambio afecta a la entidad mínima que lo contiene (una celda, una inscripción, un partido). Si una mutación dispara cascadas de derivados complejos, ahí — y solo ahí — se usa reconciliación gruesa de segmento.
Nada viaja sin camino. Un cambio en la BD no dispara nada en ningún cliente por sí solo. Solo llega a quien tiene un camino construido (petición propia, polling de su vista, o reconciliación). La no-comunicación es el diseño funcionando.
Compra frescura solo donde la frescura es el juego. Pregunta obligatoria por dato: "¿qué pierde el usuario si este dato está 30 segundos viejo?". Si la respuesta es "nada" → pull barato. Si es "una mala experiencia recuperable" → optimistic UI + reconciliación. Si es "rompe la mecánica" → atomicidad en servidor (nunca más velocidad de canal).
Previene lo imposible, asume lo probable, explica lo fallido. Lo que el RBAC prohíbe se renderiza deshabilitado desde el servidor (feedback instantáneo, la petición ni se genera). Lo que probablemente éxito se pinta optimista. Lo que falla se revierte animado y con toast explicativo de UNA línea. Prohibido el error silencioso y el refetch brusco como feedback.
El servidor es autoritativo en escritura; el cliente es autoritativo en intención. Toda mutación se re-valida en servidor dentro de una transacción (coherencia absoluta). Todo clic legítimo cambia la UI en el mismo frame (percepción de instantaneidad).

---

## 4. Estructura de Directorios

proyecto-torneos
├── README.md
├── context
│   ├── PROJECT_CONTEXT (1).md
│   ├── SISTEMA_01_AUTH_RBAC_REFACTOR.md
│   ├── SISTEMA_02_USUARIOS_PERFILES_REFACTOR.md
│   ├── SISTEMA_03_EQUIPOS_PLANTILLAS_REFACTOR.md
│   ├── SISTEMA_04_RECLUTAMIENTO_REFACTOR.md
│   ├── SISTEMA_05_CANCHAS_SEDES_REFACTOR.md
│   ├── SISTEMA_06_TORNEOS_REFACTOR.md
│   ├── SISTEMA_07_PARTIDOS_APLAZAMIENTOS_REFACTOR.md
│   ├── SISTEMA_10_RESULTADOS_ESTADISTICAS_REFACTOR.md
│   └── SISTEMA_11_NOTIFICACIONES.md
├── eslint.config.js
├── generated
│   └── prisma
│       ├── client.d.ts
│       ├── client.js
│       ├── default.d.ts
│       ├── default.js
│       ├── edge.d.ts
│       ├── edge.js
│       ├── index-browser.js
│       ├── index.d.ts
│       ├── index.js
│       ├── package.json
│       ├── query_engine-windows.dll.node
│       ├── query_engine_bg.js
│       ├── query_engine_bg.wasm
│       ├── runtime
│       │   ├── edge-esm.js
│       │   ├── edge.js
│       │   ├── index-browser.d.ts
│       │   ├── index-browser.js
│       │   ├── library.d.ts
│       │   ├── library.js
│       │   ├── react-native.js
│       │   ├── wasm-compiler-edge.js
│       │   └── wasm-engine-edge.js
│       ├── schema.prisma
│       ├── wasm-edge-light-loader.mjs
│       ├── wasm-worker-loader.mjs
│       ├── wasm.d.ts
│       └── wasm.js
├── next.config.js
├── package-lock.json
├── package.json
├── postcss.config.js
├── prettier.config.js
├── prisma
│   ├── migrations
│   │   ├── 20260828142156_init_auth_rbac
│   │   │   └── migration.sql
│   │   ├── 20260828161620_add_google_token_expires
│   │   │   └── migration.sql
│   │   ├── 20260828162119_fix_user_updated_at
│   │   │   └── migration.sql
│   │   ├── 20260831160658_system2_profiles_onboarding
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   ├── schema.prisma
│   └── seed.ts
├── prototipo
│   ├── detalle_cancha_sede.html
│   ├── detalle_equipo_card_maestra.html
│   ├── detalle_partido_vs.html
│   ├── detalle_torneo.html
│   ├── directorio_reclutamiento.html
│   ├── gestion_torneo_inscripciones.html
│   ├── gestion_torneo_planilla.html
│   ├── gestion_torneo_sorteo.html
│   ├── hub_mapa_principal.html
│   ├── login_registro.html
│   ├── panel_admin.html
│   └── perfil_jugador.html
├── public
│   └── favicon.ico
├── src
│   ├── app
│   │   ├── (app)
│   │   │   ├── config
│   │   │   ├── equipos
│   │   │   │   └── [teamId]
│   │   │   ├── layout.tsx
│   │   │   ├── notificaciones
│   │   │   ├── onboarding
│   │   │   ├── reclutamiento
│   │   │   │   └── [teamId]
│   │   │   └── torneos
│   │   │       └── [tournamentId]
│   │   ├── (auth)
│   │   │   └── login
│   │   │       └── page.tsx
│   │   ├── (public)
│   │   ├── _components
│   │   │   └── post.tsx
│   │   ├── api
│   │   │   ├── auth
│   │   │   └── trpc
│   │   │       └── [trpc]
│   │   │           └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components
│   │   ├── features
│   │   │   ├── auth
│   │   │   │   └── login-form.tsx
│   │   │   ├── notification
│   │   │   ├── team
│   │   │   └── tournament
│   │   ├── templates
│   │   └── ui
│   │       ├── button
│   │       │   ├── button.tsx
│   │       │   └── button.variants.ts
│   │       ├── card
│   │       ├── input
│   │       └── oauth-button
│   │           ├── oauth-button.tsx
│   │           └── oauth-button.variants.ts
│   ├── env.js
│   ├── hooks
│   ├── lib
│   │   └── utils.ts
│   ├── server
│   │   ├── api
│   │   │   ├── root.ts
│   │   │   ├── routers
│   │   │   │   └── post.ts
│   │   │   └── trpc.ts
│   │   ├── auth
│   │   │   ├── config.ts
│   │   │   └── index.ts
│   │   ├── core
│   │   │   ├── match
│   │   │   ├── notification
│   │   │   │   └── notification.engine.ts
│   │   │   ├── profile
│   │   │   ├── rbac
│   │   │   ├── recruitment
│   │   │   ├── stats
│   │   │   ├── team
│   │   │   │   └── team.engine.ts
│   │   │   └── tournament
│   │   │       └── tournament.engine.ts
│   │   └── db.ts
│   ├── styles
│   │   └── globals.css
│   └── trpc
│       ├── query-client.ts
│       ├── react.tsx
│       └── server.ts
├── start-database.sh
├── test-fetch.ts
└── tsconfig.json
```
4.1. Las Cuatro Capas de Estado
Todo estado de la aplicación vive en exactamente una de estas capas. Ubicar un dato en la capa correcta es la primera decisión de cualquier feature:

Capa
Qué vive ahí
Dónde (concreto)
Muere cuando
1. Verdad autoritativa	Los datos del dominio	PostgreSQL vía Prisma	Nunca (es la verdad)
2. Caché de cliente	Réplicas de la capa 1 para renderizar	TanStack Query (query keys por entidad)	Al expirar/GC, sin drama
3. Overlay de intenciones	Mutaciones optimistas no confirmadas	Query cache mutada con rollback en onMutate	Al confirmarse o revertirse
4. Estado efímero de UI	Hover, modales, countdowns, selección, drag	useState/stores locales del componente	Al desmontar o recargar

Regla de flujo: la UI renderiza capas 2+3+4 fusionadas. La capa 1 solo se toca vía: (a) materialización inicial (canal RSC), (b) mutaciones (peticiones), (c) reconciliación (auditoría). Un componente ui/ jamás conoce estas capas: recibe datos ya fusionados vía props (ver Sección 5).

4.2. Los Dos Tubos y los Tres Roles
Existen dos tubos físicos y tres roles lógicos. Esta distinción evita el error clásico de pedir infraestructura que no se necesita:

Rol lógico
Tubo físico
Cuándo se usa
Disparador
Materializar (canal RSC)	Request/response (payload RSC streameado)	Primera carga y navegación: estructura + datos iniciales	Navegación del usuario
Frescura (pull puntual)	Mutación tRPC / refetch dirigido	Optimistic UI, polling de vista montada, refetch al foco	El clic del usuario o su atención
Reconciliación gruesa	Request/response (mismo tubo que RSC)	Auditoría post-mutación con cascadas, refetch al recuperar foco, eventos masivos	La desconfianza en la verdad local

Este proyecto NO usa push (WebSocket/SSE) en su fase actual. Justificación: deploy serverless (tubos persistentes friccionan), dominio de baja frecuencia (todo cambia por acción humana agrupable), y la única mecánica de "carrera" (Sala de Cine) se resuelve con atomicidad, no con velocidad de canal (Sección 7.6). Añadir push es una decisión futura que requiere justificar frescura dato a dato contra la tabla 4.3.

4.3. Tabla de Decisión de Canales por Dato (la pieza central)
Todo dato del dominio está clasificado aquí. Si creas un dato nuevo, añádelo a esta tabla:

Dato
Escritores
¿Terceros lo cambian?
Canal para leerlo
Canal para sus cambios
Presentación al usuario
Estructura de página / perfiles / listas estáticas	Servidor	Sí, baja frecuencia	RSC	Reconciliación al foco	Materializado
Matriz propia AVAILABLE/UNAVAILABLE (S2)	Solo su dueño	No (salvo mismo usuario, otra pestaña)	RSC (semilla)	Optimistic + mutación puntual	Cambio instantáneo, cero spinner
CONFLICT (S2)	Nadie (derivado)	Sí (vía partidos)	Cálculo en runtime	Hereda el canal de partidos	Amarillo re-derivado, nunca persistido
Cupos de torneo (hall, fuera de Sala de Cine)	Servidor	Sí, media frecuencia	RSC + refetch al foco	Pull moderado mientras vista montada	Contador aproximado + edad visible ("hace Xs")
Prereserva propia (S6)	Servidor (atómico)	No	Respuesta de mutación	Nada: es un hecho, no un dato vivo	Countdown local desde timestamp del servidor
Inscripción propia (S6)	Servidor	Sí (gestor aprueba/rechaza)	Optimistic	Reconciliación gruesa post-mutación + polling de estado	Optimista + estados posteriores por pull
Bandeja del gestor (S6)	Servidor	Sí	RSC	Reconciliación al foco + post-mutación	Materializado
Notificaciones (S11)	Servidor (transaccional)	Sí	Polling 30s (decisión v1 mantenida)	Mismo polling	Badge
Partidos / fixture (S7)	Servidor	Sí, baja frecuencia	RSC	Reconciliación al foco; los afectados se enteran al contacto	Materializado
Tabla de posiciones / stats (S10)	Motor de stats	Sí, tras carga de resultado	RSC (agregados pre-calculados)	Reconciliación gruesa post-mutación del gestor	Materializado
Suspensión de cancha (S5)	Admin	Sí, evento masivo	—	Reconciliación perezosa al contacto de cada usuario	Cero difusión

4.4. Protocolo Estándar de Clic (el ciclo oficial de toda mutación)
Toda acción del usuario sigue este ciclo. Es el contrato de UX del proyecto:

Prevención: ¿el RBAC local (copiado como datos desde servidor) lo prohíbe? → el elemento ya estaba deshabilitado; el clic no existe. Fin.
Intención: se crea la intención identificada por entidad (query key mínima: la celda, la inscripción, el partido).
Overlay: se aplica al caché inmediatamente (capa 3). Render en el mismo frame. Para el usuario: instantáneo.
Envío: mutación tRPC. Los routers validan con Zod y delegan al engine de server/core/, que ejecuta TODO en una transacción Prisma (dato + derivados + notificaciones, atómicamente).
5a. Éxito: reconciliación por entidad (el overlay ya decía lo mismo → convergencia silenciosa, cero parpadeo). Si la mutación tuvo cascadas de derivados → reconciliación gruesa del segmento.
5b. Fallo: rollback animado de SOLO esa entidad + toast explicativo de una línea con la causa ("Tu cambio no se aplicó: la prereserva expiró"). El resto de la pantalla no se entera.
4.5. Honestidad de Caché
Cuando un dato se presenta aproximado (pull), la UI lo declara: el contador de cupos muestra su edad ("actualizado hace 12s"). Un dato aproximado que dice ser aproximado no genera desconfianza; uno que dice ser exacto y falla, sí. Este principio hace viable la decisión de no usar push.



## 5. Arquitectura Frontend (UI/UX)

5.1. El patrón "UI Tonto / Template Inteligente" ES la frontera RSC
La convención de carpetas del proyecto es una declaración de frontera servidor/cliente:

ui/: sin hooks de tRPC, sin roles, sin datos → son Server Components por defecto. Su JavaScript no viaja. Viaja su resultado serializado. En mobile-first esto es la optimización número uno del proyecto: una card maestra de equipo, una fila de tabla de posiciones o un perfil de jugador cuestan cero bytes de JS.
templates/: el punto donde se cruza la aduana. Un template que necesita vida (eventos, optimistic UI, countdowns) lleva 'use client' y todo lo que importe desde ahí es cliente transitivamente — aunque el archivo importado no tenga la directiva. Corolario: jamás importes desde server/ dentro de un template cliente, ni siquiera "solo un tipo" (revisa que los imports de tipos sean import type o vivan en src/domain/).
Regla de lectura en casa: los Server Components nunca se llaman a sí mismos vía HTTP de tRPC. Llaman directamente a los engines de server/core/ (o al caller de tRPC sin red). La frontera HTTP existe para el navegador, no para el servidor hablándose a sí mismo.
Regla del puente de caché: cuando un template cliente necesita vida sobre datos servidos, el server component padre le pasa los datos iniciales como props serializables, y el template los siembra en TanStack Query como valor inicial (initialData / hydrate). A partir de ese momento, el dato vive en capa 2 y las actualizaciones siguen el protocolo 4.4. El prop inicial es semilla, no fuente permanente.
Composición hacia arriba: un template cliente puede recibir segmentos server como children/props desde un padre servidor (patrón marco-de-cuadro). El cliente coloca la pieza terminada; jamás la inspecciona ni re-renderiza.

### 5.2. Gestión de Estilos: Variantes Separadas (cva)
- Para componentes complejos, la definición de variantes de Tailwind (`cva`) se extrae a un archivo `.variants.ts` hermano del componente.
- **Ejemplo:** `button.tsx` + `button.variants.ts`
- **Por qué:** Meter `cva` inline en el componente lo hace ilegible cuando hay muchas variantes. Separar responsabilidades mantiene el JSX limpio.

 ENMIENDA ESTRUCTURAL: src/domain/ (nueva carpeta)
text

src/
├─ domain/          # NUEVO: lógica pura isomórfica (cero dependencias, cero I/O)
│  ├─ availability/ # proyección de matriz: f(disponibilidad, partidos) → estados
│  ├─ standings/    # orden de tabla, desempates, Fair Play (fórmula pura)
│  └─ slot/         # aritmética de franjas de 2h y ventanas de 1h45m
Por qué (violación DRY detectada): el CONFLICT de la matriz, los desempates de la tabla y la fórmula de Fair Play son lógica de negocio pura que ambos mundos necesitan: el servidor para persistir/ratificar, el cliente para pre-visualizar y derivar en runtime. Si viven solo en server/core/, el cliente no puede importarlas sin cruzar la frontera; duplicarlas viola 3.1. Regla de separación: src/domain/ = funciones puras compartidas; server/core/ = orquestación con I/O (Prisma, transacciones, auth) que consume domain/. Con esto, la fórmula del Fair Play se escribe una vez y el cliente puede mostrar "si cargas 2 rojas tu Fair Play queda X" sin pedir nada.

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


Toda mutación con efectos colaterales es una transacción Prisma única: dato + derivados agregados + notificaciones nacen juntos o no nacen. Esto garantiza que la Sección 4 pueda reconciliar sin miedo: toda lectura post-transacción encuentra una verdad cerrada, nunca a medias.
Expiraciones por purga perezosa, no por cron: cualquier registro con TTL (prereservas, tokens) se valida por comparación temporal en cada lectura/escritura relevante, y su limpieza física es oportunista. Serverless no garantiza procesos periódicos; el tiempo se verifica, no se programa.
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

7.2. Usuarios / Perfiles — Protocolo de la Matriz 7×12 (AMPLIADO)
La matriz tiene dos capas con naturalezas opuestas. Confundirlas es el error a evitar:

Capa A — Disponibilidad propia (persistida, escritura exclusiva del dueño):

Al montar, el RSC materializa el estado de las 84 celdas como semilla → template cliente la siembra en caché.
Cada tap sigue el protocolo 4.4 completo: intención por celda (clave fila:columna), overlay instantáneo, mutación, reconciliación por entidad.
No hay canal push para esta capa: nadie más puede escribirla. El único conflicto posible es el mismo usuario con dos pestañas; se resuelve aceptando last-write-wins por celda (el estado visible es siempre la intención más reciente).
Cero spinners, cero confirmación visual adicional: el tap ES el cambio. Si falla (raro): rollback animado de esa celda + toast.
Capa B — CONFLICT (derivada en runtime, nunca persistida):

Es una función pura de src/domain/availability/ ejecutada en el cliente sobre capa 2: f(mi disponibilidad, partidos programados) → celdas CONFLICT.
Su frescura hereda del canal de partidos (ver tabla 4.3): se re-deriva al montar la vista, al refetch de partidos (foco, post-mutación de partidos), y tras mutaciones propias de la capa A.
Cuando el gestor aplaza un partido, el amarillo obsoleto de los convocados muere al su siguiente contacto con la vista, no por difusión. Decisión asumida y documentada: el aplazamiento no es información crítica en tiempo real.

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

7.6. Torneos — Protocolo de Sala de Cine (REESCRITO: decisiones cerradas)
Tesis central: la Sala de Cine no necesita canal en tiempo real porque la prereserva convierte una carrera en una fila. El único dato cuya frescura importaría ("quedan N cupos") se degrada honestamente a aproximado (Sección 4.5), porque la atomicidad de la prereserva hace que su imprecisión no pueda causar daño. Más velocidad de canal no arregla una carrera; la exclusividad garantizada en servidor la elimina.

Zona 1 — El Hall (decidiendo si entrar):

Contador de cupos: RSC al materializar + refetch al foco + refetch moderado (15s) mientras la vista está montada.
Se presenta con edad visible ("8 cupos · hace 12s"). Decisión aproximada sobre dato aproximado: correcta por diseño, porque el daño máximo (llegar y que el cupo esté tomado) se resuelve con un mensaje claro, no con una experiencia rota.
Zona 2 — Entrar a la Sala (la prereserva):

Acción explícita del usuario → mutación tRPC → transacción atómica en el engine: verifica cupos libres (contando solo prereservas vigentes, expiresAt > now), verifica que el usuario no tenga prereserva activa en otro torneo, crea la prereserva con expiresAt = now + 5min.
Éxito → el servidor devuelve expiresAt + timestamp de servidor. UI: transición a la Sala.
Colisiones (cupo tomado en la microtransacción) → rechazo explícito con causa, toast de una línea, el contador del hall se reconcilia. El usuario nunca ve un "error genérico".
Zona 3 — Dentro de la Sala:

El dato relevante ya no es el contador global: es "TU cupo está asegurado hasta HH:MM". El contador global se oculta dentro de la Sala (o se congela con edad): mostrarlo solo genera ansiedad sobre un dato que ya no afecta al usuario.
Countdown 100% local (capa 4): setInterval calculando contra expiresAt del servidor y el timestamp de respuesta del servidor (nunca el reloj local, que puede estar desfasado). El paso del tiempo no es un dato: nadie lo empuja.
La prereserva sobrevive la navegación dentro de su TTL (vive en servidor): si el usuario sale a revisar otra cosa y vuelve antes de expirar, retoma su countdown. Amable y anti-frustración.
Zona 4 — Confirmar inscripción (los 2 factores):

UI optimista: el estado de inscripción aparece al instante (protocolo 4.4).
Servidor, en UNA transacción: verifica prereserva vigente → verifica factor disponibilidad (mínimo 5 jugadores vs. matrices) → crea inscripción PENDING_PAYMENT → purga prereserva → genera notificación al gestor.
Si la prereserva expiró mientras llenaba el formulario: rechazo con causa EXPIRED, rollback animado, y el rechazo OFRECE re-prereserva con un clic (nuevos 5 minutos). La expiración no es un muro: es una puerta que se reabre.
Si falla factor disponibilidad → PENDING_AVAILABILITY según v1, con toast explicando qué falta.
Post-confirmación → reconciliación gruesa del segmento (cupos, estado del torneo, bandeja propia) para cerrar derivados.
Zona 5 — Expiración y abuso:

Purga perezosa: toda lectura de cupos cuenta solo prereservas vigentes; la limpieza física es oportunista.
Cooldown anti-acaparamiento: tras una expiración sin confirmación, reentrar a la Sala del mismo torneo exige esperar el cooldown visible (valor corto, p. ej. 2 min). Quien confirmó, jamás tiene cooldown. Esto impide bloquear-desbloquear cupos en bucle sin penalizar al usuario legítimo.
Resumen de canal para la Sala de Cine: cero push, cero polling especial dentro de la Sala, un solo polling moderado en el Hall. Toda la "magia de simultaneidad" la provee una transacción y un timestamp.

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

7.6. Torneos — Protocolo de Sala de Cine (REESCRITO: decisiones cerradas)
Tesis central: la Sala de Cine no necesita canal en tiempo real porque la prereserva convierte una carrera en una fila. El único dato cuya frescura importaría ("quedan N cupos") se degrada honestamente a aproximado (Sección 4.5), porque la atomicidad de la prereserva hace que su imprecisión no pueda causar daño. Más velocidad de canal no arregla una carrera; la exclusividad garantizada en servidor la elimina.

Zona 1 — El Hall (decidiendo si entrar):

Contador de cupos: RSC al materializar + refetch al foco + refetch moderado (15s) mientras la vista está montada.
Se presenta con edad visible ("8 cupos · hace 12s"). Decisión aproximada sobre dato aproximado: correcta por diseño, porque el daño máximo (llegar y que el cupo esté tomado) se resuelve con un mensaje claro, no con una experiencia rota.
Zona 2 — Entrar a la Sala (la prereserva):

Acción explícita del usuario → mutación tRPC → transacción atómica en el engine: verifica cupos libres (contando solo prereservas vigentes, expiresAt > now), verifica que el usuario no tenga prereserva activa en otro torneo, crea la prereserva con expiresAt = now + 5min.
Éxito → el servidor devuelve expiresAt + timestamp de servidor. UI: transición a la Sala.
Colisiones (cupo tomado en la microtransacción) → rechazo explícito con causa, toast de una línea, el contador del hall se reconcilia. El usuario nunca ve un "error genérico".
Zona 3 — Dentro de la Sala:

El dato relevante ya no es el contador global: es "TU cupo está asegurado hasta HH:MM". El contador global se oculta dentro de la Sala (o se congela con edad): mostrarlo solo genera ansiedad sobre un dato que ya no afecta al usuario.
Countdown 100% local (capa 4): setInterval calculando contra expiresAt del servidor y el timestamp de respuesta del servidor (nunca el reloj local, que puede estar desfasado). El paso del tiempo no es un dato: nadie lo empuja.
La prereserva sobrevive la navegación dentro de su TTL (vive en servidor): si el usuario sale a revisar otra cosa y vuelve antes de expirar, retoma su countdown. Amable y anti-frustración.
Zona 4 — Confirmar inscripción (los 2 factores):

UI optimista: el estado de inscripción aparece al instante (protocolo 4.4).
Servidor, en UNA transacción: verifica prereserva vigente → verifica factor disponibilidad (mínimo 5 jugadores vs. matrices) → crea inscripción PENDING_PAYMENT → purga prereserva → genera notificación al gestor.
Si la prereserva expiró mientras llenaba el formulario: rechazo con causa EXPIRED, rollback animado, y el rechazo OFRECE re-prereserva con un clic (nuevos 5 minutos). La expiración no es un muro: es una puerta que se reabre.
Si falla factor disponibilidad → PENDING_AVAILABILITY según v1, con toast explicando qué falta.
Post-confirmación → reconciliación gruesa del segmento (cupos, estado del torneo, bandeja propia) para cerrar derivados.
Zona 5 — Expiración y abuso:

Purga perezosa: toda lectura de cupos cuenta solo prereservas vigentes; la limpieza física es oportunista.
Cooldown anti-acaparamiento: tras una expiración sin confirmación, reentrar a la Sala del mismo torneo exige esperar el cooldown visible (valor corto, p. ej. 2 min). Quien confirmó, jamás tiene cooldown. Esto impide bloquear-desbloquear cupos en bucle sin penalizar al usuario legítimo.
Resumen de canal para la Sala de Cine: cero push, cero polling especial dentro de la Sala, un solo polling moderado en el Hall. Toda la "magia de simultaneidad" la provee una transacción y un timestamp.

---

## 11. Qué NO está en este documento

- Plan de implementación ni roadmap.
- Diseño visual detallado (paleta de colores, tipografías, assets).
- Especificaciones de API externas (webhooks, pagos).
- Estrategia de testing.
- Configuración de CI/CD.
- Detalle técnico de cada sistema (ver `.md` individuales).

La decisión más fuerte que tomé fue negativa: la Sala de Cine no lleva tiempo real. Tu intuición original (del ejemplo de la matriz) era que la frescura se compra con canales rápidos; la madurez arquitectónica es darse cuenta de que la prereserva reescribe el juego para que la velocidad deje de importar. Cuando puedas, elige siempre reescribir el juego sobre acelerar el canal.
La enmienda src/domain/ toca tu estructura de carpetas, y sé que está "Aprobado y Bloqueado". La señalo como enmienda explícita en lugar de colarla: es la única fuga DRY real que encontré (fórmulas que dos mundos necesitan), y prefiero que la apruebes consciente que sorprenderte después.
La tabla 4.3 es el verdadero activo del documento. Con ella, cualquier IA o desarrollador puede generar código de cualquier feature sin volver a preguntar "¿esto cómo se actualiza?". Si un día añades push, no reescribes el documento: reescribes filas de esa tabla.

> Estos temas se tratan en documentos aparte.

---

> **Documento versionado.** Última actualización: 2026-08-26. Cualquier modificación requiere revisión y aprobación antes de implementar.

DBfutbolCinco
