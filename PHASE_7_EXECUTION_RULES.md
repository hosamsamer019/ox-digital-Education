# OX-DIGITAL Education — Phase 7
# Autonomous Task Execution Rules, Quality Gates & Operating Protocol

**Document ID:** `OD-7000-EXECUTION-RULES`  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Status:** **AUTHORITATIVE OPERATING RULES FOR PHASE 7 TASKS**  
**Compliance Mandate:** BINDING ON ALL AGENTS AND DEVELOPERS  

---

## 1. Operating Philosophy & Autonomous Task Delivery

The Phase 7 Financial Management System is delivered as a series of **independent, sequential tasks (Tasks 7.1 through 7.7)**.

To eliminate micro-prompting and sustain architectural momentum, the implementation agent is empowered to execute an authorized task autonomously from start to finish through its engineering sub-steps, subject to strict boundary conditions, continuous quality gates, and mandatory stop rules.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TASK EXECUTION PROTOCOL LIFECYCLE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. PRE-FLIGHT VERIFICATION                                                  │
│    └── Check branch, working tree, prerequisites & approved OD constraints   │
│                                 │                                           │
│ 2. AUTONOMOUS STEP-BY-STEP IMPLEMENTATION                                   │
│    └── Models -> Migrations -> Backend APIs -> Admin Dashboard UI -> Tests  │
│                                 │                                           │
│ 3. CONTINUOUS TEST & SECURITY GATES                                         │
│    └── Unit Tests -> Integration Tests -> Negative IDOR Suite -> Regression │
│                                 │                                           │
│ 4. PROGRESS & EVIDENCE LOGGING                                              │
│    └── Update PHASE_7_TASK_TRACKER.md with verified artifacts               │
│                                 │                                           │
│ 5. FORMAL COMPLETION REPORT & GATEKEEPER STOP                               │
│    └── Output comprehensive report -> STOP -> Await PO Approval for Next Task│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Boundaries of Autonomy: Routine Work vs. Mandatory Stop Conditions

### 2.1 Authorized Routine Engineering Work (Autonomous Within Authorized Task)
During an active, formally authorized task, the agent may autonomously:
- Inspect codebase files, existing Prisma schemas, and documentation.
- Implement data models, Prisma migrations, and service business logic defined strictly in the authorized task scope.
- Implement and integrate Admin Dashboard frontend views inside `apps/frontend/src/app/components/admin/` and register them in `AdminDashboard.tsx`.
- Author unit tests, integration tests, mock data fixtures, and negative security tests.
- Fix bugs, regressions, or build errors directly introduced during the current task.
- Refactor directly affected files to adhere to TypeScript standards and code quality rules.
- Update tracking documents (`PHASE_7_TASK_TRACKER.md`) and technical documentation.
- Execute local non-destructive test commands and build validations inside the sandbox.
- Report exact commands, test outcomes, and execution logs truthfully, distinguishing verified results from untested assumptions.

### 2.2 Mandatory Stop Conditions (Stop & Request Product Owner Approval)
The agent **MUST IMMEDIATELY STOP** and await explicit Product Owner authorization before:
1. **Starting Any New Task:** Advancing to the next sequential task before the current task is formally signed off by the Product Owner. (Never start Task 7.2 until Task 7.1 is signed off).
2. **Task 7.1 Stage C Review Gate:** In Task 7.1, after completing Stage A (Discovery) and Stage B (Architecture & Migration Design), the agent **must STOP** at Stage C and present the audit, migration plan, schema proposals, and lifecycle evaluation to the Product Owner for explicit approval before any database writes or schema modifications occur.
3. **Encountering a True Implementation Blocker:** Proceeding when a blocker (such as UP-701 accounting validation for Task 7.5) requires formal determination.
4. **Introducing Any New Business or Accounting Policy:** Choosing an unresolved policy from `PHASE_7_UNRESOLVED_POLICIES.md` without prior approval.
5. **Implementing Unapproved Staff Permissions:** Implementing detailed financial role permissions, limits, or delegation rules not explicitly approved by the Product Owner.
6. **Changing or Reinterpreting an Approved Requirement:** Any modification to approved decisions OD-701 through OD-708.
7. **Destructive Data Operations:** Running `prisma db push --force-reset`, dropping existing tables, truncating data, or executing irreversible schema migrations.
8. **Altering Production Infrastructure:** Changing Docker compose, Kubernetes, or cloud deployment configurations.
9. **Enabling External Integrations:** Enabling external online payment gateways or live Egyptian Tax Authority (ETA) tax transmissions.
10. **Git Remote Operations:** Executing `git commit`, `git push`, `git reset --hard`, or deploying code to any remote environment.
11. **Scope Creep:** Modifying code outside the explicitly authorized task boundaries or touching unrelated student/teacher features.
12. **Unsafe Tenant or Financial Ambiguity:** Proceeding when tenant ownership, branch attribution, or financial reconciliation cannot be established safely.

---

## 3. Financial & Data Integrity Invariants (Non-Negotiable)

Every task must strictly adhere to the following 10 core financial invariants:

1. **Payment Deletion Protection Invariant (OD-708):** Historical financial transactions and payment records must **never** be silently or destructively deleted as a side effect of deleting or deactivating a user. Technical protection options (Restrict, soft deletion, archival, relationship redesign) are evaluated in Task 7.1 Stage B.
2. **Double-Entry Balance Invariant:** In the General Ledger, every posted journal entry must satisfy:
   $$\sum \text{Debits} = \sum \text{Credits}$$
   Unbalanced journal entries are rejected at both ORM and database check-constraint levels.
