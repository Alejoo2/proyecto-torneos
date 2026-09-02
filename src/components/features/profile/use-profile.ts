"use client";

import { api } from "torneos/trpc/react";

// Hook para obtener mi perfil y disponibilidades
export function useMyProfile() {
  return api.availability.getMine.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });
}

// Hook para actualizar datos del perfil
export function useUpdateProfile() {
  const utils = api.useUtils();
  return api.profile.update.useMutation({
    onSuccess: () => {
      void utils.availability.getMine.invalidate();
      void utils.profile.me.invalidate();
    },
  });
}

// Hook para togglear slots (con Optimistic UI usando useUtils de tRPC v11)
export function useToggleSlot() {
  const utils = api.useUtils();
  
  return api.availability.toggleSlot.useMutation({
    onMutate: async (newSlot) => {
      await utils.availability.getMine.cancel();
      const prevData = utils.availability.getMine.getData();

      if (prevData?.player?.availabilities) {
        const updatedSlots = prevData.player.availabilities.map((s) =>
          s.dayOfWeek === newSlot.dayOfWeek && s.timeSlot === newSlot.timeSlot
            ? {
                ...s,
                status: s.status === "AVAILABLE" ? ("UNAVAILABLE" as const) : ("AVAILABLE" as const),
              }
            : s
        );
        utils.availability.getMine.setData(undefined, {
          ...prevData,
          player: { ...prevData.player, availabilities: updatedSlots },
        });
      }
      return { prevData };
    },
    onError: (err, newSlot, ctx) => {
      if (ctx?.prevData) {
        utils.availability.getMine.setData(undefined, ctx.prevData);
      }
    },
    onSettled: () => {
      void utils.availability.getMine.invalidate();
    },
  });
}