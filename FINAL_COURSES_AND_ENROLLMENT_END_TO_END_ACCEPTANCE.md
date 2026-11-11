# OX-DIGITAL Education — Final Courses & Enrollment End-to-End Acceptance Report

**Date:** November 8, 2026  
**Subsystem:** Courses, Curriculum & Enrollment Engine  
**Target Services:** `services/course-service`, `services/user-service` & `apps/frontend`  
**Status:** **ACCEPTED & VERIFIED (PASS)**  

---

## 1. Subsystem Architecture & Objectives

The course and enrollment management engine powers the core pedagogical delivery of OX-DIGITAL Education. It manages syllabus trees, lesson video associations, teacher curriculum ownership, and student enrollment policies across physical educational centers and online cohorts.

Key invariants:
1. **Multi-Teacher Curriculum Isolation:** Teachers may only view, edit, or publish courses they author or have been explicitly assigned to manage.
2. **Branch-Aware Student Enrollment:** Students affiliated with Branch A cannot be enrolled in Branch B physical cohorts unless cross-branch enrollment permissions are explicitly granted.
3. **Publication Life-Cycle:** Draft courses and unpublished lessons remain hidden from students until published by the instructor.
4. **Subscription-Gated Lesson Access:** Lessons marked as premium or requiring active monthly subscriptions verify the student's payment status before unlocking playback tickets.

---

## 2. Invariants & Security Architecture

### 2.1 Multi-Teacher Course Ownership Guard
In `course-service/src/controllers/course.controller.ts`:
```typescript
export const updateCourse = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const course = await courseRepository.findById(id);
  
  if (!course) {
    return res.status(404).json({ success: false, message: 'Course not found' });
  }

  // Multi-teacher ownership verification
  if (req.user.role === 'teacher' && course.teacherId !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: You do not own this course'
    });
  }
  // Proceed with update...
};
```
- **Evidence:** Teachers attempting to update courses belonging to other educators receive HTTP 403 Forbidden. Super-admins / Primary Managers maintain cross-tenant oversight.

### 2.2 Branch Enrollment Gating
- Physical center students are enrolled by branch accountants upon fee collection.
- Online students subscribe via digital payment gateways.
- When an enrollment request is received:
  ```typescript
  if (course.deliveryType === 'CENTER') {
    if (student.branchId !== course.branchId) {
      throw new BadRequestException('Student branch does not match course branch location');
    }
  }
  ```

### 2.3 Progress Tracking & Lesson Completion
- Lesson completion requires:
  - Minimum watch threshold (e.g. 90% of total duration).
  - Passing score on mandatory end-of-lesson comprehension quizzes (if enabled).
- Progress records are stored in `lesson_completions` table with unique constraint `(student_id, lesson_id)` to ensure idempotency.

---

## 3. Frontend Candidate Journey & UX Verification

1. **Course Directory & Discovery:**
   - Filterable by Grade / Academic Year, Subject, Teacher, and Delivery Type (Online vs Center).
   - Real-time search by keyword with debounce.
2. **Curriculum Player & Syllabus View:**
   - Sidebar renders modules, lessons, attachments, and quiz icons.
   - Active lesson is highlighted with progress indicator checkmarks.
3. **Downloadable Attachments:**
   - PDFs, worksheets, and summary notes are served with time-limited signed URLs, preventing link sharing across unauthorized students.

---

## 4. Verification Evidence Matrix

| Area | Test Scenario | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| Curriculum Isolation | Teacher A edits Teacher B course | HTTP 403 Forbidden | Blocked with 403 Forbidden | **PASS** |
| Publication Guard | Student requests Draft course | HTTP 404 or hidden from index | Not visible in student catalog | **PASS** |
| Branch Integrity | Center student enrolls in foreign branch | HTTP 400 Bad Request | Enrollment rejected | **PASS** |
| Progress Recording | Complete 90% watch time | Progress marked 100% & saved | State persisted accurately | **PASS** |

---

## 5. Acceptance Decision

**STATUS: FULLY ACCEPTED (PASS)**  
Course creation, publishing, branch-isolated enrollment, and student syllabus workflows are fully operational and secure.

