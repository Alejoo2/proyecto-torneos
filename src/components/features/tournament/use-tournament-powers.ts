"use client";

import { api } from "torneos/trpc/react";

/** Poderes del usuario sobre un torneo, por permiso — no por rol.
 *  Dueño: todo el pack. Secretario: sus llaves. Resto: vacío. */
export function useTournamentPowers(tournamentId: string | null | undefined) {
  const query = api.delegation.myPowers.useQuery(
    { tournamentId: tournamentId ?? "" },
    { enabled: Boolean(tournamentId), retry: false, staleTime: 1000 * 60 },
  );
  const data = query.data ?? { isOwner: false, permissions: [] as string[] };
  const can = (code: string) => data.isOwner || data.permissions.includes(code);
  return {
    isOwner: data.isOwner,
    permissions: data.permissions,
    can,
    /** Ve zona de gestión si es dueño o tiene alguna llave. */
    canEnterGestion: data.isOwner || data.permissions.length > 0,
    isLoading: query.isLoading,
  };
}
