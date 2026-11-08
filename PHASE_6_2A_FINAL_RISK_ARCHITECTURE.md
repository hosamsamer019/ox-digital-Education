# OX-DIGITAL Education — Phase 6.2A
# Final Risk Architecture & System Specification

**Status:** Approved Design Specification (Documentation-Only — No Implementation Authorized)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. System Mission & Architectural Foundation

The OX-DIGITAL Education platform requires an objective, reliable, and evidence-based student monitoring and risk assessment architecture.

Following the findings of the Phase 6.2 Architecture Audit, the Product Owner has established **binding design requirements**:
1. **Four Independent Assessment Dimensions:** Academic, Attendance, Homework, and Engagement must be assessed and communicated strictly as separate dimensions.
2. **Elimination of Composite Scoring:** The system must never calculate, store, or display a single synthetic "overall risk score", composite percentage, or weighted student risk ranking.
3. **Explicit Evidentiary States:** A missing dimension must never be defaulted to zero or interpreted as satisfactory performance. The system must report explicit states (`AVAILABLE`, `PENDING`, `INSUFFICIENT_DATA`, `NOT_APPLICABLE`).
4. **Delivery Mode Specialization:** Center-based students are assessed on physical attendance; online-only students are assessed on digital activity (`Activity`); mixed-mode students are assessed on both without cross-contamination.
5. **Seven-Day Empirical Trend:** Trends must compare current valid assessments against persisted records from exactly seven days earlier. Synthetic or score-inferred trends are prohibited.
6. **All-Level Parent Notifications:** Parents must receive structured notifications across all four risk levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), tied to the specific dimension and protected by strict anti-spam and cooldown policies.

---

## 2. Core Architectural Model: Independent Assessment Dimensions

The architecture repudiates the traditional single-score model. A student who excels in exams but suffers from a family emergency that prevents physical attendance has an **Attendance risk**, not a general "academic failure." 

Collapsing separate behaviors into a single number creates misleading signals that deceive teachers, confuse parents, and misdirect interventions.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Student Assessment Context                               │
│              (Student ID, Course ID, Subject, Grade Level, Delivery Mode)              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
        ┌───────────────────┬───────────────┴───────────────┬───────────────────┐
        ▼                   ▼                               ▼                   ▼
┌───────────────┐   ┌───────────────┐               ┌───────────────┐   ┌───────────────┐
│   Dimension   │   │   Dimension   │               │   Dimension   │   │   Dimension   │
│   ACADEMIC    │   │  ATTENDANCE   │               │   HOMEWORK    │   │  ENGAGEMENT   │
├───────────────┤   ├───────────────┤               ├───────────────┤   ├───────────────┤
│ • Status      │   │ • Status      │               │ • Status      │   │ • Status      │
│ • Score/Level │   │ • Score/Level │               │ • Score/Level │   │ • Score/Level │
│ • Risk Class  │   │ • Risk Class  │               │ • Risk Class  │   │ • Risk Class  │
│ • Evidence    │   │ • Evidence    │               │ • Evidence    │   │ • Evidence    │
│ • Trend (7d)  │   │ • Trend (7d)  │               │ • Trend (7d)  │   │ • Trend (7d)  │
│ • AssessedAt  │   │ • AssessedAt  │               │ • AssessedAt  │   │ • AssessedAt  │
└───────┬───────┘   └───────┬───────┘               └───────┬───────┘   └───────┬───────┘
        │                   │                               │                   │
        └───────────────────┼───────────────────────────────┼───────────────────┘
                            ▼                               ▼
                 ┌─────────────────────┐         ┌─────────────────────┐
                 │  Independent State  │         │   Audited History   │
                 │   (Current Cache)   │         │ (Daily Snapshots)   │
                 └──────────┬──────────┘         └─────────────────────┘
                            │
        ┌───────────────────┼───────────────────────────────┬───────────────────┐
        ▼                   ▼                               ▼                   ▼
