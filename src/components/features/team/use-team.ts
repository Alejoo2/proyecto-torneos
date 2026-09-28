"use client";

import { api } from "torneos/trpc/react";
import { useRouter } from "next/navigation";

// ==========================================
// Queries
// ==========================================
export function useMyTeams() {
  return api.team.getMyTeams.useQuery();
}

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