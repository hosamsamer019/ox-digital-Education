# OX-DIGITAL Education — Phase 6.2C.1.1
# Execution Path & Score Semantics Forensic Audit
## Legacy ExamAttempt Lifecycle, Grading Pipeline & Violation Mechanics

**Date:** 2026-11-02  
**Project:** OX-DIGITAL Education  
**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline Verified:** `main @ 0500b93e65c24ed881349c4acea7f523332c5e9f` (`0500b93`)  
**Execution Mode:** Strictly Read-Only Forensic Source Code Inspection  
**Audit Status:** COMPLETE — ALL CODE PATHS DOCUMENTED  

---

## 1. Executive Summary

This forensic investigation traces every source-code execution path that creates, synchronizes, submits, grades, or disqualifies legacy `ExamAttempt` records in `services/course-service/src/controllers/exam.controller.ts`.

### Crucial Forensic Findings:
1. **Unweighted Percentage Semantics:** In `exam.controller.ts submitAttempt`, `calculatedScore` is calculated strictly as:
   $$\text{calculatedScore} = \left(\frac{\text{correctCount}}{\text{questions.length}}\right) \times 100$$
   Every question is counted as 1.0 mark regardless of whether the question definition includes `points: 5` or `points: 10`. The value stored in `ExamAttempt.score` is therefore **always a percentage ($0-100\%$)**, not raw marks.
2. **Three Distinct Origins of `score = 0`:**
   - **Origin A (Start of Attempt):** `startAttempt` explicitly sets `score: 0` and `answers: null` upon initial row creation.
   - **Origin B (Genuine Zero Score):** `submitAttempt` calculates 0 correct answers and stores `score: 0` with `answers != null`.
   - **Origin C (Cheating Disqualification):** `reportViolation` explicitly overwrites `score: 0` on the attempt upon reaching 2 or more violations.
3. **Time-Expired Stranding:** If a student submits after `exam.duration + 5` minutes, `submitAttempt` throws an HTTP 400 error (`Time limit exceeded`) without updating the database. The attempt remains permanently stranded in `score: 0` with either `answers: null` or whatever intermediate state was autosaved.

---

## 2. Stage 1 — Exam Lifecycle Execution Paths

```
                                  [Student clicks "Start Exam"]
                                                │
                                                ▼
                                    POST /api/exams/:id/start
                                    (exam.controller.ts:427)
                                                │
                                    ┌───────────┴───────────┐
                                    │ Creates ExamAttempt:  │
                                    │ - score: 0            │
                                    │ - answers: null       │
                                    │ - createdAt: now      │
                                    └───────────┬───────────┘
                                                │
                       ┌────────────────────────┼────────────────────────┐
                       │                        │                        │
                       ▼                        ▼                        ▼
               PUT /:id/sync            POST /:id/violation      Student Abandons Exam
            (exam.controller:531)      (exam.controller:549)               │
                       │                        │                          ▼
          Updates latest attempt:      Creates ExamViolation.    Row remains permanently:
          - answers: answers || []     If violations >= 2:       - score: 0
          - NO status recorded         - score: 0                - answers: null (or partial)
          - NO timestamp recorded      - Returns HTTP 403        - Skews GPA as 0% fail!
                       │                        │
                       └───────────┬────────────┘
                                   │
                                   ▼
                       POST /api/exams/:id/submit
                       (exam.controller.ts:440)
                                   │
            ┌──────────────────────┴──────────────────────┐
            │ Elapsed > duration + 5 min?                 │
            ├──────────────────────┬──────────────────────┤
            │ YES                  │ NO                   │
            ▼                      ▼                      │
     HTTP 400 Error         Auto-Grades Answers:          │
     "Time limit exceeded"  score = (correct/total)*100   │
     Row remains stranded   Updates latest attempt:       │
     in score: 0!           - score: calculatedScore      │
                            - answers: answers || []      │
                            - NO submittedAt recorded!    │
                            - NO status recorded!         │
```

---

## 3. Step-by-Step Code Walkthrough

### 3.1 Attempt Creation: `startAttempt`
* **File & Lines:** `services/course-service/src/controllers/exam.controller.ts:407–438`
* **Persisted Fields:**
  ```typescript
  const attempt = await db.examAttempt.create({
    data: {
      studentId: userId,
      examId,
      score: 0
    }
  });
  ```
* **Forensic Observations:**
  - `answers` is omitted from the `data` payload; in Prisma, `answers Json?` defaults to `null`.
  - No check exists to determine whether an active or completed attempt already exists. Calling `startAttempt` multiple times creates multiple rows in `ExamAttempt`.
  - There is zero database evidence indicating whether the student actually began answering questions.

