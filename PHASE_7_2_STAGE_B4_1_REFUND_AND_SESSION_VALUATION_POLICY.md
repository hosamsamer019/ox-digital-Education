# Phase 7.2 — Stage B.4.1: Financial Rules & Policy Refinement
## Critical Reconciliation: Refund Framework & Equal Session Valuation Model

**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Phase:** 7.2 — Pricing Catalog & Subscription Agreements  
**Stage:** Stage B.4.1 — Policy Reconciliation, Financial Rules & Architecture Refinement  
**Date:** November 2, 2026  
**Final Status:** `TASK 7.2 STAGE B.4.1 — DOCUMENTATION-ONLY POLICY RECONCILIATION — NO SOURCE, SCHEMA, DATABASE OR MIGRATION AUTHORIZATION`  

---

## 1. Critical Reconciliation A: The Multi-Tier Refund Policy Hierarchy

To reconcile the interaction between **OD-722.3** (Package-Configurable Refundability) and **UP-706** (Statutory Pro-Rata Refunds Minus Administrative Fee), the architecture establishes an explicit **6-Tier Policy Hierarchy**:

```
[ Tier 1: Mandatory Egyptian Statutory Law & Consumer Protection ] (Law 181/2018)
                               │ (Supercedes all lower tiers)
                               ▼
[ Tier 2: Institutional Refund Governance Policy ] (Primary Manager approved guidelines)
                               │ (Defines institutional boundaries)
                               ▼
[ Tier 3: Package-Specific Refund Terms ] (Configured on SessionPackage template)
                               │ (Governs specific offering terms)
                               ▼
[ Tier 4: Individual Agreement Terms ] (Snapshotted in AgreementPriceSnapshot)
                               │ (Legally binding customer contract)
                               ▼
[ Tier 5: Operational Approval & Maker-Checker Workflow ] (UP-709 Dual-Approval)
                               │ (Prevents rogue financial disbursements)
                               ▼
[ Tier 6: Double-Entry Accounting Reversal & Settlement ] (OD-708 Auditability)
```

### 1.1 Invariant Rules of the Refund Hierarchy
1. **Supremacy of Applicable Law:** Package-specific terms or institutional policies cannot contract out of mandatory Egyptian consumer protection or commercial laws. If statutory law grants an unconditional withdrawal right, private terms cannot void it.
2. **Institutional Alignment:** Package-specific refundability cannot contradict the institution-wide refund policy set by the Primary Manager.
3. **Auditability & Zero Deletions (OD-708):** A refund never deletes, modifies, or overwrites the original `PaymentTransaction`, `Invoice`, or `SubscriptionAgreement` records. All refunds are executed strictly through compensating `CreditNote` and `RefundDisbursement` records.
4. **Administrative Fee Restrictions:** Administrative cancellation fees (UP-706) cannot be assigned an arbitrary percentage or fixed amount without explicit legal counsel validation and transparent pre-contract disclosure.

---

### 1.2 Matrix of Exact Refund Scenarios

The table below delineates the required operational handling across specific commercial scenarios:

| Cancellation / Refund Scenario | Operational & Eligibility Rule | Financial Calculation Model | Accounting Ledger Posting (Double-Entry) |
|---|---|---|---|
| **1. Full Cancellation Before Service Commences** | Permitted if requested prior to package `validFrom` or first class date. | Full refund of net paid consideration minus legally disclosed administrative fee. | Debit `Deferred Revenue` (Gross) / Credit `Refund Payable` (Net) + Credit `Fee Revenue` (Admin Fee). |
| **2. Partial Service Consumption (Early Withdrawal)** | Permitted during active term if authorized by institutional policy or statutory law. | Pro-rata refund of allocable net consideration for unconsumed sessions minus administrative fee. | Debit `Deferred Revenue` (Unconsumed portion) / Credit `Refund Payable` + Credit `Fee Revenue`. |
| **3. Package Expiration at `validTo` (OD-722.2)** | Unconsumed sessions remaining at package expiration date. | Non-refundable under standard expired package terms; deferred liability cleared to revenue. | Debit `Deferred Revenue` (Remaining balance) / Credit `Expired Package Revenue` (`41900`). |
| **4. Teacher / Institution Cancellation (OD-722.5)** | Teacher cancels class or institution closes center temporarily. | Zero financial refund; compensating `SessionAdjustment` restores +1 session entitlement to package. | No GL cash entry; deferred revenue remains in liability account until session is delivered. |
| **5. Student Notice Cancellation (OD-722.5)** | Student submits cancellation before published cut-off deadline (e.g. 24h prior). | Zero financial refund; compensating `SessionAdjustment` restores +1 session entitlement. | No GL entry; session balance incremented. |
| **6. Contractual Non-Refundable Condition** | Package explicitly designated as non-refundable in contract. | Strictly non-refundable post-activation, subject to statutory defect/cancellation exceptions. | No refund permitted; customer disputes escalated to legal counsel. |
| **7. Partial Refund After Promotional Discount** | Customer purchased package under a bundle or promotional discount. | Refund calculated strictly against the discounted net price paid, **never** the full list price. | Reconciled via Minor-Unit Valuation Model (Section 2). |
| **8. Hybrid Package Withdrawal (UP-714)** | Student cancels package combining physical lab sessions and online LMS access. | Unbundled refund: physical unconsumed sessions calculated per session; online access calculated pro-rata on calendar days. | Dual-line debit clearing campus deferred revenue and online branch deferred revenue separately. |

