# OX-DIGITAL Education — Task 7.1
## Stage E.2: Mapping Parser Negative-Test Matrix & Collision Suite

**Authorized Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**GitHub Repository:** `https://github.com/hosamsamer019/ox-digital-Education.git`  
**Current Git HEAD:** `0500b93e65c24ed881349c4acea7f523332c5e9f` (branch `main`)  
**Scope:** Automated Negative Testing Framework for Tenancy Mapping Parser Remediation  
**Execution Mode:** SPECIFICATION & TEST CASE DESIGN ONLY  
**Execution Status:** **ALL TESTS MARKED NOT_TESTED (NO CODE EXECUTION AUTHORIZED)**  
**Date:** November 2, 2026  

---

## 1. Executive Summary & Objective

This test matrix defines twelve comprehensive negative test cases designed to exercise the remediated mapping parser. Each test simulates a specific corruption, conflict, duplicate, or structural violation to verify that the parser fails closed, prevents silent fallbacks, and guarantees complete tenant isolation.

In strict compliance with task boundaries, **zero tests were executed**. All test cases are documented with their expected failure modes, error messages, and validation evidence criteria.

---

## 2. Complete Negative-Test Case Matrix

| Test ID | Test Scenario Name | Target Gap / Vulnerability | Concrete Input Scenario | Expected Outcome | Expected Rejection Error Code / Message | Evidence Required for PASS | Execution Status |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **NEG-01** | **Missing Envelope Format Version** | GAP-01: Envelope Validation | A `mapping.json` file missing the top-level `formatVersion` field. | Parse abort before validation. | `FATAL_UNSUPPORTED_MAPPING_VERSION: Missing required 'formatVersion'. Expected '^1.0.0'.` | Process exits with non-zero code; zero database operations initiated. | `NOT_TESTED` |
| **NEG-02** | **Incompatible Major Format Version** | GAP-01: Envelope Validation | A `mapping.json` file declaring `"formatVersion": "2.0.0"`. | Immediate rejection. | `FATAL_UNSUPPORTED_MAPPING_VERSION: Incompatible version '2.0.0'. Expected '^1.0.0'.` | Parser throws error; process halts cleanly. | `NOT_TESTED` |
| **NEG-03** | **SHA-256 Checksum Mismatch** | GAP-02: Integrity Verification | A `mapping.json` file where a single byte was altered after manifest generation. | Pre-execution hash check aborts. | `FATAL_MAPPING_CHECKSUM_MISMATCH: Computed hash does not match manifest.` | Hash difference logged; zero JSON parsing executed. | `NOT_TESTED` |
| **NEG-04** | **Missing Manifest File** | GAP-02: Integrity Verification | Staging backfill run without accompanying `mapping.manifest.json`. | Fail closed before reading mapping. | `FATAL_MISSING_MANIFEST: Checksum manifest not found for mapping file.` | Process halts with missing artifact code. | `NOT_TESTED` |
| **NEG-05** | **Cross-Institution User ID Collision** | GAP-03: First-Match-Wins Flaw | User ID `usr_synth_conflict_01` declared under both `inst_alpha` and `inst_beta`. | Disjointness check aborts immediately. | `FATAL_CONFLICTING_TENANT_ASSIGNMENTS: Entity 'usr_synth_conflict_01' is declared in multiple institutions: [inst_alpha, inst_beta].` | Collision list output; zero database mutations executed. | `NOT_TESTED` |
| **NEG-06** | **Cross-Role Inter-Tenant Collision** | GAP-03: First-Match-Wins Flaw | ID `usr_synth_hybrid_01` listed under `userIds` of `inst_alpha` and `teacherIds` of `inst_beta`. | Disjointness check aborts immediately. | `FATAL_CONFLICTING_TENANT_ASSIGNMENTS: Entity 'usr_synth_hybrid_01' assigned to multiple institutions.` | Parser throws conflict error; zero assignments applied. | `NOT_TESTED` |
| **NEG-07** | **Intra-Institution Duplicate Entity ID** | GAP-03: Clean Input Enforcement | User ID `usr_synth_student_01` duplicated twice inside `inst_alpha.matchCriteria.userIds`. | Cleanliness check aborts before execution. | `FATAL_DUPLICATE_SOURCE_ID: Duplicate entity 'usr_synth_student_01' detected within institution 'inst_alpha'.` | Exact duplicate index logged; process halts. | `NOT_TESTED` |
| **NEG-08** | **Cross-Institution Duplicate Branch ID** | GAP-04: Branch Uniqueness Flaw | Branch ID `br_cairo_main` declared under `inst_alpha` as default and under `inst_beta` as physical branch. | Global branch uniqueness check aborts. | `FATAL_DUPLICATE_BRANCH_ID: Branch 'br_cairo_main' claimed by multiple institutions ('inst_alpha' and 'inst_beta').` | Duplicate branch logged; zero branch upserts executed. | `NOT_TESTED` |
| **NEG-09** | **Cross-Tenant Child Relational Mismatch** | Multi-Tenancy Boundary | Synthetic course belongs to `inst_alpha`, but enrollment references student mapped to `inst_beta`. | Pre-flight referential audit aborts. | `FATAL_CROSS_TENANT_RELATION: Course 'crs_1' (inst_alpha) cannot enroll student 'usr_2' (inst_beta).` | Integrity checker logs relational violation. | `NOT_TESTED` |
| **NEG-10** | **Super-Admin Erroneous Assignment** | OD-703, OD-718 SaaS Isolation | `admin@edu.com` accidentally included in `inst_alpha.matchCriteria.userIds`. | Dedicated super-admin protection aborts. | `FATAL_SUPERADMIN_TENANCY_VIOLATION: admin@edu.com cannot be assigned institutional tenancy.` | Process aborts; super-admin record verified untouched. | `NOT_TESTED` |
| **NEG-11** | **Empty Institution Rule Array** | Baseline Input Validation | `mapping.json` contains `"institutions": []`. | Array validation aborts. | `FATAL_INVALID_TENANT_MAPPING: Configuration must specify at least one verified institution mapping.` | Parser throws error; process halts. | `NOT_TESTED` |
| **NEG-12** | **Institution Missing Default Branch** | Tenant Hierarchy Invariant | Institution declared with valid ID and name, but `defaultBranchId` is null/empty. | Structural validation aborts. | `FATAL_INVALID_TENANT_MAPPING: Incomplete institution specification for code: ALPHA_EDU. Missing defaultBranchId.` | Parser throws error; process halts. | `NOT_TESTED` |

---

## 3. Test Verification Criteria for Stage E.3 Execution

When authorization for implementation and testing is granted in Stage E.3, each test case above must be validated through an automated test harness (e.g., Jest / Vitest) asserting:
1. The script throws the **exact anticipated exception code**.
2. Database state before the test equals database state after the test ($\Delta = 0$).
3. Zero partial records are written to PostgreSQL or `_migration_quarantine`.

