-- CreateEnum
CREATE TYPE "MigrationJobStatus" AS ENUM ('queued', 'running', 'done', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "migration_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" "MigrationJobStatus" NOT NULL DEFAULT 'queued',
    "phase" TEXT NOT NULL DEFAULT '',
    "total" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorLog" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "migration_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "migration_jobs_userId_idx" ON "migration_jobs"("userId");

-- AddForeignKey
ALTER TABLE "migration_jobs" ADD CONSTRAINT "migration_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