### 3.2 Answer Synchronization: `syncAttempt`
* **File & Lines:** `services/course-service/src/controllers/exam.controller.ts:523–547`
* **Mechanism:**
  ```typescript
  const existingAttempt = await db.examAttempt.findFirst({
    where: { studentId: userId, examId },
    orderBy: { createdAt: 'desc' }
  });

  if (existingAttempt) {
    await db.examAttempt.update({
      where: { id: existingAttempt.id },
      data: { answers: answers || [] }
    });
  }
  ```
* **Forensic Observations:**
  - Updates only the most recent attempt (`orderBy: { createdAt: 'desc' }`).
  - If a student answers questions and closes the browser without submitting, `answers` contains saved JSON answers, but the exam was never submitted!
  - `answers: []` or `answers: [...]` does **NOT** prove submission.

### 3.3 Normal Submission: `submitAttempt`
* **File & Lines:** `services/course-service/src/controllers/exam.controller.ts:440–520`
* **Grading Algorithm:**
  ```typescript
  let calculatedScore = 0;
  const questions = Array.isArray(exam.questions) ? exam.questions : [];
  
  if (questions.length > 0 && Array.isArray(answers)) {
    let correctCount = 0;
    for (const ans of answers) {
      const q: any = questions.find((q: any) => q.id === ans.questionId);
      if (q && q.correct !== undefined && ans.selectedOption === q.correct) {
        correctCount++;
      }
    }
    calculatedScore = (correctCount / questions.length) * 100;
  }
  ```
* **Database Write:**
  ```typescript
  attempt = await db.examAttempt.update({
    where: { id: existingAttempt.id },
    data: {
      score: calculatedScore,
      answers: answers || []
    }
  });
  ```
* **Forensic Observations:**
  - **No Timestamp:** `submittedAt` is never recorded.
  - **No Status:** `status: 'GRADED'` or `isGraded: true` is never recorded.
  - **Unweighted Points:** `q.points` is completely ignored. Even if questions have custom point values, each question is treated as worth 1.0 point.
  - **Percentage Value:** `score` stores a value between `0.0` and `100.0`.

### 3.4 Cheating Disqualification: `reportViolation`
* **File & Lines:** `services/course-service/src/controllers/exam.controller.ts:549–587`
* **Mechanism:**
  ```typescript
  await db.examViolation.create({
    data: {
      id: crypto.randomUUID(),
      attemptId: attempt.id,
      type: type || 'UNKNOWN'
    }
  });

  if (attempt.ExamViolation.length >= 1) { // 1 existing + 1 new = 2 violations
    await db.examAttempt.update({
      where: { id: attempt.id },
      data: { score: 0 }
    });
    return res.status(403).json({ message: 'Disqualified due to multiple violations' });
  }
  ```
* **Forensic Observations:**
  - Disqualification sets `score: 0` directly on `ExamAttempt`.
  - The student's recorded answers remain in `answers`.
  - The only forensic marker distinguishing a cheating disqualification from a genuine zero score is the existence of $\ge 2$ rows in `ExamViolation` with `attemptId = attempt.id`.

---

## 4. Score Semantics Matrix: Legacy vs Unified

| Parameter | Legacy `ExamAttempt` (`exam.controller.ts`) | Unified `AssessmentAttempt` (`assessment.controller.ts`) |
|---|---|---|
| **Stored `score` field** | Percentage ($0.0 - 100.0$) | Raw points earned ($\sum \text{points}$) |
| **Stored `totalPoints` field** | **Absent** (None in schema) | Maximum points ($\sum \text{points}$) |
| **Stored `percentage` field** | **Absent** (Implicit in `score`) | Explicit normalized percentage ($0.0 - 100.0$) |
| **Question Weighting** | **Ignored** (All questions = 1 point) | **Respected** (`q.points \|\| 1`) |
| **Submission Timestamp** | **Absent** | `submittedAt DateTime?` |
| **Lifecycle State** | **Absent** | `status: AttemptStatus` |
| **Cheating Representation** | Overwrites `score = 0` | Sets `cheatingDetected: true`, `status: 'CHEATING'` |

---

## 5. Architectural Conclusions

1. **`score` is a Percentage:** In legacy `ExamAttempt`, `score` was designed and written as a percentage. It must not be treated as raw points.
2. **Missing In-Flight State:** The lack of lifecycle columns makes it impossible for database queries to distinguish an abandoned attempt from a legitimate submission without joining `ExamViolation` and inspecting JSON `answers`.
3. **Stranded Expired Attempts:** Students whose time expired were blocked by HTTP 400 and left in `score: 0`, which downstream analytics erroneously interpret as academic failure.