3. **Strict Multi-Tenant Isolation:** Every financial record, invoice, account, and cashbox must have an immutable `institutionId`. No query may read or mutate across tenant boundaries.
4. **Mandatory Branch Attribution:** Operating revenues, collections, expenses, cashboxes, and teacher payroll must carry an attributable `branchId` (or the dedicated `Online Branch Dimension` for virtual operations).
5. **Domain A vs. Domain B Separation (OD-702):** SaaS vendor licensing revenue (Domain A) must remain completely decoupled from institutional tuition and fees (Domain B). Inter-domain automatic settlement is forbidden.
6. **Decoupling of Invoicing, Collection & Revenue Recognition (OD-704, OD-705, OD-706):** Invoicing does **NOT** equal automatic earned revenue. Cash collection alone does **NOT** equal earned revenue. Revenue is recognized strictly when educational services are earned: progressively over time for online subscriptions, or via attendance consumption for center packages. Absence does not consume sessions.
7. **No Fabricated Data (OD-711):** Never generate synthetic historical transactions to balance incomplete legacy data. Opening balances are recorded via explicit opening journal vouchers.
8. **Single Primary Manager Sovereignty (OD-701):** The Primary Manager exercises central authority over branches and pricing. Subordinate operational roles remain subordinate. Detailed permissions remain subject to approval; unapproved financial privileges must not be implemented.
9. **Server-Side Authorization Enforcement:** Hiding a button, menu item, or navigation link in the frontend is **never** accepted as security. All permissions, branch boundaries, and tenant scopes must be verified on the backend API.
10. **Admin Dashboard Exclusivity:** All financial management views belong strictly inside the existing Admin / Manager Dashboard. Teachers, students, and parents must never be granted internal financial administration views or capabilities.

---

## 4. Sequential Task Execution Protocol & Task 7.1 Staging

### 4.1 Task 7.1 Specific Staging Protocol
Task 7.1 executes through a strict 5-stage progression:
- **Stage A — Read-Only Discovery:** Inspect existing identity, relational, academic, and financial data structures; inspect auth, JWT, session, WebSocket, worker, and storage flows; zero database writes or migrations.
- **Stage B — Architecture & Migration Design:** Produce `PHASE_7_1_CURRENT_STATE_AUDIT.md`; produce `PHASE_7_1_LEGACY_DATA_MIGRATION_PLAN.md`; design Institution & Branch models; map existing records to initial institution & default branch; evaluate payment protection options and user lifecycle designs (without assuming `deletedAt` as already decided); design safe backfill & expand-and-contract schema progression.
- **Stage C — Product Owner Review Gate:** Present complete audit, migration design, and schema proposals. **STOP: Await explicit Product Owner approval before any DB mutation.**
- **Stage D — Authorized Implementation (Post-Approval):** Implement approved models, tenant-scoping middleware, and auth claims; apply safe non-destructive migrations; implement tenant isolation across APIs, workers, sockets, storage; add automated test suites.
- **Stage E — Verification & Completion:** Run automated tests and builds; verify data-preservation invariants and auth compatibility; deliver Task 7.1 Completion Report; STOP.

### 4.2 Standard Protocol for Subsequent Tasks (7.2 through 7.7)
When a subsequent task is authorized for execution, the agent must execute through the standardized 6-step protocol:
1. *Pre-Flight Verification:* Verify workspace, clean working tree, predecessor task completion, and zero unresolved blockers.
2. *Database Schema & Migration Scaffolding:* Define Prisma models with non-destructive migrations; validate SQL before execution.
3. *Backend API & Service Business Logic:* Implement service layer with transactional integrity (`prisma.$transaction`), AsyncLocalStorage tenant context, and server-side verification.
4. *Admin Dashboard UI Implementation:* Implement views inside `apps/frontend/src/app/components/admin/`, register routes in `AdminDashboard.tsx`, and enforce responsive layout.
5. *Comprehensive Automated Testing:* Author and execute unit, integration, negative cross-tenant IDOR, and regression test suites.
6. *Documentation & Stop:* Update `PHASE_7_TASK_TRACKER.md`, output Task Completion Report, and **STOP** to await Product Owner authorization for the next task.

---

## 5. Standard Task Completion Report Template

Every completed task must conclude with a formal report structured as follows:

```markdown
# Phase 7 — Task [X.X] Completion & Quality Verification Report

## 1. Task Identity & Status
- **Task ID:** TASK 7.X
- **Title:** [Task Name]
- **Status:** COMPLETED & VERIFIED (PENDING PO SIGN-OFF)
- **Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`

## 2. Summary of Implemented Scope
- [Brief bulleted list of backend services, models, and UI screens introduced]

## 3. Database & Migration Artifacts
- **Migration SQL:** `prisma/migrations/...`
- **Models Added/Modified:** [List of Prisma models]
- **Data Integrity Safeguards:** [Confirmation of non-destructive checks]

## 4. Admin Dashboard Implementation Evidence
- **Screens Introduced:** [List of component files]
- **Navigation Routes:** [List of `/admin/...` paths added]
- **Role Permissions Verified:** [Matrix of role access]

## 5. Automated Test Results
- **Unit Tests:** [X passed / 0 failed]
- **Integration Tests:** [X passed / 0 failed]
- **Negative Security Suite (IDOR):** [X attack vectors blocked]
- **Regression Suite:** [X legacy tests passing]

## 6. Git Status & Working Tree Verification
- [Output of git status verifying only authorized files were changed]

## 7. Next Task Readiness & Gatekeeper Stop
- **Next Task:** TASK 7.Y
- **Prerequisites Met:** [Yes / No]
- **Blockers:** [None / Detail]
- **STOP STATUS:** Execution halted. Awaiting Product Owner authorization for Task 7.Y.
```

---

*Authored and certified by Antigravity Architecture Agent under Product Owner mandate.*
