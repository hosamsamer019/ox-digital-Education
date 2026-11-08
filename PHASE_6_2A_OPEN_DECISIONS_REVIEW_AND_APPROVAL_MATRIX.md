# OX-DIGITAL Education
# Phase 6.2A — Open Decisions Review & Approval Matrix

**Document:** OD-01 to OD-10 Decision Review  
**Status:** PARTIALLY APPROVED (OD-01, OD-02, OD-11, OD-12, OD-12.1 APPROVED; OD-03 to OD-10 PENDING)  
**Scope:** Risk Assessment Architecture  
**Authorization:** Design and policy decisions only. No implementation authorization is granted.  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Core Architectural Principles

The following decisions have already been approved and must remain unchanged:

1. **Four independent assessment dimensions:**
   - Academic
   - Attendance
   - Homework
   - Engagement

2. **No combined or weighted overall risk score.**

3. **Online-only students must be assessed through digital Activity rather than physical Attendance.**

4. **Parent notifications must support all assessment levels:**
   - LOW
   - MEDIUM
   - HIGH
   - CRITICAL

5. **Trends must compare actual assessment records from the current period against records from seven days earlier.**

6. **Missing or insufficient evidence must never be interpreted as good performance or zero risk.**

The ten decisions below must be reviewed without violating these approved principles.

---

# 2. Decision Review Matrix

## OD-01 — Academic Assessment Calculation

**Question:** How should academic performance be calculated when a student has multiple graded assessments?

### Available options

**Option A — Simple Average**
- Calculate the arithmetic mean of eligible graded assessment results.
- Every assessment has equal importance.

**Option B — Assessment-Type Weighting**
- Assign different weights to exams, quizzes, and other assessment types.
- Requires approved academic weighting rules.

**Option C — Recency-Based Weighting**
- Give more importance to recent assessments.
- Requires a defined recency window and decay policy.

### Technical recommendation

Start with a simple average of eligible graded assessments until the Academic Director approves a more sophisticated model.

Do not silently introduce assessment-type or recency weighting.

Retakes must follow a separately approved policy. The latest graded attempt should not automatically replace all previous assessment evidence without considering assessment identity and retake rules.

**Required approver:** Academic Director.  
**Proposed decision:** Option A.  
**Status:** PENDING APPROVAL.  

---

## OD-02 — Minimum Evidence for Academic Assessment

**Question:** How many graded assessments are required before an academic assessment becomes AVAILABLE?

### Available options

- Option A: At least one graded assessment.
- Option B: At least two graded assessments.
- Option C: At least three graded assessments.
- Option D: Configurable minimum based on grade level or assessment type.

### Technical recommendation

Use at least three eligible graded assessments before classifying the academic dimension as AVAILABLE.

Before reaching the minimum:
- Return `INSUFFICIENT_DATA`.
- Show the number of available assessments.
- Do not assign a LOW or GOOD classification based on insufficient evidence.

The minimum should be evaluated within an approved assessment period.

**Required approvers:** Academic Director and Product Owner.  
**Proposed decision:** Option C — Minimum three graded assessments.  
**Status:** PENDING APPROVAL.  

---

## OD-03 — Attendance Lateness Treatment

**Question:** How should late attendance affect the attendance assessment?

### Available options

- Option A: Treat late attendance as PRESENT.
- Option B: Treat late attendance as PARTIALLY ATTENDED.
- Option C: Treat late attendance as ABSENT.
- Option D: Apply a configurable attendance credit.

### Technical recommendation

Treat `LATE` as a separate attendance state.

For an initial proposed formula:
- PRESENT = 100% attendance credit.
- LATE = 75% attendance credit.
- Unexcused ABSENT = 0% attendance credit.
- Excused ABSENT = excluded from the eligible absence denominator.
- Cancelled sessions = excluded.

The 75% value is a proposal, not an approved academic or operational rule.

Attendance calculations must use actual sessions held and the student's valid enrollment period.

