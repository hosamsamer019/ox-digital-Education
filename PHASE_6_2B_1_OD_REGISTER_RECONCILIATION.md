# OX-DIGITAL Education
# Phase 6.2B.1 — Open Decisions Register Reconciliation Report
## Restoration of Canonical OD-01 through OD-10 Definitions

**Date:** November 1, 2026  
**Status:** COMPLETE & RECONCILED  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Scope:** Strict reconciliation of open decisions OD-01 through OD-10 against canonical Phase 6.2A governance records.

---

## 1. Executive Summary

During the Phase 6.2B implementation and reporting, an erroneous renumbering and conceptual reassignment of decisions OD-03 through OD-10 occurred. Specifically, Phase 6.2B reports altered canonical decisions by substituting whole assessment dimensions and policies:

- **OD-08** (canonically *"Online-Only Student Activity Assessment"*) was incorrectly labeled as *"Risk Classification Bands"*.
- **OD-10** (canonically *"Seven-Day Trend Threshold"*) was incorrectly labeled as *"Academic Period Definition"*.
- **OD-03 through OD-07** and **OD-09** were generalized into broad dimension names rather than their specific policy questions.

This document formally invalidates the altered mappings and restores the authoritative, canonical definitions established in `PHASE_6_2A_OPEN_DECISIONS_REGISTER.md` and `PHASE_6_2A_OPEN_DECISIONS_REVIEW_AND_APPROVAL_MATRIX.md`.

---

## 2. Canonical Open Decisions Register (OD-01 to OD-10)

The following table reflects the authoritative definitions, required approvers, and statuses established in Phase 6.2A:

| Decision ID | Canonical Title | Core Policy Question / Definition | Required Approver | Current Status |
|---|---|---|---|---|
| **OD-01** | **Academic Assessment Calculation** | How should academic performance be calculated when a student has multiple graded assessments? (Option A: Simple arithmetic average approved). | Academic Director | **APPROVED (Option A)** |
| **OD-02** | **Minimum Evidence for Academic Assessment** | How many graded assessments are required before an academic assessment becomes AVAILABLE? (Option C: $\ge 3$ approved). | Academic Director & Product Owner | **APPROVED (Option C)** |
| **OD-03** | **Attendance Lateness Treatment** | Should late attendance count as present, absent, or partial attendance in the physical attendance dimension? | Operations Lead | **PENDING APPROVAL** |
| **OD-04** | **Late Homework Submission Treatment** | How should late homework submissions affect the homework completion and performance score? | Academic Director | **PENDING APPROVAL** |
| **OD-05** | **Video Engagement Grace Period** | How many days after lesson publication before an unwatched video is counted as missing engagement? | Product Owner | **PENDING APPROVAL** |
| **OD-06** | **Historical Lesson Publication Timestamp Backfill** | How should lessons published before video tracking was active be timestamped for fair engagement assessment? | Lead Architect | **PENDING APPROVAL** |
| **OD-07** | **Parent Notification Cooldown** | How many days must elapse between consecutive automated parent risk notifications for the same dimension? | Product Owner | **PENDING APPROVAL** |
| **OD-08** | **Online-Only Student Activity Assessment** | How should student activity be measured for online-only students who do not attend center classes? | Product Owner | **PENDING APPROVAL** |
| **OD-09** | **External Parent Notification Channels** | Which external communication channels (SMS, WhatsApp, Email, In-App) should be activated for each risk level? | Product Owner & Operations | **PENDING APPROVAL** |
| **OD-10** | **Seven-Day Trend Threshold** | What percentage change between the current assessment and the record from 7 days ago constitutes an IMPROVING, STABLE, or DECLINING trend? | Academic Director | **PENDING APPROVAL** |

---

## 3. Side-by-Side Reconciliation Analysis

