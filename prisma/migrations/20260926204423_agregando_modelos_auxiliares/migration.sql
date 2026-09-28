-- CreateTable
CREATE TABLE "TeamSuggestedSlot" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "timeSlot" INTEGER NOT NULL,
    "suggestedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamSuggestedSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentAbsence" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "teamId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentAbsence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentSlotReservation" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timeSlot" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentSlotReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamSuggestedSlot_teamId_idx" ON "TeamSuggestedSlot"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSuggestedSlot_teamId_dayOfWeek_timeSlot_key" ON "TeamSuggestedSlot"("teamId", "dayOfWeek", "timeSlot");

-- CreateIndex
CREATE INDEX "TournamentAbsence_tournamentId_idx" ON "TournamentAbsence"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentAbsence_playerId_tournamentId_key" ON "TournamentAbsence"("playerId", "tournamentId");

-- CreateIndex
CREATE INDEX "TournamentSlotReservation_courtId_date_timeSlot_idx" ON "TournamentSlotReservation"("courtId", "date", "timeSlot");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentSlotReservation_tournamentId_date_timeSlot_key" ON "TournamentSlotReservation"("tournamentId", "date", "timeSlot");

-- AddForeignKey
ALTER TABLE "TeamSuggestedSlot" ADD CONSTRAINT "TeamSuggestedSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAbsence" ADD CONSTRAINT "TournamentAbsence_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAbsence" ADD CONSTRAINT "TournamentAbsence_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentAbsence" ADD CONSTRAINT "TournamentAbsence_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentSlotReservation" ADD CONSTRAINT "TournamentSlotReservation_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentSlotReservation" ADD CONSTRAINT "TournamentSlotReservation_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
