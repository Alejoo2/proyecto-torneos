-- CreateTable
CREATE TABLE "TournamentSlot" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "timeSlot" INTEGER NOT NULL,

    CONSTRAINT "TournamentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentSlot_tournamentId_idx" ON "TournamentSlot"("tournamentId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentSlot_tournamentId_dayOfWeek_timeSlot_key" ON "TournamentSlot"("tournamentId", "dayOfWeek", "timeSlot");

-- AddForeignKey
ALTER TABLE "TournamentSlot" ADD CONSTRAINT "TournamentSlot_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
