-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CaptaincyTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "TeamMembership" ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" VARCHAR(10) NOT NULL,
    "primaryColor" VARCHAR(7) NOT NULL,
    "secondaryColor" VARCHAR(7),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "TeamStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamInvitation" (
    "id" TEXT NOT NULL,
    "teamId" TEXT,
    "playerId" TEXT NOT NULL,
    "invitedBy" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "TeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptaincyTransfer" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "status" "CaptaincyTransferStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "CaptaincyTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_abbreviation_key" ON "Team"("abbreviation");

-- CreateIndex
CREATE INDEX "TeamInvitation_playerId_status_idx" ON "TeamInvitation"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_teamId_playerId_key" ON "TeamInvitation"("teamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptaincyTransfer_fromId_toId_status_key" ON "CaptaincyTransfer"("fromId", "toId", "status");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_leftAt_idx" ON "TeamMembership"("teamId", "leftAt");

-- CreateIndex
CREATE INDEX "TeamMembership_playerId_leftAt_idx" ON "TeamMembership"("playerId", "leftAt");

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptaincyTransfer" ADD CONSTRAINT "CaptaincyTransfer_outgoingTeam_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptaincyTransfer" ADD CONSTRAINT "CaptaincyTransfer_incomingTeam_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptaincyTransfer" ADD CONSTRAINT "CaptaincyTransfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "TeamMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptaincyTransfer" ADD CONSTRAINT "CaptaincyTransfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "TeamMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
