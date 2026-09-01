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
            // Quitamos el include: { team: true } porque el modelo Team es del Sistema 3
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
          include: { 
            teamMemberships: { where: { leftAt: null } } 
          },
        },
      },
    });

    if (!targetProfile?.phone) return null;

    const viewerProfile = await prisma.profile.findUnique({
      where: { userId: viewerUserId },
      include: {
        player: {
          include: { 
            teamMemberships: { where: { leftAt: null, isCaptain: true } } 
          },
        },
        manager: true,
      },
    });

    // Caso 1: El target es capitán -> gestores lo ven
    const targetIsCaptain = targetProfile.player?.teamMemberships.some((tm) => tm.isCaptain);
    if (targetIsCaptain && viewerProfile?.manager) {
      return targetProfile.phone;
    }

    // Caso 2: El target está en un equipo -> solo su capitán lo ve
    const targetTeamId = targetProfile.player?.teamMemberships[0]?.teamId;
    const viewerIsCaptainOfTargetTeam = viewerProfile?.player?.teamMemberships.some(
      (tm) => tm.teamId === targetTeamId
    );
    
    if (viewerIsCaptainOfTargetTeam) {
      return targetProfile.phone;
    }

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