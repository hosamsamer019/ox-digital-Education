# OX-DIGITAL Education — Phase 6.2A
# Data Requirements & Assessment Formulas Specification

**Status:** Approved Design Specification (Documentation-Only — No Implementation Authorized)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Verified Prisma Data Sources & Field Availability

Based on direct read-only inspection of [`packages/database/prisma/schema.prisma`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma), the following data models and fields are verified as currently existing in the database schema:

| Dimension | Target Entity | Verified Available Fields | Verification Status | Notes / Limitations |
|---|---|---|---|---|
| **Academic** | `ExamAttempt` | `id`, `examId`, `studentId`, `score`, `createdAt`, `answers` | **VERIFIED** | Simple exams; score stored as float. |
| **Academic** | `AssessmentAttempt` | `id`, `assessmentId`, `studentId`, `score`, `percentage`, `status`, `startedAt`, `submittedAt` | **VERIFIED** | Advanced assessments with status `GRADED`, `SUBMITTED`, `TIME_EXPIRED`. |
| **Attendance** | `Attendance` | `id`, `studentId`, `date`, `status`, `createdAt` | **VERIFIED** | Status: `PRESENT`, `ABSENT`, `LATE`. |
| **Attendance** | `CenterGroup` | `id`, `name`, `schedule`, `students` | **VERIFIED** | Links center students to physical cohort schedule. |
| **Homework** | `Homework` | `id`, `courseId`, `lessonId`, `deadline`, `closeAt`, `openAt`, `type` | **VERIFIED** | Defines assignment deadlines and availability. |
| **Homework** | `Submission` | `id`, `studentId`, `homeworkId`, `grade`, `createdAt`, `updatedAt` | **VERIFIED** | Tracks student upload/answer submission and grading. |
| **Engagement** | `Lesson` | `id`, `courseId`, `title`, `videoUrl`, `publishedAt`, `createdAt`, `activeMediaId` | **VERIFIED** | `publishedAt` is nullable; lessons created via UI currently leave it NULL. |
| **Engagement** | `VideoProgress` | `studentId`, `lessonId`, `progress`, `watched`, `status`, `totalWatchTimeSec`, `watchSessionsCount`, `firstOpenedAt`, `lastActivityAt` | **VERIFIED** | Tracks granular video playback and quiz answers. |
| **Student Mode** | `User` | `role`, `centerGroupId`, `parentId`, `gradeLevel`, `academicLevel` | **VERIFIED** | Roles include `ONLINE_STUDENT`, `CENTER_STUDENT`, `PARENT`. |
| **History** | `StudentRiskHistory` | `id`, `studentId`, `lessonId`, `riskLevel`, `riskCode`, `detectedAt`, `resolvedAt` | **VERIFIED** | **Schema Limitation:** Hard-linked to `lessonId` and `VideoProgress`. Cannot store non-video risk history without schema migration. |
| **Activity** | `Activity` | *Does not exist in schema* | **NOT FOUND** | Digital activity must be derived from `VideoProgress`, `ExamAttempt`, and `Submission`. |

---

## 2. Evidence Eligibility Rules per Dimension

### 2.1 Academic Dimension Evidence Rules
1. **Retake & Multi-Attempt Policy:**
   - Adhering to the approved Phase 6.1B policy, if a student takes an assessment multiple times, **only the latest completed/graded attempt** is evaluated. Earlier attempts are archived and excluded from the average.
2. **Pending Grading:**
   - Attempts in status `SUBMITTED` that require manual teacher review (e.g., essay questions) are excluded from the score numerator and denominator until graded (`status = 'GRADED'`).
3. **Assessment Active Window:**
   - Evaluates assessments conducted within the active academic term (configurable default: past 60 days). Lifetime historical attempts from previous terms are strictly excluded.
4. **Minimum Evidence Threshold:**
   - A minimum of **3 completed graded assessments** is required.
   - If graded assessments $< 3$, status is `INSUFFICIENT_DATA` (or `PENDING` if $< 3$ exams have been scheduled).

---

### 2.2 Attendance Dimension Evidence Rules
1. **Actual Sessions Held Denominator:**
   - The denominator is defined strictly by **scheduled center sessions held** since the student's enrollment date.
   - It is an integrity violation to use `attendance.length` as the denominator, because unrecorded sessions would artificially inflate attendance.
2. **Cancelled Sessions & Holidays:**
   - Center sessions formally cancelled by the center administration are excluded from both numerator and denominator.
3. **Absence Classification:**
   - `PRESENT`: Counted as full attendance ($1.0$).
   - `LATE`: Counted as partial attendance ($0.75$, or per academic policy).
   - `EXCUSED`: Documented illness/emergency approved by administration; excluded from denominator.
   - `ABSENT`: Unexcused absence ($0.0$).
4. **Online Students Exclusion:**
   - For students with `role = 'ONLINE_STUDENT'` and `centerGroupId = NULL`, the physical attendance dimension is strictly `NOT_APPLICABLE`.

---

### 2.3 Homework Dimension Evidence Rules
1. **Past Deadline Requirement:**
   - An assignment is eligible for evaluation only if `now() > deadline` (or `closeAt`).
   - Active, upcoming assignments are strictly excluded from denominator.
2. **Submission Classifications:**
   - **On-Time Submission:** `createdAt <= deadline` $\to$ Successful ($1.0$).
   - **Late Submission:** `createdAt > deadline` $\to$ Partial penalty (e.g. $0.5$ credit).
   - **Exempt / Excused:** Formally waived by teacher $\to$ Excluded from denominator.
   - **Missing Submission:** No submission record exists and deadline has passed $\to$ Failure ($0.0$).
3. **Zero Eligible Denominator:**
   - If a course has published 0 homework assignments, or all deadlines are in the future, status is `PENDING`. It must never calculate $0/0 = 0\%$.

