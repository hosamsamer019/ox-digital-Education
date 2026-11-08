-- ==============================================================================
-- OX-DIGITAL Education — Phase 5.2: Manager-Created Accountant Accounts
-- Migration Name: 20261104_add_must_change_password
-- Scope: Add 'mustChangePassword' boolean column to "User" table (default: false)
-- Safety: Non-breaking additive column; all existing users default to false.
-- ==============================================================================

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

