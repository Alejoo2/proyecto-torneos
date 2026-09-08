-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'GRACE_PERIOD', 'IN_PROGRESS', 'FINISHED', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TournamentFormat" AS ENUM ('SINGLE_ELIMINATION', 'LEAGUE', 'LEAGUE_PLUS_ELIMINATION');

-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING_AVAILABILITY', 'PENDING_PAYMENT', 'APPROVED', 'REJECTED', 'DISAPPROVED');

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "courtId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'DRAFT',
    "format" "TournamentFormat" NOT NULL DEFAULT 'SINGLE_ELIMINATION',
    "maxTeams" INTEGER NOT NULL,
    "type" "TournamentType" NOT NULL DEFAULT 'PUBLIC',
    "startDate" TIMESTAMP(3),
    "enrollmentDeadline" TIMESTAMP(3) NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "timeSlot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentEnrollment" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING_AVAILABILITY',
    "availabilityNote" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "disapprovedAt" TIMESTAMP(3),
    "disapprovedBy" TEXT,
    "disapprovedReason" TEXT,

    CONSTRAINT "TournamentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentPhase" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentSlotHold" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "heldBy" TEXT NOT NULL,
    "teamId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentSlotHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tournament_status_enrollmentDeadline_idx" ON "Tournament"("status", "enrollmentDeadline");

-- CreateIndex
CREATE INDEX "Tournament_courtId_status_idx" ON "Tournament"("courtId", "status");

-- CreateIndex
CREATE INDEX "TournamentEnrollment_tournamentId_status_idx" ON "TournamentEnrollment"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "TournamentEnrollment_teamId_status_idx" ON "TournamentEnrollment"("teamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentEnrollment_tournamentId_teamId_key" ON "TournamentEnrollment"("tournamentId", "teamId");

-- CreateIndex
CREATE INDEX "TournamentPhase_tournamentId_order_idx" ON "TournamentPhase"("tournamentId", "order");

-- CreateIndex
CREATE INDEX "TournamentSlotHold_tournamentId_expiresAt_idx" ON "TournamentSlotHold"("tournamentId", "expiresAt");

-- CreateIndex
CREATE INDEX "TournamentSlotHold_heldBy_idx" ON "TournamentSlotHold"("heldBy");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEnrollment" ADD CONSTRAINT "TournamentEnrollment_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentEnrollment" ADD CONSTRAINT "TournamentEnrollment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentPhase" ADD CONSTRAINT "TournamentPhase_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentSlotHold" ADD CONSTRAINT "TournamentSlotHold_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
