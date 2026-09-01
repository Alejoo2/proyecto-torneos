-- AlterEnum
ALTER TYPE "InvitationStatus" ADD VALUE 'REVOKED';

-- RenameForeignKey
ALTER TABLE "CaptaincyTransfer" RENAME CONSTRAINT "CaptaincyTransfer_incomingTeam_fkey" TO "CaptaincyTransfer_teamId_fkey";
