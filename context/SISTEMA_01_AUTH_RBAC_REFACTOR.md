# Sistema 1: Auth & RBAC

> **Estado:** Refactorizado v2.0 (auditoría post-W11, doc vs código, 2026-09)
> **Naturaleza:** descriptiva. Lo no-implementado va a Horizonte.

## 1. Visión

OAuth (Google + Discord) + RBAC granular normalizado. Un usuario = un perfil;
múltiples roles; cada rol agrupa permisos. Tres capas: JWT firmado, middleware
tRPC por permiso, ownership en engine. **Todo registrado nace `Player`.**
Sin elección de rol en el registro.

## 2. Decisiones (verificadas en código)

| Decisión | Valor real |
|---|---|
| Provider | NextAuth v5 + Prisma Adapter (`AUTH_SECRET`; solo prod lo exige) |
| OAuth | Google, Discord (+ Credentials "Dev Login" solo `development`) |
| Modelo | 1 User : 1 Profile |
| RBAC | Tablas `Role/Permission/RolePermission/RoleAssignment`; naming `{modulo}:{accion}` |
| Jerarquía | Plana: `admin/manager/player/captain` (seed + matriz en `prisma/seed.ts`) |
| Capitanía | Transferencia con aceptación; 1 equipo activo por capitán; **gap:** `acceptTransfer` no sincroniza `RoleAssignment` captain (fix en S03) |
| Gestores | Admin asigna `manager` a cuenta existente; `Manager.isActive`; **SÍ delegan** vía `ManagerDelegate` (W11-E3) |
| Registro | Siempre jugador: evento `createUser` crea Profile + Player + 84 slots AVAILABLE + rol `player` en tx (`auth/index.ts:8-50`) |
| Uploads | Ninguno. Avatar = `User.image` del provider (ver §3.2.1) |

## 3. Modelo real (delta vs v1)

- `User`: estándar OAuth + `profile`. `Profile`: suma `onboarded` (gate
  `middleware.ts:46-54`), `delegateFor` (delegaciones recibidas).
- `Player`: suma `invitations/sentInvitations`, `stats`. `PlayerAvailability`:
  `@@unique[playerId,dayOfWeek,timeSlot]`, `AVAILABLE/UNAVAILABLE`, 7×12.
- `Manager`: `isActive`, `tournaments`, `delegates`. Nuevo `ManagerDelegate`
  (`managerId/profileId/designatedByUserId`, `@@unique[managerId,profileId]`).
- `TeamMembership`: suma `isStarter`, índices `[teamId,leftAt]/[playerId,leftAt]`.
  `CaptaincyTransfer`: suma `teamId` FK.
- `Session` (tabla) sin uso: estrategia `jwt` (`config.ts:97-99`).

### 3.2.1. Pipeline de avatar (deuda cerrada, sin documentar hasta hoy)

Adapter crea `User.image` desde el perfil OAuth antes del evento; nada la
sobrescribe. Viaja en sesión (`config.ts:102-130`). Backend la selecciona en
6 lecturas (team, match, recruitment×2, admin, perfil). `PlayerAvatar`
(`ui/player-avatar.tsx:30-35`) renderiza imagen o iniciales. Gaps honestos:
Dev-login nace sin imagen (iniciales, by design); pendiente verificar con un
OAuth real en BD.

## 4. Defensa en profundidad (código-as-is)

- **Capa 1 JWT:** firmado con `AUTH_SECRET`; claims `id/profileId/onboarded`
  (nunca roles/permisos). `profileId`+`onboarded` existen por el gate de
  onboarding, no son filtración.
- **Capa 2 tRPC** (`api/trpc.ts`): `publicProcedure` (vitrina) ·
  `protectedProcedure` · `permissionProcedure(code)` (lookup
  `roleAssignment→role.permissions→permission.code`, `:144-172`) ·
  `managerProcedure` (inyecta Manager activo; ownership fino en engine, `:183-202`).
- **Capa 3 ownership:** el engine verifica recurso (ej. `Tournament.managerId`
  vs gestor/delegado, fail-closed). **Nota v1 corregida:** el ejemplo con
  `Court.manager` era falso — `Court` no tiene manager.
- **Regla de oro:** permiso a nivel acción + ownership a nivel recurso.

## 5. Permisos sembrados (delta vs v1)

Base v1 intacta (14 códigos). Suman `rbac:manage`, `referee:manage`.
`match:postpone`/`match:result` están sembrados pero **sin consumidor en routers**
(match/result usan ownership gestor/delegado): mantener sembrados; cablear o
eliminar se decide en S07. "Capitán jamás carga resultados" se matiza: hoy lo
impide ownership, no un permiso.

## 6. Negocio crítico

Registro (§2), capitanía (§2 + gap), gestores (§2). `getVisiblePhone` parcial:
no valida `manager.isActive`; `memberships[0]` rompe multi-equipo (deuda S02).
Doble fuente `createUser`: OAuth (`onboarded:false`) vs Dev (`onboarded:true`,
bypass) — lógica fuera de engine (deuda).

## 7. Agregar permisos (procedimiento vigente)

1. Naming `{modulo}:{accion}`. 2. Seed en `prisma/seed.ts` + matriz de roles.
3. Proteger endpoint con `permissionProcedure(code)` u ownership en engine
   (elegir según §4; no duplicar). 4. UI: ocultar/deshabilitar desde datos del
   servidor (el front no autoriza). No existe router `rbac` ni `usePermission`
   (eran checklist, no código).

## 8. Diagrama (delta vs v1)

`User(1:1)Profile` → `Player` (availabilities, memberships, invitations±,
stats) · `Manager` (tournaments, delegates) · `RoleAssignment` · `delegateFor`.
`Membership` → `CaptaincyTransfer(+teamId)`. Sin `hooks/`, sin `manager.engine.ts`.

## 9. Checklist real (reescrito)

- [x] `AUTH_SECRET` + Google/Discord creds (`src/env.js`)
- [x] Schema + migraciones + seed roles/permisos
- [x] 4 procedures (`trpc.ts`) + `createUser` + onboarding gate
- [x] `captaincy.engine.ts` (falta sync de rol)
- [ ] Router `rbac` / `usePermission` (Horizonte, si hace falta)
- [ ] `match:*` cablear o eliminar (decidir en S07)
- [ ] Unificar `createUser` OAuth vs Dev (Horizonte)

## 10. Dependencias (corregidas)

S02 (perfil) · S03 (membership/capitanía) · S05 (gestores USAN canchas, no las
poseen) · S06 (ownership `Tournament.managerId`) · S07 (gestor/delegado,
capitán ausentes) · S11 (transferencias y capitanía deben notificar: TODO).

> Versionado. Modificarlo requiere aprobación del dueño.
