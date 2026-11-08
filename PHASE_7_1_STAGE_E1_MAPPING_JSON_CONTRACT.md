# OX-DIGITAL Education — Task 7.1
## Stage E.1: Authoritative `mapping.json` Contract & Parser Compatibility Review

**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Target Codebase:** `scripts/backfill_task_7_1_tenancy.ts` (lines 1–116)  
**Execution Mode:** STATIC CODE ANALYSIS & DOCUMENTATION CONTRACT SPECIFICATION  
**Date:** November 2, 2026  

---

## 1. Executive Summary

This document defines the strict specification for the authoritative tenancy mapping input file (`mapping.json`), evaluates the parsing capabilities of the existing offline backfill script (`scripts/backfill_task_7_1_tenancy.ts`), and identifies the specific structural gaps between current parser code and enterprise provenance requirements.

---

## 2. Static Analysis of Existing Backfill Parser (`backfill_task_7_1_tenancy.ts`)

Inspection of `scripts/backfill_task_7_1_tenancy.ts:4-98` reveals the exact runtime data contract currently enforced:

### 2.1 Implemented TypeScript Interfaces
```typescript
// VERIFIED IN SOURCE: scripts/backfill_task_7_1_tenancy.ts:4-26
export interface InstitutionMappingRule {
  targetInstitutionId: string;
  targetInstitutionName: string;
  targetInstitutionCode: string;
  defaultBranchId: string;
  defaultBranchName: string;
  defaultBranchCode: string;
  onlineBranchId?: string;
  onlineBranchName?: string;
  onlineBranchCode?: string;
  matchCriteria: {
    teacherIds?: string[];
    centerGroupIds?: string[];
    userIds?: string[];
    courseIds?: string[];
  };
}

export interface BackfillMappingConfig {
  approvedBy: string;
  approvedAt: string;
  institutions: InstitutionMappingRule[];
}
```

### 2.2 Implemented Parser Logic & Validation
1. **Source Loading (`loadAndValidateMapping`, lines 67–87):** Accepts an in-memory configuration object or loads and parses a UTF-8 JSON file via `fs.readFileSync(options.mappingFilePath, 'utf8')`.
2. **Fail-Closed Gate (`lines 83–86`):** If neither `mappingConfig` nor `mappingFilePath` is provided, the script throws `FATAL_MISSING_TENANT_MAPPING`.
3. **Array Validation (`lines 89–98`):** Verifies that `config.institutions` is a non-empty array and asserts that `targetInstitutionId`, `targetInstitutionCode`, and `defaultBranchId` are present on each institution element.
4. **Entity Assignment Logic (`lines 262–342`):**
   - **Users:** Checks `matchCriteria.userIds` or `matchCriteria.teacherIds`.
   - **CenterGroups:** Checks `matchCriteria.centerGroupIds`.
   - **Courses:** Checks `matchCriteria.courseIds` or `matchCriteria.teacherIds`.
   - **Payments:** Resolves via student `p.userId` against `matchCriteria.userIds`.
   - **Unmapped Records:** Fails safe by routing to `_migration_quarantine` table with reason `AMBIGUOUS_UNMAPPED_*`. Zero synthetic tenants are created.

---

## 3. Structural Gaps Between Enterprise Standards & Current Parser

A rigorous audit identifies four distinct architectural gaps between enterprise mapping provenance requirements and the current parser implementation:

| Gap ID | Enterprise Requirement | Current Parser Implementation | Gap Severity | Proposed Engineering Remediation |
| :---: | :--- | :--- | :--- | :--- |
| **GAP-01** | **Envelope Metadata (`formatVersion`, `datasetId`, `generatorVersion`)** | Parser only validates `approvedBy` and `approvedAt`. Top-level versioning fields are ignored. | Medium | Add optional top-level metadata fields to `BackfillMappingConfig` interface without breaking backward compatibility. |
| **GAP-02** | **Cryptographic Fingerprint (`sha256Fingerprint`)** | Parser does not compute or assert the SHA-256 integrity hash of the mapping content. | Medium | Calculate and log `crypto.createHash('sha256').update(raw).digest('hex')` prior to execution. |
| **GAP-03** | **Cross-Institution Duplicate Detection** | If an entity ID appears in `matchCriteria` under two different institutions, `find()` selects the **first matching rule** without raising an exception. | **High** | Introduce pre-execution duplicate detection asserting that $\text{matchCriteria} \cap \text{otherMatchCriteria} = \emptyset$. |
| **GAP-04** | **Branch Uniqueness Validation** | Parser does not verify that a `defaultBranchId` or `onlineBranchId` belongs to exactly one institution across the entire config. | Medium | Assert set uniqueness on all declared branch IDs across all institution rules. |

