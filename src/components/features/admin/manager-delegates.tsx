"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, UserMinus } from "lucide-react";
import { api } from "torneos/trpc/react";
import { UserSearchResult } from "torneos/components/ui/admin/user-search-result";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";

/** W11 — E3: sección de secretarios por gestor (Consola Admin, pestaña Gestores).
 *  Se monta bajo cada ManagerCard — contrato de ManagerCard INTACTO (reskin W10).
 *  Alta: admin.searchUsers (gate user:manage existente) → delegation.addForManager.
 *  Baja: reversible (se puede re-designar) → botón directo, sin ConfirmModal.
 *  Errores del engine en línea (patrón W4/W5). */
interface ManagerDelegatesProps {
  managerId: string;
  managerName: string;
}

export function ManagerDelegates({ managerId, managerName }: ManagerDelegatesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const utils = api.useUtils();
  const invalidate = () => void utils.delegation.listForManager.invalidate({ managerId });

  const { data: delegates, isLoading } = api.delegation.listForManager.useQuery(
    { managerId },
    { enabled: isOpen },
  );
  const { data: searchResults } = api.admin.searchUsers.useQuery(
    { query: searchQuery },
    { enabled: isOpen && searchQuery.length >= 3 },
  );

  const addMutation = api.delegation.addForManager.useMutation({
    onSuccess: () => {
      setFeedback(null);
      setSearchQuery("");
      invalidate();
    },
    onError: (e) => setFeedback(e.message),
  });
  const removeMutation = api.delegation.removeForManager.useMutation({
    onSuccess: invalidate,
    onError: (e) => setFeedback(e.message),
  });

  const count = delegates?.length ?? 0;

  return (
    <div className="rounded-xl border border-cypher-4/10 bg-cypher-5-1-1 px-4 py-2.5">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between text-xs font-semibold text-cypher-4-2"
      >
        <span>Secretarios ({count})</span>
        {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {isLoading ? (
            <LoadingSkeleton variant="row" rows={1} />
          ) : delegates && delegates.length > 0 ? (
            <ul className="space-y-1.5">
              {delegates.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm text-cypher-4">
                  <span className="truncate">{d.profile.displayName ?? d.profile.user.email}</span>
                  <button
                    type="button"
                    aria-label={`Quitar a ${d.profile.displayName ?? "este secretario"} como secretario de ${managerName}`}                    onClick={() => removeMutation.mutate({ managerId, delegateId: d.id })}
                    className="rounded-lg p-1.5 text-cypher-4-2-2 transition-colors hover:bg-cypher-5/60 hover:text-cypher-4"
                  >
                    <UserMinus className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-cypher-4-2-2">Sin secretarios designados.</p>
          )}

          <div>
            <input
              type="text"
              placeholder={`Buscar perfil para designar (mín. 3 caracteres)`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-cypher-5-1-1 bg-cypher-5-1-1 px-3 py-2 text-xs text-cypher-4 outline-none transition-colors placeholder:text-cypher-4-2-2 focus:border-cypher-4-2"
            />
            {searchQuery.length >= 3 && searchResults && searchResults.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {searchResults.map((profile) => (
                  <UserSearchResult
                    key={profile.id}
                    name={profile.displayName ?? profile.user.email}
                    email={profile.user.email}
                    onSelect={() => addMutation.mutate({ managerId, profileId: profile.id })}
                  />
                ))}
              </div>
            )}
            {searchQuery.length >= 3 && searchResults?.length === 0 && (
              <p className="mt-2 text-xs text-cypher-4-2-2">Sin resultados.</p>
            )}
          </div>

          {feedback && (
            <p role="alert" className="text-xs text-red-400">
              {feedback}
            </p>
          )}
        </div>
      )}
    </div>
  );
}