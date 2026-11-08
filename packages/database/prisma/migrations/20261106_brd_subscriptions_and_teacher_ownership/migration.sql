-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "profilePictureUrl" TEXT,
ADD COLUMN     "responsibleTeacherId" TEXT,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'default';

-- CreateTable
CREATE TABLE "StudentTeacher" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "accessStatus" "FinancialAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "exceptionActiveUntil" TIMESTAMP(3),
    "exceptionReason" TEXT,
    "exceptionGrantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherTransferHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromTeacherId" TEXT,
    "toTeacherId" TEXT NOT NULL,
    "transferredById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherTransferHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherSubscriptionSetting" (
    "teacherId" TEXT NOT NULL,
    "lastGraceDay" INTEGER NOT NULL DEFAULT 5,
    "lockDay" INTEGER NOT NULL DEFAULT 6,
    "lockMessageAr" TEXT NOT NULL DEFAULT 'تم إيقاف الوصول مؤقتاً لعدم سداد الاشتراك الشهري. يرجى مراجعة إدارة الفرع.',
    "lockMessageEn" TEXT NOT NULL DEFAULT 'Access has been temporarily suspended due to unpaid monthly subscription. Please contact branch administration.',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherSubscriptionSetting_pkey" PRIMARY KEY ("teacherId")
);

-- CreateTable
CREATE TABLE "TeacherGradePricing" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "effectiveMonth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherGradePricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAuditHistory" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "previousPrice" DOUBLE PRECISION NOT NULL,
    "newPrice" DOUBLE PRECISION NOT NULL,
    "effectiveMonth" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAuditHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMonthlySubscription" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billingYear" INTEGER NOT NULL,
    "billingMonth" INTEGER NOT NULL,
    "amountDue" DOUBLE PRECISION NOT NULL,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "priceSnapshot" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "discountAuthorizedById" TEXT,
    "isExempt" BOOLEAN NOT NULL DEFAULT false,
    "exemptionReason" TEXT,
    "exemptionAuthorizedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentMonthlySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "accountantId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "receivingMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPaymentItem" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPaymentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchSequentialReceipt" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "paymentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "accountantId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "receivingMethod" TEXT NOT NULL,
    "monthsCovered" TEXT NOT NULL,
    "pdfPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchSequentialReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchReceiptCounter" (
    "branchId" TEXT NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchReceiptCounter_pkey" PRIMARY KEY ("branchId")
);

-- CreateTable
CREATE TABLE "StudentAuditLog" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentTeacher_studentId_idx" ON "StudentTeacher"("studentId");

-- CreateIndex
CREATE INDEX "StudentTeacher_teacherId_idx" ON "StudentTeacher"("teacherId");

-- CreateIndex
CREATE INDEX "StudentTeacher_accessStatus_idx" ON "StudentTeacher"("accessStatus");

-- CreateIndex
CREATE UNIQUE INDEX "StudentTeacher_studentId_teacherId_key" ON "StudentTeacher"("studentId", "teacherId");

-- CreateIndex
CREATE INDEX "TeacherTransferHistory_studentId_idx" ON "TeacherTransferHistory"("studentId");

-- CreateIndex
CREATE INDEX "TeacherTransferHistory_toTeacherId_idx" ON "TeacherTransferHistory"("toTeacherId");

-- CreateIndex
CREATE INDEX "TeacherGradePricing_teacherId_grade_idx" ON "TeacherGradePricing"("teacherId", "grade");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherGradePricing_teacherId_grade_effectiveMonth_key" ON "TeacherGradePricing"("teacherId", "grade", "effectiveMonth");

-- CreateIndex
CREATE INDEX "PriceAuditHistory_teacherId_grade_idx" ON "PriceAuditHistory"("teacherId", "grade");

-- CreateIndex
CREATE INDEX "StudentMonthlySubscription_studentId_teacherId_idx" ON "StudentMonthlySubscription"("studentId", "teacherId");

-- CreateIndex
CREATE INDEX "StudentMonthlySubscription_branchId_idx" ON "StudentMonthlySubscription"("branchId");

-- CreateIndex
CREATE INDEX "StudentMonthlySubscription_status_idx" ON "StudentMonthlySubscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMonthlySubscription_studentId_teacherId_billingYear__key" ON "StudentMonthlySubscription"("studentId", "teacherId", "billingYear", "billingMonth");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_branchId_idx" ON "SubscriptionPayment"("branchId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_studentId_idx" ON "SubscriptionPayment"("studentId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_accountantId_idx" ON "SubscriptionPayment"("accountantId");

-- CreateIndex
CREATE INDEX "SubscriptionPaymentItem_paymentId_idx" ON "SubscriptionPaymentItem"("paymentId");

-- CreateIndex
CREATE INDEX "SubscriptionPaymentItem_subscriptionId_idx" ON "SubscriptionPaymentItem"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchSequentialReceipt_receiptNumber_key" ON "BranchSequentialReceipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BranchSequentialReceipt_paymentId_key" ON "BranchSequentialReceipt"("paymentId");

-- CreateIndex
CREATE INDEX "BranchSequentialReceipt_branchId_idx" ON "BranchSequentialReceipt"("branchId");

-- CreateIndex
CREATE INDEX "BranchSequentialReceipt_studentId_idx" ON "BranchSequentialReceipt"("studentId");

-- CreateIndex
CREATE INDEX "BranchSequentialReceipt_teacherId_idx" ON "BranchSequentialReceipt"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchSequentialReceipt_branchId_sequenceNumber_key" ON "BranchSequentialReceipt"("branchId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "StudentAuditLog_studentId_idx" ON "StudentAuditLog"("studentId");

-- CreateIndex
CREATE INDEX "StudentAuditLog_eventType_idx" ON "StudentAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "StudentAuditLog_createdAt_idx" ON "StudentAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "User_responsibleTeacherId_idx" ON "User"("responsibleTeacherId");

-- CreateIndex
CREATE INDEX "User_creatorId_idx" ON "User"("creatorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_responsibleTeacherId_fkey" FOREIGN KEY ("responsibleTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTeacher" ADD CONSTRAINT "StudentTeacher_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentTeacher" ADD CONSTRAINT "StudentTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherTransferHistory" ADD CONSTRAINT "TeacherTransferHistory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherTransferHistory" ADD CONSTRAINT "TeacherTransferHistory_fromTeacherId_fkey" FOREIGN KEY ("fromTeacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherTransferHistory" ADD CONSTRAINT "TeacherTransferHistory_toTeacherId_fkey" FOREIGN KEY ("toTeacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSubscriptionSetting" ADD CONSTRAINT "TeacherSubscriptionSetting_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherGradePricing" ADD CONSTRAINT "TeacherGradePricing_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMonthlySubscription" ADD CONSTRAINT "StudentMonthlySubscription_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMonthlySubscription" ADD CONSTRAINT "StudentMonthlySubscription_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_accountantId_fkey" FOREIGN KEY ("accountantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPaymentItem" ADD CONSTRAINT "SubscriptionPaymentItem_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SubscriptionPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPaymentItem" ADD CONSTRAINT "SubscriptionPaymentItem_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "StudentMonthlySubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSequentialReceipt" ADD CONSTRAINT "BranchSequentialReceipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SubscriptionPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSequentialReceipt" ADD CONSTRAINT "BranchSequentialReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSequentialReceipt" ADD CONSTRAINT "BranchSequentialReceipt_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSequentialReceipt" ADD CONSTRAINT "BranchSequentialReceipt_accountantId_fkey" FOREIGN KEY ("accountantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAuditLog" ADD CONSTRAINT "StudentAuditLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