*Note: In accordance with strict read-only execution boundaries, these gaps are documented for future parser enhancement and will not be edited during Stage E.1.*

---

## 4. Authoritative Parser-Compatible `mapping.json` Schema

To ensure 100% compatibility with the current `scripts/backfill_task_7_1_tenancy.ts` implementation while incorporating enterprise audit fields, the canonical mapping structure is specified below:

```json
{
  "$schema": "https://ox-digital.edu.invalid/schemas/tenancy-mapping-v1.json",
  "formatVersion": "1.0.0",
  "datasetId": "SYNTH-STAGE-7.1-V1",
  "generatorVersion": "1.0.0",
  "sha256Fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "approvedBy": "Product Owner & Financial Auditor",
  "approvedAt": "2026-11-02T22:00:00.000Z",
  "institutions": [
    {
      "targetInstitutionId": "inst_synth_alpha",
      "targetInstitutionName": "Alpha Educational Academy",
      "targetInstitutionCode": "ALPHA_EDU",
      "defaultBranchId": "br_alpha_cairo",
      "defaultBranchName": "Downtown Cairo Campus",
      "defaultBranchCode": "ALPHA_CAIRO",
      "onlineBranchId": "br_alpha_online",
      "onlineBranchName": "Alpha Digital Hub",
      "onlineBranchCode": "ALPHA_ONLINE",
      "matchCriteria": {
        "teacherIds": [
          "usr_synth_t_a1",
          "usr_synth_t_a2"
        ],
        "centerGroupIds": [
          "cg_synth_a_cairo_01",
          "cg_synth_a_alex_01"
        ],
        "userIds": [
          "usr_synth_pm_a",
          "usr_synth_s_a01",
          "usr_synth_s_a02",
          "usr_synth_s_hybrid"
        ],
        "courseIds": [
          "crs_synth_a_math_101",
          "crs_synth_a_physics_online"
        ]
      }
    },
    {
      "targetInstitutionId": "inst_synth_beta",
      "targetInstitutionName": "Beta STEM Institute",
      "targetInstitutionCode": "BETA_STEM",
      "defaultBranchId": "br_beta_giza",
      "defaultBranchName": "Giza Campus",
      "defaultBranchCode": "BETA_GIZA",
      "onlineBranchId": "br_beta_online",
      "onlineBranchName": "Beta Remote Portal",
      "onlineBranchCode": "BETA_ONLINE",
      "matchCriteria": {
        "teacherIds": [
          "usr_synth_t_b1"
        ],
        "centerGroupIds": [
          "cg_synth_b_giza_01"
        ],
        "userIds": [
          "usr_synth_pm_b",
          "usr_synth_s_b01",
          "usr_synth_s_b02"
        ],
        "courseIds": [
          "crs_synth_b_chem_101"
        ]
      }
    }
  ]
}
```

*(Above JSON is an illustrative, non-executable specification artifact).*

---

## 5. Mapping Validation Rules & Integrity Checklist

Prior to ingesting `mapping.json` into Staging backfill execution, an automated pre-flight script must verify:

1. **Rule 1 (1:1 Institution Code Uniqueness):** Every `targetInstitutionCode` must be unique across the configuration array.
2. **Rule 2 (Branch Ownership Disjointness):** Every branch ID (`defaultBranchId`, `onlineBranchId`) must appear in exactly one institution.
3. **Rule 3 (Entity ID Disjointness):** No entity ID (`userId`, `teacherId`, `centerGroupId`, `courseId`) may appear in `matchCriteria` under multiple institutions.
4. **Rule 4 (No Synthetic Fallbacks):** Records that are not explicitly matched must be confirmed to route to `_migration_quarantine`.
5. **Rule 5 (SaaS Super-Admin Exclusion):** `admin@edu.com` must never be included in any `userIds` array.
6. **Rule 6 (Deterministic Rerun):** Parsing the mapping file 100 consecutive times must generate identical assignment structures.

---

## 6. Pre-Execution Mapping Validation Report Schema

The output of the mapping pre-flight validator must produce a report structured as follows:

```json
{
  "validationTimestamp": "ISO-8601",
  "datasetId": "SYNTH-STAGE-7.1-V1",
  "mappingFileHash": "SHA-256",
  "metrics": {
    "totalSourceEntitiesInDatabase": 0,
    "totalExplicitlyMappedEntities": 0,
    "totalExpectedQuarantinedEntities": 0,
    "duplicateSourceIdViolations": 0,
    "conflictingAssignmentViolations": 0,
    "invalidBranchParentCombinations": 0
  },
  "verdict": "GO" | "NO-GO"
}
```
**Safety Mandate:** Any validation metric with violations $> 0$ triggers an automatic **`NO-GO`**.

