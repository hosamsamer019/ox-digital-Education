-- ==============================================================================
-- OX-DIGITAL Education — Backend Authentication Integration
-- Migration Name: 20261104_add_accountant_role
-- Scope: Add 'ACCOUNTANT' enum value to "Role" enum
-- Execution Mode: STAGE DRAFTED (NOT APPLIED TO DATABASE)
-- Safety: Additive only, no table mutations, no destructive schema alterations
-- ==============================================================================

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ACCOUNTANT';