| Decision ID | Canonical Definition (Phase 6.2A) | Erroneous Phase 6.2B Document Label | Root Discrepancy & Analysis |
|---|---|---|---|
| **OD-01** | Academic Assessment Calculation (Option A: Simple Average) | Academic Assessment Calculation | **Consistent.** Implementation of simple arithmetic average aligned with Option A. |
| **OD-02** | Minimum Evidence for Academic Assessment ($\ge 3$ assessments) | Minimum Academic Evidence | **Consistent.** Minimum evidence threshold of 3 graded assessments aligned with Option C. |
| **OD-03** | Attendance Lateness Treatment | "Attendance Dimension" | **Label generalized.** Obscured the specific question regarding late attendance weighting. |
| **OD-04** | Late Homework Submission Treatment | "Digital Activity Dimension" | **Completely misplaced.** Digital activity belongs to OD-08, not OD-04. |
| **OD-05** | Video Engagement Grace Period | "Homework Dimension" | **Completely misplaced.** Homework belongs to OD-04, not OD-05. |
| **OD-06** | Historical Lesson Publication Timestamp Backfill | "Engagement Dimension" | **Label generalized.** Obscured the database backfill policy question. |
| **OD-07** | Parent Notification Cooldown | "Trend Analysis" | **Completely misplaced.** Trend analysis belongs to OD-10, not OD-07. |
| **OD-08** | **Online-Only Student Activity Assessment** | **"Risk Classification Bands"** | **Severe Error.** Reassigned OD-08 to classification cutoffs, completely erasing online student activity governance. |
| **OD-09** | External Parent Notification Channels | "Parent Notification Policy" | **Label generalized.** Obscured the channel dispatch governance question. |
| **OD-10** | **Seven-Day Trend Threshold** | **"Academic Period Definition"** | **Severe Error.** Reassigned OD-10 to academic term definitions, completely erasing trend calculation governance. |

---

## 4. Policy Gap Analysis: Retakes and Academic Periods

Neither Retake Handling nor Academic Period Definition was included in the canonical OD-01 through OD-10 register. They were treated in Phase 6.2A as architectural prerequisites:

1. **Retake Policy:** In `PHASE_6_2A_OPEN_DECISIONS_REVIEW_AND_APPROVAL_MATRIX.md` under OD-01 technical recommendations, it was explicitly recorded:
   > *"Retakes must follow a separately approved policy. The latest graded attempt should not automatically replace all previous assessment evidence without considering assessment identity and retake rules."*
   Because no dedicated OD decision was assigned, Phase 6.2B mistakenly assumed the Phase 6.1B ranking retake rule ("latest completed attempt") applied to the academic assessment dimension.
2. **Academic Period Definition:** In `PHASE_6_2A_OPEN_DECISIONS_REVIEW_AND_APPROVAL_MATRIX.md` under OD-02 technical recommendations, it was recorded:
   > *"The minimum should be evaluated within an approved assessment period."*
   Because no OD decision was assigned for defining academic periods, Phase 6.2B attempted to force it into OD-10.

---

## 5. Supplementary Decision Proposals (OD-11 & OD-12)

To prevent future numbering corruption and formalize governance over these two critical missing policies, the following supplemental decisions are proposed for Product Owner review:

### Proposed Decision OD-11: Assessment Retake Policy
- **Question:** When a student takes the same assessment multiple times, how should retakes be handled in the academic assessment dimension?
- **Option A (Latest Attempt):** Strictly evaluate the latest completed, graded attempt.
- **Option B (Highest Attempt):** Evaluate the highest score achieved on that assessment.
- **Option C (Arithmetic Average of Attempts):** Average all attempts on that assessment.
- **Option D (First Attempt Only):** Evaluate only the first attempt; retakes are for diagnostic purposes only.
- **Recommended Default Pending Approval:** Treat multiple attempts as `BLOCKED_PENDING_POLICY` without silent selection.

### Proposed Decision OD-12: Academic Assessment Evaluation Period
- **Question:** Over what time boundary should eligible assessments be aggregated for a student's active academic dimension?
- **Option A (Explicit Academic Term):** Gated by an `AcademicTerm` calendar entity (requires schema migration).
- **Option B (Rolling Window):** Gated by a rolling sliding window (e.g., past 90 days from evaluation date).
- **Option C (Course Enrollment Boundary):** Gated by current active course enrollment start and end dates.
- **Recommended Default Pending Approval:** Require callers to provide `startDate`/`endDate` or mark status as unverified aggregate.

---

## 6. Conclusion

The canonical definitions of OD-01 through OD-10 are fully restored. All subsequent documentation, remediation, and architectural specifications must strictly adhere to the authoritative register.

