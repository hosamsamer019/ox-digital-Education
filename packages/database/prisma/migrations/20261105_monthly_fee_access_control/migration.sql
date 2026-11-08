-- CreateEnum
CREATE TYPE "FinancialAccessStatus" AS ENUM ('ACTIVE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "PolicyMode" AS ENUM ('GLOBAL', 'PER_BRANCH');

-- CreateEnum
CREATE TYPE "RestrictionAction" AS ENUM ('RESTRICTED', 'REACTIVATED');

-- CreateEnum
CREATE TYPE "ObligationType" AS ENUM ('MONTHLY_FEE', 'SEMESTER_FEE', 'TERM_FEE', 'FULL_PERIOD_FEE', 'ACTIVITY_FEE', 'OTHER');

-- AlterTable
ALTER TABLE "StudentObligation" ADD COLUMN     "billingMonth" TEXT,
ADD COLUMN     "isMonthlyFee" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "obligationType" "ObligationType" NOT NULL DEFAULT 'MONTHLY_FEE',
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "financialAccessStatus" "FinancialAccessStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "MonthlyFeePolicy" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT,
    "policyMode" "PolicyMode" NOT NULL DEFAULT 'GLOBAL',
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 5,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "configuredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyFeePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyFeePolicyAudit" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT,
    "previousMode" "PolicyMode",
    "newMode" "PolicyMode" NOT NULL,
    "previousDays" INTEGER,
    "newDays" INTEGER NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyFeePolicyAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialRestrictionHistory" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "obligationId" TEXT,
    "action" "RestrictionAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "relevantMonth" TEXT NOT NULL,
    "outstandingAmount" DECIMAL(12,2) NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'SYSTEM_EVALUATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialRestrictionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyFeePolicy_institutionId_policyMode_idx" ON "MonthlyFeePolicy"("institutionId", "policyMode");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyFeePolicy_institutionId_branchId_key" ON "MonthlyFeePolicy"("institutionId", "branchId");

-- CreateIndex
CREATE INDEX "MonthlyFeePolicyAudit_institutionId_createdAt_idx" ON "MonthlyFeePolicyAudit"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialRestrictionHistory_institutionId_studentId_idx" ON "FinancialRestrictionHistory"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "FinancialRestrictionHistory_institutionId_action_idx" ON "FinancialRestrictionHistory"("institutionId", "action");

-- CreateIndex
CREATE INDEX "FinancialRestrictionHistory_relevantMonth_idx" ON "FinancialRestrictionHistory"("relevantMonth");

-- CreateIndex
CREATE INDEX "User_financialAccessStatus_idx" ON "User"("financialAccessStatus");

-- AddForeignKey
ALTER TABLE "MonthlyFeePolicy" ADD CONSTRAINT "MonthlyFeePolicy_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFeePolicy" ADD CONSTRAINT "MonthlyFeePolicy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFeePolicy" ADD CONSTRAINT "MonthlyFeePolicy_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFeePolicyAudit" ADD CONSTRAINT "MonthlyFeePolicyAudit_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyFeePolicyAudit" ADD CONSTRAINT "MonthlyFeePolicyAudit_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRestrictionHistory" ADD CONSTRAINT "FinancialRestrictionHistory_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRestrictionHistory" ADD CONSTRAINT "FinancialRestrictionHistory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRestrictionHistory" ADD CONSTRAINT "FinancialRestrictionHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialRestrictionHistory" ADD CONSTRAINT "FinancialRestrictionHistory_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "StudentObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

