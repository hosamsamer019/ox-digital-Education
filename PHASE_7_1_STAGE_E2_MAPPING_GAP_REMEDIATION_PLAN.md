# OX-DIGITAL Education — Task 7.1
## Stage E.2: Mapping Parser Gap Remediation Plan

**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Target Codebase:** `scripts/backfill_task_7_1_tenancy.ts` (lines 1–116)  
**Execution Mode:** STRICT DOCUMENTATION-ONLY PLANNING (NO CODE MODIFICATIONS)  
**Date:** November 2, 2026  

---

## 1. Executive Summary & Objective

During the Stage E.1 pre-execution audit, static analysis of `scripts/backfill_task_7_1_tenancy.ts` identified four structural gaps between the existing mapping parser and enterprise tenancy provenance standards:
- **GAP-01:** Lack of Envelope Versioning & Dataset Metadata Validation.
- **GAP-02:** Absence of Pre-Execution SHA-256 Checksum & Manifest Verification.
- **GAP-03:** Absence of Cross-Institution Duplicate Assignment Detection (First-Match-Wins Flaw).
- **GAP-04:** Absence of Cross-Institution Branch ID Uniqueness Validation.

This document specifies the exact, implementation-ready remediation designs for all four gaps. In strict adherence to governance boundaries, **zero code or script modifications are performed in this stage**.

---

## 2. Review & Remediation Design for GAP-01: Mapping Envelope

### 2.1 Problem Analysis in Current Parser
In `scripts/backfill_task_7_1_tenancy.ts:89-98`, `validateConfig()` asserts only that `config.institutions` is a non-empty array and that target institution IDs exist. The parser ignores schema versions, dataset identifiers, and generator metadata. If an incompatible mapping format is supplied, the parser attempts execution, leading to runtime failures midway through backfill.

### 2.2 Proposed Remediation Specification
1. **SemVer Format Specification:**
   - The mapping file must declare `"formatVersion": "1.0.0"`.
   - The parser must support SemVer `^1.0.0` (accepting minor/patch increments `1.x.y` with identical semantics, rejecting major version `2.x.x`).
2. **Mandatory Dataset Identity (`datasetId`):**
   - The mapping must declare a non-empty string identifier matching the target dataset profile (e.g., `"SYNTH-STAGE-7.1-V1"`).
3. **Unsupported Version Rejection (Fail-Closed):**
   - If `formatVersion` is missing or has an unsupported major version, the parser must immediately throw:
     `FATAL_UNSUPPORTED_MAPPING_VERSION: Mapping format version '${config.formatVersion}' is incompatible. Expected '^1.0.0'.`
4. **Metadata Validation:**
   - Assert presence of `approvedBy` (non-empty string) and `approvedAt` (valid ISO-8601 UTC timestamp).
5. **Backward Compatibility Policy:**
   - To maintain compatibility with legacy draft test files, if `formatVersion` is omitted during a designated `--legacy-dev` flag, a loud warning is emitted; in all staging, benchmark, and production runs, strict envelope validation is mandatory.

---

## 3. Review & Remediation Design for GAP-02: SHA-256 Integrity Verification

### 3.1 Problem Analysis in Current Parser
The backfill script reads the raw JSON file into memory and parses it without verifying that the file contents match an approved, untampered manifest. A corrupted file or partial write would be parsed without warning.

### 3.2 Proposed Remediation Specification
1. **Canonical Byte Representation:**
   - To prevent whitespace, line-break (CRLF vs LF), or key-ordering differences from causing false checksum mismatches, hashing must operate on the exact raw file bytes loaded from disk before JSON parsing:
     ```typescript
     const rawBytes = fs.readFileSync(mappingFilePath);
     const calculatedHash = crypto.createHash('sha256').update(rawBytes).digest('hex');
     ```
2. **Detached Sidecar Manifest Architecture (Avoiding Self-Referential Hashing):**
   - Storing a checksum *inside* the file being hashed creates a self-referential paradox unless complex key-stripping normalization is used.
   - **Remediation Standard:** Use an external detached manifest file: `mapping.json.sha256` or an accompanying signed audit manifest (`mapping.manifest.json`).
   - The manifest records:
     ```json
     {
       "mappingFilename": "mapping.json",
       "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
       "fileSizeBytes": 12840,
       "generatedAt": "2026-11-02T22:00:00.000Z",
       "approvedBy": "Product Owner"
     }
     ```
3. **Verification Timing:**
   - The checksum must be calculated and verified **strictly before** `JSON.parse()` and before any database connection or dry-run evaluation occurs.
