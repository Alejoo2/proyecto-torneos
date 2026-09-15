# SISTEMA_12_FRONTEND_UI_UX.md

> **Estado:** Borrador para Aprobación
> **Versión:** 1.0
> **Fecha:** 2026-09
> **Propósito:** Especificación de la arquitectura UI/UX del frontend: App Shell (marco-dispositivo), sistema de navegación, sistema de color Cypher, Hub/Mapa (cierra el hueco del Sistema 12 en PROJECT_CONTEXT v2.0), frontera de animación, modelo de datos de pines, mapa de canales Back↔Front y análisis preparatorio de notificaciones.
> **Lee antes:** PROJECT_CONTEXT v2.0 (obligatorio). Este documento NO lo reemplaza: lo extiende.

## CHANGELOG v1.0
- Creación del documento. Consolida las decisiones de análisis de wireframes (Hub/Mapa) y contexto complementario.
- Enmienda al contexto complementario de Fase 1: la regla de ocultamiento de BottomNav en modales fullscreen queda **revocada** (ver 2.4).
- Especifica el Sistema 12 (Mapa / Landing UI), que estaba "Por especificar".
- Define el sistema de color Cypher (tema oscuro grafito + acentos quirúrgicos).
- Formaliza la deuda técnica de geolocalización y su plan de costura.
- **Cierra la decisión del punto de acceso a notificaciones:** campana persistente del shell con apilamiento horizontal respecto al botón back (ver 3.4). El shell queda sin decisiones abiertas de estructura.
- Identifica las auditorías pendientes del código existente (Sección 10) como prerrequisito de implementación.

---

## 1. Alcance

Este documento gobierna:

1. El **App Shell**: el marco-dispositivo universal y sus capas.
2. La **navegación**: BottomNav, Barra Superior (back + campana) y panel de notificaciones.
3. El **sistema de color Cypher**: tokens, roles, combinaciones legales, efecto neón.
4. El **Hub/Mapa**: la landing page (especificación del Sistema 12).
5. La **frontera de animación**: qué es de Tailwind y qué de Motion One.
6. El **modelo de datos de pines** y la migración pendiente.
7. El **mapa de canales** Back↔Front aplicado a cada vista.
8. El **análisis preparatorio de notificaciones** desde el front.

Fuera de alcance: implementación (pendiente de auditorías de Sección 10), especificación de tipografía, assets e iconografía final.

---

## 2. El App Shell — Marco de Dispositivo Universal

### 2.1 Filosofía

El shell no es un layout responsive: es la **simulación intencional de un dispositivo móvil**. La app nunca se adapta al desktop; el desktop la enmarca como hardware. En móvil real, el marco desaparece y la simulación se vuelve la realidad.

Propiedades físicas del dispositivo:

| Propiedad | Móvil real | Desktop |
|---|---|---|
| Ancho | 100% | max-w-lg (techo duro) |
| Alto | 100dvh | 90vh centrado vertical |
| Marco físico | Ninguno (es el teléfono real) | Borde 10px grafito + radius 2rem + sombra |
| Contención | overflow-hidden: nada sangra fuera del "dispositivo" | Ídem |

Reglas derivadas:

- `100dvh` es obligatorio (respeta las barras dinámicas del navegador móvil). Prohibido `100vh`.
- `env(safe-area-inset-bottom)` se aplica en la BottomNav. Como Tailwind no lo trae nativo para padding, se resuelve como utilidad en el CSS centralizado — **jamás inline** (regla 3.2 del PROJECT_CONTEXT).
- El body es el "escenario" detrás del dispositivo (fondo grafito profundo). En móvil real el escenario no es visible.
- El marco es un componente **puro, reutilizable y universal**: cada route group lo consume. No existe un mega-layout que intente abarcarlo todo.

### 2.2 Composición por Route Group

