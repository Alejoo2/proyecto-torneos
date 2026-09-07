-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CaptaincyTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED', 'EXECUTED');

-- CreateEnum
CREATE TYPE "CourtStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CourtAvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "birthDate" TIMESTAMP(3),
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAvailability" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "timeSlot" INTEGER NOT NULL,
    "status" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "PlayerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manager" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "TeamDeletionRequest" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DeletionStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "TeamDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamDeletionVote" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "approve" BOOLEAN NOT NULL DEFAULT true,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamDeletionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Court" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "description" TEXT,
    "inventory" TEXT,
    "status" "CourtStatus" NOT NULL DEFAULT 'ENABLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Court_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtAvailability" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timeSlot" INTEGER NOT NULL,
    "status" "CourtAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "CourtAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RoleAssignment_profileId_roleId_key" ON "RoleAssignment"("profileId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Player_profileId_key" ON "Player"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAvailability_playerId_dayOfWeek_timeSlot_key" ON "PlayerAvailability"("playerId", "dayOfWeek", "timeSlot");

-- CreateIndex
CREATE UNIQUE INDEX "Manager_profileId_key" ON "Manager"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_abbreviation_key" ON "Team"("abbreviation");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_leftAt_idx" ON "TeamMembership"("teamId", "leftAt");

-- CreateIndex
CREATE INDEX "TeamMembership_playerId_leftAt_idx" ON "TeamMembership"("playerId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_playerId_teamId_key" ON "TeamMembership"("playerId", "teamId");

-- CreateIndex
CREATE INDEX "TeamInvitation_playerId_status_idx" ON "TeamInvitation"("playerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvitation_teamId_playerId_key" ON "TeamInvitation"("teamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptaincyTransfer_fromId_toId_status_key" ON "CaptaincyTransfer"("fromId", "toId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamDeletionRequest_teamId_key" ON "TeamDeletionRequest"("teamId");

-- CreateIndex
CREATE INDEX "TeamDeletionRequest_teamId_status_idx" ON "TeamDeletionRequest"("teamId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeamDeletionVote_requestId_playerId_key" ON "TeamDeletionVote"("requestId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Court_name_key" ON "Court"("name");

-- CreateIndex
CREATE INDEX "CourtAvailability_courtId_date_idx" ON "CourtAvailability"("courtId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CourtAvailability_courtId_date_timeSlot_key" ON "CourtAvailability"("courtId", "date", "timeSlot");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAvailability" ADD CONSTRAINT "PlayerAvailability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manager" ADD CONSTRAINT "Manager_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvitation" ADD CONSTRAINT "TeamInvitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptaincyTransfer" ADD CONSTRAINT "CaptaincyTransfer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptaincyTransfer" ADD CONSTRAINT "CaptaincyTransfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "TeamMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptaincyTransfer" ADD CONSTRAINT "CaptaincyTransfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "TeamMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamDeletionRequest" ADD CONSTRAINT "TeamDeletionRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamDeletionVote" ADD CONSTRAINT "TeamDeletionVote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "TeamDeletionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtAvailability" ADD CONSTRAINT "CourtAvailability_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

