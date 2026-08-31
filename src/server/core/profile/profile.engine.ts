import { db } from "torneos/server/db";
import type { PrismaClient, Profile } from "@prisma/client";

export const profileEngine = {
  async getByUserId(prisma: PrismaClient, userId: string) {
    return prisma.profile.findUnique({
      where: { userId },
      include: { player: true },
    });
  },

  async getPublicProfile(prisma: PrismaClient, targetProfileId: string, viewerUserId: string) {
    const profile = await prisma.profile.findUnique({
      where: { id: targetProfileId },
      include: {
        player: {
          include: {
            teamMemberships: { where: { leftAt: null } },
          },
        },
      },
    });

    if (!profile) return null;

    const phone = await this.getVisiblePhone(prisma, targetProfileId, viewerUserId);

    return {
      id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio,
      birthDate: profile.birthDate,
      phone,
    };
  },

  async getVisiblePhone(prisma: PrismaClient, targetProfileId: string, viewerUserId: string): Promise<string | null> {
    const targetProfile = await prisma.profile.findUnique({
      where: { id: targetProfileId },
      include: {
        player: {
          include: { teamMemberships: { where: { leftAt: null }, include: { team: true } } },
        },
      },
    });

    if (!targetProfile?.phone) return null;

    const viewerProfile = await prisma.profile.findUnique({
      where: { userId: viewerUserId },
      include: {
        player: {
          include: { teamMemberships: { where: { leftAt: null, isCaptain: true } } },
        },
        manager: true,
      },
    });

    const targetIsCaptain = targetProfile.player?.teamMemberships.some((tm) => tm.isCaptain);
    if (targetIsCaptain && viewerProfile?.manager) return targetProfile.phone;

    const targetTeamId = targetProfile.player?.teamMemberships[0]?.teamId;
    const viewerIsCaptainOfTargetTeam = viewerProfile?.player?.teamMemberships.some(
      (tm) => tm.teamId === targetTeamId
    );
    if (viewerIsCaptainOfTargetTeam) return targetProfile.phone;

    return null;
  },

  async update(prisma: PrismaClient, userId: string, data: Partial<Profile>) {
    return prisma.profile.update({
      where: { userId },
      data,
    });
  },

  async completeOnboarding(prisma: PrismaClient, userId: string, data: Partial<Profile>) {
    return prisma.profile.update({
      where: { userId },
      data: { ...data, onboarded: true },
    });
  },
};