| Route Group | Composición del shell |
|---|---|
| `(app)` | Marco + Barra Superior + área de contenido + BottomNav |
| `(auth)` | Marco + contenido. Sin nav, sin barra superior |
| `(public)` | A determinar en auditoría (ver 10). Hipótesis: `/` termina sirviendo el hub; el grupo puede absorberse o quedarse como transición |

Regla de flujo interno en `(app)`: las páginas solo renderizan contenido dentro del área entre la barra superior y la nav, con padding inferior que garantice que nada quede bajo la nav.

### 2.3 Jerarquía de Capas (la escalera de z-index del dispositivo)

La escalera es fija, documentada, y ningún componente puede inventar niveles:

| Capa | z | Habitantes |
|---|---|---|
| Mapa | 0 | Tiles, pines |
| Filtros rápidos | 20 | Chips de filtro del hub |
| Search bar | 30 | Búsqueda del hub (solo hub) |
| Controles flotantes | 30 | Zoom, centrar |
| Bottom Sheet | 40 | Ficha de cancha |
| Panel de notificaciones | 45 | Bandeja desplegable desde la campana; su borde inferior termina sobre la nav |
| Barra superior del shell | sticky / flotante según modo | Back + campana + título (3.2) |
| **BottomNav** | **50** | **Techo del contenido** |
| Modales fullscreen | < 50 | Viven ENTRE barra superior y nav |
| Toast | 70 | Siempre visible, anclado arriba |

### 2.4 La Nav Bar Intocable (enmienda)

**El contexto complementario de Fase 1 decía:** "BottomNav debe ocultarse cuando se abran modales de pantalla completa (ej. Sala de Cine)".

**Decisión vigente (revoca lo anterior):** ningún modal, ningún flujo, ninguna vista oculta o tapa jamás la BottomNav. Los "modales fullscreen" son fullscreen **dentro del área de contenido**: ocupan todo entre la barra superior y la BottomNav. El panel de notificaciones (3.4) está sujeto a esta misma regla.

Justificación de diseño: la nav siempre visible convierte a la app en un lugar del que nunca se "sale a ciegas". En Sala de Cine, el usuario con prereserva activa ve siempre sus cuatro salidas; combinado con la regla de que la prereserva sobrevive la navegación dentro de su TTL, la expiración nunca es una trampa. Coherencia total con 7.6 del PROJECT_CONTEXT.

Corolario técnico: no se necesita ningún mecanismo de ocultamiento (ni contexto de shell ni segmentos de ruta externos). El modal fullscreen es un template más respetando la escalera de capas.

---

## 3. Navegación

### 3.1 BottomNav

- Ubicación estructural: `(app)/layout.tsx` (el shell). Confirmado.
- Cuatro pestañas: **Inicio** (hub/mapa), **Equipo**, **Torneos**, **Perfil**.
- Pestaña activa por `usePathname`.
- Altura base 64px + safe-area. Áreas táctiles mínimas 44px (regla de feedback táctil).

### 3.2 Barra Superior del Shell (AppHeader unificado)

El shell renderiza **UNA sola barra superior persistente** con dos modos:

- **Modo hub:** transparente, flotante sobre el mapa. Contiene solo la campana (3.4). La search bar del hub se ubica debajo de esta barra, coordinando sus offsets superiores.
- **Modo interno:** la barra ES el AppHeader (sticky, blur con token grafito translúcido, borde inferior): `[back] [campana] [título]`.

Reglas de la barra:

- **Botón back:** visible solo cuando el usuario NO está en el hub (`/`). Ejecuta `router.back()`.
- **Apilamiento horizontal:** back y campana viven en el mismo contenedor flex. Cuando el back aparece, la campana cede la esquina superior izquierda y se posiciona a su derecha. El orden se resuelve por **flujo del contenedor**, jamás por posicionamiento absoluto manual. La campana no "salta": se desplaza como elemento de flujo.
- **Título dinámico** por vista (solo modo interno).
- La search bar NO es de la barra: es del hub exclusivamente (decisión cerrada).

### 3.3 Clasificación de los client components del shell

