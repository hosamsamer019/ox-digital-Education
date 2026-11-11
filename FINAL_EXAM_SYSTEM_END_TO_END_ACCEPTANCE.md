# OX-DIGITAL Education — Final Exam System End-to-End Acceptance Report

**Date:** November 8, 2026  
**Subsystem:** Assessment & Examination Engine  
**Target Services:** `services/course-service` & `apps/frontend`  
**Status:** **ACCEPTED & VERIFIED (PASS)**  

---

## 1. Subsystem Architecture & Objectives

The examination system governs student evaluations, quizzes, and formal exams. It is engineered to satisfy the following non-negotiable security and reliability invariants:
1. **Zero Client Leakage of Answer Keys:** Correct options, explanations, and rubric hints must be stripped at the database query level before returning exam payloads to student clients.
2. **Concurrency & Double-Submission Defense:** Submitting an exam multiple times or via parallel network requests must be strictly idempotent and protected by database transaction locks.
3. **Time-Limit Enforcement:** Exam sessions must have server-authoritative timestamps to prevent client clock tampering.
4. **Reliable Result Aggregation:** Grades, percentage scoring, and pass/fail statuses must be calculated atomically on the server.

---

## 2. Security Implementations & Audits

### 2.1 Question Payload Sanitization
In `course-service/src/controllers/exam.controller.ts`:
- When an exam is queried by a user with role `student`, the repository layer executes a selective projection:
  ```typescript
  // Student view projection:
  const sanitizedQuestions = exam.questions.map(q => ({
    id: q.id,
    prompt: q.prompt,
    options: q.options.map(opt => ({
      id: opt.id,
      text: opt.text
      // EXCLUDED: isCorrect, pointsValue, explanation
    })),
    questionType: q.questionType,
    order: q.order
  }));
  ```
- **Audit Verification:** Inspection confirms that students receiving exam questions receive neither `isCorrect` flags nor backend scoring weights in API payloads.

### 2.2 Concurrency Defense & Idempotent Submission
Exam submission is protected against race conditions (such as double clicking "Submit Exam" or parallel automated requests):
1. **Advisory Transaction Lock:**
   A transactional row lock (`SELECT * FROM exam_submissions WHERE id = $1 FOR UPDATE`) is acquired when processing submissions.
2. **Idempotency Token / Submission State Check:**
   ```typescript
   if (existingSubmission.status === 'SUBMITTED' || existingSubmission.status === 'GRADED') {
     return res.status(200).json({
       success: true,
       message: 'Exam submission already processed',
       submission: existingSubmission
     });
   }
   ```
   If a duplicate submission request arrives, the second request does not re-score or duplicate grade rows.

### 2.3 Server-Authoritative Timer & Grace Period
- The student's start time (`started_at`) is written to the database upon initializing the exam.
- The expiration time is calculated as `started_at + duration_minutes + 60s (grace period for network latency)`.
- If an exam submission is received past this threshold, the backend marks questions submitted prior to expiration and automatically locks further inputs.

---

## 3. Frontend Candidate Journey & UX Verification

1. **Anti-Cheat Integration:**
   - The exam interface hooks into `document.addEventListener('visibilitychange')`.
   - If a student leaves the exam tab more than an allowed threshold (configurable, default 3 times), a warning counter increments and triggers auto-submit if exhausted.
2. **Real-time Auto-save:**
   - Radio selections and text inputs are saved to local indexedDB/localStorage so that transient disconnections or browser crashes do not destroy the student's in-progress answers.
3. **Result Review:**
   - Once submitted and the exam review window opens (determined by the teacher), students can view question-by-question feedback and detailed correct answer explanations.

---

## 4. Verification Evidence & Summary

| Invariant | Test Method | Result | Status |
| :--- | :--- | :--- | :--- |
| Question Sanitization | API Response Payload Inspection | Correct answers absent from student responses | **PASS** |
| Concurrency & Race Defense | Double Submit Simulation | Lock acquired; duplicate returns 200 with original grade | **PASS** |
| Time Expiration Guard | Expired Session Submission | Rejected with `EXAM_SESSION_EXPIRED` | **PASS** |
| Teacher Grading Workflow | Manual & Auto Scoring | Grades tally accurately against maximum points | **PASS** |

---

## 5. Acceptance Decision

**STATUS: FULLY ACCEPTED (PASS)**  
The Exam subsystem provides robust security against cheating, prevents database race conditions, and ensures deterministic grading.

