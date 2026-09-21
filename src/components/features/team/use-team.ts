"use client";

import { api } from "torneos/trpc/react";
import { useRouter } from "next/navigation";

// ==========================================
// Queries
// ==========================================
export function useGetTeamById(teamId: string) {
  return api.team.getById.useQuery({ teamId });
}

// ==========================================
// Mutations
// ==========================================
export function useCreateDraft() {
  const router = useRouter();
  return api.team.createDraft.useMutation({
    onSuccess: (data) => {
      router.push(`/equipos/${data.id}`);
    },
  });
}

export function useLeaveTeam() {
  const utils = api.useUtils();
  const router = useRouter();

  return api.team.leaveTeam.useMutation({
    onSuccess: () => {
      void utils.team.getMyTeams.invalidate();
      void utils.team.getById.invalidate();
      router.push("/equipos");
    },
  });
}

export function useRequestDelete() {
  const utils = api.useUtils();
  const router = useRouter();

  return api.team.requestDelete.useMutation({
    onSuccess: (data) => {
      void utils.team.getById.invalidate();
      void utils.team.getMyTeams.invalidate();
      if (data.directDelete) {
        router.push("/equipos");
      }
    },
  });
}

export function useConfirmDelete() {
  const utils = api.useUtils();
  const router = useRouter();

  return api.team.confirmDelete.useMutation({
    onSuccess: (data) => {
      void utils.team.getById.invalidate();
      void utils.team.getMyTeams.invalidate();
      if (data.finalized && data.approved) {
        router.push("/equipos");
      }
    },
  });
}

/** N-3/W8: toggle de titular con optimistic completo (patrón manager-match-template).
 *  `onError?` alimenta el Toast del consumidor con el mensaje del engine. */
export function useSetStarter(teamId: string, onError?: (message: string) => void) {
  const utils = api.useUtils();
  return api.team.setStarter.useMutation({
    onMutate: async ({ membershipId, isStarter }) => {
      await utils.team.getById.cancel({ teamId });
      const prev = utils.team.getById.getData({ teamId });
      utils.team.getById.setData({ teamId }, (old) =>
        old
          ? {
              ...old,
              memberships: old.memberships.map((m) =>
                m.id === membershipId ? { ...m, isStarter } : m,
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) utils.team.getById.setData({ teamId }, ctx.prev);
      onError?.(e.message);
    },
    onSettled: () => void utils.team.getById.invalidate({ teamId }),
  });
}