┌───────────────┐   ┌───────────────┐               ┌───────────────┐   ┌───────────────┐
│ Admin View    │   │ Teacher View  │               │ Parent View   │   │ Notification  │
│ (Active Flags)│   │ (Intervention)│               │ (Guidance)    │   │ (4-Level URE) │
└───────────────┘   └───────────────┘               └───────────────┘   └───────────────┘
```

---

## 3. Four Independent Assessment Dimensions Defined

### 3.1 Academic Dimension (`ACADEMIC`)
- **Scope:** Graded assessments, unit exams, comprehensive tests, and quizzes.
- **Underlying Models:** `ExamAttempt`, `Exam`, `AssessmentAttempt`, `Assessment`.
- **Policy Rules:**
  - Evaluates only the **latest completed/graded attempt** per assessment (preserving Phase 6.1B decision).
  - Lifetime historical failures are **not** permanent risk indicators.
  - Requires a minimum evidence threshold (e.g., at least 3 completed graded assessments within the active grading period).
  - If threshold is not met, the dimension transitions to `INSUFFICIENT_DATA` or `PENDING`.

### 3.2 Attendance Dimension (`ATTENDANCE` / `ACTIVITY`)
- **Center-Based Students (`ATTENDANCE`):**
  - **Scope:** Physical center classroom sessions.
  - **Underlying Model:** `Attendance` (`PRESENT`, `ABSENT`, `LATE`).
  - **Denominator:** Strictly the count of **actual classroom sessions held** for the student's assigned group (`CenterGroup`), not the count of records.
  - Distinguishes unexcused absence from excused absence and lateness.
- **Online-Only Students (`ACTIVITY`):**
  - **Scope:** Digital learning activity milestones.
  - **Underlying Models:** `VideoProgress` (sessions, watch ticks, completion), `Submission`, `ExamAttempt`.
  - Assesses consistency of digital interaction across weekly course pacing.
- **Mixed-Mode Students:**
  - Evaluated on physical attendance for center sessions and digital activity for online modules as separate independent metrics without cross-mixing or artificial dilution.

### 3.3 Homework Dimension (`HOMEWORK`)
- **Scope:** Assigned practice exercises and mandatory homework submissions.
- **Underlying Models:** `Homework`, `Submission`.
- **Policy Rules:**
  - Only assignments with **past deadlines** (`deadline < now` or `closeAt < now`) are eligible.
  - Not-yet-due assignments are excluded from the denominator.
  - Distinguishes on-time submissions, late submissions, missing submissions, and formally excused/exempt assignments.
  - If no assignments have reached their deadline, the dimension is `PENDING`.

### 3.4 Engagement Dimension (`ENGAGEMENT`)
- **Scope:** Interaction with instructional video lessons and core educational materials.
- **Underlying Models:** `Lesson`, `VideoProgress`, `ProcessedMedia`.
- **Policy Rules:**
  - Evaluates lessons with verified publication dates (`Lesson.publishedAt`).
  - Distinguishes tracking capabilities: YouTube embeds vs Google Drive links vs native HLS streaming.
  - Students are **never penalized** for unplayable videos, pending transcode jobs, or untracked third-party links.
  - Evaluates watch velocity, abandoned viewing sessions, and quiz interactions.

---

## 4. Evidentiary States & Transition Rules

To prevent misleading zero-risk or unearned good-standing classifications, every dimension must report one of four explicit data states:

| Status Enum | Semantic Meaning | Preconditions / Evaluation Criteria | UI Presentation |
|---|---|---|---|
| `AVAILABLE` | Sufficient empirical data exists; score and risk level are verified. | Assessment criteria met (e.g. $\ge 3$ exams graded, $\ge 2$ center sessions held). | Renders verified metric badge, level color, and evidence breakdown. |
| `PENDING` | Active enrollment, but scheduled activities have not yet occurred. | Course started, but first exam date is in the future; or homework deadline has not elapsed. | Renders blue/neutral "قيد الانتظار" (Pending scheduled events). |
| `INSUFFICIENT_DATA` | Activity has occurred, but sample size is below statistical confidence threshold. | 1 exam taken (minimum is 3); or student recently enrolled mid-term. | Renders yellow/neutral "بيانات غير مكتملة" (e.g., "اختبار واحد مكتمل من أصل 3 مطلوبين"). |
| `NOT_APPLICABLE` | Dimension does not apply to this student's registration profile. | Physical `ATTENDANCE` for an online-only student; or `ACTIVITY` for a pure center student. | Renders muted grey "غير مشمول" (Excluded from profile). |

---

## 5. Seven-Day Trend Calculation Architecture

### 5.1 Principle of Empirical Integrity
- Trends must be calculated **exclusively from persisted historical snapshots** recorded exactly 7 days prior ($\pm 24\text{ hours}$ window to allow for daily midnight snapshot runs).
- Synthetic trends, instantaneous score ratios (e.g., `-1 * Math.floor(score / 10)`), or projected regressions are strictly forbidden.

### 5.2 Trend Outcomes
1. `IMPROVING`: Dimension metric improved beyond the policy threshold compared to 7 days prior.
2. `STABLE`: Dimension metric changed within the allowable variation threshold.
3. `DETERIORATING`: Dimension metric worsened beyond the policy threshold compared to 7 days prior.
4. `UNAVAILABLE`: Historical record 7 days prior is missing, incomplete, or the dimension was `PENDING` / `INSUFFICIENT_DATA`.

### 5.3 Mathematical Comparison Model
For an empirical metric $M_t$ at current time $t$ and $M_{t-7}$ at time $t - 7\text{ days}$:
$$\Delta = M_t - M_{t-7}$$
Where thresholds $\theta_{\text{improve}}$ and $\theta_{\text{worsen}}$ are explicitly documented as **configurable academic policies requiring leadership approval** (see Document 2 and Document 6).

---

## 6. Parent Notification Architecture

### 6.1 All-Level Notification Mandate
Notifications must be dispatched for **all four risk classifications**:
- `LOW`: Reassurance and positive reinforcement (e.g., "أداء ممتاز ومستقر في الواجبات").
- `MEDIUM`: Proactive guidance (e.g., "تأخر في تسليم واجب الرياضيات لهذا الأسبوع").
- `HIGH`: Warning of emerging academic jeopardy (e.g., "غياب حصتين متتاليتين في المركز").
- `CRITICAL`: Urgent intervention request (e.g., "تراجع حاد في نتائج اختبارين متتاليين").

### 6.2 Key Notification Principles
1. **Dimension Specificity:** Notifications cite the exact dimension (`الواجبات`, `الحضور`, `الامتحانات`, `المشاهدة`). They never combine or imply an overall student failure.
2. **Channel Separation:** In-app notifications serve as the mandatory baseline. Out-of-band channels (SMS, WhatsApp) are optional future integrations requiring separate approvals and parent consent.
3. **Anti-Spam & Cooldown:** A student remaining at `HIGH` across multiple days will not generate daily duplicate notifications. A minimum cooldown period (e.g., 7 days) is enforced unless the dimension escalates in severity.

