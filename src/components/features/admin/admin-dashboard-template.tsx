"use client";

import { useState } from "react";
import { api } from "torneos/trpc/react";
import { ManagerCard } from "torneos/components/ui/admin/manager-card";
import { UserSearchResult } from "torneos/components/ui/admin/user-search-result";
import { AdminCourtTemplate } from "torneos/components/features/court/admin-court-template"; // Asumiendo que moviste el de canchas aquí

export function AdminDashboardTemplate() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  // Queries
  const { data: managers, refetch: refetchManagers } = api.admin.listManagers.useQuery();
  const { data: searchResults } = api.admin.searchUsers.useQuery(
    { query: searchQuery }, 
    { enabled: searchQuery.length >= 3 }
  );

  // Mutations
  const promoteMutation = api.admin.promoteToManager.useMutation({
    onSuccess: () => {
      void refetchManagers();
      setSearchQuery("");
      setShowResults(false);
    }
  });

  const toggleStatusMutation = api.admin.toggleManagerStatus.useMutation({
    onSuccess: () => refetchManagers()
  });

  return (
    <div className="space-y-8 pb-8">
      
      {/* ─── SECCIÓN 1: GESTORES ─── */}
      <div className="px-6 pt-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">Gestión de Gestores</h2>
        
        <div className="bg-zinc-50 rounded-2xl p-4 mb-6">
          <p className="text-sm text-zinc-600 mb-3">Buscar usuario por email o nombre:</p>
          <input 
            type="text"
            placeholder="ej: juan@futbol.com"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowResults(e.target.value.length >= 3);
            }}
            className="w-full h-12 bg-white rounded-xl border-2 border-zinc-200 px-4 focus:border-zinc-400 focus:outline-none"
          />
          
          {showResults && searchResults && searchResults.length > 0 && (
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
        </div>

        <h3 className="text-sm font-semibold text-zinc-700 mb-3">Gestores Actuales</h3>
        <div className="space-y-3">
          {managers?.map((manager) => (
            <ManagerCard 
              key={manager.id}
              name={manager.profile.displayName ?? manager.profile.user.email}
              email={manager.profile.user.email}
              isActive={manager.isActive}
              onToggleStatus={() => toggleStatusMutation.mutate({ managerId: manager.id })}
            />
          ))}
          {managers?.length === 0 && (
            <p className="text-zinc-500 text-center py-4 text-sm">No hay gestores registrados.</p>
          )}
        </div>
      </div>

      <div className="h-px bg-zinc-200 mx-6" />

      {/* ─── SECCIÓN 2: CANCHAS ─── */}
      <div className="px-6">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">Gestión de Canchas</h2>
        {/* Aquí reutilizamos la lógica de canchas que ya tenías */}
        <AdminCourtTemplate />
      </div>

    </div>
  );
}