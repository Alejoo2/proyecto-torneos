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

// ==========================================
// Titulares + sugerida + transferencias (detalle de equipo)
// Contratos espejo de team-detail-view (usa teamId + notify opcional).
// ==========================================
type NotifyFn = (message: string) => void;

export function useSetStarter(teamId: string, notify?: NotifyFn) {
  const utils = api.useUtils();
  return api.team.setStarter.useMutation({
    onSuccess: () => {
      void utils.team.getById.invalidate({ teamId });
      notify?.("Titular actualizado");
    },
    onError: (e) => notify?.(e.message),
  });
}

export function useSuggestedSlots(teamId: string) {
  return api.team.getSuggestedSlots.useQuery({ teamId });
}

export function useSetSuggestedSlots(teamId: string, notify?: NotifyFn) {
  const utils = api.useUtils();
  return api.team.setSuggestedSlots.useMutation({
    onSuccess: () => {
      void utils.team.getSuggestedSlots.invalidate({ teamId });
      notify?.("Sugerencia guardada");
    },
    onError: (e) => notify?.(e.message),
  });
}

export function useRequestTransfer(notify?: NotifyFn) {
  const utils = api.useUtils();
  return api.captaincy.requestTransfer.useMutation({
    onSuccess: () => {
      void utils.captaincy.getPendingTransfers.invalidate();
      notify?.("Transferencia solicitada");
    },
    onError: (e) => notify?.(e.message),
  });
}

export function usePendingTransfers() {
  return api.captaincy.getPendingTransfers.useQuery();
}

export function useAcceptTransfer(teamId: string, notify?: NotifyFn) {
  const utils = api.useUtils();
  return api.captaincy.acceptTransfer.useMutation({
    onSuccess: () => {
      void utils.captaincy.getPendingTransfers.invalidate();
      void utils.team.getById.invalidate({ teamId });
      void utils.team.getMyTeams.invalidate();
      notify?.("Capitanía transferida");
    },
    onError: (e) => notify?.(e.message),
  });
}

export function useRejectTransfer(notify?: NotifyFn) {
  const utils = api.useUtils();
  return api.captaincy.rejectTransfer.useMutation({
    onSuccess: () => {
      void utils.captaincy.getPendingTransfers.invalidate();
      notify?.("Transferencia rechazada");
    },
    onError: (e) => notify?.(e.message),
  });
}