-- CreateEnum
CREATE TYPE "MediaSourceType" AS ENUM ('GOOGLE_DRIVE', 'YOUTUBE', 'DIRECT');

-- CreateEnum
CREATE TYPE "ProcessedMediaStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'TRANSCODING', 'COMPLETED', 'FAILED', 'SUPERSEDED', 'PURGING');

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "activeMediaId" TEXT,
ADD COLUMN     "mediaGeneration" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ProcessedMedia" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT,
    "mediaGeneration" INTEGER NOT NULL,
    "sourceType" "MediaSourceType" NOT NULL,
    "sourceFileId" TEXT,
    "canonicalSource" TEXT NOT NULL,
    "sourceUrlHash" CHAR(64) NOT NULL,
    "storagePrefix" TEXT NOT NULL,
    "masterPlaylistKey" TEXT,
    "renditions" JSONB,
    "durationSeconds" INTEGER,
    "status" "ProcessedMediaStatus" NOT NULL DEFAULT 'PENDING',
    "fencingToken" BIGINT NOT NULL DEFAULT 0,
    "workerId" TEXT,
    "heartbeatAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "cleanupToken" BIGINT NOT NULL DEFAULT 0,
    "cleanupWorkerId" TEXT,
    "cleanupHeartbeatAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessedMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessedMedia_sourceUrlHash_idx" ON "ProcessedMedia"("sourceUrlHash");

-- CreateIndex
CREATE INDEX "ProcessedMedia_status_heartbeatAt_idx" ON "ProcessedMedia"("status", "heartbeatAt");

-- CreateIndex
CREATE INDEX "ProcessedMedia_status_supersededAt_idx" ON "ProcessedMedia"("status", "supersededAt");

-- CreateIndex
CREATE INDEX "ProcessedMedia_status_cleanupHeartbeatAt_idx" ON "ProcessedMedia"("status", "cleanupHeartbeatAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedMedia_lessonId_mediaGeneration_key" ON "ProcessedMedia"("lessonId", "mediaGeneration");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_activeMediaId_key" ON "Lesson"("activeMediaId");

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_activeMediaId_fkey" FOREIGN KEY ("activeMediaId") REFERENCES "ProcessedMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedMedia" ADD CONSTRAINT "ProcessedMedia_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable Row Level Security (RLS) consistent with 20261001_enable_rls policy
ALTER TABLE IF EXISTS "ProcessedMedia" ENABLE ROW LEVEL SECURITY;