---

## 2. Critical Reconciliation B: Equal Session Valuation Model (OD-722.4)

Under provisional decision **OD-722.4**, prepaid package revenue is allocated equally across all included sessions. To prevent accounting anomalies, rounding drift, and tax distortion, the exact mathematical and operational model is formalized below.

### 2.1 Formal Calculation Framework

Let:
- $P_{\text{gross}}$ = Undiscounted list price of the package.
- $D$ = Total contractual discount granted.
- $P_{\text{net}} = P_{\text{gross}} - D$ = Net monetary consideration payable by the student.
- $T$ = Applicable output VAT (governed by UP-702 tax legal opinion).
- $N$ = Total number of physical sessions included in the package.
- $A_{\text{session}}$ = Base allocable consideration per session before rounding.

$$\text{Base Session Allocation:} \quad A_{\text{session}} = \frac{P_{\text{net}}}{N}$$

Because currency is represented as exact fixed-point decimal (`Decimal(12,2)` in Egyptian Piastres/Cents), dividing $P_{\text{net}}$ by $N$ often yields fractional fractions of a piastre (e.g. $1,000.00 \text{ EGP} \div 3 \text{ sessions} = 333.3333... \text{ EGP}$).

---

### 2.2 Deterministic Minor-Unit Allocation & Rounding Residual Strategy

To guarantee that the sum of allocated session values reconciles **exactly** to the net consideration ($P_{\text{net}}$) without creating or losing a single piastre, the system implements a **Deterministic Minor-Unit Allocation Algorithm**:

1. Calculate the truncated integer minor-unit amount per session:
   $$V_{\text{base}} = \left\lfloor \frac{P_{\text{net}} \times 100}{N} \right\rfloor \div 100$$
2. Calculate the minor-unit rounding residual:
   $$R = P_{\text{net}} - (V_{\text{base}} \times N)$$
   *(Note: $R \times 100$ is always an integer in the range $[0, N-1]$).*
3. **Deterministic Residual Assignment Rule:**
   - The residual $R$ (measured in 0.01 EGP increments) is distributed deterministically by adding $0.01 \text{ EGP}$ to each of the first $(R \times 100)$ sessions in chronological order of attendance consumption.
   - All subsequent sessions are valued at $V_{\text{base}}$.

#### Concrete Numerical Example:
- $P_{\text{net}} = 1,000.00 \text{ EGP}$, $N = 3 \text{ sessions}$.
- $V_{\text{base}} = \lfloor 100,000 \div 3 \rfloor \div 100 = 33,333 \div 100 = 333.33 \text{ EGP}$.
- Residual $R = 1,000.00 - (333.33 \times 3) = 1,000.00 - 999.99 = 0.01 \text{ EGP}$ (1 piastre).
- **Session Valuation Schedule:**
  - Session 1 (First attended): $333.33 + 0.01 = \mathbf{333.34 \text{ EGP}}$
  - Session 2 (Second attended): $\mathbf{333.33 \text{ EGP}}$
  - Session 3 (Third attended): $\mathbf{333.33 \text{ EGP}}$
  - **Total Reconciled Consideration:** $333.34 + 333.33 + 333.33 = \mathbf{1,000.00 \text{ EGP}}$ *(Exact zero-drift match)*.

---

### 2.3 Critical Accounting & Technical Invariants

1. **Discounts Allocated to Net Consideration:**
   - Recognized revenue is **strictly calculated from the net consideration paid ($P_{\text{net}}$)**.
   - Recognizing revenue based on the undiscounted list price ($P_{\text{gross}}$) is strictly prohibited as it would overstate earned revenue and misrepresent student liability.
2. **Tax Treatment Gated by UP-702:**
   - If the Egyptian Tax Counsel determines that the service is subject to VAT (e.g. 14%), the net allocable amount $P_{\text{net}}$ is partitioned into Base Service Consideration and Output Tax Payable prior to session allocation.
3. **Separation of Operational Attendance from Accounting Recognition:**
   - **Operational Level:** Recording attendance `status == 'PRESENT'` triggers `SessionConsumption`.
   - **Accounting Level:** `SessionConsumption` emits an event to the General Ledger service queue, which verifies fiscal period status (UP-707) and posts the debit to `Deferred Revenue` and credit to `Earned Tuition Revenue`.
4. **Attendance Reversal via Compensating Adjustments (OD-708):**
   - If an attendance record is reversed (e.g. teacher clerical error), the system creates a compensating `SessionAdjustment` with `sessionDelta: +1`.
   - Historical journal entries are **never deleted or updated in place**. A compensating reversing journal entry is posted:
     $$\text{Debit Earned Tuition Revenue } V_{\text{session}} \quad / \quad \text{Credit Deferred Revenue } V_{\text{session}}$$
5. **Partial Refund Valuation Formula:**
   - If a student withdraws after consuming $k$ sessions out of $N$, the gross refundable service amount is calculated strictly as:
     $$\text{Refundable Base} = P_{\text{net}} - \sum_{i=1}^{k} V_i$$
   - The final cash refund is: $\text{Refundable Base} - \text{Approved Administrative Fee}$.

---

## 3. Explicit Governance Statement

```
TASK 7.2 STAGE B.4.1 — DOCUMENTATION-ONLY POLICY RECONCILIATION — NO SOURCE, SCHEMA, DATABASE OR MIGRATION AUTHORIZATION
```

