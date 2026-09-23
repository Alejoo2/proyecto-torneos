-- CreateEnum
CREATE TYPE "TournamentInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "ManagerDelegate" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "designatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerDelegate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentTeamInvite" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "status" "TournamentInviteStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "TournamentTeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerDelegate_profileId_idx" ON "ManagerDelegate"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerDelegate_managerId_profileId_key" ON "ManagerDelegate"("managerId", "profileId");

-- CreateIndex
CREATE INDEX "TournamentTeamInvite_teamId_status_idx" ON "TournamentTeamInvite"("teamId", "status");

-- CreateIndex
CREATE INDEX "TournamentTeamInvite_tournamentId_status_idx" ON "TournamentTeamInvite"("tournamentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeamInvite_tournamentId_teamId_key" ON "TournamentTeamInvite"("tournamentId", "teamId");

-- AddForeignKey
ALTER TABLE "ManagerDelegate" ADD CONSTRAINT "ManagerDelegate_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerDelegate" ADD CONSTRAINT "ManagerDelegate_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamInvite" ADD CONSTRAINT "TournamentTeamInvite_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamInvite" ADD CONSTRAINT "TournamentTeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentTeamInvite" ADD CONSTRAINT "TournamentTeamInvite_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
