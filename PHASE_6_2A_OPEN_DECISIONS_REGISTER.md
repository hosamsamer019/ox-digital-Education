# OX-DIGITAL Education — Phase 6.2A
# Open Decisions Register

**Status:** Canonical Decision Register (Updated with Approved OD-01, OD-02, OD-11, OD-12 & OD-12.1)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Governance & Decision Principles

This register formally documents every technical, educational, and operational policy decision across the student assessment and risk architecture.

> [!IMPORTANT]
> **Governance & Approval State:**
> - **OD-01, OD-02, OD-11, OD-12, and OD-12.1** are formally **APPROVED** by the Product Owner.
> - **OD-03 through OD-10** remain proposed decisions awaiting separate stakeholder sign-off prior to their respective implementation phases.

---

## 2. Open Decisions Register Table

| ID | Title & Scope | Why It Matters | Available Options | Approved Selection / Technical Recommendation | Status & Governance |
|---|---|---|---|---|---|
| **OD-01** | **Academic Assessment Calculation** | Determines how academic performance is calculated across multiple eligible assessments. | **A:** Simple unweighted average.<br>**B:** Weighted by assessment type.<br>**C:** Progressive penalties for consecutive failures. | **Option A (Simple Arithmetic Mean):** Arithmetic mean of percentages with equal weighting. No hidden multipliers or weights. | **APPROVED** (Product Owner) |
| **OD-02** | **Minimum Assessments for Availability** | Prevents volatile or unfair early flagging when a student has limited submissions. | **A:** 1 graded exam.<br>**B:** 2 graded exams.<br>**C:** 3 graded exams. | **Option C (Minimum 3 Graded Assessments):** Strict threshold: $N \ge 3$ required before status becomes `AVAILABLE`. | **APPROVED** (Product Owner) |
| **OD-03** | **Lateness Credit in Physical Attendance** | Sets the credit value for a student marked `LATE` in center classes. | **A:** 0.50 (50% credit).<br>**B:** 0.75 (75% credit).<br>**C:** 1.00 (Treated as present, warning only). | **Option B (0.75):** Acknowledges attendance while motivating punctuality. | **UNRESOLVED (PROPOSED)** (Center Operations Lead) |
| **OD-04** | **Late Homework Submission Credit** | Encourages students to complete assignments even if they missed the formal deadline. | **A:** 0% credit (Binary: on-time or fail).<br>**B:** 50% credit for submission within 7 days.<br>**C:** Full grading with 20% flat penalty deduction. | **Option B (50% credit):** Incentivizes pedagogical practice without punishing honest late efforts unduly. | **UNRESOLVED (PROPOSED)** (Academic Director) |
| **OD-05** | **Video Engagement Grace Period** | Prevents marking a student delayed if they watch lectures on weekends. | **A:** 48 hours from publication.<br>**B:** 72 hours (3 days).<br>**C:** 7 days (Weekly cycle). | **Option B (72 hours):** Aligns with standard 3-day course pacing intervals. | **UNRESOLVED (PROPOSED)** (Product Owner) |
| **OD-06** | **Historical Lesson Publication Backfill** | Lessons in DB have `publishedAt = NULL`. Blind backfill could distort historical risk. | **A:** Set `publishedAt = createdAt` for all lessons.<br>**B:** Dry-run audit and set `publishedAt` only for lessons with completed student views.<br>**C:** Leave historical lessons NULL; apply only to new/edited lessons. | **Option B (Audited Dry-Run):** Protects historical integrity without producing false alerts for abandoned legacy drafts. | **UNRESOLVED (PROPOSED)** (System Architect & PO) |
| **OD-07** | **Parent Notification Cooldown Period** | Balances parental awareness with the risk of alert fatigue and notification dismissal. | **A:** 3 days.<br>**B:** 7 days.<br>**C:** 14 days for stable assessments. | **Option B (7 days) for unchanged; Immediate for escalation.** Escalation must never be delayed. | **UNRESOLVED (PROPOSED)** (Product Owner) |
| **OD-08** | **Digital Activity Formula for Online Students** | Replaces physical attendance for online-only cohorts without double-counting. | **A:** Platform login count.<br>**B:** Video watch time + Quiz completions.<br>**C:** Composite 14-day activity score (50% lessons, 30% homework, 20% continuity). | **Option C:** Holistic learning engagement rather than passive login timestamps. | **UNRESOLVED (PROPOSED)** (Academic Lead & System Architect) |
| **OD-09** | **Out-of-Band Channels (WhatsApp / SMS)** | Parents may miss in-app notifications if they do not log into the portal daily. | **A:** In-app only (baseline).<br>**B:** Enable WhatsApp alerts for CRITICAL level only.<br>**C:** Full SMS/WhatsApp multi-channel for all levels. | **Option A for initial launch;** Option B proposed for Phase 7 following privacy and provider audit. | **UNRESOLVED (PROPOSED)** (Product Owner & Legal) |
| **OD-10** | **Seven-Day Trend Point Delta Threshold ($\theta$)** | Defines the minimum shift required to change trend from `STABLE` to `IMPROVING` or `DETERIORATING`. | **A:** $\pm 2.0$ points.<br>**B:** $\pm 5.0$ points.<br>**C:** $\pm 10.0$ points. | **Option B ($\pm 5.0$ points):** Filters out minor noise while capturing meaningful performance trajectories. | **UNRESOLVED (PROPOSED)** (Academic Director) |
| **OD-11** | **Assessment Retake Policy** | Dictates which attempt contributes to academic averages when retakes occur for an assessment. | **A:** Latest completed attempt.<br>**B:** Highest score achieved.<br>**C:** Average of attempts.<br>**D:** First attempt only. | **Option A (Latest Attempt):** The chronologically latest eligible graded attempt per assessment contributes. Tie-breaker: `submittedAt || createdAt DESC, id DESC`. | **APPROVED** (Product Owner) |
| **OD-12** | **Academic Assessment Evaluation Period** | Defines the evaluation timeframe for assessments included in academic calculations. | **A:** Cumulative All-Time.<br>**B:** Official Academic Term.<br>**C:** Rolling Time Window. | **Option C (Rolling Time Window):** Filters attempts within a dynamic rolling sliding window. | **APPROVED** (Product Owner) |
| **OD-12.1** | **Rolling Time Window Duration** | Defines the exact calendar duration for the rolling evaluation window (Parent: OD-12). | **A:** 30 Calendar Days.<br>**B:** 60 Calendar Days.<br>**C:** 90 Calendar Days.<br>**D:** Custom Configuration. | **Option A (30 Calendar Days):** Evaluates attempts submitted within the trailing 30-day window (`now - 30 days`). | **APPROVED** (Explicit Product Owner Approval) |