`usePathname`, `router.back()`, el estado abierto/cerrado del panel y el badge son estado de navegación/presentación — no son capa 4 de negocio, no son hooks de datos, no tocan tRPC. No violan la letra de 5.1 del PROJECT_CONTEXT (que prohíbe hooks de datos/roles en `ui/`), pero tocan su espíritu ("Server Components por defecto").

**Decisión:** la Barra Superior (back + campana) y la BottomNav son las piezas cliente del shell (capacidades del dispositivo, no componentes de librería), excepción documentada. Son los únicos client components con permiso permanente en la capa de shell. Cualquier candidato adicional a "client component de shell" requiere enmienda de este documento.

### 3.4 Campana de Notificaciones (CIERRA la decisión 9.3)

La campana es **ciudadana del shell**: vive en el mismo plano de permanencia que la BottomNav (siempre visible, nunca cubierta, presente en toda vista con sesión activa). No es contenido de página.

- **Posición por defecto:** esquina superior izquierda.
- **Comportamiento de apilamiento:** al aparecer el botón back (vistas internas), la campana cede la esquina y se apila a su derecha, según 3.2.
- **Click → panel de notificaciones** (bandeja desplegable). El panel:
  - Respeta 2.4: **jamás tapa la BottomNav**; su borde inferior termina sobre la nav.
  - Ocupa la capa 45 de la escalera (2.3): sobre contenido y bottom sheet, bajo nav y toast.
  - Cierre: tap fuera, botón de cierre, tecla Escape.
- **Es el punto de montaje permanente del polling (9.2):** la isla cliente del badge de no leídas vive aquí.
- **Badge:** contador de no leídas sobre el icono. Su color es **semántico estándar** (4.5), jamás un acento Cypher: el badge ES información, y los acentos no informan (4.2).

---

## 4. Sistema de Color Cypher

### 4.1 Filosofía: grafito + neón quirúrgico

La app es **oscura en su totalidad**. La información vive en grises sobre grafito. El color es energía, no dato: los tres acentos existen para identidad, ambiente y jerarquía visual — **jamás para transportar información crítica al usuario**. La legibilidad de la información no depende nunca de un acento.

