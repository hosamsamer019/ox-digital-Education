# OX-DIGITAL Education — Phase 6.2
# Unified Risk Engine Architecture Proposal

**Status:** Architecture Proposal (Requires Product Owner Sign-off Before Implementation)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Architectural Vision: The Unified Risk Engine (URE)

To eliminate the four disconnected and contradictory risk mechanisms discovered during Phase 6.2, OX-DIGITAL must consolidate all risk evaluation into a single authoritative service: the **Unified Risk Engine (URE)**.

The URE transforms risk calculation from an ad-hoc, isolated arithmetic exercise into an **explainable, multi-dimensional diagnostic system** that serves Admin, Teacher, and Parent dashboards identically.

```
                           ┌───────────────────────────────┐
                           │      Unified Risk Engine      │
                           │   (Analytics / Job Worker)    │
                           └──────────────┬────────────────┘
                                          │
            ┌─────────────────┬───────────┴───────────┬─────────────────┐
            │                 │                       │                 │
    [Academic Score]  [Attendance Score]      [Homework Score]  [Engagement Score]
       (Exams &          (Physical /              (Submissions      (Video velocity &
       Quizzes)            Online)                 & Quality)         Interaction)
            │                 │                       │                 │
            └─────────────────┼───────────────────────┼─────────────────┘
                              ▼                       ▼
                   ┌─────────────────────┐ ┌─────────────────────┐
                   │ StudentRiskProfile  │ │ StudentRiskHistory  │
                   │  (Current State)    │ │   (Audit Ledger)    │
                   └──────────┬──────────┘ └─────────────────────┘
                              │
            ┌─────────────────┼───────────────────────┬─────────────────┐
            ▼                 ▼                       ▼                 ▼
     [Admin Dashboard] [Teacher Dashboard]    [Parent Dashboard]   [Notification
       (Active KPI)     (Interventions)        (Alerts & Advice)       Engine]
```

---

## 2. Four-Dimensional Risk Calculation Model

> [!IMPORTANT]
> **UNAPPROVED PROPOSAL:** The percentage weightings and thresholds detailed below represent an architectural baseline recommendation. **They require formal review and approval by the Product Owner and academic leadership before any implementation.**

A student's composite **Risk Index** ($R \in [0, 100]$, where $0 = \text{No Risk}$ and $100 = \text{Severe Emergency}$) is computed from four independent dimensions:

$$\text{Composite Risk} = w_A \cdot R_{\text{Academic}} + w_C \cdot R_{\text{Attendance}} + w_H \cdot R_{\text{Homework}} + w_E \cdot R_{\text{Engagement}}$$

### Proposed Baseline Weights:
- **Academic Performance ($w_A = 0.40$):** $40\%$ weight
- **Attendance Consistency ($w_C = 0.30$):** $30\%$ weight
- **Homework Completion ($w_H = 0.15$):** $15\%$ weight
- **Learning Velocity & Engagement ($w_E = 0.15$):** $15\%$ weight

---

### Dimension 1: Academic Performance Risk ($R_{\text{Academic}}$)
- **Data Source:** `ExamAttempt` (filtered by latest graded attempt per exam, adhering to Phase 6.1B policy).
- **Minimum Eligibility:** At least 1 graded assessment required. If 0 assessments, $R_{\text{Academic}}$ is marked `PENDING` and weights are dynamically normalized across remaining dimensions.
- **Formula:**
  $$R_{\text{Academic}} = 100 - \text{Weighted Exam Average}$$
  *(With progressive penalty for consecutive failed attempts: $+10$ points if 2 consecutive fails, $+25$ points if $\ge 3$ consecutive fails).*

---

### Dimension 2: Attendance Consistency Risk ($R_{\text{Attendance}}$)
- **Data Source:** `Attendance` records.
- **Center Students:**
  $$\text{Absence Rate} = \frac{\text{Unexcused Absences}}{\text{Total Sessions Held}}$$
  $$R_{\text{Attendance}} = \min(100, \, \text{Absence Rate} \times 100)$$
- **Online-Only Students:** If a student has no physical center enrollment, attendance risk mirrors platform login frequency (sessions per week relative to course pacing).

---

### Dimension 3: Homework Completion Risk ($R_{\text{Homework}}$)
- **Data Source:** `Assignment` and `Submission` records.
- **Formula:**
  $$\text{Submission Rate} = \frac{\text{Submitted on Time} + 0.5 \times \text{Late Submissions}}{\text{Total Assigned Due}}$$
  $$R_{\text{Homework}} = 100 \times (1 - \text{Submission Rate})$$

---

