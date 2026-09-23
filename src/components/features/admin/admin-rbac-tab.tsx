"use client";

import { Fragment, useState } from "react";
import { useSession } from "next-auth/react";
import { Lock, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { api } from "torneos/trpc/react";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";
import { EmptyState } from "torneos/components/ui/empty-state";
import { ConfirmModal } from "torneos/components/ui/confirm-modal/confirm-modal";
import { UserSearchResult } from "torneos/components/ui/admin/user-search-result";
import { cn } from "torneos/lib/utils";

/** W10.1 — Pestaña Permisos (filosofía del dueño): los 4 roles del SISTEMA son
 *  SOLO LECTURA (matriz con candado — jamás se dañan los defaults); el admin crea
 *  ROLES PERSONALIZADOS (derivados) con permisos específicos, editables por celda
 *  (optimistic) y borrables (engine rechaza si hay usuarios asignados). Asignación
 *  de roles reusa searchUsers; salvaguardas S2/S3 viven en engine y el front las
 *  ESPEJA (botón de auto-remoción admin deshabilitado). */
export function AdminRbacTab() {
  const { data: session } = useSession();
  const utils = api.useUtils();
  const [toast, setToast] = useState<{ title: string } | null>(null);
  const notify = (title: string) => setToast({ title });

  const matrix = api.admin.getPermissionsMatrix.useQuery(undefined, { retry: false });

  // ─── Crear rol personalizado ───
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleCodes, setNewRoleCodes] = useState<string[]>([]);

  const createRoleMutation = api.admin.createRole.useMutation({
    onSuccess: () => {
      notify("Rol creado");
      setNewRoleName("");
      setNewRoleCodes([]);
      void utils.admin.getPermissionsMatrix.invalidate();
    },
    onError: (e) => notify(e.message),
  });

  // ─── Borrar rol personalizado ───
  const [deletingRole, setDeletingRole] = useState<{ id: string; name: string } | null>(null);
  const deleteRoleMutation = api.admin.deleteRole.useMutation({
    onSuccess: () => {
      notify("Rol eliminado");
      setDeletingRole(null);
      void utils.admin.getPermissionsMatrix.invalidate();
    },
    onError: (e) => notify(e.message),
  });

  // ─── Toggle de permiso (solo roles personalizados) ───
  const setPermissionMutation = api.admin.setRolePermission.useMutation({
    onMutate: async ({ roleId, permissionId, granted }) => {
      await utils.admin.getPermissionsMatrix.cancel();
      const prev = utils.admin.getPermissionsMatrix.getData();
      utils.admin.getPermissionsMatrix.setData(undefined, (old) =>
        old
          ? {
              ...old,
              roles: old.roles.map((r) =>
                r.id !== roleId
                  ? r
                  : {
                      ...r,
                      permissions: granted
                        ? [...r.permissions, old.permissions.find((p) => p.id === permissionId)?.code ?? ""]
                        : r.permissions.filter((code) => code !== old.permissions.find((p) => p.id === permissionId)?.code),
                    },
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.admin.getPermissionsMatrix.setData(undefined, ctx.prev);
      notify(e.message);
    },
    onSettled: () => void utils.admin.getPermissionsMatrix.invalidate(),
  });

  // ─── Asignación de roles ───
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const { data: searchResults } = api.admin.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 3 },
  );
  const userRoles = api.admin.getUserRoles.useQuery(
    { profileId: selectedProfileId ?? "" },
    { enabled: selectedProfileId !== null, retry: false },
  );

  const assignMutation = api.admin.assignRole.useMutation({
    onSuccess: () => {
      if (selectedProfileId) void utils.admin.getUserRoles.invalidate({ profileId: selectedProfileId });
    },
    onError: (e) => notify(e.message),
  });

  const removeMutation = api.admin.removeRole.useMutation({
    onSuccess: () => {
      if (selectedProfileId) void utils.admin.getUserRoles.invalidate({ profileId: selectedProfileId });
    },
    onError: (e) => notify(e.message),
  });

  if (matrix.isLoading) return <LoadingSkeleton variant="card" rows={4} />;
  if (matrix.isError || !matrix.data) {
    return (
      <EmptyState
        icon={<Lock className="size-8" />}
        title="No pudimos cargar la matriz"
        description="Necesitas el permiso de gestión de roles y permisos."
      />
    );
  }

  const { roles, permissions } = matrix.data;
  const systemRoles = roles.filter((r) => r.isSystem);
  const customRoles = roles.filter((r) => !r.isSystem);
  const modules = [...new Set(permissions.map((p) => p.module))];

  // Roles del sistema: SIEMPRE bloqueados (filosofía del dueño)
  const isLocked = (role: { isSystem: boolean }) => role.isSystem;

  const isSelfRemoval = (email: string, roleName: string) =>
    roleName === "admin" && email === session?.user?.email;

  const canCreate = newRoleName.trim().length >= 2 && newRoleCodes.length > 0;

  const renderPermissionCell = (role: (typeof roles)[number], code: string, permissionId: string) => {
    const granted = role.permissions.includes(code);
    const locked = isLocked(role);
    return (
      <td key={role.id} className="py-2 text-center">
        <button
          type="button"
          aria-pressed={granted}
          disabled={locked}
          title={
            locked
              ? "Rol del sistema: solo lectura. Crea un rol personalizado para este permiso."
              : undefined
          }
          onClick={() => setPermissionMutation.mutate({ roleId: role.id, permissionId, granted: !granted })}
          className={cn(
            "mx-auto flex size-7 items-center justify-center rounded-lg text-xs font-bold transition-colors",
            granted ? "bg-cypher-2 text-cypher-5" : "border border-cypher-5-1-1 bg-cypher-5 text-cypher-4-2-2",
            locked ? "cursor-not-allowed opacity-50" : "active:scale-90",
          )}
        >
          {granted ? "✓" : ""}
        </button>
      </td>
    );
  };

  return (
    <div className="space-y-6">
      {/* MATRIZ: roles del sistema (solo lectura) */}
      <section className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          <ShieldCheck className="size-4" /> Roles del sistema
        </h2>
        <p className="mb-4 text-xs text-cypher-4-2-2">
          Solo lectura: los 4 roles base jamás se modifican. Crea roles personalizados abajo.
        </p>

        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[420px] text-left">
            <thead>
              <tr className="border-b border-cypher-5-1-1">
                <th className="pb-2 pr-3 text-[10px] font-bold uppercase tracking-widest text-cypher-4-2-2">Permiso</th>
                {systemRoles.map((r) => (
                  <th key={r.id} className="pb-2 text-center">
                    <span className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-cypher-4-2">
                      {r.name} <Lock className="size-2.5 text-cypher-4-2-2" />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => (
                <Fragment key={mod}>
                  <tr>
                    <td colSpan={systemRoles.length + 1} className="pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-cypher-4-2-2">
                      {mod}
                    </td>
                  </tr>
                  {permissions.filter((p) => p.module === mod).map((p) => (
                    <tr key={p.id} className="border-t border-cypher-5-1-1/50">
                      <td className="py-2 pr-3">
                        <p className="text-xs font-medium text-cypher-4">{p.code}</p>
                        <p className="text-[10px] text-cypher-4-2-2">{p.name}</p>
                      </td>
                      {systemRoles.map((r) => renderPermissionCell(r, p.code, p.id))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ROLES PERSONALIZADOS: crear + editar por celda + borrar */}
      <section className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Roles personalizados
        </h2>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            maxLength={50}
            placeholder="Nombre del nuevo rol (ej: Arbitro Senior)"
            className="flex-1 rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
          />
          <button
            type="button"
            disabled={!canCreate || createRoleMutation.isPending}
            onClick={() => createRoleMutation.mutate({ name: newRoleName.trim(), permissionCodes: newRoleCodes })}
            className="flex items-center justify-center gap-2 rounded-xl bg-cypher-2 px-5 py-2.5 text-sm font-bold text-cypher-5 transition-colors active:bg-cypher-2-1 disabled:opacity-50"
          >
            <Plus className="size-4" /> Crear rol
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-cypher-4-2-2">
          Marca los permisos del rol ({newRoleCodes.length} seleccionados). Mínimo uno.
        </p>

        {modules.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {permissions.map((p) => {
              const on = newRoleCodes.includes(p.code);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  title={("description" in p && typeof p.description === "string" ? p.description : null) ?? p.name}
                  onClick={() =>
                    setNewRoleCodes((cur) =>
                      on ? cur.filter((c) => c !== p.code) : [...cur, p.code],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    on
                      ? "border-cypher-2 bg-cypher-2 text-cypher-5"
                      : "border-cypher-5-1-1 bg-cypher-5 text-cypher-4-2",
                  )}
                >
                  {p.code}
                </button>
              );
            })}
          </div>
        )}

        {customRoles.length > 0 && (
          <div className="mt-6 space-y-3">
            {customRoles.map((r) => (
              <div key={r.id} className="rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold text-cypher-4">{r.name}</p>
                  <button
                    type="button"
                    aria-label={`Eliminar rol ${r.name}`}
                    onClick={() => setDeletingRole({ id: r.id, name: r.name })}
                    className="text-cypher-4-2-2 transition-colors hover:text-red-400"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {permissions.map((p) => renderPermissionChip(r, p.code, p.id))}
                </div>
                {r.permissions.length === 0 && (
                  <p className="mt-2 text-[11px] text-cypher-4-2-2">Sin permisos: toca los chips para conceder.</p>
                )}
              </div>
            ))}
          </div>
        )}
        {customRoles.length === 0 && (
          <p className="mt-4 text-center text-sm text-cypher-4-2-2">
            Aún no hay roles personalizados.
          </p>
        )}
      </section>

      {/* ASIGNACIÓN DE ROLES */}
      <section className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Asignación de roles
        </h2>
        <input
          type="text"
          placeholder="Buscar usuario por email o nombre (mín. 3 caracteres)"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setSelectedProfileId(null); }}
          className="w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
        />

        {searchQuery.length >= 3 && searchResults && searchResults.length > 0 && !selectedProfileId && (
          <div className="mt-3 space-y-2">
            {searchResults.map((profile) => (
              <UserSearchResult
                key={profile.id}
                name={profile.displayName ?? profile.user.email}
                email={profile.user.email}
                onSelect={() => setSelectedProfileId(profile.id)}
              />
            ))}
          </div>
        )}

        {selectedProfileId && (
          <div className="mt-4 border-t border-cypher-5-1-1 pt-4">
            {userRoles.isLoading ? (
              <LoadingSkeleton variant="row" rows={1} />
            ) : userRoles.data ? (
              <>
                <p className="text-sm font-semibold text-cypher-4">{userRoles.data.displayName ?? userRoles.data.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {userRoles.data.roles.map((role) => (
                    <span
                      key={role.id}
                      className="flex items-center gap-1.5 rounded-full bg-cypher-5-1-1 px-3 py-1.5 text-xs font-medium text-cypher-4"
                    >
                      {role.name}
                      <button
                        type="button"
                        aria-label={`Quitar rol ${role.name}`}
                        disabled={isSelfRemoval(userRoles.data?.email ?? "", role.name)}
                        title={
                          isSelfRemoval(userRoles.data?.email ?? "", role.name)
                            ? "No puedes quitarte tu propio rol admin"
                            : role.name === "captain"
                              ? "Ojo: quitar el rol NO lo destituye de su equipo (la capitanía vive en la membresía); solo afecta reclutamiento y transferencias."
                              : undefined
                        }
                        onClick={() => removeMutation.mutate({ profileId: selectedProfileId, roleId: role.id })}
                        className={cn(
                          "text-cypher-4-2-2 transition-colors",
                          isSelfRemoval(userRoles.data?.email ?? "", role.name)
                            ? "cursor-not-allowed opacity-40"
                            : "hover:text-red-400",
                        )}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                  {userRoles.data.roles.length === 0 && (
                    <span className="text-xs text-cypher-4-2-2">Sin roles asignados.</span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {roles
                    .filter((r) => !userRoles.data?.roles.some((ur) => ur.id === r.id))
                    .map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => assignMutation.mutate({ profileId: selectedProfileId, roleId: r.id })}
                        className="rounded-full border border-cypher-5-1-1 bg-cypher-5 px-3 py-1.5 text-xs font-medium text-cypher-4-2 transition-colors active:bg-cypher-5-1-1"
                      >
                        + {r.name}
                      </button>
                    ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProfileId(null)}
                  className="mt-4 text-xs text-cypher-4-2 underline-offset-2 hover:underline"
                >
                  Elegir otro usuario
                </button>
              </>
            ) : (
              <p className="text-xs text-cypher-4-2-2">No pudimos cargar los roles del usuario.</p>
            )}
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={deletingRole !== null}
        title="Eliminar rol personalizado"
        message={
          deletingRole
            ? `¿Eliminar el rol "${deletingRole.name}"? Si tiene usuarios asignados, el sistema lo rechazará y te pedirá desasignarlos primero.`
            : ""
        }
        confirmText={deleteRoleMutation.isPending ? "Eliminando..." : "Eliminar"}
        variant="danger"
        onConfirm={() => deletingRole && deleteRoleMutation.mutate({ roleId: deletingRole.id })}
        onCancel={() => setDeletingRole(null)}
      />

      <Toast toast={toast} />
    </div>
  );

  // Chip de permiso para roles personalizados (mismo toggle optimistic)
  function renderPermissionChip(
    role: (typeof roles)[number],
    code: string,
    permissionId: string,
  ) {
    const granted = role.permissions.includes(code);
    return (
      <button
        key={permissionId}
        type="button"
        aria-pressed={granted}
        onClick={() => setPermissionMutation.mutate({ roleId: role.id, permissionId, granted: !granted })}
        className={cn(
          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors active:scale-95",
          granted
            ? "border-cypher-2 bg-cypher-2 text-cypher-5"
            : "border-cypher-5-1-1 bg-cypher-5 text-cypher-4-2-2",
        )}
      >
        {code}
      </button>
    );
  }
}