# Final API Inventory & Integration Test Matrix

**Platform:** OX-DIGITAL Education  
**Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-08  
**Scope:** Complete Cross-Service API Inventory, Ingress Routes, Role Authorization & Integration Contracts  

---

## 1. Complete Cross-Service API Inventory

| Path | Method | Service Target | Authorized Roles | Rate Limit | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | POST | `auth-service` | Public | `auth_limit` | User authentication & JWT issuance |
| `/api/auth/register` | POST | `auth-service` | Public | `auth_limit` | Student self-registration |
| `/api/auth/change-password` | POST | `auth-service` | Authenticated | `auth_limit` | Password change & first-login reset |
| `/api/auth/me` | GET | `auth-service` | Authenticated | Standard | Current user profile validation |
| `/api/users/profile` | GET / PUT | `user-service` | Authenticated | Standard | User personal details |
| `/api/users/profile-picture` | POST | `user-service` | Authenticated | Standard | Base64 avatar upload (2MB limit) |
| `/api/users/avatar/:filename` | GET | `user-service` | Public | Standard | Stream stored avatar image |
| `/api/users/linked-relationships` | GET | `user-service` | Authenticated | Standard | Fetch student-parent & teacher links |
| `/api/users/teacher-students` | GET | `user-service` | Teacher, Admin | Standard | Teacher student roster & subscriptions |
| `/api/manager/team` | GET | `user-service` | Primary Manager | Standard | Branch staff roster (Admin, Teacher, Accountant) |
| `/api/manager/team/assign-branch` | POST | `user-service` | Primary Manager | Standard | Assign staff member to branch |
| `/api/manager/cashbox` | GET / POST | `user-service` | Primary Manager | Standard | Multi-branch consolidated cashbox |
| `/api/accounting/receipts` | GET / POST | `user-service` | Accountant, Admin | Standard | Branch receipt issuance & listing |
| `/api/accounting/collections` | POST | `user-service` | Accountant | Standard | Student fee collection desk |
| `/api/accounting/expenses` | GET / POST | `user-service` | Accountant, Admin | Standard | Branch expense vouchers |
| `/api/accounting/cashbox/reconcile` | POST | `user-service` | Accountant | Standard | Daily cashbox drawer reconciliation |
| `/api/notifications` | GET | `user-service` | Authenticated | Standard | In-app user notifications |
| `/api/notifications/unread-count`| GET | `user-service` | Authenticated | Standard | Notification badge count |
| `/api/courses` | GET / POST | `course-service` | Public (GET) / Teacher | Standard | Course syllabus & management |
| `/api/courses/:id/lessons` | GET / POST | `course-service` | Enrolled / Teacher | Standard | Course lesson modules |
| `/api/courses/lessons/:id/stream` | GET | `course-service` | Enrolled Student | Stream (No Limit)| Native byte-range video streaming |
| `/api/courses/lessons/:id/hls/*` | GET | `course-service` | Enrolled Student | Standard | Adaptive HLS master and media chunks |
| `/api/courses/lessons/:id/video-ticket` | GET | `course-service` | Enrolled Student | Standard | Issue video playback session ticket |
| `/api/exams` | GET / POST | `course-service` | Enrolled / Teacher | Standard | Exam list & creation |
| `/api/exams/:id` | GET | `course-service` | Enrolled / Teacher | Standard | Sanitized exam questions |
| `/api/exams/:id/start` | POST | `course-service` | Enrolled Student | Standard | Initialize exam attempt |
| `/api/exams/:id/submit` | POST | `course-service` | Enrolled Student | Standard | Submit answers with concurrency lock |
| `/api/assessments` | GET / POST | `course-service` | Enrolled / Teacher | Standard | Homeworks & practice assessments |
| `/api/upload` | POST | `course-service` | Teacher, Admin | 50MB Limit | Media asset & document upload |
| `/api/ai/chat` | POST | `ai-service` | Authenticated | Standard | Math AI tutor interaction |
| `/api/analytics/admin` | GET | `analytics-service`| Admin, Manager | Standard | Consolidated platform KPIs |
| `/api/analytics/teacher` | GET | `analytics-service`| Teacher | Standard | Teacher course performance analytics |

---

## 2. Integration Contract Status
- All 32 primary endpoints have verified routes in Nginx gateway (`nginx.conf`).
- All endpoints enforce JWT bearer token validation or explicit public exposure where authorized.
- 0 route collisions or unhandled 404 traps exist between frontend service calls and backend definitions.
- **Verdict: PASS**

