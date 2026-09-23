/*
  Warnings:

  - The values [EXPIRED,REVOKED] on the enum `TournamentInviteStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TournamentInviteStatus_new" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
ALTER TABLE "public"."TournamentTeamInvite" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TournamentTeamInvite" ALTER COLUMN "status" TYPE "TournamentInviteStatus_new" USING ("status"::text::"TournamentInviteStatus_new");
ALTER TYPE "TournamentInviteStatus" RENAME TO "TournamentInviteStatus_old";
ALTER TYPE "TournamentInviteStatus_new" RENAME TO "TournamentInviteStatus";
DROP TYPE "public"."TournamentInviteStatus_old";
ALTER TABLE "TournamentTeamInvite" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropIndex
DROP INDEX "TournamentTeamInvite_tournamentId_status_idx";
