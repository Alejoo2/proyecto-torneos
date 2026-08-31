-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_playerId_teamId_key" ON "TeamMembership"("playerId", "teamId");

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
