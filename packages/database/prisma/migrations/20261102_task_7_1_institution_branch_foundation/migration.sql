-- ==============================================================================
-- OX-DIGITAL Education — Task 7.1 Migration
-- Migration Name: 20261102_task_7_1_institution_branch_foundation
-- Scope: Institution, Branch, Primary Manager Invitation, Tenant Scoping & Safeties
-- Execution Mode: STAGE D DRAFTED (NOT APPLIED TO DATABASE)
-- Remediation: PostgreSQL TEXT type consistency across all FKs, OD-708 payment protection
-- ==============================================================================

-- 1. Create Tenant & Branch Enums
CREATE TYPE "InstitutionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- 2. Expand User Role Enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PRIMARY_MANAGER';

-- 3. Create Tenant Root Model: Institution
-- Note: id and primaryManagerId use TEXT to match PostgreSQL User.id and database-wide TEXT primary keys
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "status" "InstitutionStatus" NOT NULL DEFAULT 'ACTIVE',
    "primaryManagerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pk_institution" PRIMARY KEY ("id"),
    CONSTRAINT "unq_institution_code" UNIQUE ("code"),
    CONSTRAINT "unq_institution_primary_manager" UNIQUE ("primaryManagerId")
);

-- 4. Create Institution-Owned Model: Branch (Physical & Online OD-719)
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "institutionId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "address" TEXT,
    "phone" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pk_branch" PRIMARY KEY ("id"),
    CONSTRAINT "fk_branch_institution" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT,
    CONSTRAINT "unq_branch_institution_code" UNIQUE ("institutionId", "code")
);

-- 5. Create Primary Manager Invitation Table (Option 3B — OD-718)
CREATE TABLE "PrimaryManagerInvitation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "institutionId" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_primary_manager_invitation" PRIMARY KEY ("id"),
    CONSTRAINT "fk_invitation_institution" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT,
    CONSTRAINT "fk_invitation_accepted_user" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL,
    CONSTRAINT "unq_invitation_token_hash" UNIQUE ("tokenHash"),
    CONSTRAINT "unq_invitation_institution_email" UNIQUE ("institutionId", "email")
);

-- 6. Alter Existing Tables to Add Nullable Tenant & Branch Fields (Expand Phase)
ALTER TABLE "User" 
    ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
    ADD COLUMN IF NOT EXISTS "branchId" TEXT,
    ADD COLUMN IF NOT EXISTS "isPrimaryManager" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Add Foreign Key from Institution to User (compatible TEXT to TEXT)
ALTER TABLE "Institution"
    ADD CONSTRAINT "fk_institution_primary_manager_user" 
    FOREIGN KEY ("primaryManagerId") REFERENCES "User"("id") ON DELETE SET NULL;

ALTER TABLE "User"
    ADD CONSTRAINT "fk_user_institution" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "fk_user_branch" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "CenterGroup"
    ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
    ADD COLUMN IF NOT EXISTS "branchId" TEXT,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD CONSTRAINT "fk_center_group_institution" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "fk_center_group_branch" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "Course"
    ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
    ADD COLUMN IF NOT EXISTS "branchId" TEXT,
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
    ADD CONSTRAINT "fk_course_institution" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "fk_course_branch" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "Lesson"
    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Payment OD-708 Invariant: Replace legacy CASCADE FK with RESTRICT
ALTER TABLE "Payment"
    DROP CONSTRAINT IF EXISTS "Payment_userId_fkey",
    ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
    ADD COLUMN IF NOT EXISTS "branchId" TEXT,
    ADD CONSTRAINT "fk_payment_user" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "fk_payment_institution" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT,
    ADD CONSTRAINT "fk_payment_branch" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;

ALTER TABLE "QuestionBank"
    ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
    ADD CONSTRAINT "fk_question_bank_institution" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT;

ALTER TABLE "ProcessedMedia"
    ADD COLUMN IF NOT EXISTS "institutionId" TEXT,
    ADD CONSTRAINT "fk_processed_media_institution" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT;

-- 7. Create Migration Quarantine Table (OD-720 Indefinite Cold Archival)
-- Naming reconciled with backfill script contract and unique constraint on (entity_type, entity_id)
CREATE TABLE IF NOT EXISTS "_migration_quarantine" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "quarantine_reason" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "quarantined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "resolution_action" VARCHAR(50),

    CONSTRAINT "pk_migration_quarantine" PRIMARY KEY ("id"),
    CONSTRAINT "unq_migration_quarantine_entity" UNIQUE ("entity_type", "entity_id")
);

-- 8. Performance and Isolation Indexes
CREATE INDEX IF NOT EXISTS "idx_institution_status" ON "Institution"("status");
CREATE INDEX IF NOT EXISTS "idx_branch_institution" ON "Branch"("institutionId");
CREATE INDEX IF NOT EXISTS "idx_branch_inst_default" ON "Branch"("institutionId", "isDefault");
CREATE INDEX IF NOT EXISTS "idx_branch_inst_online" ON "Branch"("institutionId", "isOnline");
CREATE INDEX IF NOT EXISTS "idx_invitation_hash" ON "PrimaryManagerInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "idx_invitation_inst_status" ON "PrimaryManagerInvitation"("institutionId", "status");

CREATE INDEX IF NOT EXISTS "idx_user_institution" ON "User"("institutionId");
CREATE INDEX IF NOT EXISTS "idx_user_inst_branch" ON "User"("institutionId", "branchId");
CREATE INDEX IF NOT EXISTS "idx_center_group_institution" ON "CenterGroup"("institutionId");
CREATE INDEX IF NOT EXISTS "idx_center_group_branch" ON "CenterGroup"("branchId");
CREATE INDEX IF NOT EXISTS "idx_course_institution" ON "Course"("institutionId");
CREATE INDEX IF NOT EXISTS "idx_course_branch" ON "Course"("branchId");
CREATE INDEX IF NOT EXISTS "idx_lesson_course_deleted" ON "Lesson"("courseId", "deletedAt");
CREATE INDEX IF NOT EXISTS "idx_payment_institution" ON "Payment"("institutionId");
CREATE INDEX IF NOT EXISTS "idx_payment_branch" ON "Payment"("branchId");
CREATE INDEX IF NOT EXISTS "idx_question_bank_institution" ON "QuestionBank"("institutionId");
CREATE INDEX IF NOT EXISTS "idx_processed_media_institution" ON "ProcessedMedia"("institutionId");
CREATE INDEX IF NOT EXISTS "idx_quarantine_entity" ON "_migration_quarantine"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_quarantine_reason" ON "_migration_quarantine"("quarantine_reason");