**Required approver:** Center Operations Lead.  
**Proposed decision:** Option D — 75% credit for LATE.  
**Status:** PENDING APPROVAL.  

---

## OD-04 — Late Homework Submission Treatment

**Question:** How should late homework submissions affect the homework assessment?

### Available options

- Option A: Late submission receives full credit.
- Option B: Late submission receives partial credit.
- Option C: Late submission receives zero credit.
- Option D: Late submission is tracked separately without reducing the submission rate.

### Technical recommendation

Use partial credit for late submissions.

Proposed calculation:
- On-time submission = 100% submission credit.
- Late submission = 50% submission credit.
- Missing submission after the deadline = 0% submission credit.
- Exempted or cancelled assignments = excluded.
- Assignments not yet due = excluded.
- Ungraded submissions must not be treated as missing.

If there are no eligible assignments, return `PENDING` or `NOT_APPLICABLE`.

**Required approver:** Academic Director.  
**Proposed decision:** Option B — 50% credit for late submissions.  
**Status:** PENDING APPROVAL.  

---

## OD-05 — Video Engagement Grace Period

**Question:** How long should a student have to watch a newly published lesson before inactivity can affect engagement assessment?

### Available options

- Option A: No grace period.
- Option B: 24 hours.
- Option C: 48 hours.
- Option D: 72 hours.
- Option E: Configurable grace period based on course policy.

### Technical recommendation

Use a 72-hour grace period after the actual publication timestamp.

Important safeguards:
- Draft lessons must not enter engagement calculations.
- Scheduled lessons must become eligible only after actual publication.
- Editing an existing lesson must not reset its original publication timestamp.
- Unavailable or untrackable content must not penalize students.
- Live lessons and non-video materials must have separate engagement rules.

**Required approver:** Product Owner.  
**Proposed decision:** Option D — 72 hours.  
**Status:** PENDING APPROVAL.  

---

## OD-06 — Historical Lesson Publication Timestamp Backfill

**Question:** How should existing lessons with `publishedAt = NULL` be handled?

### Available options

**Option A — No Backfill**
- Keep historical NULL values.
- Only future verified publication events receive timestamps.

**Option B — Selective Backfill**
- Identify lessons with reliable evidence that they were already published.
- Prepare a dry-run report.
- Backfill only verified records after separate authorization.

**Option C — Full Backfill**
- Set every NULL `publishedAt` to `createdAt`.

### Technical recommendation

Choose Option B.

A lesson creation timestamp does not prove that the lesson was published at that time.

The audit must first inspect:
- Existing publication status fields.
- Visibility rules.
- Historical status transitions, if available.
- Course publication state.
- Scheduled publication behavior.

The dry-run report must include:
- Total lessons inspected.
- Confirmed published lessons.
- Draft lessons.
- Scheduled lessons.
- Ambiguous records.
- Proposed records eligible for backfill.

No database writes are authorized by this decision document.

**Required approvers:** System Architect and Product Owner.  
**Proposed decision:** Option B — Selective, evidence-based backfill.  
**Status:** PENDING APPROVAL.  

---

## OD-07 — Parent Notification Cooldown

**Question:** How should repeated notifications be controlled?

### Available options

- Option A: Notify on every assessment.
- Option B: Notify only when the assessment level changes.
- Option C: Notify on first assessment and meaningful changes, with a cooldown for unchanged assessments.
- Option D: Notify only for HIGH and CRITICAL.

Option D conflicts with the previously approved requirement to notify parents about all four levels and is therefore not recommended.

### Technical recommendation

Choose Option C.

Proposed notification rules:
1. Send an initial notification when a dimension receives its first valid assessment.
2. Send a notification when its level changes.
3. Send an immediate notification when the level escalates.
4. Do not send repeated notifications for unchanged assessments during the cooldown.
5. Send another notification after the cooldown only if the assessment remains eligible for a scheduled reminder under the approved policy.
6. Deduplicate notifications using a deterministic event identifier.
7. Maintain an auditable notification history.