---

### 2.4 Engagement Dimension Evidence Rules
1. **Lesson Publication Lifecycle:**
   - Only lessons with verified publication date (`Lesson.publishedAt <= now()`) are eligible.
   - Scheduled future lessons (`publishedAt > now()`) are excluded.
2. **Player Capability & Delivery Infrastructure:**
   - **HLS Native Video:** Tracked with second-by-second precision (`totalWatchTimeSec`, `progress`).
   - **YouTube Embeds:** Tracked via iframe API (`progress`, `watchSessionsCount`).
   - **Google Drive Links:** Tracked only via opening event (`firstOpenedAt`).
   - **Infrastructure Safeguard:** If a lesson is in processing status (`ProcessedMediaStatus !== 'COMPLETED'`) or has an invalid URL, students are **never penalized** for uncompleted viewing.
3. **Watch Velocity:**
   - Students are given a grace window (default: 72 hours from `publishedAt` or enrollment) before a lesson is considered delayed.

---

## 3. Mathematical Formulas & Dimension Scoring

Each dimension computes a normalized **Dimension Health Score** ($S \in [0, 100]$, where $100 = \text{Flawless Performance}$ and $0 = \text{Severe Failure}$), which maps to an independent **Risk Level**.

$$\text{Risk Level} = 
\begin{cases} 
\text{LOW} & \text{if } S \ge 75 \\ 
\text{MEDIUM} & \text{if } 60 \le S < 75 \\ 
\text{HIGH} & \text{if } 40 \le S < 60 \\ 
\text{CRITICAL} & \text{if } S < 40 
\end{cases}$$

*(Note: Threshold values $\theta$ are configurable academic policy parameters subject to formal approval).*

---

### 3.1 Academic Formula
$$S_{\text{Academic}} = \frac{1}{N} \sum_{i=1}^{N} \left( \frac{\text{LatestScore}_i}{\text{MaxPoints}_i} \times 100 \right)$$
Where $N \ge 3$ eligible graded assessments.

---

### 3.2 Center Attendance Formula
$$S_{\text{Attendance}} = \frac{N_{\text{present}} + 0.75 \times N_{\text{late}}}{N_{\text{sessions\_held}} - N_{\text{excused}}} \times 100$$
Where $N_{\text{sessions\_held}} \ge 2$ sessions held.

---

### 3.3 Online Digital Activity Formula (for Online-Only Students)
For online students, Activity evaluates learning continuity over the trailing 14 days:
$$S_{\text{Activity}} = \left( 0.50 \times \frac{L_{\text{completed}}}{L_{\text{due}}} + 0.30 \times \frac{H_{\text{submitted}}}{H_{\text{due}}} + 0.20 \times \text{ContinuityFactor} \right) \times 100$$
Where $\text{ContinuityFactor} = 1.0$ if active sessions logged across at least 2 distinct weeks, $0.5$ if 1 week, $0.0$ if 0 sessions.

---

### 3.4 Homework Completion Formula
$$S_{\text{Homework}} = \frac{N_{\text{on\_time}} + 0.50 \times N_{\text{late}}}{N_{\text{assignments\_due}} - N_{\text{exempt}}} \times 100$$
Where $N_{\text{assignments\_due}} \ge 1$.

---

### 3.5 Video Engagement Formula
$$S_{\text{Engagement}} = \frac{1}{M} \sum_{j=1}^{M} \min(100, \, \text{WatchProgress}_j) \times 100$$
Where $M$ is the count of eligible published video lessons in enrolled courses.

---

## 4. Tenant & Contextual Isolation Boundaries

To ensure fairness and statistical validity, assessments must never blend incomparable student cohorts:

1. **Course & Subject Isolation:**
   - Assessments must be calculated per course/subject enrollment. A student struggling in Advanced Physics must not have their Physics risk diluted by their high score in History.
2. **Grade Level Pacing:**
   - Deadlines and expectations are scoped strictly to the student's registered `GradeLevel` and `AcademicLevel`.
3. **Delivery Mode Partitioning:**
   - `CENTER_STUDENT`: Evaluated on `ACADEMIC`, `ATTENDANCE`, `HOMEWORK`, `ENGAGEMENT`.
   - `ONLINE_STUDENT`: Evaluated on `ACADEMIC`, `ACTIVITY`, `HOMEWORK`, `ENGAGEMENT`.
   - Physical `ATTENDANCE` is strictly forbidden from appearing in an online student's profile.

---

## 5. Explicitly Unresolved Academic Policy Parameters

The following parameters are technical defaults and **require formal written approval by Academic Leadership** before being made active:

| Parameter ID | Parameter Description | Current Baseline Recommendation | Required Approver |
|---|---|---|---|
| `ACAD_MIN_EXAMS` | Minimum graded assessments for `AVAILABLE` state | $3$ graded assessments | Academic Director |
| `ATTEND_LATE_WEIGHT` | Credit assigned for a `LATE` classroom attendance | $0.75$ (75% credit) | Center Operations Lead |
| `HW_LATE_CREDIT` | Credit assigned for late homework submissions | $0.50$ (50% credit) | Academic Director |
| `ENGAGE_GRACE_HOURS` | Hours after video publication before lateness penalty | $72$ hours (3 days) | Product Owner |
| `LEVEL_THRESHOLDS` | Cutoffs for LOW ($\ge 75$), MEDIUM ($60-74$), HIGH ($40-59$), CRITICAL ($<40$) | Standard educational quartiles | Product Owner & Academic Lead |
| `TREND_DELTA_SIGMA` | Minimum score point shift over 7 days to trigger `IMPROVING` / `DETERIORATING` | $\pm 5.0$ percentage points | Academic Director |