Esta filosofía explica la paleta por diseño: un lima neón (#CCFF00) no puede significar "aprobado" porque su primera lectura es "street", no "OK". Los semánticos de estado quedan en estándar (4.5).

### 4.2 Tokens y roles

**Superficies (la escalera de profundidad):**

| Token | Hex | Rol |
|---|---|---|
| `cypher-5` | #141414 | Fondo raíz del dispositivo |
| `cypher-5-1` | #1F1F1F | Superficie elevada 1: cards, sheets, nav |
| `cypher-5-1-1` | #2A2A2A | Superficie elevada 2: inputs, chips, elementos interactivos, estados hover |

La escalera de profundidad es la jerarquía visual: más claro = más elevado/interactivo. Prohibido usar blancos puros (`white`, `gray-50`, `gray-100`) como superficie dentro del dispositivo. El wireframe de referencia en blanco muere como piel; sobrevive como estructura.

**Texto (la escala informativa):**

| Token | Hex | Rol |
|---|---|---|
| `cypher-4` | #E0E1DD | Texto primario / títulos (el "gris sobre grafito") |
| `cypher-4-2` | #C6C7C3 | Texto secundario |
| `cypher-4-2-2` | #ACADAA | Texto muted, placeholders, metadatos |

**Acentos (quirúrgicos, nunca informativos):**

| Token | Hex | Rol |
|---|---|---|
| `cypher-1` | #7B2CBF | Identidad/marca (púrpura) |
| `cypher-2` | #CCFF00 | EL acento street principal (lima neón) |
| `cypher-3` | #00F5D4 | Acento secundario (turquesa neón) |
| `cypher-1-1/-2`, `cypher-2-1/-2`, `cypher-3-1/-2` | — | Derivados claros (-1) y oscuros (-2) de cada acento |

Reglas de uso de acentos:

1. **Prohibido** usar acentos para estados, errores, confirmaciones o cualquier dato que el usuario necesite leer (estados usan 4.5).
2. **Permitido:** fondos de secciones específicas (con derivados -2 como fondo profundo: ej. una franja de sección de torneos sobre `cypher-1-2`), detalles gráficos, indicadores decorativos, efecto neón (4.4).
3. Texto sobre acento: solo `cypher-5` (grafito sobre neón). Combinación legal y de alto contraste.
4. Texto en color de acento sobre oscuridad: solo en elementos no informativos (marca, decoración) o tamaños grandes.

### 4.3 Matriz de combinaciones legales

| Fondo ↓ / Contenido → | Texto primario (4) | Texto secundario (4-2) | Acento como detalle | Grafito (5) como texto |
|---|---|---|---|---|
| cypher-5 (raíz) | ✅ | ✅ | ✅ | — |
| cypher-5-1 (elevada 1) | ✅ | ✅ | ✅ | — |
| cypher-5-1-1 (elevada 2) | ✅ | ✅ | ✅ | — |
| Acento (-1 / base) | — | — | — | ✅ |
| Acento -2 (profundo) | ✅ | ✅ | ✅ | ✅ |

Fuera de esta matriz = combinación prohibida. `cva` solo construye desde esta matriz; ninguna variante puede inventar pares nuevos sin enmienda.

### 4.4 Efecto Neón

Los títulos grises (`cypher-4`) pueden portar glow de lima (`cypher-2`) o turquesa (`cypher-3`).

Reglas:

- Es una **utilidad de la librería interna** (shadow/glow definido en CSS centralizado o plugin de Tailwind), jamás inline (3.2).
- Es **presentación, no semántica**: un título neón no significa nada más allá de energía visual.
- Reservado a títulos/elementos destacados; prohibido en párrafos, datos tabulares y estados.
- El glow usa el derivado -1 del acento como halo (suave), nunca el acento base a plena opacidad como sombra.

### 4.5 Semánticos de estado (deuda documentada)

Decisión cerrada: **los estados usan el estándar de Tailwind** (`green-*`, `red-*`) por ahora. El verde de Cypher es neón, no verde de aprobación — no puede cargar la semántica. El badge de notificaciones y el punto de "torneos activos" en los pines usan esta familia estándar.

Registrado como deuda futura: diseñar una familia semántica propia (success/danger/warning) que conviva con la regla de "acentos no informativos". Etiqueta de deuda: **TECH-DEBT-COLOR-SEMANTICS**.

### 4.6 El aurora oficial

El fondo aurora del hub (detrás del mapa) se re-mapea de los colores huérfanos del prototipo a los acentos Cypher: manchas radiales de `cypher-2`, `cypher-3` y `cypher-1` en baja opacidad sobre `cypher-5`. La receta exacta (posiciones, opacidades) se fija en la implementación y queda documentada como la única definición válida del aurora (DRY del gradiente).

---

## 5. El Hub / Mapa — Especificación del Sistema 12

*(Este sistema estaba "Por especificar" en PROJECT_CONTEXT v2.0. Este capítulo es su especificación.)*

### 5.1 Stack de mapa

- **Leaflet + react-leaflet**, tiles de OpenStreetMap. Sin Google Maps, sin Mapbox, sin API keys (el espíritu de 7.10 sobrevive intacto).
- Carga por `next/dynamic` con `ssr: false` (Leaflet requiere `window`). El hub es una **isla cliente**: la estructura del shell viaja servida (RSC), el mapa se hidrata en el navegador.
- Controles nativos de Leaflet eliminados (`zoomControl: false`, `attributionControl: false`).

### 5.2 El hack de tiles (excepción técnica documentada)

`grayscale(100%)` + `mix-blend-mode: multiply` + `opacity: 0.8` sobre el tile-pane de Leaflet convierte el blanco del tile en transparente: sobre el aurora oscuro solo quedan las calles, en modo urbano oscuro, sin pagar un proveedor de tiles dark.

Registro obligatorio:

1. Vive en CSS centralizado, no inline (es CSS sobre DOM de tercero que Tailwind no alcanza — excepción justificada a 3.2, documentada).
2. Con comentario de por qué funciona y de qué depende (estructura interna del DOM de Leaflet, blanco base de los tiles de OSM).
3. Riesgo conocido: si OSM cambia su estilo de tiles base, el efecto puede degradarse. Riesgo aceptado y documentado; revisión en cada upgrade de Leaflet.
4. Los pines NO heredan el filtro (viven fuera del tile-pane).

### 5.3 Pines

- Componente `<CourtPin />` (divIcon de Leaflet) alimentado por `api.court.list` (vía la costura de Sección 7 mientras la deuda siga abierta).
- Lenguaje visual del pin: estado `ENABLED` → pin oscuro; `DISABLED` → pin apagado. Indicador de torneos activos (punto verde semántico estándar — ver 4.5).
- **Interacción: click simple.** El long-press de 7.10 queda **diferido a fase madura**. Ratificado.
- Detalle técnico de composición React↔Leaflet (divIcon consume HTML string): a resolver en implementación. El componente sigue siendo `ui/` puro: recibe la cancha por props.

### 5.4 Bottom Sheet de cancha

- Al tap de pin: pan suave del mapa + sheet de ficha.
- Posición: respeta la nav (por encima de ella, nunca tapándola), anclado abajo-izquierda, ancho acotado al dispositivo.
- Contenido: nombre, dirección, estado (semántico estándar), mini-matriz de disponibilidad, torneos activos, inventario, CTA "Ver Detalle" → `/canchas/[id]`.
- Estados de carga: skeletons en la mini-matriz y torneos (honestidad de carga).
- Animación de entrada: spring (frontera Motion One, ver Sección 6).
- Cierre: botón X, tecla Escape.

### 5.5 Controles y filtros (exclusivos del hub)

- Barra superior en modo hub (3.2): campana sola, flotante. La **search bar** se sitúa debajo de la barra superior.
- Zoom in/out y centrar: flotantes derecha, coordenadas en la escalera 2.3. Deshabilitados mientras el sheet está abierto.
- Filtros rápidos: debajo de la search bar. **El filtrado es local** (capa 4 sobre la lista ya materializada en capa 2) — ver 8.2.
- Feedback: todo control con `hover:`/`active:` evidentes, mínimo 44px, vibración háptica en selección de pin (`navigator.vibrate`, mejora progresiva silenciosa donde no exista).

---

## 6. Frontera de Animación: Tailwind vs Motion One

Un solo sistema mental, dos dueños por naturaleza de la animación:

| Animación | Dueño | Ejemplos del proyecto |
|---|---|---|
| Micro-feedback de estado (instantáneo, sin secuencia) | Tailwind (transiciones en clases/variantes `cva`) | `active:bg-*` de botones, hover de chips, cambio de color de foco |
| Entrada/salida de elementos (secuencia, spring, física) | **Motion One** | Aparición del bottom sheet (spring), toast entrando/saliendo, despliegue del panel de notificaciones, transición entre estados de Sala de Cine |

Regla práctica: si la animación tiene secuencia, rebote, o requiere desmontar el elemento al terminar → Motion One. Si es un cambio de estado de superficie → Tailwind.

Aclaraciones de cumplimiento:

1. Motion One manipula estilos del DOM en runtime; eso **no viola 3.2** (que castiga estilos declarados por el desarrollador en el JSX). Lo que la librería deja en el DOM es estado de presentación transitorio. Queda escrito para auditorías futuras.
2. Motion One exige cliente: todo lo que anime con él vive en templates `'use client'` o islas cliente. El hub ya es isla por Leaflet; coherente.
3. Las keyframes de skeleton del prototipo migran a utilidades Tailwind (animate-pulse ya cubre el caso). Motion One no entra donde CSS basta.

---

## 7. Datos: Pines como Entidad y la Costura

### 7.1 La deuda

PROJECT_CONTEXT 7.10 dice "sin coordenadas en BD, posiciones relativas". La evolución a Leaflet **mató la razón de ser de esa regla** (Leaflet exige coordenadas reales). Decisión cerrada: la regla queda **obsoleta**; adaptar los datos es deuda técnica formal. Mientras se paga: **datos quemados** (fixtures de canchas de Sogamoso/Nobsa).

Etiqueta de deuda: **TECH-DEBT-GEO**.

### 7.2 Propuesta de entidad: MapPin

La posición geográfica se modela como **entidad propia con relación 1:1 a Court**, no como campos sueltos:

- `MapPin`: identidad propia (`id`), relación única con `courtId`, latitud, longitud (evaluar en auditoría: etiqueta visual, orden, metadatos de presentación).
- Justificación: (a) **aísla la deuda** — la migración toca una tabla nueva, no muta Court; (b) la cancha no sabe de mapas (separación de dominio); (c) deja puerta abierta a proyecciones futuras del mapa; (d) el seed de datos quemados puede poblar MapPin sin ensuciar Court.
- Costo conocido: un join para el caso de uso principal (hub). Aceptado: la lectura del hub es agregada (cancha + pin + torneos activos) y ya vive en un solo query del router.

⚠️ **PROPUESTA:** la estructura final (nombres, tipos, convenciones de tabla) debe calzar con el `schema.prisma` real, que aún no ha sido auditado (Sección 10). La migración se etiqueta siguiendo la convención existente (`YYYYMMDDHHMMSS_nombre`) tras esa auditoría. Nombre tentativo: `add_map_pins`.

### 7.3 La costura tipada en el front (patrón anti-propagación de deuda)

Mientras TECH-DEBT-GEO viva:

1. El front consume el **contrato**, no el fixture: los tipos del hub se infieren del output de tRPC (`api.court.list`), aunque la fuente temporal sea el fixture.
2. El fixture vive en un único módulo que **cumple ese contrato tipado** (falla compilación si miente).
3. Ningún componente importa el fixture directamente; solo la fuente de la costura.

Al pagar la deuda (migración + seed con coordenadas reales): se cambia la fuente de la costura y **cero componentes se enteran**. La deuda queda en un archivo, no regada por el front (3.1 aplicado a deuda técnica).

---

## 8. Comunicación Back ↔ Front — Mapa de Canales por Vista

*(Aplica la tabla 4.3 del PROJECT_CONTEXT a las vistas de este documento. La verificación contra los routers reales es auditoría pendiente.)*

### 8.1 Canales del Hub

| Dato | Canal de lectura | Canal de cambios | Presentación |
|---|---|---|---|
| Lista de canchas + estado ENABLED/DISABLED | RSC (materialización) | Reconciliación al foco | Materializado |
| Posición de pines (MapPin) | RSC, mismo query agregado que canchas | Ídem (baja frecuencia extrema) | Materializado |
| Torneos activos por cancha (agregado del pin) | RSC (pre-calculado) | Ídem | Materializado |
| Mini-matriz del bottom sheet | Pull puntual al abrir el sheet | Reconciliación al foco | Skeleton → dato |
| Detalle de cancha `/canchas/[id]` | RSC | Reconciliación al foco | Materializado |

### 8.2 Canales de búsqueda y filtros

**Decisión de canal: el filtrado es 100% cliente.** La búsqueda por nombre y los tres filtros rápidos operan sobre la lista ya materializada en capa 2 (capa 4 filtrando capa 2). Cero peticiones por keystroke. Justificación: dataset pequeño (decenas de canchas, no miles), baja frecuencia de cambio, y la regla de compra de frescura (3.4 v2.0): "¿qué pierde el usuario si la lista tiene 30 segundos?" — nada.

### 8.3 Canales de Sala de Cine (definidos en 7.6 v2.0 — se citan, no se redefinen)

Hall con contador + edad visible y refetch 15s; prereserva como hecho con countdown local; inscripción optimista con reconciliación gruesa post-mutación. Nav siempre visible (2.4) refuerza la supervivencia de la prereserva ante navegación.

### 8.4 Verificación pendiente

Los routers reales ya existen en el backend — cómo exponen hoy estas lecturas (¿queries agregadas? ¿N+1? ¿el output calza con la costura de 7.3?) se audita en Sección 10 antes de escribir el front del hub.

---

## 9. Notificaciones

*(S11 está especificado en backend: canal in-app, familias, polling 30s, badge de no leídas. Este capítulo prepara el dolor de cabeza desde el front.)*

### 9.1 Los tres sistemas que no hay que confundir

| Sistema | Naturaleza | Capa |
|---|---|---|
| Toast | Feedback de una acción del usuario (protocolo 4.4 v2.0) | Capa 4 (efímero) |
| Notificaciones | Datos del dominio generados transaccionalmente en servidor | Capa 2 (caché) |
| Preferencias de familias | Datos del usuario | Capa 2 |

Un toast jamás "es" una notificación. El toast muere en 3 segundos; la notificación vive en bandeja hasta leerse.

### 9.2 El polling del badge: quién, dónde, cómo

- El polling 30s del badge tiene **punto de montaje permanente**: la campana (3.4), ciudadana del shell, montada solo con sesión activa. El layout sigue siendo RSC; la campana es la isla cliente que solo hace polling y expone el número.
- Query key por entidad (`notifications.count`), dueño único del dato. La bandeja y el badge comparten entidad, no duplican canales.
- Al abrir la bandeja y marcar leídas: optimistic UI por entidad + rollback animado + toast de una línea si falla (protocolo 4.4 v2.0 completo).

### 9.3 Punto de acceso: la campana (DECISIÓN CERRADA)

La campana de notificaciones es elemento persistente del shell, esquina superior izquierda por defecto, con apilamiento horizontal respecto al botón back (especificación completa en 3.4). El badge vive sobre la campana; el panel de bandeja se despliega desde ella respetando la nav intocable (2.4) y la capa 45 de la escalera (2.3). La arquitectura del polling (9.2) queda validada contra este punto de montaje.

### 9.4 Preferencias

UI de familias (con SYSTEM bloqueado, no desactivable) vive en Perfil. Renderizado según RBAC desde servidor. Las familias desactivadas ocultan de bandeja pero siguen generándose en BD (S11): el front solo filtra presentación, nunca asume que "no ver" es "no existir".

---

## 10. Auditoría Pendiente del Código Existente (prerrequisito de implementación)

Este documento se escribió sin leer el código real. Antes de tocar una línea de front, se audita — en este orden:

| # | Artefacto | Qué se busca | Alimenta |
|---|---|---|---|
| 1 | `prisma/schema.prisma` | Modelo Court actual, convenciones de nombres/tablas, relaciones existentes, cómo están modeladas prereservas e inscripciones | 7.2 (migración MapPin definitiva), etiquetado de migración |
| 2 | Routers tRPC (court, tournament, auth, sala de cine) | Qué queries/mutations exponen, si siguen patrón delgado+engines, shape de outputs | 8 (canales reales), 7.3 (costura) |
| 3 | `src/app/` route groups reales | Qué vive en `(public)`, qué hace `page.tsx` raíz, estructura actual de `(app)` | 2.2, decisión de routing del hub |
| 4 | `src/components/` existente | Violaciones a 3.2/3.3/5.1 v2.0 (inline styles, barrels, hooks de datos en ui/), scaffold T3 residual (`post.tsx`, `post.ts`), qué componentes ya existen vs. los que este documento define | Plan de limpieza |
| 5 | Front actual de Sala de Cine / Auth / Torneos | Cómo consumen hoy los datos (¿siembran initialData? ¿refetch salvaje? ¿spinners prohibidos?) | Plan de limpieza |
| 6 | `globals.css` + config Tailwind | Dónde nacen los tokens Cypher (4), utilidad del glow neón (4.4), CSS del hack de tiles (5.2) | Sección 4 |
| 7 | Query client / config TanStack | Defaults de staleTime/gcTime contra la tabla 4.3 v2.0 | 8 |
| 8 | Estado de sesión en cliente | Cómo lee el shell la sesión (para la campana/polling 9.2 y el RBAC renderizado desde servidor) | 2, 9 |

Entregable de la auditoría: **informe de hallazgos + plan de limpieza priorizado**. Solo entonces se toca código.

---

## 11. Enmiendas que este Documento provoca en PROJECT_CONTEXT v2.0

Para mantener una sola verdad (y que la verdad no se contradiga):

1. **7.10 "Mapa custom Canvas/SVG"** → obsoleto. Sustituido por Leaflet + OSM (5.1). El espíritu (sin dependencias comerciales de mapas) se conserva.
2. **7.10 "Sin coordenadas geográficas en BD"** → obsoleta. Deuda formal TECH-DEBT-GEO; destino: lat/lon en BD vía entidad MapPin (7.2).
3. **7.10 "Long-press para mobile"** → diferido (5.3). Click simple vigente.
4. **Sección 9, Sistema 12** → pasa de "Pendiente / Por especificar" a "Especificado en SISTEMA_12_FRONTEND_UI_UX.md".
5. **Contexto complementario de Fase 1** (documento externo): la regla de ocultar BottomNav en modales fullscreen queda **revocada** por 2.4.
6. La sección 11 de v2.0 ("Qué NO está en este documento: paleta de colores") recibe su llenado parcial: la paleta vive ahora aquí (Sección 4).

---

## 12. Estado de Decisiones

**Cerradas:**

| Decisión | Resultado |
|---|---|
| Marco-dispositivo | Universal, reutilizable por route group (2.1–2.2) |
| Tema visual | Oscuro grafito total; superficies blancas prohibidas (4.2) |
| Acentos | Nunca informativos; sí secciones y neón (4.2) |
| Efecto neón | Utilidad interna, títulos, decorativo (4.4) |
| Semánticos | Estándar Tailwind; deuda TECH-DEBT-COLOR-SEMANTICS (4.5) |
| Nav bar | Intocable por cualquier modal o panel (2.4) |
| Barra superior | Única y persistente, dos modos: hub (flotante) / interno (AppHeader) (3.2) |
| Campana de notificaciones | Ciudadana del shell, esquina sup-izq, apila con back; panel en capa 45, jamás tapa nav (3.4, 9.3) |
| AppHeader | Solo modo interno; hub gestiona su propia search bar (3.2) |
| Interacción de pines | Click simple; long-press diferido (5.3) |
| Coordenadas | Deuda TECH-DEBT-GEO; datos quemados con costura tipada (7) |
| Mapa | Leaflet + OSM; hack de tiles documentado como excepción (5.1–5.2) |
| Animación | Tailwind = estados; Motion One = secuencia/spring (6) |
| Filtrado del hub | 100% cliente sobre capa 2 (8.2) |

**Abiertas (dependen de auditoría, no de diseño):**

| Decisión | Bloquea | Resolución |
|---|---|---|
| Forma final de MapPin (7.2) | Migración etiquetada | Auditoría de schema (10.1) |
| Destino de `(public)` (2.2) | Routing del hub | Auditoría de route groups (10.3) |
| Receta exacta del aurora (4.6) | Nada | Implementación |
| Patrones React↔Leaflet para pines/sheet | Implementación del hub | Fase de diseño técnico |

---

> **Siguiente paso propuesto:** ejecutar la auditoría de Sección 10 (empezando por `schema.prisma` y routers). Su entregable desbloquea el plan de limpieza y la migración etiquetada. Este documento permanece en Borrador hasta que la auditoría no contradiga nada de lo aquí especificado.
