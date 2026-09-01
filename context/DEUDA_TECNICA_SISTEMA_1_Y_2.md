Deuda Técnica e Integraciones — Sistemas 1 & 2
Estado: Sistemas 1 y 2 implementados. Deuda técnica controlada y aislada.
Propósito: Documentación exhaustiva de placeholders temporales, validaciones omitidas, limpieza de scaffolding y los puntos exactos de acoplamiento para los Sistemas 3, 4, 5, 6, 7 y 11.

1. Placeholders y Simulaciones Visuales (UI)
En el desarrollo de los Sistemas 1 y 2, se priorizó la arquitectura y la fidelidad a los wireframes. Los siguientes elementos visuales son placeholders que deben resolverse en fases posteriores:

Branding Visual (Logo y Nombre): En login-form.tsx y en el Hub Demo (/), el logo y el nombre de la app son bloques grises (bg-gray-200) o texto plano.
Deuda: Reemplazar por los assets reales de diseño (SVG del logo y tipografía de "Fútbol Barrio").
Skeleton Inicial (appLoading): Se simuló un retardo artificial de 800ms con setTimeout en un useEffect en el login para replicar el wireframe.
Deuda: Eliminar este retardo artificial y depender exclusivamente del estado isLoading nativo de React Server Components o de la consulta de sesión real de NextAuth.
Imágenes de Perfil (Avatares): El schema dicta que el avatar viene de OAuth (User.image). Actualmente la UI de Onboarding y el Hub no lo muestran ni previsualizan.
Deuda: En la UI de Onboarding y en la barra de navegación del Hub, consumir session.user.image y renderizar el avatar con el componente <Image /> de Next.js.
Cálculo de Conflicto (Estado CONFLICT en Disponibilidad): La UI de la matriz 7x12 ya soporta visualmente el estado CONFLICT (color amarillo), pero la query availabilityRouter.getMine devuelve solo los estados crudos de la BD (AVAILABLE / UNAVAILABLE).
Deuda (Sistema 7): Inyectar el cálculo en runtime cruzando la disponibilidad con los partidos programados.
2. Deuda Técnica Funcional (Auth, Routing & Validaciones)
Redirección de Onboarding (RESUELTO EN SISTEMA 2): En el Sistema 1, un usuario nuevo entraba directo al Hub sin validar si tenía phone o birthDate. Con la implementación del Sistema 2, se creó el campo onboarded en Profile y se añadió un middleware.ts a nivel raíz que fuerza el redirect a /onboarding si el flag es false.
Callback URL Hardcodeado (PENDIENTE): En login-form.tsx, signIn(provider, { callbackUrl: "/" }) fuerza la entrada al Hub.
Deuda: Si un usuario intenta acceder a una ruta protegida (ej: /torneos/123) sin sesión, el login debe redirigirlo de vuelta a esa ruta original, no al Hub. El componente de login deberá recibir la ruta original por props o buscarla en los headers/searchParams.
Endpoint de Visibilidad de Disponibilidad (PENDIENTE): El endpoint availabilityRouter.getByPlayerId no tiene validación de rol.
Deuda (Sistema 4): Modificar el protectedProcedure para verificar que el usuario que hace la petición tiene el rol de Capitán (usando el motor de RBAC). Si no es capitán, denegar el acceso.
Feedback de Errores en Optimistic UI (PENDIENTE): Si la mutación toggleSlot falla en el servidor, el Optimistic UI revierte el estado visual silenciosamente.
Deuda: Integrar el sistema de Toasts (Shadcn/UI) o el Sistema 11 de Notificaciones para mostrar un mensaje visual de error al usuario.
3. Motores de Dominio Pendientes (server/core/)
El spec mandata que la lógica de negocio viva en server/core/. Hasta ahora, la lógica de creación atómica de usuario vive en el evento createUser de NextAuth. Faltan por crear los siguientes motores:

server/core/rbac/captaincy.engine.ts (Sistema 3):
Todo el modelo de datos para la capitanía está en Prisma (TeamMembership, CaptaincyTransfer), pero no existe la lógica que valide que un jugador solo sea capitán de un equipo activo a la vez, ni el flujo de aceptación obligatoria de transferencia.
server/core/rbac/manager.engine.ts (Sistema 5/6):
Falta la función que el Admin ejecutará para asignar el rol manager a un usuario existente y crear su registro en la tabla Manager. Hoy por hoy, un usuario solo puede nacer como player.
4. Guía de Integración con Sistemas Futuros
🔗 Sistema 3: Equipos & Plantillas
Este es el sistema con mayor acoplamiento a los Sistemas 1 y 2.

Modelo TeamMembership (Placeholder): En el Sistema 2, añadimos un modelo básico TeamMembership en schema.prisma para que la lógica de visibilidad de teléfono compilara.
Acción: Al implementar el Sistema 3, relacionar este modelo formalmente con Team y ajustar índices.
Visibilidad de Teléfono:
En src/server/core/profile/profile.engine.ts, la función getVisiblePhone verifica si el jugador es capitán. El Sistema 3 deberá crear los registros en TeamMembership con isCaptain = true para que esta lógica se active.
Asignación de Capitanía:
Al crear un equipo, el Sistema 3 debe crear el TeamMembership y disparar un RoleAssignment con el rol captain.
Página de Edición de Perfil:
Crear la vista /config/perfil para que el usuario edite su nombre, bio y disponibilidad post-onboarding, reutilizando los componentes UI ya construidos.
🔗 Sistema 4: Reclutamiento
Estado de Invitaciones:
La spec indica que la disponibilidad no restringe invitación. El Sistema 4 deberá ignorar el estado UNAVAILABLE al enviar invitaciones, usándolo solo como dato informativo en la UI de reclutamiento.
🔗 Sistema 5: Canchas y Sistema 6: Torneos
Validación de Ownership (Capa 3): Los routers de tRPC para crear torneos deben usar permissionProcedure("tournament:create"). El motor en server/core/tournament/ debe verificar que el Manager que hace la petición tiene permisos sobre la cancha seleccionada (Capa 3 del spec §4.3).
Sembrado de Nuevos Permisos: A medida que se añadan funcionalidades de torneos, agregar filas a prisma/seed.ts con nuevos códigos (tournament:draw, etc.) y relacionarlos a los roles correspondientes.
🔗 Sistema 7: Partidos / Aplazamientos
Cálculo de Conflicto:
Modificar el endpoint que sirve la matriz de disponibilidad para inyectar los partidos programados del jugador. Se utilizará la función getSlotStatus (documentada en availability.engine.ts) que convierte horas a franjas usando Math.floor(match.scheduledAt.getHours() / 2).
🔗 Sistema 11: Notificaciones
Bienvenida Post-OAuth:
En el evento createUser de src/server/auth/index.ts, dentro de la transacción atómica, incluir la creación de un registro en la tabla Notification con la familia AUTH para dar la bienvenida al usuario nuevo.
Transferencia de Capitanía:
El motor captaincy.engine.ts deberá, al aceptar una transferencia, generar notificaciones síncronas para el antiguo y nuevo capitán.
5. Limpieza de Scaffolding (T3 Stack)
Quedan residuos del template inicial de T3 Stack que deben ser limpiados:

Router de Ejemplo (post.ts):
Eliminar src/server/api/routers/post.ts y su referencia en src/server/api/root.ts si no se ha hecho.
Componente de Ejemplo (post.tsx):
Eliminar src/app/_components/post.tsx ya que no sigue la arquitectura UI Tonto / Template Inteligente.
Resumen del Estado Actual
La base de los Sistemas 1 y 2 es sólida. La matriz RBAC está sembrada en la base de datos, la defensa en profundidad está programada en tRPC, el flujo de Onboarding genera las 84 franjas horarias automáticamente, la UI utiliza Optimistic UI y respeta la regla de Cero CSS Inline.

La deuda técnica actual es baja, está perfectamente aislada y documentada para resolverse en cuanto se inicien los Sistemas 3, 4 y 7.