# Sistema 2: Usuarios / Perfiles / Matriz de disponibilidad

> **Estado:** Rediseñado v2.0 (decisiones del dueño, 2026-09 — aún NO implementado)
> **Naturaleza:** prescriptiva en matriz (§5–§8), descriptiva en perfil (§3–§4).
> Todo lo prescriptivo es trabajo pendiente (código actual = v1: 84 slots
> AVAILABLE + onboarding de 1 paso + CONFLICT muerto sin consumidores).

## 1. Visión

El jugador dueña su matriz sin fricción: nace vacía, la edita libremente por
lotes, y lee dos capas trazadas que no puede tocar — sugerencias de sus equipos
(amarillo) y conflictos duros (rojo).

## 2. Decisiones del dueño (2026-09)

| Decisión | Valor |
|---|---|
| Onboarding | ELIMINADO. Registro = `User` + `Profile` + `Player` + matriz vacía, todo en una tx. Nada que completar, nada que retomar |
| Matriz inicial | Vacía = 84 celdas `UNAVAILABLE`. El usuario habilita lo suyo (invierte el default v1) |
| Amarillo | Sugerido por el equipo: el capitán publica horario sugerido; el jugador lo ve en su matriz. Multi-equipo: unión; toda amarilla es válida |
| Rojo | Conflicto duro: el jugador, en la misma franja, con 2+ equipos en torneos DISTINTOS programados (distintas canchas). Mismo torneo ≠ duro: se desambigua en carga de resultados (ahí se ve en qué partido jugó) |
| Edición | Libre y total sobre verde/gris; amarillo/rojo no editables (trazados). Batch: el cliente acumula toggles ~1 min y envía UNA mutación bulk |
| Resolución del rojo | El capitán lo ve y lo pide por interno (sin herramienta punitiva). El jugador se auto-marca AUSENTE para ese torneo. Decisión exclusiva del jugador; NO relacionada con el `markAbsent` del capitán en convocatoria |
| Teléfono | Campo de perfil post-registro, opcional, edit no bloqueante (ver §3). Sin onboarding que lo exija, vive solo en perfil |
| Teléfono | Intención §6.2 v1 vigente (gaps ya documentados: `manager.isActive`, multi-equipo) |

## 3. Perfil (código-as-is)

Teléfono: campo post-registro, opcional, edit no bloqueante (`profile.update`,
`phone` optional en `routers/profile.ts:19,30`). Nada lo exige ni lo bloquea;
las reglas de visibilidad (§6.2 v1: capitán→gestores, jugador→su capitán) siguen
vigentes con sus gaps. Zods `displayName 1-50, phone ≤20, bio ≤500` (`routers/profile.ts`). Avatar por
pipeline OAuth (ver S01 §3.2.1). `profile.update(Partial)` sin whitelist en
engine (deuda). `completeOnboarding` deprecado con el onboarding (no borrar
hasta migrar gate de `middleware.ts`).

## 4. Cambios de código pendientes (onboarding off + matriz vacía)

1. `createUser` (`auth/index.ts`): `onboarded:true`, 84 slots `UNAVAILABLE`.
2. Dev-login (`config.ts`): slots `UNAVAILABLE` (ya nace `onboarded:true`).
3. `middleware.ts`: gate `/onboarding` queda sin nacimientos nuevos; decidir si
   se retira o se recicla (p. ej. completar teléfono).
4. Seed: alinear (`UNAVAILABLE` + reescribir franjas de prueba).

## 5. Estados de celda (contrato nuevo)

| Estado | Color | Quién lo escribe | Editable por jugador |
|---|---|---|---|
| `AVAILABLE` | Verde | Jugador | Sí |
| `UNAVAILABLE` | Gris | Jugador | Sí |
| `SUGGESTED` | Amarillo | Capitán de su equipo (slot sugerido) | No (lectura) |
| `HARD_CONFLICT` | Rojo | Derivado: fixture de sus equipos | No (lectura) |

Cálculo (runtime, `domain/`): rojo = misma franja con partidos programados de
2+ equipos del jugador en torneos distintos (cancha distinta). Amarillo = unión
de sugerencias de sus equipos. Verde/gris = BD propia. Nada de esto existe hoy:
`conflict.ts` actual (0 consumidores) se reemplaza o extiende.

## 6. Edición por lotes (contrato nuevo)

El cliente acumula celdas tocadas durante ~1 min (timer, capa 4) y dispara UNA
mutación bulk con el delta (`setSlots`-like: array `{dayOfWeek,timeSlot,status}`;
requiere endpoint nuevo — el `setSlots` v1 nunca existió). Optimistic por celda
(protocolo 4.4); el bulk solo transporta verde/gris; amarillo/rojo jamás viajan
al servidor. `toggleSlot` individual queda como fallback/error, no como camino
principal.

## 7. Sugerencia del capitán (modelo nuevo, trabajo S03)

El capitán publica/borra slots sugeridos de SU equipo (permiso `team:manage`,
ya existe). Requiere tabla nueva (ej. `TeamSuggestedSlot(teamId,dayOfWeek,timeSlot)`)
+ endpoints gestionar + lectura agregada para la matriz del jugador.
**Análisis pendiente en S03.**

## 8. Auto-ausencia por torneo (mecanismo nuevo, trabajo S06/S07)

El jugador se marca ausente para UN torneo inscrito (resuelve su rojo).
Efectos: sale del conteo del Factor 1 de ese torneo (`enrollment.engine`);
NO toca convocatorias pasadas ni equivale al `markAbsent` del capitán
(convocatoria puntual, potestad del capitán). Requiere modelo + endpoints +
regla Factor 1. **Análisis pendiente en S06/S07.**

## 9. Sistemas tocados — análisis pendiente marcado

| Sistema | Qué le toca | Estado |
|---|---|---|
| S03 equipos | Sugerencias del capitán: modelo, permiso, UI gestión | ⏳ pendiente |
| S04 reclutamiento | ¿Mostrar sugeridos/disponibilidad real al invitar? | ⏳ pendiente |
| S06 torneos | Auto-ausencia por torneo; Factor 1 excluye auto-ausentes; matriz vacía invierte supuestos del Factor 1 (¿umbral ≥5 sigue válido?) | ⏳ pendiente |
| S07 partidos | Fixture como fuente del rojo; distinguir auto-ausencia vs `markAbsent`; mismo-torneo sin rojo | ⏳ pendiente |
| S10 resultados | Desambiguación mismo-torneo en carga (en qué partido jugó) | ⏳ pendiente |
| S11 notificaciones | ¿Notificar sugerencia nueva / rojo detectado? | ⏳ pendiente |
| S12 UI | Matrix con 4 estados + batch timer + tab de edición; copy "oculto/no editable" para amarillo/rojo | ⏳ pendiente |

## 10. Deuda v1 que muere o muta

Muere: onboarding, `setSlots`-fantasma (renace distinto en §6), CONFLICT v1,
default AVAILABLE. Muta: `getMine` debe devolver fusión BD + sugerencias +
rojo (o endpoints separados por capa). Vigente: zods perfil, 7×12, teléfono
+gaps, `PREFERRED`/`TENTATIVE` como horizonte del enum.

> Versionado. Modificarlo requiere aprobación del dueño.
