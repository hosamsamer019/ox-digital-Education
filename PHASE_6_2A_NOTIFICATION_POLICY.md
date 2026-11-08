# OX-DIGITAL Education — Phase 6.2A
# Parent Notification Policy & Communication Specification

**Status:** Approved Design Specification (Documentation-Only — No Implementation Authorized)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Notification Policy Objectives & All-Level Coverage

Parent communication must be transparent, constructive, and timely. 

Per Product Owner directive, the platform must notify parents across **all four assessment levels**:
1. `LOW`: Reassurance and positive reinforcement (e.g., student demonstrating consistent homework completion and excellent exam scores).
2. `MEDIUM`: Early advisory and proactive guidance (e.g., student missed a single homework deadline or has a minor drop in engagement).
3. `HIGH`: Clear early warning of academic or attendance jeopardy requiring guardian attention.
4. `CRITICAL`: Urgent intervention alert requiring direct guardian collaboration with teachers or center management.

> [!IMPORTANT]
> **Strict Semantic Boundary:** Notifications must identify the **specific dimension** (`الواجبات`, `الحضور`, `الامتحانات`, `المشاهدة`). Notifications must **never** imply an overall composite student failure or use language suggesting a single student risk ranking.

---

## 2. Notification Triggers & Anti-Spam Architecture

To maintain high parental engagement and avoid notification fatigue, dispatch logic follows strict event-driven filtering:

```
                            [Daily Snapshot Evaluation]
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │ Has the Dimension Level Changed?      │
                     └───────────────────┬───────────────────┘
                                         │
                    YES                  │                  NO
         ┌───────────────────────────────┴───────────────────────────────┐
         ▼                                                               ▼
┌─────────────────────────────────┐                     ┌─────────────────────────────────┐
│ Level Escalation                │                     │ Repeated Unchanged Assessment   │
│ (e.g. MEDIUM -> HIGH)           │                     │ (Level remains unchanged)       │
├─────────────────────────────────┤                     ├─────────────────────────────────┤
│ • Immediate notification        │                     │ • Suppress daily notification   │
│ • Bypass standard cooldown      │                     │ • Apply 14-day digest cooldown  │
│ • Update lastNotifiedAt         │                     │ • Only notify if digest due     │
└────────────────┬────────────────┘                     └────────────────┬────────────────┘
                 │                                                       │
                 └───────────────────────┬───────────────────────────────┘
                                         ▼
                     ┌───────────────────────────────────────┐
                     │ Deduplication & Idempotency Check     │
                     │ (studentId:dimension:level:dateKey)   │
                     └───────────────────┬───────────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │ Insert into Notification Table        │
                     │ (userId = student.parentId)           │
                     └───────────────────┬───────────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │ Push Socket.IO Real-time Event        │
                     │ (if parent currently connected)       │
                     └───────────────────────────────────────┘
```

---

## 3. Cooldown & Frequency Rules

| Scenario | Trigger Condition | Notification Behavior | Cooldown Period |
|---|---|---|---|
| **First Assessment** | Student's dimension first enters `AVAILABLE` state. | Send initial status notification with baseline explanation. | Immediate |
| **Escalation** | Level worsens (e.g. `LOW` $\to$ `MEDIUM`, or `MEDIUM` $\to$ `HIGH`). | Immediate high-priority notification with specific action recommendation. | Cooldown waived upon escalation |
| **Emergency Escalation** | Level jumps to `CRITICAL`. | Urgent emergency alert; flags teacher and administrator simultaneously. | Cooldown waived; highlighted in UI |
| **De-escalation (Recovery)** | Level improves (e.g. `HIGH` $\to$ `LOW`). | Positive reinforcement notification celebrating improvement. | Immediate |
| **Repeated Unchanged Level** | Daily evaluation produces the identical risk level as previous run. | **SUPPRESSED:** No notification sent. Daily evaluations must not produce repeating notifications. | Minimum 14-day interval before reminder digest |

---

## 4. Idempotency & Duplicate Prevention

To guarantee that parallel background worker runs or network retries never spam parents:

1. **Deterministic Idempotency Key:**
   $$\text{IdempotencyKey} = \text{MD5}(\text{studentId} \,\|\, \text{dimension} \,\|\, \text{riskLevel} \,\|\, \text{calendarWeek})$$
2. **Database Verification:**
   Before inserting into `Notification`, the system queries `metadata->>'idempotencyKey'`. If a record exists within the active cooldown window, creation is safely skipped.

---

## 5. Parent Permissions, Privacy & Access Control

1. **Strict Guardian Scoping:**
   - In accordance with the schema model `User.parentId`, a parent is authorized to receive data **only for students where `student.parentId === req.user.userId`**.
   - Under no circumstances may a parent view data, names, or comparisons concerning other students or cohort peers.
2. **Channel Separation:**
   - **In-App Notifications (Baseline):** Delivered directly to the parent account via `Notification` records and viewed on `ParentHomePage.tsx`.
   - **External Channels (SMS / WhatsApp):**
     > [!WARNING]
     > SMS and WhatsApp are **optional future integrations**. They require formal Product Owner approval, verified parent opt-in consent, third-party provider credentials (e.g., Twilio/Meta Business API), and strict rate-limiting compliance. They must remain disabled until separately authorized.

---

## 6. Delivery Failure & Retry Behavior

1. **In-App Database Insert:**
   - Executed within a transactional boundary. If PostgreSQL insert fails, the worker retries up to 3 times with exponential backoff (1s, 2s, 4s).
2. **Socket.IO Real-Time Dispatch:**
   - If parent is offline, the socket emit is silently dropped; the parent receives the unread badge upon their next session login from the database.
3. **Audit Ledger:**
   - Every dispatched notification records `read = false`, `createdAt = now()`, and structured `metadata`:
     ```json
     {
       "studentId": "uuid-student",
       "courseId": "uuid-course",
       "dimension": "HOMEWORK",
       "level": "HIGH",
       "idempotencyKey": "hash-value",
       "triggerType": "ESCALATION"
     }
     ```