Proposed cooldown:
- Seven days for unchanged assessments.
- No cooldown for escalation events.

The system must notify for LOW, MEDIUM, HIGH, and CRITICAL when the applicable notification trigger is satisfied.

**Required approver:** Product Owner.  
**Proposed decision:** Option C — Seven-day cooldown with immediate escalation notifications.  
**Status:** PENDING APPROVAL.  

---

## OD-08 — Online-Only Student Activity Assessment

**Question:** Which digital activity sources should determine online-only student engagement?

### Available options

- Option A: VideoProgress only.
- Option B: VideoProgress and completed learning activities.
- Option C: VideoProgress, homework submissions, and learning continuity.
- Option D: A broader event-based activity model after introducing a normalized Activity event system.

### Technical recommendation

Use Option C as an initial design proposal, subject to data-quality validation.

Proposed composition:

| Activity source | Proposed contribution |
|---|---:|
| Video learning activity | 50% |
| Homework activity | 30% |
| Learning continuity | 20% |

Important conditions:
- These percentages are proposals only.
- ExamAttempt should remain part of academic assessment, not be counted again as a separate engagement signal without an explicit policy.
- Login timestamps alone must not represent meaningful learning.
- Missing video tracking must not be interpreted as inactivity.
- The system must distinguish content unavailable for tracking from content available but not accessed.
- Online-only students must not be penalized for lacking physical attendance records.

If one or more activity sources are unavailable, the system must not silently treat missing values as zero.

A documented eligibility and normalization policy is required before calculating an activity result.

**Required approvers:** Academic Lead and System Architect.  
**Proposed decision:** Option C — VideoProgress, homework activity, and continuity, with the proposed percentages subject to approval.  
**Status:** PENDING APPROVAL.  

---

## OD-09 — External Parent Notification Channels

**Question:** Which notification channels should be supported?

### Available options

- Option A: In-app notifications only.
- Option B: In-app notifications and email.
- Option C: In-app notifications, SMS, and WhatsApp.
- Option D: Configurable multi-channel notifications.

### Technical recommendation

Start with in-app notifications.

Future external channels must require:
- Explicit Product Owner approval.
- Legal and privacy review.
- Parent consent where required.
- Validated contact information.
- Approved message templates.
- Delivery failure handling.
- Opt-out support where applicable.
- Audit records.

Do not implement SMS or WhatsApp in the current architecture stage.

**Required approvers:** Product Owner and Legal.  
**Proposed decision:** Option A for the initial implementation; external channels deferred.  
**Status:** PENDING APPROVAL.  

---

## OD-10 — Seven-Day Trend Threshold

**Question:** How much change is required to classify a dimension as improving or deteriorating?

### Available options

- Option A: Any measurable change.
- Option B: A configurable threshold.
- Option C: A fixed threshold of ±5 percentage points.
- Option D: Dimension-specific thresholds.

### Technical recommendation

Use configurable thresholds, with the option to define different thresholds for different dimensions.

Proposed initial rule:

| Change in dimension score | Trend |
|---|---|
| Improvement greater than 5 points | IMPROVING |
| Change between -5 and +5 points | STABLE |
| Deterioration greater than 5 points | DETERIORATING |
| Missing or incomparable historical data | UNAVAILABLE |

The comparison must use valid persisted assessments from seven days earlier.

Do not compare different assessment populations, periods, or calculation versions without an explicit comparability check.

**Required approver:** Academic Director.  
**Proposed decision:** Option B — Configurable thresholds, initially considering ±5 points.  
**Status:** PENDING APPROVAL.  

---

## OD-11 — Assessment Retake Policy

**Question:** Which attempt contributes to academic calculations when a student takes an assessment more than once?

### Available options

