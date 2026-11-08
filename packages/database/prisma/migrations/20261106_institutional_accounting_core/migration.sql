-- CreateEnum
CREATE TYPE "CashboxStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('COLLECTION', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'COLLECTION_REVERSED', 'EXPENSE_REVERSED', 'TRANSFER_REVERSED');

-- CreateEnum
CREATE TYPE "MovementStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('BALANCED', 'DISCREPANCY_PENDING_INVESTIGATION', 'DISCREPANCY_RESOLVED');

-- CreateEnum
CREATE TYPE "FinancialAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'TERMINATED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'FULFILLED', 'OVERDUE', 'WAIVED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'POS_CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('COLLECTED', 'DEPOSITED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'REVERSED');

-- CreateEnum
CREATE TYPE "AdjustmentType" AS ENUM ('CREDIT_NOTE', 'DEBIT_NOTE', 'FEE_WAIVER', 'REFUND_REQUEST', 'DISPUTE_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED', 'REVERSED');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'CERTIFIED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RecognitionStatus" AS ENUM ('POSTED', 'REVERSED');

-- DropForeignKey
ALTER TABLE "Branch" DROP CONSTRAINT "fk_branch_institution";

-- DropForeignKey
ALTER TABLE "CenterGroup" DROP CONSTRAINT "fk_center_group_branch";

-- DropForeignKey
ALTER TABLE "CenterGroup" DROP CONSTRAINT "fk_center_group_institution";

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "fk_course_branch";

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "fk_course_institution";

-- DropForeignKey
ALTER TABLE "Institution" DROP CONSTRAINT "fk_institution_primary_manager_user";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "fk_payment_branch";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "fk_payment_institution";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "fk_payment_user";

-- DropForeignKey
ALTER TABLE "PrimaryManagerInvitation" DROP CONSTRAINT "fk_invitation_accepted_user";

-- DropForeignKey
ALTER TABLE "PrimaryManagerInvitation" DROP CONSTRAINT "fk_invitation_institution";

-- DropForeignKey
ALTER TABLE "ProcessedMedia" DROP CONSTRAINT "fk_processed_media_institution";

-- DropForeignKey
ALTER TABLE "QuestionBank" DROP CONSTRAINT "fk_question_bank_institution";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "fk_user_branch";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "fk_user_institution";

-- DropIndex
DROP INDEX "idx_institution_status";

-- AlterTable
ALTER TABLE "Branch" RENAME CONSTRAINT "pk_branch" TO "Branch_pkey";
ALTER TABLE "Branch" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "code" SET DATA TYPE TEXT,
ALTER COLUMN "phone" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Institution" RENAME CONSTRAINT "pk_institution" TO "Institution_pkey";
ALTER TABLE "Institution" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "name" SET DATA TYPE TEXT,
ALTER COLUMN "code" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PrimaryManagerInvitation" RENAME CONSTRAINT "pk_primary_manager_invitation" TO "PrimaryManagerInvitation_pkey";
ALTER TABLE "PrimaryManagerInvitation" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "email" SET DATA TYPE TEXT,
ALTER COLUMN "tokenHash" SET DATA TYPE TEXT;

-- DropTable
DROP TABLE "_migration_quarantine";

