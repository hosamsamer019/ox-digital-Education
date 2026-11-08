# OX-DIGITAL Education — Phase 6.2A
# Implementation & Verification Roadmap

**Status:** Approved Design Specification (Documentation-Only — No Implementation Authorized)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Ordered Implementation Stages & Gateways

Implementation of the independent dimension monitoring architecture must proceed through **six strictly sequenced stages**. Advancement to each successive stage is gated by automated test verification and explicit Product Owner sign-off.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 1: Pre-Implementation Clean-up & Bug Fixes                       │
│ (Fix publishedAt lifecycle & deprecate orphaned user-service endpoint) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 2: Database Schema Migration                                     │
│ (Introduce StudentDimensionAssessment & StudentDimensionHistory)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 3: Core Assessment Engine & Snapshot Worker                      │
│ (Independent 4-dimension calculation & 7-day empirical trend)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 4: API Service & Backward-Compatibility Bridge                   │
│ (/api/analytics/monitoring-roster & temporary legacy adapter)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 5: Frontend Dashboards Refactor                                  │
│ (Teacher, Admin, and Parent multi-badge RTL UI components)             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 6: Event-Driven Parent Notification Engine                       │
│ (All-level notifications, idempotency, and anti-spam cooldown)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Migration Analysis

### Limitations of Existing `StudentRiskHistory`
Direct inspection of `packages/database/prisma/schema.prisma` confirms:
```prisma
model StudentRiskHistory {
  id             String    @id @default(uuid())
  studentId      String
  lessonId       String
  riskLevel      String
  riskCode       String
  detectedAt     DateTime  @default(now())
  resolvedAt     DateTime?
  resolutionCode String?
  videoProgress VideoProgress @relation(fields: [studentId, lessonId], references: [studentId, lessonId], onDelete: Cascade)
}
```
**Architectural Barrier:** Because `StudentRiskHistory` is constrained to `VideoProgress [studentId, lessonId]`, it cannot record Academic, Attendance, or Homework assessments without schema corruption.

### Required Non-Destructive Schema Additions
To support independent dimensions without altering or deleting existing tables, the following models are specified for Stage 2:

```prisma
enum AssessmentDimension {
  ACADEMIC
  ATTENDANCE
  HOMEWORK
  ENGAGEMENT
  ACTIVITY
}

enum DimensionAssessmentStatus {
  AVAILABLE
  PENDING
  INSUFFICIENT_DATA
  NOT_APPLICABLE
}

enum DimensionRiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum DimensionTrendDirection {
  IMPROVING
  STABLE
  DETERIORATING
  UNAVAILABLE
}

// Current cached dimensional status per student/course
model StudentDimensionAssessment {
  id             String                    @id @default(uuid())
  studentId      String
  courseId       String
  dimension      AssessmentDimension
  status         DimensionAssessmentStatus @default(PENDING)
  healthScore    Float?
  riskLevel      DimensionRiskLevel?
  trendDirection DimensionTrendDirection   @default(UNAVAILABLE)
  trendDelta     Float?
  explanationAr  String
  evidenceJson   Json
  assessedAt     DateTime                  @default(now())
  updatedAt      DateTime                  @updatedAt

  student User   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  course  Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([studentId, courseId, dimension])
  @@index([dimension, riskLevel])
}

// Daily historical snapshots for 7-day empirical trend calculation
model StudentDimensionHistory {
  id          String              @id @default(uuid())
  studentId   String
  courseId    String
  dimension   AssessmentDimension
  healthScore Float?
  riskLevel   DimensionRiskLevel?
  snapshotDate DateTime           // Truncated to midnight UTC
  createdAt   DateTime            @default(now())

  student User   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  course  Course @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([studentId, courseId, dimension, snapshotDate])
  @@index([studentId, dimension, snapshotDate])
}
```

---

## 3. Comprehensive Multi-Layered Testing Plan

| Test Layer | Focus Areas & Edge Cases | Verification Tooling |
|---|---|---|
| **1. Unit Tests** | • Division-by-zero protection (0 exams scheduled).<br>• Latest attempt selection (retake handling).<br>• Attendance denominator exclusion of excused absences.<br>• Homework deadline comparison against UTC timestamps.<br>• Pure 7-day delta calculation ($\pm 24\text{h}$ snapshot window). | Vitest / Jest |
| **2. Integration Tests** | • End-to-end BullMQ midnight snapshot job.<br>• Parallel execution idempotency.<br>• Verification that online-only students receive `NOT_APPLICABLE` for attendance.<br>• Verification that center students receive `NOT_APPLICABLE` for pure online activity. | Supertest & Docker Test DB |
| **3. API Contract Tests** | • Response validation against `StudentMonitoringProfile` interface.<br>• Verification of explicit status enums.<br>• Zero occurrences of `overallRiskScore` in payload.<br>• Legacy bridge response formatting. | Vitest API Test Suite |
| **4. Security & Privacy Tests** | • Parent authorization scoping (verify parent cannot read data of non-child).<br>• Cross-tenant isolation (verify teacher cannot query students from other centers). | RBAC Integration Tests |
| **5. RTL & UI Browser Tests** | • Arabic layout rendering on desktop (1920x1080), tablet (1024x768), mobile (375x812).<br>• Contrast ratio compliance for risk level badges.<br>• Evidence drawer slide-over interaction. | Playwright / Vitest Testing Library |

---

## 4. Rollback & Data Protection Strategy

1. **Non-Destructive Migrations Only:**
   - All proposed database changes consist exclusively of **adding new tables and enums**. No existing columns or tables are dropped or renamed.
2. **Immediate Rollback Mechanism:**
   - If Stage 4 or Stage 5 reveals frontend anomalies, traffic can be redirected back to the legacy endpoint `/api/analytics/risk` instantaneously via environment variable `FEATURE_FLAG_URE=false`.
3. **Audit Ledger Immutability:**
   - Snapshot records in `StudentDimensionHistory` are append-only. No `UPDATE` operations are executed against historical ledger rows.

