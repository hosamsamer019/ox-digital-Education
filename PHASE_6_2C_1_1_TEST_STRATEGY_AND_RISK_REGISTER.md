# OX-DIGITAL Education — Phase 6.2C.1.1
# Test Strategy & Pre-Migration Risk Register

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Audit Execution Mode:** Strictly Read-Only  

---

## 1. Executive Summary

This testing strategy details the multi-tiered verification required before and after any database schema alignment migration. Tests are categorized by execution boundary to preserve database safety.

---

## 2. Test Execution Tiers & Safety Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: In-Memory Unit & Mocked Component Tests                        │
│ - Execution: vitest run in apps/frontend & npm test in microservices   │
│ - Safety: 100% Safe (Read-only, zero DB connections, runs in sandbox) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 2: Isolated Container Database Integration Tests                  │
│ - Execution: Ephemeral test container (ox-digital-postgres-test)       │
│ - Safety: Isolated (Must NEVER point to primary database)              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 3: Cross-Service Contract & Staging End-to-End Tests              │
│ - Execution: Inter-service HTTP calls in staging environment           │
│ - Safety: Read-only probes, mock tokens, verified endpoints            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Comprehensive 22-Scenario Lifecycle Test Matrix

| # | Test Scenario | Execution Tier | Database Connection Required? | Expected Outcome |
|---|---|---|---|---|
| **1** | New attempt created via `startAttempt` | Tier 1 / Tier 2 | In-memory mock (Tier 1) / Test DB (Tier 2) | Row created with `status: 'STARTED'`, `score: 0`, `submittedAt: null`. |
| **2** | Duplicate attempt created before submission | Tier 1 / Tier 2 | Mock / Test DB | Second row created with `status: 'STARTED'`, does not overwrite first. |
| **3** | Answer autosave via `syncAttempt` | Tier 1 / Tier 2 | Mock / Test DB | Answers updated in-place; status remains `STARTED`, `submittedAt` remains null. |
| **4** | Normal exam submission | Tier 1 / Tier 2 | Mock / Test DB | Score calculated, `status: 'GRADED'`, `isGraded: true`, `submittedAt: now`. |
| **5** | Zero score on legitimate completion | Tier 1 / Tier 2 | Mock / Test DB | Student answered all wrong: `status: 'GRADED'`, `score: 0`, `submittedAt: now`. |
| **6** | Single cheating violation logged | Tier 1 / Tier 2 | Mock / Test DB | Violation saved, attempt continues unaltered. |
| **7** | Second cheating violation logged | Tier 1 / Tier 2 | Mock / Test DB | Attempt updated to `status: 'CHEATING'`, `score: 0`, student locked out. |
| **8** | Time expiry past grace period | Tier 1 / Tier 2 | Mock / Test DB | `status: 'TIME_EXPIRED'`, available answers graded. |
| **9** | Abandoned exam (browser closed) | Tier 1 / Tier 2 | Mock / Test DB | Status remains `STARTED`, excluded from academic average. |
| **10**| Multiple completed retakes (OD-11) | Tier 1 (Calculator) | Pure in-memory (No DB) | Engine halts with `BLOCKED_PENDING_POLICY`. |
| **11**| Single attempt + abandoned attempt | Tier 1 (Calculator) | Pure in-memory | Abandoned ignored; valid attempt evaluated without conflict. |
| **12**| Legacy record lacking `totalPoints` | Tier 1 (Calculator) | Pure in-memory | Tracked in `unverifiableAttemptsCount`, amber UI warning displayed. |
| **13**| Ambiguous zero score (no violations) | Tier 1 / Tier 2 | Mock / Test DB | Marked `UNVERIFIABLE`, excluded from GPA. |
| **14**| Student GPA calculation in `user-service` | Tier 1 (Mocked) | Mock DB | Averages only `status = 'GRADED'`, ignores abandoned sessions. |
| **15**| At-risk queue in `analytics-service` | Tier 1 (Mocked) | Mock DB | Does not mark students at-risk for abandoned exams. |
| **16**| Admin platform average score | Tier 1 (Mocked) | Mock DB | Computes platform pass rate strictly from graded attempts. |
| **17**| Parent dashboard child exam view | Tier 1 (Mocked) | Mock DB | Displays completed exams under graded list, in-progress separately. |
| **18**| Idempotent double submission | Tier 1 / Tier 2 | Mock / Test DB | Second submit returns existing result without regrading or duplicating. |
| **19**| Concurrent autosave and submit race | Tier 2 | Test DB (Row lock) | Transaction serializes cleanly; submit wins without corrupted answers. |
| **20**| DDL migration schema integrity | Tier 2 | Test DB | `prisma migrate deploy` succeeds with zero table rewrites. |
| **21**| Data backfill accuracy | Tier 2 | Test DB | Backfill script classifies historical rows with 100% adherence to rules. |
| **22**| Backup restoration verification | Tier 2 | Isolated throwaway DB | `pg_restore` completes with code 0 and exact table/row checksums. |

---

## 4. Pre-Migration Risk Register

| Risk ID | Risk Description | Severity | Likelihood | Impact | Mitigation Strategy |
|---|---|---|---|---|---|
| **R-01** | **Historical Zero-Score Ambiguity:** A student who genuinely scored 0% with no violations might be mistaken for an abandoned exam. | Medium | Low | True 0% student excluded from average. | Require `answers IS NOT NULL AND answers != '[]'` before classifying as graded. |
| **R-02** | **Accidental Unique Constraint Collision:** Adding `@@unique([studentId, examId])` while duplicate rows exist. | **CRITICAL** | High | **Immediate migration failure.** | Prohibit unique constraint on `ExamAttempt` until OD-11 is decided. |
| **R-03** | **Post-Migration Rollback Data Loss:** Executing down-migration destroys submission timestamps written after deployment. | High | Low | Loss of post-migration audit trail. | Mandate roll-forward policy; prohibit down migrations on live data. |
| **R-04** | **Unweighted Score Mismatch:** Legacy code scored exams as $(correct/total)\times 100$, ignoring `q.points`. | Medium | Medium | Points vs percentage confusion. | Explicitly document that `ExamAttempt.score` is a percentage; store raw points in `totalPoints`. |
| **R-05** | **Stranded Expired Attempts:** Students whose time expired were blocked by HTTP 400. | Low | Medium | Students locked out without grade. | Auto-grade stranded answers during Phase 6.2C backfill. |

