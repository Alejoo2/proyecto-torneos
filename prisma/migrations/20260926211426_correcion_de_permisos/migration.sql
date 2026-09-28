-- CreateTable
CREATE TABLE "ManagerDelegatePermission" (
    "id" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerDelegatePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManagerDelegatePermission_delegateId_idx" ON "ManagerDelegatePermission"("delegateId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerDelegatePermission_delegateId_permission_key" ON "ManagerDelegatePermission"("delegateId", "permission");

-- AddForeignKey
ALTER TABLE "ManagerDelegatePermission" ADD CONSTRAINT "ManagerDelegatePermission_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "ManagerDelegate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