4. **Behavior on Mismatch (Fail-Closed):**
   - If `calculatedHash !== manifest.sha256`, the parser aborts immediately with:
     `FATAL_MAPPING_CHECKSUM_MISMATCH: Computed hash does not match approved manifest. File may be corrupted or modified.`
5. **Integrity vs. Authenticity Distinction:**
   - An ordinary SHA-256 checksum proves **data integrity** (the file has not suffered bit-rot or accidental modification).
   - It **does not prove cryptographic authenticity or non-repudiation** unless accompanied by an HMAC key or an asymmetric signature (e.g., GPG/ED25519) signed by the authorized Product Owner or Security Officer.

---

## 4. Review & Remediation Design for GAP-03: Cross-Institution Conflicts (First-Match-Wins Flaw)

### 4.1 Problem Analysis in Current Parser
In `scripts/backfill_task_7_1_tenancy.ts:262-265`:
```typescript
const matchingRule = mappingConfig.institutions.find(r => 
  r.matchCriteria.userIds?.includes(user.id) ||
  (user.role === 'TEACHER' && r.matchCriteria.teacherIds?.includes(user.id))
);
```
`Array.prototype.find()` returns the **first matching element**. If entity `usr_123` is erroneously configured under both Institution A and Institution B, the parser silently assigns the entity to Institution A without notifying the operator. This creates a severe risk of cross-tenant data corruption.

### 4.2 Proposed Remediation Specification (Fail-Closed Disjointness Engine)
1. **Global Inverted Index Construction:**
   - Before executing backfill mutations, the parser must construct an in-memory inverted index mapping every entity ID to its declared institutions:
     $$\text{entityIndex}: \text{Map}<\text{EntityID}, \text{Array}<\text{TargetInstitutionCode}>>$$
2. **Disjointness Assertion:**
   - Iterate through all declared institutions and populate the index for:
     - `userIds`
     - `teacherIds`
     - `centerGroupIds`
     - `courseIds`
3. **Cardinality Verification:**
   - For every entry in `entityIndex`:
     - If $\text{count} == 1$: Valid single-tenant assignment.
     - If $\text{count} > 1$: **FATAL COLLISION**. Abort immediately with:
       `FATAL_CONFLICTING_TENANT_ASSIGNMENTS: Entity '${entityId}' is declared in multiple institutions: [${institutions.join(', ')}]. Disjointness violated.`
4. **Intra-Institution Duplicate Check:**
   - Detect and reject duplicate IDs defined within the same array (e.g., `userIds: ['usr_1', 'usr_1']`).
5. **No First-Match-Wins:**
   - Replace `Array.find()` with an exact lookup into the validated unique assignment map.

---

## 5. Review & Remediation Design for GAP-04: Cross-Institution Branch Uniqueness

### 5.1 Problem Analysis in Current Parser
In `scripts/backfill_task_7_1_tenancy.ts`, the parser reads `defaultBranchId` and `onlineBranchId` for each institution, but does not verify that branch IDs are globally unique across all institutions. If Institution B accidentally reuses Institution A's branch ID, the upsert in lines 204–232 would overwrite Institution A's branch record, reassigning its foreign key to Institution B!

### 5.2 Proposed Remediation Specification
1. **Branch Ownership Mapping:**
   - Build a global map:
     $$\text{branchMap}: \text{Map}<\text{BranchID}, \text{TargetInstitutionID}>$$
2. **Cross-Tenant Collision Detection:**
   - For every declared `defaultBranchId` and `onlineBranchId`:
     - If `branchMap.has(branchId)` and `branchMap.get(branchId) !== currentInstitutionId`:
       Throw: `FATAL_DUPLICATE_BRANCH_ID: Branch '${branchId}' is claimed by multiple institutions ('${branchMap.get(branchId)}' and '${currentInstitutionId}').`
3. **Branch-to-Institution Relational Validation:**
   - Enforce that a branch cannot be assigned to an entity unless that branch belongs to the same institution assigned to that entity.
4. **Prohibition of Silent Defaults:**
   - Eliminate any fallback to hardcoded default branch codes. If a branch is not explicitly declared in mapping, the assignment fails closed.

---

## 6. Synthesis & Remediation Readiness

```
GAP_01_ENVELOPE_REMEDIATION: SPECIFIED_DESIGN_ONLY
GAP_02_INTEGRITY_REMEDIATION: SPECIFIED_DESIGN_ONLY
GAP_03_CONFLICT_REMEDIATION: SPECIFIED_DESIGN_ONLY
GAP_04_BRANCH_REMEDIATION: SPECIFIED_DESIGN_ONLY
IMPLEMENTATION_STATUS: NOT_IMPLEMENTED (AWAITING_STAGE_E3_AUTHORIZATION)
```

