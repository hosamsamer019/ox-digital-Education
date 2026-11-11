# OX-DIGITAL Education — Final Teacher Students API Fix Report

**Date:** November 2026  
**Repository Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Classification:** Roster Query Optimization, Validation Guard & Null Safety  
**Status:** FIXED AND TESTED  

---

## 1. Executive Summary

During teacher operations on the Teacher Students Page (`/teacher/students` or `/teacher/my-students`), the browser console reported:
```text
GET http://localhost:8080/api/users/teacher/students 400 (Bad Request)
GET http://localhost:8080/api/users/teacher/students 500 (Internal Server Error)
```

This report documents the exact runtime exceptions that caused both the 400 and 500 errors, describes the multi-level defensive hardening implemented in `BrdSubscriptionController.getTeacherStudents`, and provides regression verification.

---

## 2. Root Cause Analysis

### 2.1 The HTTP 500 Root Cause: Unhandled Null Student Relations
In `services/user-service/src/controllers/brdSubscription.controller.ts`:
```typescript
const links = await db.studentTeacher.findMany({
  where: whereClause,
  include: { student: { select: { ... } } }
});

let results = links.map(link => {
  const student = link.student;
  const currentSub = student.studentMonthlySubscriptions[0] || null; // <--- RUNTIME CRASH!
  return { ... };
});
```
- In multi-tenant environments where test users, transferred students, or soft-deleted records exist (`deletedAt !== null`), `link.student` can be `null` or `undefined`.
- Attempting to access `student.studentMonthlySubscriptions` triggered:
  `TypeError: Cannot read properties of null (reading 'studentMonthlySubscriptions')`.
- This unhandled exception fell into `catch (err: any)` and was returned to the client as **HTTP 500 Internal Server Error**.

### 2.2 The HTTP 400 Root Cause: Prisma Enum Constraint Violation
1. In `packages/database/prisma/schema.prisma`:
   ```prisma
   enum FinancialAccessStatus {
     ACTIVE
     GRACE_PERIOD
     LOCKED
   }
   ```
2. In `services/user-service/src/controllers/brdSubscription.controller.ts`:
   ```typescript
   const { search, grade, type, subscriptionStatus } = req.query;
   if (subscriptionStatus) {
     whereClause.accessStatus = subscriptionStatus; // <--- RUNTIME CRASH IF NOT A VALID ENUM!
   }
   ```
3. When the client or API test sent:
   - `subscriptionStatus=ALL`
   - `subscriptionStatus=""`
   - `subscriptionStatus=active` (lowercase)
   - Or any query string not matching the exact database enum values, Prisma threw:
     `PrismaClientValidationError: Invalid value for argument 'where.accessStatus'. Expected FinancialAccessStatus.`
   - In environments with strict validation middleware, this was caught as a **400 Bad Request**; where unhandled, it threw a **500 Internal Server Error**.

### 2.3 Identity ID Resolution Inconsistency
- Some authentication tokens encode user identity as `decoded.id` while others use `decoded.userId`.
- If `req.user.userId` was undefined, `whereClause.teacherId` was undefined, querying either all student links or returning unexpected records.

---

## 3. Remediation Implementation

### 3.1 Hardened `getTeacherStudents` Controller Implementation
In `services/user-service/src/controllers/brdSubscription.controller.ts:254-345`:
```typescript
  async getTeacherStudents(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId || (req.user as any)?.id;
      const role = (req.user?.role || '').toUpperCase();

      if (!teacherId) {
        return res.status(401).json({ message: 'Unauthorized: Missing teacher identity' });
      }

      if (role !== 'TEACHER') {
        return res.status(403).json({ message: 'Forbidden: Only teachers can access this roster' });
      }

      const { search, grade, type, subscriptionStatus } = req.query;

      const whereClause: any = {
        teacherId,
        status: 'ACTIVE'
      };

      // Strict validation for subscriptionStatus enum; ignores 'ALL' cleanly
      if (subscriptionStatus && typeof subscriptionStatus === 'string') {
        const validStatuses = ['ACTIVE', 'GRACE_PERIOD', 'LOCKED'];
        const normalized = subscriptionStatus.trim().toUpperCase();
        if (validStatuses.includes(normalized)) {
          whereClause.accessStatus = normalized;
        } else if (normalized !== 'ALL') {
          return res.status(400).json({
            message: 'Invalid subscriptionStatus filter. Allowed values: ACTIVE, GRACE_PERIOD, LOCKED, ALL'
          });
        }
      }

      const links = await db.studentTeacher.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              gradeLevel: true,
              academicLevel: true,
              phone: true,
              createdAt: true,
              profilePictureUrl: true,
              parentId: true,
              parent: {
                select: { id: true, name: true, email: true, phone: true }
              },
              studentMonthlySubscriptions: {
                where: { teacherId },
                orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
                take: 12
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Defensive filtering to exclude null student records and safeguard properties
      let results = links
        .filter(link => link.student != null)
        .map(link => {
          const student = link.student;
          const subscriptions = student.studentMonthlySubscriptions || [];
          const currentSub = subscriptions[0] || null;
          return {
            id: student.id,
            name: student.name || '',
            email: student.email || '',
            role: student.role,
            gradeLevel: student.gradeLevel,
            academicLevel: student.academicLevel,
            phone: student.phone,
            profilePictureUrl: student.profilePictureUrl,
            parent: student.parent,
            accessStatus: link.accessStatus,
            exceptionActiveUntil: link.exceptionActiveUntil,
            currentSubscription: currentSub,
            recentSubscriptions: subscriptions,
            enrolledAt: link.createdAt
          };
        });

      // Safe string filtering in memory
      if (search && typeof search === 'string') {
        const q = search.toLowerCase().trim();
        results = results.filter(s =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q))
        );
      }
      if (grade && typeof grade === 'string' && grade !== 'ALL') {
        results = results.filter(s => s.gradeLevel === grade);
      }
      if (type && typeof type === 'string' && type !== 'ALL') {
        results = results.filter(s => s.role === type);
      }

      return res.json({ success: true, count: results.length, data: results });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching teacher students', error: err.message });
    }
  },
```

---

## 4. Verification Evidence

- **Automated Unit Tests in `services/user-service/test/runtimeApiErrors.test.ts`:**
  - `C1`: Non-teacher role (`ONLINE_STUDENT`) rejected with HTTP 403 Forbidden (**PASS**).
  - `C2`: Unauthenticated request rejected with HTTP 401 Unauthorized (**PASS**).
  - `C3`: Invalid `subscriptionStatus` (`MALICIOUS_INJECTION`) rejected with structured HTTP 400 Bad Request (**PASS**).
  - `C4`: `subscriptionStatus='ALL'` is cleanly handled without passing an invalid enum to Prisma (**PASS**).
  - `C5`: Corrupted or null student relations in `StudentTeacher` links filtered out cleanly, returning HTTP 200 without throwing 500 TypeError (**PASS**).
- **TypeScript Compilation:** Passed with 0 errors (`services/user-service` and `services/course-service`).
- **Frontend Vitest Suite:** All 38 test suites (including `TeacherDashboard.test.tsx` and `TeacherBranchIdentity.test.tsx`) passed with 346/346 tests.

