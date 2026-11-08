# OX-DIGITAL Education — Phase 6.2C.1.1
# Implementation Readiness & Product Owner Policy Roadmap

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Audit Execution Mode:** Strictly Read-Only  
**Verdict:** **IMPLEMENTATION READY & POLICY GATES COMPLETED (OD-01, OD-02, OD-11, OD-12, OD-12.1 APPROVED)**  

---

## 1. Executive Summary

This document synthesizes the forensic findings of Phase 6.2C.1.1 into an actionable readiness specification for the Product Owner.

All technical prerequisites for schema alignment on `Exam` and `ExamAttempt` have been validated. However, **execution remains gated** upon formal Product Owner decisions regarding historical retakes (OD-11) and evaluation periods (OD-12).

---

## 2. Canonical Decisions Register (OD-01 to OD-12)

| Decision ID | Canonical Topic | Status | Engineering Impact & State |
|---|---|---|---|
| **OD-01** | Academic Assessment Calculation | **APPROVED** | Simple arithmetic mean with equal 1.0x weighting. Implemented. |
| **OD-02** | Minimum Academic Evidence Requirement | **APPROVED** | Strict minimum 3 eligible graded assessments. Implemented. |
| **OD-03** | Attendance Lateness Treatment | **UNRESOLVED** | Future Phase 6.3 scope. |
| **OD-04** | Late Homework Submission Treatment | **UNRESOLVED** | Future Phase 6.3 scope. |
| **OD-05** | Video Engagement Grace Period | **UNRESOLVED** | Future Phase 6.4 scope. |
| **OD-06** | Historical Lesson Publication Timestamp Backfill | **UNRESOLVED** | Future Phase 6.4 scope. |
| **OD-07** | Parent Notification Cooldown Window | **UNRESOLVED** | Future Phase 6.4 scope. |
| **OD-08** | Online-Only Student Activity Assessment Method | **UNRESOLVED** | Future Phase 6.4 scope. |
| **OD-09** | External Parent Notification Delivery Channels | **UNRESOLVED** | Future Phase 6.4 scope. |
| **OD-10** | Seven-Day Assessment Trend Comparison Threshold | **UNRESOLVED** | Future Phase 6.4 scope. |
| **OD-11** | Assessment Retake Policy | **APPROVED (Option A)** | Latest attempt selected with deterministic tie-breaking. Implemented in Phase 6.2C.2. |
| **OD-12** | Academic Assessment Evaluation Period | **APPROVED (Option C)** | Rolling window evaluation selected. Implemented in Phase 6.2C.2. |
| **OD-12.1** | Rolling Time Window Duration | **APPROVED (Option A)** | 30 calendar days duration (`LAST_30_DAYS`) approved by Product Owner. Implemented. |

---

## 3. Approved Decision Specifications & Technical Alignment

### 3.1 OD-11: Assessment Retake Policy — APPROVED (Option A: Latest Attempt)
- **Approved Policy:** Option A — Latest Completed Attempt.
- **Implementation:** When multiple graded attempts exist for `assessmentId`, the engine selects the attempt with the most recent `submittedAt` (or `createdAt`), using attempt `id` as deterministic secondary tie-breaker (`ORDER BY submittedAt DESC, id DESC`).
- **Database Schema Invariant:** The database schema MUST NOT enforce `@@unique([studentId, examId])`, allowing multiple legitimate retake attempts to be recorded.

### 3.2 OD-12: Academic Evaluation Period & OD-12.1 Rolling Duration — APPROVED (Option C: Rolling 30 Days)
- **Approved Policy:** OD-12 Option C (Rolling Time Window) with OD-12.1 Option A (30 Calendar Days).
- **Implementation:** Evaluates eligible graded assessments where `submittedAt >= now() - 30 calendar days`. Implemented across `academicAssessment.calculator.ts` and downstream consumers with `LAST_30_DAYS` evaluation scope.

---

## 4. Go / No-Go Implementation Gates for Phase 6.2C.2

Before Phase 6.2C.2 is authorized to execute database modifications, all four gates must be certified:

| Gate | Requirement | Status | Responsible Role |
|---|---|---|---|
| **Gate 1** | Product Owner formal policy approval for OD-11, OD-12, and OD-12.1. | **APPROVED (COMPLETED)** | Product Owner |
| **Gate 2** | Pre-migration PostgreSQL backup and verified restore test in isolated container. | **SPECIFIED (Ready)** | Lead Engineer |
| **Gate 3** | Non-breaking DDL migration script with zero table rewrites. | **VALIDATED (Ready)** | Lead Engineer |
| **Gate 4** | Zero-invention conditional backfill script. | **VALIDATED (Ready)** | Lead Engineer |

---

## 5. Scope of Future Implementation (Phase 6.2C.2)

Upon receipt of Product Owner authorization, Phase 6.2C.2 will execute the following bounded operations:
1. Apply DDL additions (`Exam.totalPoints`, `ExamAttempt.status`, `submittedAt`, `isGraded`, `totalPoints`, `percentage`).
2. Run data backfill classifying legacy abandoned sessions as `STARTED` / `ABANDONED` without fabricating timestamps.
3. Update `exam.controller.ts` to write `status: 'STARTED'` on exam initiation and `status: 'GRADED'`, `submittedAt: now` on submission.
4. Update `analytics-service` and `user-service` to filter `{ where: { status: 'GRADED' } }`, eliminating ghost 0% grades.
5. Re-run full 212-test regression suite to guarantee 100% platform integrity.

**STOP CONDITION:** Execution halts here. No code, schema, or database modifications will occur until explicit authorization is granted.

