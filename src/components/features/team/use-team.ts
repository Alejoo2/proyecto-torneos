"use client";

import { api } from "torneos/trpc/react";
import { useRouter } from "next/navigation";

export function useLeaveTeam() {
  const utils = api.useUtils();
  const router = useRouter();
  
  return api.team.leaveTeam.useMutation({
    onSuccess: () => {
      // Invalidamos las queries de equipos para que se actualice la UI
      void utils.team.getMyTeams.invalidate();
      void utils.team.getById.invalidate();
      // Redirigimos al usuario a su lista de equipos
      router.push("/equipos");
    },
  });
  
}
export function useRequestDelete() {
  const utils = api.useUtils();
  return api.team.requestDelete.useMutation({
    onSuccess: () => {
      void utils.team.getById.invalidate();
    },
  });
}

export function useVoteDeletion() {
  const utils = api.useUtils();
  return api.team.voteDeletion.useMutation({
    onSuccess: () => {
      void utils.team.getById.invalidate();
    },
  });
}

export function useCancelDeletionRequest() {
  const utils = api.useUtils();
  return api.team.cancelDeletionRequest.useMutation({
    onSuccess: () => {
      void utils.team.getById.invalidate();
    },
  });
}