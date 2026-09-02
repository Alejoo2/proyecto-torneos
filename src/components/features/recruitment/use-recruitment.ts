"use client";

import { api } from "torneos/trpc/react";

// ==========================================
// Hooks para el Capitán (Directorio)
// ==========================================

export function useSearchPlayers(teamId: string) {
  return api.recruitment.searchPlayers.useQuery(
    { teamId },
    {
      // Solo se ejecuta si hay teamId
      enabled: !!teamId,
      // Mantiene los datos en caché mientras cambias de pestaña
      staleTime: 1000 * 60 * 1, 
    }
  );
}

export function useInvitePlayer() {
  const utils = api.useContext();
  
  return api.recruitment.invite.useMutation({
    onSuccess: (_data, variables) => {
      // Invalida la búsqueda para que el jugador invitado cambie su estado a "Invitado"
      void utils.recruitment.searchPlayers.invalidate({ teamId: variables.teamId });
      void utils.recruitment.getMyInvitations.invalidate();
    },
  });
}

export function useRevokeInvitation() {
  const utils = api.useContext();
  
  return api.recruitment.revokeInvitation.useMutation({
    onSuccess: () => {
      void utils.recruitment.searchPlayers.invalidate();
    },
  });
}

// ==========================================
// Hooks para el Jugador Pasivo (Sus invitaciones)
// ==========================================

export function useMyInvitations() {
  return api.recruitment.getMyInvitations.useQuery(undefined, {
    staleTime: 1000 * 30, // Refresca cada 30s (igual que el badge de notificaciones)
  });
}

export function useAcceptInvitation() {
  const utils = api.useContext();
  
  return api.recruitment.acceptInvitation.useMutation({
    onSuccess: () => {
      void utils.recruitment.getMyInvitations.invalidate();
      void utils.team.getById.invalidate();
    },
  });
}

export function useRejectInvitation() {
  const utils = api.useContext();
  
  return api.recruitment.rejectInvitation.useMutation({
    onSuccess: () => {
      void utils.recruitment.getMyInvitations.invalidate();
    },
  }); 
}
// ==========================================
// Hooks para Perfil de Jugador (Capitán)
// ==========================================
export function usePlayerProfile(teamId: string, playerId: string | null) {
  return api.recruitment.getPlayerProfile.useQuery(
    { teamId, playerId: playerId! },
    {
      enabled: !!teamId && !!playerId,
      staleTime: 1000 * 60 * 5, // 5 minutos de caché para no spammear la BD al abrir el modal
    }
  );
}