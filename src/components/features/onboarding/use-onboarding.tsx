"use client";

import { api } from "torneos/trpc/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

export function useOnboarding() {
  const router = useRouter();
  const { update } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const completeOnboarding = api.profile.completeOnboarding.useMutation({
    onSuccess: async () => {
      await update({ onboarded: true });
      router.push("/dashboard");
    },
  });

  return {
    completeOnboarding: completeOnboarding.mutateAsync,
    isSubmitting,
    setIsSubmitting,
  };
}

export function useAvailabilityMatrix() {
  const utils = api.useUtils();
  const getMine = api.availability.getMine.useQuery();
  
  const toggleSlot = api.availability.toggleSlot.useMutation({
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

  return {
    availabilities: getMine.data?.player?.availabilities ?? [],
    isLoading: getMine.isLoading,
    toggleSlot: (dayOfWeek: number, timeSlot: number) => 
      toggleSlot.mutate({ dayOfWeek, timeSlot }),
  };
}