### Dimension 4: Learning Velocity & Video Engagement Risk ($R_{\text{Engagement}}$)
- **Data Source:** `Lesson.publishedAt` and `VideoProgress`.
- **Precondition:** Fix `course.controller.ts` so `Lesson.publishedAt` defaults to `now()` on creation.
- **Formula:**
  - Evaluates lessons published in enrolled courses within the last 14 days.
  - If a student has watched $\ge 80\%$ of published duration: $R_{\text{Engagement}} = 0$.
  - If unwatched after 3 days: $+20$ points per pending lesson.
  - If unwatched after 7 days: $+40$ points per pending lesson.
  - Capped at 100 points.

---

## 3. Real Trend Calculation & Historical Tracking

To replace the synthetic `-1 * Math.floor(score / 10)` fabrication:

1. **Daily Snapshots:** At midnight (00:00 UTC), a background job computes each student's composite risk and appends a record to `StudentRiskHistory`.
2. **True Velocity Delta:**
   $$\Delta \text{Risk} = \text{CompositeRisk}_{\text{current}} - \text{CompositeRisk}_{7\text{ days ago}}$$
3. **Trend Categorization:**
   - $\Delta \text{Risk} \le -5$: `IMPROVING` (Risk decreased, student recovering)
   - $-5 < \Delta \text{Risk} < +5$: `STABLE`
   - $\Delta \text{Risk} \ge +5$: `DETERIORATING` (Risk increased, urgent intervention needed)

---

## 4. Proposed Database Schema: Unified Risk Model

To persist and query risk efficiently without blocking real-time HTTP requests, we propose introducing a dedicated cached profile table alongside the audit ledger:

```prisma
// Proposed Prisma Schema Extension (Awaiting Product Owner Approval)

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TrendDirection {
  IMPROVING
  STABLE
  DETERIORATING
}

model StudentRiskProfile {
  id                String         @id @default(uuid())
  studentId         String         @unique
  student           User           @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  compositeScore    Float          // 0 to 100
  riskLevel         RiskLevel      @default(LOW)
  
  // Dimensional breakdowns for explainability
  academicScore     Float          // 0 to 100
  attendanceScore   Float          // 0 to 100
  homeworkScore     Float          // 0 to 100
  engagementScore   Float          // 0 to 100
  
  trendDirection    TrendDirection @default(STABLE)
  trendDelta        Float          @default(0.0)
  
  primaryFactor     String         // e.g. "EXAM_FAILURE", "ABSENCE_SPIKE", "VIDEO_LAG"
  explanationText   String         // Human-readable Arabic explanation
  
  lastEvaluatedAt   DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@index([riskLevel])
  @@index([lastEvaluatedAt])
}
```

---

## 5. Explainability & Diagnostic Attribution

Every dashboard (Teacher, Admin, Parent) must display **why** a student is at risk rather than presenting an arbitrary number.

When queried, the API returns:
```json
{
  "studentId": "uuid-1234",
  "studentName": "أحمد محمود",
  "compositeScore": 72,
  "riskLevel": "HIGH",
  "trend": {
    "direction": "DETERIORATING",
    "delta": +14.5
  },
  "diagnostics": {
    "primaryFactor": "ABSENCE_SPIKE",
    "academic": { "score": 25, "status": "GOOD", "detail": "متوسط درجات الاختبارات 75%" },
    "attendance": { "score": 90, "status": "CRITICAL", "detail": "غياب 4 حصص متتالية في المركز" },
    "homework": { "score": 10, "status": "GOOD", "detail": "تم تسليم 9 من أصل 10 واجبات" },
    "engagement": { "score": 40, "status": "WARNING", "detail": "تأخر في مشاهدة حصتين فيديو" }
  },
  "recommendedAction": "التواصل الفوري مع ولي الأمر بسبب تكرار الغياب غير المبرر"
}
```

---

## 6. Parent Visibility & Automated Notification Workflow

### 6.1 Parent Portal Integration
The Parent Dashboard (`ParentHomePage.tsx`) will feature an **Early Warning & Academic Status Card**:
- When `riskLevel` is `LOW` or `MEDIUM`: Displays a green/yellow reassurance badge with positive recommendations.
- When `riskLevel` is `HIGH` or `CRITICAL`: Displays a prominent Arabic notification card detailing the exact root cause (e.g., "تنبيه: تم رصد غياب الطالب في آخر 3 حصص وتراجعه في اختبار الجبر") with a direct action button to contact the center or teacher.

### 6.2 Intelligent Event-Driven Notification Policy
To prevent notification fatigue:
1. **Transition Triggers Only:** Notifications are sent **only on level escalation** (e.g., transitioning from `MEDIUM` $\to$ `HIGH` or `HIGH` $\to$ `CRITICAL`).
2. **Cool-down Period:** No more than 1 notification per student per 7 days unless escalated to `CRITICAL`.
3. **Multi-Channel Dispatch:**
   - In-app Notification (`Notification` table)
   - Real-time Socket.IO event to active parent/teacher sessions
   - Out-of-band SMS/WhatsApp message (via existing notification worker)

