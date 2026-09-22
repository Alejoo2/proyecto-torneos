"use client";

import { useState } from "react";
import { api } from "torneos/trpc/react";
import { ManagerCard } from "torneos/components/ui/admin/manager-card";
import { UserSearchResult } from "torneos/components/ui/admin/user-search-result";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";
import { Toast } from "torneos/components/ui/toast";

/** W10 — Pestaña Gestores (mismas queries del dashboard pre-docs, re-skinned).
 *  Toggle de estado es reversible → sin ConfirmModal (convención). */
export function AdminManagersTab() {
  const utils = api.useUtils();
  const [toast, setToast] = useState<{ title: string } | null>(null);
  const notify = (title: string) => setToast({ title });

  const [searchQuery, setSearchQuery] = useState("");

  const { data: managers, isLoading } = api.admin.listManagers.useQuery();
  const { data: searchResults } = api.admin.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 3 },
  );

  const promoteMutation = api.admin.promoteToManager.useMutation({
    onSuccess: () => {
      notify("Gestor creado");
      setSearchQuery("");
      void utils.admin.listManagers.invalidate();
    },
    onError: (e) => notify(e.message),
  });

  const toggleStatusMutation = api.admin.toggleManagerStatus.useMutation({
    onSuccess: () => void utils.admin.listManagers.invalidate(),
    onError: (e) => notify(e.message),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Promover usuario a gestor
        </h2>
        <input
          type="text"
          placeholder="Buscar por email o nombre (mín. 3 caracteres)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-4 py-2.5 text-sm text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
        />
        {searchQuery.length >= 3 && searchResults && searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map((profile) => (
              <UserSearchResult
                key={profile.id}
                name={profile.displayName ?? profile.user.email}
                email={profile.user.email}
                onSelect={() => promoteMutation.mutate({ profileId: profile.id })}
              />
            ))}
          </div>
        )}
        {searchQuery.length >= 3 && searchResults?.length === 0 && (
          <p className="mt-3 text-xs text-cypher-4-2-2">Sin resultados.</p>
        )}
      </section>

      <section className="rounded-2xl border border-cypher-5-1-1 bg-cypher-5-1 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cypher-4-2">
          Gestores actuales
        </h2>
        {isLoading ? (
          <LoadingSkeleton variant="row" rows={2} />
        ) : managers && managers.length > 0 ? (
          <div className="space-y-3">
            {managers.map((manager) => (
              <ManagerCard
                key={manager.id}
                name={manager.profile.displayName ?? manager.profile.user.email}
                email={manager.profile.user.email}
                isActive={manager.isActive}
                onToggleStatus={() => toggleStatusMutation.mutate({ managerId: manager.id })}
              />
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-cypher-4-2-2">No hay gestores registrados.</p>
        )}
      </section>

      <Toast toast={toast} />
    </div>
  );
}