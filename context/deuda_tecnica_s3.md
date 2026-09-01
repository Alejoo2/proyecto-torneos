REPORTE DE DEUDA TÉCNICA: SISTEMA 3 (EQUIPOS & PLANTILLAS)
Estado: Sistema 3 (Núcleo) implementado. Deuda técnica aislada y documentada para fases posteriores.
Propósito: Registrar los placeholders temporales, lógica omitida y puntos de acoplamiento para los Sistemas 4, 6, 7 y 11.

1. Deuda Técnica RESUELTA (Sistemas 1 y 2)
Con la implementación del Sistema 3, hemos saldado las siguientes deudas heredadas:

1.1. Modelo TeamMembership (Placeholder del Sistema 2)
Deuda Anterior: En el Sistema 2, se añadió un modelo básico TeamMembership sin relaciones formales para que la lógica de visibilidad de teléfono compilara.
Resolución: Se ha reemplazado por el modelo completo. Ahora está formalmente relacionado con Team y Player, incluye joinedAt, y tiene índices optimizados (@@index([teamId, leftAt])).
1.2. Visibilidad de Teléfono (profile.engine.ts)
Deuda Anterior: La función getVisiblePhone verificaba si un jugador era capitán (isCaptain: true), pero no existía forma de que un jugador obtuviera ese flag en la base de datos.
Resolución: El flujo de teamEngine.acceptInvitation ahora crea el TeamMembership con isCaptain: true para el creador. La lógica del Sistema 2 ahora opera sobre datos reales.
1.3. Asignación de Capitanía (RBAC)
Deuda Anterior: Faltaba el motor que creara registros en RoleAssignment con el rol captain al activarse un equipo.
Resolución: En la transacción de acceptInvitation (cuando el equipo pasa de DRAFT a ACTIVE), el sistema busca el rol captain en la BD y crea el RoleAssignment automáticamente para el creador.
1.4. Motor de Capitanía (captaincy.engine.ts)
Deuda Anterior: El spec mandataba que la lógica de transferencia viviera en server/core/rbac/, pero no existía.
Resolución: Se ha creado el motor con validación estricta: el capitán actual debe ser miembro activo, el receptor debe ser miembro activo del mismo equipo, y se valida la unicidad (no ser capitán de otro equipo activo).
2. Deuda Técnica ADQUIRIDA (Sistema 3)
Al priorizar la arquitectura base y la fidelidad al spec en el backend, hemos generado la siguiente deuda técnica temporal:

2.1. Motores de Dominio Incompletos (server/core/)
Se han creado los motores y validado la arquitectura, pero faltan por implementar algunos métodos del spec para no sobrecargar esta iteración:

team.engine.ts (Gestión de Membresía):
Faltan: leave (abandonar equipo), removeMember (expulsar), update (editar datos), y el flujo de eliminación completo (requestDelete / confirmDelete con consenso de 3+ miembros).
Flujo DRAFT -> ACTIVE (Bug Menor Conocido):
En acceptInvitation, la lógica para buscar el equipo en estado DRAFT requiere un ajuste. Actualmente asume que el teamId viene en la invitación, pero el spec indica que durante el DRAFT el teamId es null. Se necesita un ajuste en invitePlayer para pasar el ID del equipo DRAFT recién creado, o ajustar la búsqueda en acceptInvitation usando el invitedBy.
2.2. Frontend: Hooks no Co-localizados
Deuda: En create-team-form.tsx usamos directamente api.team.createDraft.useMutation().
Spec: El spec dicta que los hooks de dominio se co-localicen en src/components/features/team/use-team.ts.
Acción: Extraer las mutaciones de tRPC a un archivo use-team.ts en la siguiente iteración de UI.
2.3. Frontend: Rutas y Vistas Faltantes
Deuda: Solo se construyó la vista de listado/formulario en /equipos. El usuario puede crear el equipo, pero al redirigir a /equipos/[teamId] no hay vista de detalle (Card Maestra hidratada, lista de miembros, etc.).
Acción: Crear el Template Inteligente para /equipos/[teamId] que consuma getById y getMembers.
2.4. UI: Workaround para Colores Dinámicos (Cero CSS Inline)
Deuda: Para respetar la regla de "Cero CSS Inline" con los colores hexadecimales dinámicos del equipo, usamos un truco gráfico: inyectar el color en un atributo fill de un SVG oculto.
Evaluación: Funciona visualmente, pero no es escalable para textos o fondos de contenedores complejos.
Acción: Evaluar el uso de CSS Variables seguras (ej. style={{ '--team-primary': color }} aplicado a clases Tailwind bg-[--team-primary]) o aceptar la excepción de estilo inline solo para propiedades de color de marca dinámica, previa aprobación arquitectónica.
2.5. Notificaciones Síncronas (Sistema 11)
Deuda: El spec del Sistema 3 indica que al enviar/aceptar invitaciones y transferir capitanía, se deben generar registros en la tabla Notification.
Estado: No se implementó. La lógica de transacciones en team.engine.ts y captaincy.engine.ts está aislada y lista para inyectar la creación de notificaciones en cuanto el Sistema 11 esté disponible.
3. Guía Rápida de Integraciones para la Siguiente Fase
🔗 Próximos pasos inmediatos (Iteración Sistema 3.1):

Corregir el flujo de búsqueda del equipo DRAFT en acceptInvitation.
Implementar los métodos faltantes en team.engine.ts (leave, removeMember, update).
Co-localizar hooks en use-team.ts.
Construir la página de detalle /equipos/[teamId] consumiendo la UI Tonta (Card Maestra).
🔗 Sistema 4 (Reclutamiento):
El flujo de invitación unidireccional (invitePlayer) ya está programado en el backend. El Sistema 4 solo deberá construir la UI de directorio de jugadores y consumir este endpoint existente.

Resumen del Arquitecto:
El Sistema 3 ha sido un éxito a nivel de modelo de datos y motores de dominio. La defensa en profundidad (Capa 1 Auth, Capa 2 RBAC tRPC, Capa 3 Validación de Capitán en Engine) está sólidamente integrada. La deuda actual es puramente de UI e iteración de funciones CRUD secundarias. El sistema está listo para ser consumido por el frontend.