- **Option A — Latest Attempt:** The chronologically latest eligible graded attempt per assessment contributes. Tie-breaker: `submittedAt || createdAt DESC, id DESC`.
- **Option B — Highest Score:** Highest percentage achieved.
- **Option C — Arithmetic Mean:** Average of attempts.
- **Option D — First Attempt Only:** Initial attempt only.

**Required approver:** Product Owner.  
**Approved decision:** Option A — Latest Attempt.  
**Status:** APPROVED (Product Owner).  

---

## OD-12 — Academic Assessment Evaluation Period

**Question:** What timeframe should be evaluated for student academic assessments?

### Available options

- **Option A — Cumulative All-Time:** Full historical tenure.
- **Option B — Official Academic Term:** Term-bound evaluation.
- **Option C — Rolling Time Window:** Trailing sliding time window.

**Required approver:** Product Owner.  
**Approved decision:** Option C — Rolling Time Window.  
**Status:** APPROVED (Product Owner).  

---

## OD-12.1 — Rolling Time Window Duration

**Question:** What is the approved calendar duration for the rolling evaluation window (Parent: OD-12)?

### Available options

- **Option A — 30 Calendar Days:** Trailing 30-day window (`now - 30 days`).
- **Option B — 60 Calendar Days:** Trailing 60-day window.
- **Option C — 90 Calendar Days:** Trailing 90-day window.
- **Option D — Custom Duration:** Other configured period.

**Required approver:** Product Owner.  
**Approved decision:** Option A — 30 Calendar Days.  
**Status:** APPROVED (Explicit Product Owner Approval).  

---

# 3. Approval Summary

| Decision | Approved / Proposed selection | Required approver | Current Status |
|---|---|---|---|
| **OD-01** | Simple academic average | Academic Director & Product Owner | **APPROVED** |
| **OD-02** | Minimum 3 graded assessments | Academic Director & Product Owner | **APPROVED** |
| **OD-03** | 75% credit for late attendance | Center Operations Lead | PENDING APPROVAL |
| **OD-04** | 50% credit for late homework | Academic Director | PENDING APPROVAL |
| **OD-05** | 72-hour video grace period | Product Owner | PENDING APPROVAL |
| **OD-06** | Selective historical backfill via dry-run report | System Architect & Product Owner | PENDING APPROVAL |
| **OD-07** | 7-day cooldown, immediate escalation | Product Owner | PENDING APPROVAL |
| **OD-08** | Video 50%, homework 30%, continuity 20% | Academic Lead & System Architect | PENDING APPROVAL |
| **OD-09** | In-app first; external channels deferred | Product Owner & Legal | PENDING APPROVAL |
| **OD-10** | Configurable trend threshold, initially ±5 | Academic Director | PENDING APPROVAL |
| **OD-11** | Latest completed attempt per assessment | Product Owner | **APPROVED** |
| **OD-12** | Rolling time window evaluation | Product Owner | **APPROVED** |
| **OD-12.1** | Rolling window duration: 30 calendar days | Product Owner | **APPROVED** |

---

# 4. Approval and Implementation Boundaries

Approval of an individual decision means approval of its policy direction only.

It does not automatically authorize:
- Source-code changes.
- Prisma schema modifications.
- Database migrations.
- Historical data updates.
- Docker or infrastructure changes.
- Production deployment.
- Git commits or pushes.

Each implementation stage requires a separate explicit authorization.

Any unresolved decision must remain configurable or explicitly `PENDING`; developers must not invent a default policy and treat it as approved.

---

# 5. Required Final Sign-Off

The Product Owner should review each OD decision and record:
- `APPROVED`
- `REJECTED`
- `NEEDS REVISION`

The final approved decision register must preserve the approver and approval date for every decision.

**Current status: OD-01, OD-02, OD-11, OD-12, AND OD-12.1 ARE APPROVED; OD-03 THROUGH OD-10 REMAIN PROPOSED AND AWAITING SEPARATE PHASE APPROVAL.**

