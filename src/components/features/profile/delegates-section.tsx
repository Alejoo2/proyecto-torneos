"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import { api } from "torneos/trpc/react";
import { UserSearchResult } from "torneos/components/ui/admin/user-search-result";
import { LoadingSkeleton } from "torneos/components/ui/loading-skeleton";

/** W11 — E3/E4: secretarios del gestor (pestaña Gestor de perfil).
 *  Gemelo de admin/manager-delegates con procedures self-service
 *  (listMine/addMine/removeMine — managerProcedure). Baja reversible → sin ConfirmModal. */
export function DelegatesSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const utils = api.useUtils();
  const invalidate = () => void utils.delegation.listMine.invalidate();

  const { data: delegates, isLoading } = api.delegation.listMine.useQuery(undefined, { retry: false });
  const { data: searchResults } = api.delegation.searchProfiles.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length >= 3 },
  );

  const addMutation = api.delegation.addMine.useMutation({
    onSuccess: () => {
      setFeedback(null);
      setSearchQuery("");
      invalidate();
    },
    onError: (e) => setFeedback(e.message),
  });
  const removeMutation = api.delegation.removeMine.useMutation({
    onSuccess: invalidate,
    onError: (e) => setFeedback(e.message),
  });

  return (
    <section className="rounded-2xl border border-cypher-4/10 bg-cypher-5-1 p-4">
      <h2 className="text-sm font-semibold text-cypher-4">Secretarios</h2>
      <p className="mt-0.5 text-xs text-cypher-4-2-2">
        Pueden aplazar, reprogramar, declarar paseos, asignar árbitro y cargar resultados en tus torneos.
      </p>

      <div className="mt-3">
        {isLoading ? (
          <LoadingSkeleton variant="row" rows={1} />
        ) : delegates && delegates.length > 0 ? (
          <ul className="mb-3 space-y-1.5">
            {delegates.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-sm text-cypher-4">
                <span className="truncate">{d.profile.displayName ?? d.profile.user.email}</span>
                <button
                  type="button"
                  aria-label={`Quitar a ${d.profile.displayName ?? "este secretario"}`}
                  onClick={() => removeMutation.mutate({ delegateId: d.id })}
                  className="rounded-lg p-1.5 text-cypher-4-2-2 transition-colors hover:bg-cypher-5/60 hover:text-cypher-4"
                >
                  <UserMinus className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-xs text-cypher-4-2-2">Sin secretarios designados.</p>
        )}

        <input
          type="text"
          placeholder="Buscar perfil para designar (mín. 3 caracteres)"
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
                onSelect={() => addMutation.mutate({ profileId: profile.id })}
              />
            ))}
          </div>
        )}
        {searchQuery.length >= 3 && searchResults?.length === 0 && (
          <p className="mt-2 text-xs text-cypher-4-2-2">Sin resultados.</p>
        )}

        {feedback && (
          <p role="alert" className="mt-2 text-xs text-red-400">{feedback}</p>
        )}
      </div>
    </section>
  );
}