-- CreateTable
CREATE TABLE "Cashbox" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CashboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "assignedCashierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Cashbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashboxTransaction" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashboxId" TEXT NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "businessDate" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT NOT NULL,
    "actorRole" "Role" NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "counterpartCashboxId" TEXT,
    "counterpartTransactionId" TEXT,
    "notes" TEXT,
    "status" "MovementStatus" NOT NULL DEFAULT 'POSTED',
    "reversedAt" TIMESTAMP(3),
    "reversedBy" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "CashboxTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashboxReconciliation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashboxId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledByUserId" TEXT NOT NULL,
    "openingBalance" DECIMAL(12,2) NOT NULL,
    "totalCollections" DECIMAL(12,2) NOT NULL,
    "totalIncomingTransfers" DECIMAL(12,2) NOT NULL,
    "totalOutgoingTransfers" DECIMAL(12,2) NOT NULL,
    "totalExpenses" DECIMAL(12,2) NOT NULL,
    "expectedClosingBalance" DECIMAL(12,2) NOT NULL,
    "actualCountedClosingBalance" DECIMAL(12,2) NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'BALANCED',
    "notes" TEXT,

    CONSTRAINT "CashboxReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFinancialAccount" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "status" "FinancialAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFinancialAgreement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "centerGroupId" TEXT,
    "agreementNumber" TEXT NOT NULL,
    "catalogPrice" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAgreedPrice" DECIMAL(12,2) NOT NULL,
    "physicalCampusAmount" DECIMAL(12,2) NOT NULL,
    "digitalPlatformAmount" DECIMAL(12,2) NOT NULL,
    "totalSessionsCount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "status" "AgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "termsNotes" TEXT,
    "priorBranchId" TEXT,
    "priorCenterGroupId" TEXT,
    "transferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFinancialAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentObligation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "scheduleItemNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountDue" DECIMAL(12,2) NOT NULL,
    "amountCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "ObligationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentObligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashboxId" TEXT,
    "cashierUserId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "obligationId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "amountCollected" DECIMAL(12,2) NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unallocatedAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "CollectionStatus" NOT NULL DEFAULT 'COLLECTED',
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversalReason" TEXT,
    "payerUserId" TEXT,
    "payerName" TEXT,
    "payerPhone" TEXT,
    "receiptPdfUrl" TEXT,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionAllocation" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedByUserId" TEXT NOT NULL,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "CollectionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAdjustment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "agreementId" TEXT,
    "adjustmentNumber" TEXT NOT NULL,
    "type" "AdjustmentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "preparedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupPricingAgreement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT,
    "centerGroupId" TEXT,
    "courseId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "standardPrice" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "effectivePrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupPricingAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialIdempotencyRecord" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "responsePayload" JSONB NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 200,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialIdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAuditEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "targetEntity" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "oldState" JSONB,
    "newState" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonDeliveryEvidence" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "centerGroupId" TEXT NOT NULL,
    "teacherUserId" TEXT NOT NULL,
    "supervisorUserId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "deliveredAt" TIMESTAMP(3) NOT NULL,
    "certifiedAt" TIMESTAMP(3) NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'CERTIFIED',
    "attendanceCount" INTEGER NOT NULL DEFAULT 0,
    "supervisorNotes" TEXT,
    "digitalSignature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonDeliveryEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueRecognitionEntry" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "unitIndex" INTEGER NOT NULL,
    "amountRecognized" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "status" "RecognitionStatus" NOT NULL DEFAULT 'POSTED',
    "recognizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "RevenueRecognitionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionTender" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "tenderType" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cashboxId" TEXT,
    "posTerminalId" TEXT,
    "posAuthCode" TEXT,
    "cardLastFour" TEXT,
    "bankReferenceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionTender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT,
    "iban" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "currentBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'CREDIT',
    "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "matchedCollectionId" TEXT,
    "matchedExpenseId" TEXT,
    "rawDescription" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseVoucher" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "voucherNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "payeeName" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "paymentSource" TEXT NOT NULL DEFAULT 'CASHBOX',
    "cashboxId" TEXT,
    "bankAccountId" TEXT,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
    "preparedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "disbursedById" TEXT,
    "receiptAttachmentUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "disbursedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSettlement" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherUserId" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "totalCollectedTuition" DECIMAL(12,2) NOT NULL,
    "totalDeliveredSessions" INTEGER NOT NULL DEFAULT 0,
    "calculatedGrossEarnings" DECIMAL(12,2) NOT NULL,
    "totalDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CALCULATED',
    "preparedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cashbox_institutionId_idx" ON "Cashbox"("institutionId");

-- CreateIndex
CREATE INDEX "Cashbox_institutionId_branchId_idx" ON "Cashbox"("institutionId", "branchId");

-- CreateIndex
CREATE INDEX "Cashbox_status_idx" ON "Cashbox"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Cashbox_institutionId_code_key" ON "Cashbox"("institutionId", "code");

-- CreateIndex
CREATE INDEX "CashboxTransaction_institutionId_cashboxId_idx" ON "CashboxTransaction"("institutionId", "cashboxId");

-- CreateIndex
CREATE INDEX "CashboxTransaction_cashboxId_businessDate_idx" ON "CashboxTransaction"("cashboxId", "businessDate");

