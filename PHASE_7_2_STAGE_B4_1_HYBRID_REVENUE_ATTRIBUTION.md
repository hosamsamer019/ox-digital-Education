# Phase 7.2 — Stage B.4.1: Financial Architecture Refinement
## Critical Reconciliation: Hybrid Revenue Attribution & Single-Ledger Governance

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4.1 — Policy Reconciliation, Financial Rules & Architecture Refinement  
**Date:** November 2, 2026  
**Final Status:** `TASK 7.2 STAGE B.4.1 — DOCUMENTATION-ONLY POLICY RECONCILIATION — NO SOURCE, SCHEMA, DATABASE OR MIGRATION AUTHORIZATION`  

---

## 1. Critical Reconciliation G: Hybrid Package Revenue Attribution (UP-714)

Under provisional decision **UP-714**, hybrid educational programs combining **physical classroom sessions** (at a physical campus) and **digital LMS video access** (delivered online) must be unbundled and attributed accurately across institutional dimensions.

### 1.1 Structural Domain Separation & Dimensions

In strict accordance with **OD-702** (Domain Separation) and **OD-703** (Single Ledger with Branch Dimensions):

```
+----------------------------------------------------------------------------------------------------+
| INSTITUTION LEGAL ENTITY (Single General Ledger / Single Chart of Accounts)                        |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ Dimension A: Physical Branch ]                [ Dimension B: Online Branch (OD-719) ]           |
|  Branch.id = 'br_nasr_city'                     Branch.id = 'br_online_main'                       |
|  Branch.isOnline = false                         Branch.isOnline = true                            |
|                                                                                                    |
|  Attributed Services:                            Attributed Services:                              |
|  - In-person classroom lectures                  - Video streaming & on-demand playback            |
|  - Science / computer laboratory access          - Automated online quizzes & homeworks            |
|  - Printed academic materials                    - Digital student forum & chat                    |
|                                                                                                    |
|  Revenue Recognition Method:                     Revenue Recognition Method:                       |
|  Attendance-based per session (OD-722.1/4)       Straight-line daily/monthly amortization (OD-705) |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
+----------------------------------------------------------------------------------------------------+
| SEPARATE PLATFORM COMMERCIAL DOMAIN (OD-702)                                                       |
| OX-DIGITAL EdTech SaaS Commercial Accounts (Platform Subscription Fees, Infrastructure Charges)   |
| *Zero mingling with institutional student tuition ledgers*                                         |
+----------------------------------------------------------------------------------------------------+
```

---

## 2. Invariant Accounting Safeguards for Hybrid Bundles

1. **Exact Total Consideration Reconciliation:**
   - A hybrid agreement itemizes two discrete line items:
     $$\text{Line 1 (Physical Classroom)} = P_{\text{physical}}$$
     $$\text{Line 2 (Digital LMS Platform)} = P_{\text{digital}}$$
     $$\text{Total Net Agreement Consideration} = P_{\text{physical}} + P_{\text{digital}}$$
   - The sum of unbundled line items must reconcile **cent-for-cent** to the total monetary consideration agreed by the customer.
2. **Proportional Discount & Tax Allocation:**
   - If an agreement receives a promotional discount $D$, it is prorated across physical and digital lines in proportion to their relative list prices:
     $$D_{\text{physical}} = D \times \left( \frac{P_{\text{physical, gross}}}{P_{\text{gross}}} \right), \quad D_{\text{digital}} = D \times \left( \frac{P_{\text{digital, gross}}}{P_{\text{gross}}} \right)$$
   - Output VAT (if applicable under UP-702) is calculated independently on each line item, supporting differing tax treatments if physical education is exempt while digital streaming is taxable.
3. **Distinct, Decoupled Revenue Recognition Rules:**
   - **Physical Component ($P_{\text{physical}}$):** Recognized strictly **per attended session** (`status == 'PRESENT'`) via equal minor-unit allocation (OD-722.4).
   - **Digital Component ($P_{\text{digital}}$):** Amortized **straight-line over calendar days** across the active term $[ \text{startsAt}, \text{endsAt} ]$, regardless of how many videos are viewed (OD-705).
4. **Prevention of Double-Counting:**
   - An educational activity cannot recognize revenue under both dimensions. Attending a physical class triggers recognition solely against the physical deferred revenue account; streaming a video never decrements physical prepaid session entitlements.
5. **No Synthetic Legal Entities:**
   - Branch dimensions (`branchId`) represent **analytical cost centers and internal reporting dimensions**, not independent legal persons or separate corporate ledgers.
   - All accounting entries post to the **single general ledger** of the host Institution (OD-703).
6. **No Pre-Set Invented Percentages:**
   - The architecture enforces the unbundled data structure but **does not hard-code an invented percentage split** (such as 60/40 or 70/30).
   - Line item values are derived authoritatively from the active institutional pricing catalog item definitions configured by the Primary Manager (OD-721).

---

## 3. Illustrative Dual-Dimension Journal Entry Flow

For an illustrative hybrid enrollment of **1,200.00 EGP** (800.00 EGP for 8 physical sessions + 400.00 EGP for 2 months digital access):

### Step 1: Invoicing (Establishment of Receivables & Deferred Revenue)

| Account Name | Account Code | Branch Dimension | Debit (EGP) | Credit (EGP) |
|---|---|---|---|---|
| Accounts Receivable — Students | `11200` | Nasr City Campus (`br_nasr`) | 1,200.00 | — |
| Deferred Revenue — Physical Sessions | `22110` | Nasr City Campus (`br_nasr`) | — | 800.00 |
| Deferred Revenue — Online LMS Access | `22120` | Online Branch (`br_online`) | — | 400.00 |

### Step 2: Cash Collection (Payment Settlement)

| Account Name | Account Code | Branch Dimension | Debit (EGP) | Credit (EGP) |
|---|---|---|---|---|
| Cash at Bank — Clearing | `11110` | Central Treasury | 1,200.00 | — |
| Accounts Receivable — Students | `11200` | Nasr City Campus (`br_nasr`) | — | 1,200.00 |

### Step 3: Operational Service Delivery & Amortization
- **When Student Attends Session 1 at Campus:**
  $$\text{Debit Deferred Revenue — Physical } (100.00) \quad / \quad \text{Credit Earned Tuition — Physical } (100.00) \quad [\text{Nasr City}]$$
- **When Month 1 Concludes (Digital Amortization):**
  $$\text{Debit Deferred Revenue — Online } (200.00) \quad / \quad \text{Credit Earned Tuition — Online } (200.00) \quad [\text{Online Branch}]$$

*Result:* Nasr City Branch P&L reflects earned physical tuition; Online Branch P&L reflects digital LMS platform revenue. Central institution balance sheet reconciles to zero remaining liability upon term completion.

---

## 4. Explicit Governance Statement

```
TASK 7.2 STAGE B.4.1 — DOCUMENTATION-ONLY POLICY RECONCILIATION — NO SOURCE, SCHEMA, DATABASE OR MIGRATION AUTHORIZATION
```