-- CreateIndex
CREATE INDEX "CashboxTransaction_cashboxId_timestamp_idx" ON "CashboxTransaction"("cashboxId", "timestamp");

-- CreateIndex
CREATE INDEX "CashboxTransaction_referenceId_idx" ON "CashboxTransaction"("referenceId");

-- CreateIndex
CREATE INDEX "CashboxTransaction_actorUserId_idx" ON "CashboxTransaction"("actorUserId");

-- CreateIndex
CREATE INDEX "CashboxTransaction_status_idx" ON "CashboxTransaction"("status");

-- CreateIndex
CREATE INDEX "CashboxReconciliation_institutionId_businessDate_idx" ON "CashboxReconciliation"("institutionId", "businessDate");

-- CreateIndex
CREATE INDEX "CashboxReconciliation_institutionId_status_idx" ON "CashboxReconciliation"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CashboxReconciliation_cashboxId_businessDate_key" ON "CashboxReconciliation"("cashboxId", "businessDate");

-- CreateIndex
CREATE INDEX "StudentFinancialAccount_institutionId_studentId_idx" ON "StudentFinancialAccount"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "StudentFinancialAccount_status_idx" ON "StudentFinancialAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFinancialAccount_institutionId_studentId_key" ON "StudentFinancialAccount"("institutionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFinancialAccount_institutionId_accountNumber_key" ON "StudentFinancialAccount"("institutionId", "accountNumber");

-- CreateIndex
CREATE INDEX "StudentFinancialAgreement_institutionId_studentId_idx" ON "StudentFinancialAgreement"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "StudentFinancialAgreement_institutionId_status_idx" ON "StudentFinancialAgreement"("institutionId", "status");

-- CreateIndex
CREATE INDEX "StudentFinancialAgreement_branchId_idx" ON "StudentFinancialAgreement"("branchId");

-- CreateIndex
CREATE INDEX "StudentFinancialAgreement_centerGroupId_idx" ON "StudentFinancialAgreement"("centerGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFinancialAgreement_institutionId_agreementNumber_key" ON "StudentFinancialAgreement"("institutionId", "agreementNumber");

-- CreateIndex
CREATE INDEX "StudentObligation_institutionId_dueDate_idx" ON "StudentObligation"("institutionId", "dueDate");

-- CreateIndex
CREATE INDEX "StudentObligation_institutionId_status_idx" ON "StudentObligation"("institutionId", "status");

-- CreateIndex
CREATE INDEX "StudentObligation_studentId_idx" ON "StudentObligation"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentObligation_agreementId_scheduleItemNumber_key" ON "StudentObligation"("agreementId", "scheduleItemNumber");

-- CreateIndex
CREATE INDEX "Collection_institutionId_collectedAt_idx" ON "Collection"("institutionId", "collectedAt");

-- CreateIndex
CREATE INDEX "Collection_cashboxId_collectedAt_idx" ON "Collection"("cashboxId", "collectedAt");

-- CreateIndex
CREATE INDEX "Collection_studentId_idx" ON "Collection"("studentId");

-- CreateIndex
CREATE INDEX "Collection_cashierUserId_idx" ON "Collection"("cashierUserId");

-- CreateIndex
CREATE INDEX "Collection_status_idx" ON "Collection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_institutionId_receiptNumber_key" ON "Collection"("institutionId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionAllocation_idempotencyKey_key" ON "CollectionAllocation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CollectionAllocation_collectionId_idx" ON "CollectionAllocation"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionAllocation_obligationId_idx" ON "CollectionAllocation"("obligationId");

-- CreateIndex
CREATE INDEX "CollectionAllocation_agreementId_idx" ON "CollectionAllocation"("agreementId");

-- CreateIndex
CREATE INDEX "CollectionAllocation_institutionId_allocatedAt_idx" ON "CollectionAllocation"("institutionId", "allocatedAt");

-- CreateIndex
CREATE INDEX "CollectionAllocation_status_idx" ON "CollectionAllocation"("status");

-- CreateIndex
CREATE INDEX "FinancialAdjustment_institutionId_status_idx" ON "FinancialAdjustment"("institutionId", "status");

-- CreateIndex
CREATE INDEX "FinancialAdjustment_accountId_idx" ON "FinancialAdjustment"("accountId");

-- CreateIndex
CREATE INDEX "FinancialAdjustment_studentId_idx" ON "FinancialAdjustment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAdjustment_institutionId_adjustmentNumber_key" ON "FinancialAdjustment"("institutionId", "adjustmentNumber");

-- CreateIndex
CREATE INDEX "GroupPricingAgreement_institutionId_isActive_idx" ON "GroupPricingAgreement"("institutionId", "isActive");

-- CreateIndex
CREATE INDEX "GroupPricingAgreement_centerGroupId_idx" ON "GroupPricingAgreement"("centerGroupId");

-- CreateIndex
CREATE INDEX "GroupPricingAgreement_courseId_idx" ON "GroupPricingAgreement"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupPricingAgreement_institutionId_code_key" ON "GroupPricingAgreement"("institutionId", "code");

-- CreateIndex
CREATE INDEX "FinancialIdempotencyRecord_expiresAt_idx" ON "FinancialIdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "FinancialIdempotencyRecord_operationType_idx" ON "FinancialIdempotencyRecord"("operationType");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialIdempotencyRecord_institutionId_idempotencyKey_key" ON "FinancialIdempotencyRecord"("institutionId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "FinancialAuditEvent_institutionId_createdAt_idx" ON "FinancialAuditEvent"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialAuditEvent_targetEntity_targetEntityId_idx" ON "FinancialAuditEvent"("targetEntity", "targetEntityId");

-- CreateIndex
CREATE INDEX "FinancialAuditEvent_actorUserId_idx" ON "FinancialAuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "LessonDeliveryEvidence_institutionId_branchId_idx" ON "LessonDeliveryEvidence"("institutionId", "branchId");

-- CreateIndex
CREATE INDEX "LessonDeliveryEvidence_institutionId_deliveredAt_idx" ON "LessonDeliveryEvidence"("institutionId", "deliveredAt");

-- CreateIndex
CREATE INDEX "LessonDeliveryEvidence_status_idx" ON "LessonDeliveryEvidence"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LessonDeliveryEvidence_lessonId_centerGroupId_deliveredAt_key" ON "LessonDeliveryEvidence"("lessonId", "centerGroupId", "deliveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueRecognitionEntry_idempotencyKey_key" ON "RevenueRecognitionEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RevenueRecognitionEntry_agreementId_recognizedAt_idx" ON "RevenueRecognitionEntry"("agreementId", "recognizedAt");

-- CreateIndex
CREATE INDEX "RevenueRecognitionEntry_institutionId_studentId_idx" ON "RevenueRecognitionEntry"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "RevenueRecognitionEntry_evidenceId_idx" ON "RevenueRecognitionEntry"("evidenceId");

-- CreateIndex
CREATE INDEX "RevenueRecognitionEntry_status_idx" ON "RevenueRecognitionEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueRecognitionEntry_institutionId_evidenceId_studentId_key" ON "RevenueRecognitionEntry"("institutionId", "evidenceId", "studentId");

-- CreateIndex
CREATE INDEX "CollectionTender_collectionId_idx" ON "CollectionTender"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionTender_cashboxId_idx" ON "CollectionTender"("cashboxId");

-- CreateIndex
CREATE INDEX "BankAccount_institutionId_idx" ON "BankAccount"("institutionId");

-- CreateIndex
CREATE INDEX "BankAccount_branchId_idx" ON "BankAccount"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_institutionId_accountNumber_key" ON "BankAccount"("institutionId", "accountNumber");

-- CreateIndex
CREATE INDEX "BankTransaction_institutionId_status_idx" ON "BankTransaction"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_bankAccountId_referenceNumber_key" ON "BankTransaction"("bankAccountId", "referenceNumber");

-- CreateIndex
CREATE INDEX "ExpenseVoucher_institutionId_branchId_idx" ON "ExpenseVoucher"("institutionId", "branchId");

-- CreateIndex
CREATE INDEX "ExpenseVoucher_status_idx" ON "ExpenseVoucher"("status");

-- CreateIndex
CREATE INDEX "ExpenseVoucher_preparedById_idx" ON "ExpenseVoucher"("preparedById");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseVoucher_institutionId_voucherNumber_key" ON "ExpenseVoucher"("institutionId", "voucherNumber");

-- CreateIndex
CREATE INDEX "TeacherSettlement_institutionId_teacherUserId_idx" ON "TeacherSettlement"("institutionId", "teacherUserId");

-- CreateIndex
CREATE INDEX "TeacherSettlement_periodYear_periodMonth_idx" ON "TeacherSettlement"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherSettlement_institutionId_settlementNumber_key" ON "TeacherSettlement"("institutionId", "settlementNumber");

-- AddForeignKey
ALTER TABLE "Institution" ADD CONSTRAINT "Institution_primaryManagerId_fkey" FOREIGN KEY ("primaryManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrimaryManagerInvitation" ADD CONSTRAINT "PrimaryManagerInvitation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterGroup" ADD CONSTRAINT "CenterGroup_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterGroup" ADD CONSTRAINT "CenterGroup_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedMedia" ADD CONSTRAINT "ProcessedMedia_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cashbox" ADD CONSTRAINT "Cashbox_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cashbox" ADD CONSTRAINT "Cashbox_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cashbox" ADD CONSTRAINT "Cashbox_assignedCashierId_fkey" FOREIGN KEY ("assignedCashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashboxTransaction" ADD CONSTRAINT "CashboxTransaction_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashboxTransaction" ADD CONSTRAINT "CashboxTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashboxTransaction" ADD CONSTRAINT "CashboxTransaction_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashboxTransaction" ADD CONSTRAINT "CashboxTransaction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashboxReconciliation" ADD CONSTRAINT "CashboxReconciliation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashboxReconciliation" ADD CONSTRAINT "CashboxReconciliation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashboxReconciliation" ADD CONSTRAINT "CashboxReconciliation_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashboxReconciliation" ADD CONSTRAINT "CashboxReconciliation_reconciledByUserId_fkey" FOREIGN KEY ("reconciledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAccount" ADD CONSTRAINT "StudentFinancialAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAccount" ADD CONSTRAINT "StudentFinancialAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAgreement" ADD CONSTRAINT "StudentFinancialAgreement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAgreement" ADD CONSTRAINT "StudentFinancialAgreement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAgreement" ADD CONSTRAINT "StudentFinancialAgreement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAgreement" ADD CONSTRAINT "StudentFinancialAgreement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentFinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFinancialAgreement" ADD CONSTRAINT "StudentFinancialAgreement_centerGroupId_fkey" FOREIGN KEY ("centerGroupId") REFERENCES "CenterGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObligation" ADD CONSTRAINT "StudentObligation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObligation" ADD CONSTRAINT "StudentObligation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObligation" ADD CONSTRAINT "StudentObligation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentObligation" ADD CONSTRAINT "StudentObligation_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "StudentFinancialAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_cashierUserId_fkey" FOREIGN KEY ("cashierUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "StudentObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAllocation" ADD CONSTRAINT "CollectionAllocation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAllocation" ADD CONSTRAINT "CollectionAllocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAllocation" ADD CONSTRAINT "CollectionAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAllocation" ADD CONSTRAINT "CollectionAllocation_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "StudentFinancialAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAllocation" ADD CONSTRAINT "CollectionAllocation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAllocation" ADD CONSTRAINT "CollectionAllocation_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "StudentObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionAllocation" ADD CONSTRAINT "CollectionAllocation_allocatedByUserId_fkey" FOREIGN KEY ("allocatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentFinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "StudentFinancialAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPricingAgreement" ADD CONSTRAINT "GroupPricingAgreement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPricingAgreement" ADD CONSTRAINT "GroupPricingAgreement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPricingAgreement" ADD CONSTRAINT "GroupPricingAgreement_centerGroupId_fkey" FOREIGN KEY ("centerGroupId") REFERENCES "CenterGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupPricingAgreement" ADD CONSTRAINT "GroupPricingAgreement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialIdempotencyRecord" ADD CONSTRAINT "FinancialIdempotencyRecord_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAuditEvent" ADD CONSTRAINT "FinancialAuditEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAuditEvent" ADD CONSTRAINT "FinancialAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonDeliveryEvidence" ADD CONSTRAINT "LessonDeliveryEvidence_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonDeliveryEvidence" ADD CONSTRAINT "LessonDeliveryEvidence_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonDeliveryEvidence" ADD CONSTRAINT "LessonDeliveryEvidence_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonDeliveryEvidence" ADD CONSTRAINT "LessonDeliveryEvidence_centerGroupId_fkey" FOREIGN KEY ("centerGroupId") REFERENCES "CenterGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonDeliveryEvidence" ADD CONSTRAINT "LessonDeliveryEvidence_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonDeliveryEvidence" ADD CONSTRAINT "LessonDeliveryEvidence_supervisorUserId_fkey" FOREIGN KEY ("supervisorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueRecognitionEntry" ADD CONSTRAINT "RevenueRecognitionEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueRecognitionEntry" ADD CONSTRAINT "RevenueRecognitionEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueRecognitionEntry" ADD CONSTRAINT "RevenueRecognitionEntry_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "StudentFinancialAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueRecognitionEntry" ADD CONSTRAINT "RevenueRecognitionEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueRecognitionEntry" ADD CONSTRAINT "RevenueRecognitionEntry_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "LessonDeliveryEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionTender" ADD CONSTRAINT "CollectionTender_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionTender" ADD CONSTRAINT "CollectionTender_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_cashboxId_fkey" FOREIGN KEY ("cashboxId") REFERENCES "Cashbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseVoucher" ADD CONSTRAINT "ExpenseVoucher_disbursedById_fkey" FOREIGN KEY ("disbursedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSettlement" ADD CONSTRAINT "TeacherSettlement_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSettlement" ADD CONSTRAINT "TeacherSettlement_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSettlement" ADD CONSTRAINT "TeacherSettlement_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSettlement" ADD CONSTRAINT "TeacherSettlement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_branch_inst_default" RENAME TO "Branch_institutionId_isDefault_idx";

-- RenameIndex
ALTER INDEX "idx_branch_inst_online" RENAME TO "Branch_institutionId_isOnline_idx";

-- RenameIndex
ALTER INDEX "idx_branch_institution" RENAME TO "Branch_institutionId_idx";

-- RenameIndex
ALTER INDEX "unq_branch_institution_code" RENAME TO "Branch_institutionId_code_key";

-- RenameIndex
ALTER INDEX "idx_center_group_branch" RENAME TO "CenterGroup_branchId_idx";

-- RenameIndex
ALTER INDEX "idx_center_group_institution" RENAME TO "CenterGroup_institutionId_idx";

-- RenameIndex
ALTER INDEX "idx_course_branch" RENAME TO "Course_branchId_idx";

-- RenameIndex
ALTER INDEX "idx_course_institution" RENAME TO "Course_institutionId_idx";

-- RenameIndex
ALTER INDEX "unq_institution_code" RENAME TO "Institution_code_key";

-- RenameIndex
ALTER INDEX "unq_institution_primary_manager" RENAME TO "Institution_primaryManagerId_key";

-- RenameIndex
ALTER INDEX "idx_lesson_course_deleted" RENAME TO "Lesson_courseId_deletedAt_idx";

-- RenameIndex
ALTER INDEX "idx_payment_branch" RENAME TO "Payment_branchId_idx";

-- RenameIndex
ALTER INDEX "idx_payment_institution" RENAME TO "Payment_institutionId_idx";

-- RenameIndex
ALTER INDEX "idx_invitation_hash" RENAME TO "PrimaryManagerInvitation_tokenHash_idx";

-- RenameIndex
ALTER INDEX "idx_invitation_inst_status" RENAME TO "PrimaryManagerInvitation_institutionId_status_idx";

-- RenameIndex
ALTER INDEX "unq_invitation_institution_email" RENAME TO "PrimaryManagerInvitation_institutionId_email_key";

-- RenameIndex
ALTER INDEX "unq_invitation_token_hash" RENAME TO "PrimaryManagerInvitation_tokenHash_key";

-- RenameIndex
ALTER INDEX "idx_processed_media_institution" RENAME TO "ProcessedMedia_institutionId_idx";

-- RenameIndex
ALTER INDEX "idx_question_bank_institution" RENAME TO "QuestionBank_institutionId_idx";

-- RenameIndex
ALTER INDEX "idx_user_inst_branch" RENAME TO "User_institutionId_branchId_idx";

-- RenameIndex
ALTER INDEX "idx_user_institution" RENAME TO "User_institutionId_idx";
