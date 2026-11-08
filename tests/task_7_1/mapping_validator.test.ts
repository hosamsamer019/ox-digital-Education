/**
 * OX-DIGITAL Education — Task 7.1 Staging Foundation
 * Comprehensive Mapping Validator Negative Test Suite & Regression Matrix
 *
 * Implements and verifies:
 * - NEG-01 through NEG-12 (Stage E.2 Negative Test Matrix)
 * - REG-01 through REG-10 (Regression Tests for GAP-01 to GAP-04)
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  validateMappingConfig,
  verifyDetachedManifest,
  loadAndValidateMapping,
  BackfillMappingConfig,
  DetachedManifest
} from '../../scripts/mapping_validator.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorMsg?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName} -> ${errorMsg || 'Condition failed'}`);
    failed++;
  }
}

function expectError(fn: () => any, expectedSnippet: string, testName: string) {
  try {
    fn();
    console.error(`[FAIL] ${testName} -> Expected error containing "${expectedSnippet}" but no error was thrown.`);
    failed++;
  } catch (err: any) {
    if (err.message && err.message.includes(expectedSnippet)) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} -> Error message mismatch. Expected "${expectedSnippet}", received: "${err.message}"`);
      failed++;
    }
  }
}

function createValidBaseConfig(): BackfillMappingConfig {
  return {
    formatVersion: '1.0.0',
    datasetId: 'SYNTH-STAGE-7.1-V1',
    generatorVersion: '1.0.0',
    approvedBy: 'Product Owner & Financial Auditor',
    approvedAt: '2026-11-02T22:00:00.000Z',
    institutions: [
      {
        targetInstitutionId: 'inst_alpha',
        targetInstitutionName: 'Alpha Academy',
        targetInstitutionCode: 'ALPHA_EDU',
        defaultBranchId: 'br_alpha_cairo',
        defaultBranchName: 'Cairo Campus',
        defaultBranchCode: 'ALPHA_CAIRO',
        onlineBranchId: 'br_alpha_online',
        onlineBranchName: 'Online Campus',
        onlineBranchCode: 'ALPHA_ONLINE',
        matchCriteria: {
          userIds: ['usr_alpha_1', 'usr_alpha_2'],
          teacherIds: ['tch_alpha_1'],
          centerGroupIds: ['grp_alpha_1'],
          courseIds: ['crs_alpha_1']
        }
      },
      {
        targetInstitutionId: 'inst_beta',
        targetInstitutionName: 'Beta Institute',
        targetInstitutionCode: 'BETA_EDU',
        defaultBranchId: 'br_beta_alex',
        defaultBranchName: 'Alexandria Campus',
        defaultBranchCode: 'BETA_ALEX',
        matchCriteria: {
          userIds: ['usr_beta_1', 'usr_beta_2'],
          teacherIds: ['tch_beta_1'],
          centerGroupIds: ['grp_beta_1'],
          courseIds: ['crs_beta_1']
        }
      }
    ]
  };
}

async function runMappingValidatorTests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Task 7.1 — Authoritative Mapping Validator Test Suite');
  console.log('Exercising GAP-01, GAP-02, GAP-03, GAP-04 & Negative Matrix');
  console.log('===================================================================\n');

  // Temporary directory for file-based tests
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ox-mapping-tests-'));

  try {
    // -------------------------------------------------------------
    // SECTION 1: THE 12 NEGATIVE TEST CASES (NEG-01 to NEG-12)
    // -------------------------------------------------------------
    console.log('--- Section 1: Twelve Negative Test Cases (Stage E.2) ---');

    // NEG-01: Missing Envelope Format Version
    const neg01Config = createValidBaseConfig() as any;
    delete neg01Config.formatVersion;
    expectError(
      () => validateMappingConfig(neg01Config),
      "FATAL_UNSUPPORTED_MAPPING_VERSION: Missing required 'formatVersion'. Expected '^1.0.0'.",
      'NEG-01: Missing Envelope Format Version rejected'
    );

    // NEG-02: Incompatible Major Format Version
    const neg02Config = createValidBaseConfig();
    neg02Config.formatVersion = '2.0.0';
    expectError(
      () => validateMappingConfig(neg02Config),
      "FATAL_UNSUPPORTED_MAPPING_VERSION: Incompatible version '2.0.0'. Expected '^1.0.0'.",
      'NEG-02: Incompatible Major Format Version rejected'
    );

    // NEG-03: SHA-256 Checksum Mismatch
    const sampleBytes = Buffer.from('{"hello": "world"}', 'utf8');
    const badManifest: DetachedManifest = {
      mappingFilename: 'mapping.json',
      sha256: '0000000000000000000000000000000000000000000000000000000000000000'
    };
    expectError(
      () => verifyDetachedManifest(sampleBytes, badManifest),
      'FATAL_MAPPING_CHECKSUM_MISMATCH: Computed hash does not match manifest.',
      'NEG-03: SHA-256 Checksum Mismatch rejected'
    );

    // NEG-04: Missing Manifest File
    const dummyMappingPath = path.join(tempDir, 'neg04_mapping.json');
    fs.writeFileSync(dummyMappingPath, JSON.stringify(createValidBaseConfig()), 'utf8');
    expectError(
      () => loadAndValidateMapping({ mappingFilePath: dummyMappingPath }),
      'FATAL_MISSING_MANIFEST: Checksum manifest not found for mapping file',
      'NEG-04: Missing Manifest File fails closed'
    );

    // NEG-05: Cross-Institution User ID Collision
    const neg05Config = createValidBaseConfig();
    neg05Config.institutions[0].matchCriteria.userIds!.push('usr_synth_conflict_01');
    neg05Config.institutions[1].matchCriteria.userIds!.push('usr_synth_conflict_01');
    expectError(
      () => validateMappingConfig(neg05Config),
      "FATAL_CONFLICTING_TENANT_ASSIGNMENTS: Entity 'usr_synth_conflict_01' is declared in multiple institutions: [ALPHA_EDU, BETA_EDU].",
      'NEG-05: Cross-Institution User ID Collision rejected'
    );

    // NEG-06: Cross-Role Inter-Tenant Collision
    const neg06Config = createValidBaseConfig();
    neg06Config.institutions[0].matchCriteria.userIds!.push('usr_synth_hybrid_01');
    neg06Config.institutions[1].matchCriteria.teacherIds!.push('usr_synth_hybrid_01');
    expectError(
      () => validateMappingConfig(neg06Config),
      "FATAL_CONFLICTING_TENANT_ASSIGNMENTS: Entity 'usr_synth_hybrid_01' is declared in multiple institutions: [ALPHA_EDU, BETA_EDU].",
      'NEG-06: Cross-Role Inter-Tenant Collision rejected'
    );

    // NEG-07: Intra-Institution Duplicate Entity ID
    const neg07Config = createValidBaseConfig();
    neg07Config.institutions[0].matchCriteria.userIds!.push('usr_synth_student_01', 'usr_synth_student_01');
    expectError(
      () => validateMappingConfig(neg07Config),
      "FATAL_DUPLICATE_SOURCE_ID: Duplicate entity 'usr_synth_student_01' detected within institution 'ALPHA_EDU'.",
      'NEG-07: Intra-Institution Duplicate Entity ID rejected'
    );

    // NEG-08: Cross-Institution Duplicate Branch ID
    const neg08Config = createValidBaseConfig();
    neg08Config.institutions[0].defaultBranchId = 'br_cairo_main';
    neg08Config.institutions[1].defaultBranchId = 'br_cairo_main';
    expectError(
      () => validateMappingConfig(neg08Config),
      "FATAL_DUPLICATE_BRANCH_ID: Branch 'br_cairo_main' claimed by multiple institutions ('ALPHA_EDU' and 'BETA_EDU').",
      'NEG-08: Cross-Institution Duplicate Branch ID rejected'
    );

    // NEG-09: Cross-Tenant Child Relational Mismatch
    const neg09Config = createValidBaseConfig();
    expectError(
      () => validateMappingConfig(neg09Config, {
        preflightData: {
          courseEnrollments: [
            { courseId: 'crs_alpha_1', studentId: 'usr_beta_1' } // Course in Alpha, Student in Beta
          ]
        }
      }),
      "FATAL_CROSS_TENANT_RELATION: Course 'crs_alpha_1' (ALPHA_EDU) cannot enroll student 'usr_beta_1' (BETA_EDU).",
      'NEG-09: Cross-Tenant Child Relational Mismatch rejected'
    );

    // NEG-10: Super-Admin Erroneous Assignment
    const neg10Config = createValidBaseConfig();
    neg10Config.institutions[0].matchCriteria.userIds!.push('admin@edu.com');
    expectError(
      () => validateMappingConfig(neg10Config),
      'FATAL_SUPERADMIN_TENANCY_VIOLATION: admin@edu.com cannot be assigned institutional tenancy.',
      'NEG-10: Super-Admin Erroneous Assignment rejected'
    );

    // NEG-11: Empty Institution Rule Array
    const neg11Config = createValidBaseConfig();
    neg11Config.institutions = [];
    expectError(
      () => validateMappingConfig(neg11Config),
      'FATAL_INVALID_TENANT_MAPPING: Configuration must specify at least one verified institution mapping.',
      'NEG-11: Empty Institution Rule Array rejected'
    );

    // NEG-12: Institution Missing Default Branch
    const neg12Config = createValidBaseConfig();
    neg12Config.institutions[0].defaultBranchId = '';
    expectError(
      () => validateMappingConfig(neg12Config),
      'FATAL_INVALID_TENANT_MAPPING: Incomplete institution specification for code: ALPHA_EDU. Missing defaultBranchId.',
      'NEG-12: Institution Missing Default Branch rejected'
    );

    console.log('');

    // -------------------------------------------------------------
    // SECTION 2: REGRESSION & COMPLIANCE TEST CASES (REG-01 to REG-10)
    // -------------------------------------------------------------
    console.log('--- Section 2: Regression & Robustness Tests ---');

    // REG-01: Valid Mapping Acceptance
    const validConfig = createValidBaseConfig();
    const validResult = validateMappingConfig(validConfig);
    assert(validResult.config.formatVersion === '1.0.0', 'REG-01: Valid mapping accepted with formatVersion 1.0.0');
    assert(validResult.entityToInstitutionMap.size === 10, 'REG-01: Correctly indexes all 10 unique entities');
    assert(validResult.branchToInstitutionMap.size === 3, 'REG-01: Correctly indexes all 3 unique branches');

    // REG-02: SemVer Minor/Patch Compatibility (^1.0.0)
    const patchConfig = createValidBaseConfig();
    patchConfig.formatVersion = '1.2.3';
    const patchResult = validateMappingConfig(patchConfig);
    assert(patchResult.config.formatVersion === '1.2.3', 'REG-02: SemVer patch increment 1.2.3 accepted under ^1.0.0');

    // REG-03: Invalid Manifest Rejection (Empty Checksum)
    const emptyChecksumManifest: DetachedManifest = {
      mappingFilename: 'mapping.json',
      sha256: '   '
    };
    expectError(
      () => verifyDetachedManifest(sampleBytes, emptyChecksumManifest),
      'FATAL_INVALID_MANIFEST: Manifest missing required sha256 checksum.',
      'REG-03: Manifest with empty checksum rejected'
    );

    // REG-04: End-to-End Detached File Hash Verification
    const testMappingPath = path.join(tempDir, 'valid_mapping.json');
    const testManifestPath = path.join(tempDir, 'valid_mapping.json.manifest.json');
    const mappingContent = JSON.stringify(createValidBaseConfig(), null, 2);
    const mappingBytes = Buffer.from(mappingContent, 'utf8');
    const trueHash = crypto.createHash('sha256').update(mappingBytes).digest('hex');

    fs.writeFileSync(testMappingPath, mappingBytes);
    fs.writeFileSync(testManifestPath, JSON.stringify({
      mappingFilename: 'valid_mapping.json',
      sha256: trueHash,
      fileSizeBytes: mappingBytes.length,
      generatedAt: new Date().toISOString(),
      approvedBy: 'Product Owner'
    }));

    const fileLoaded = loadAndValidateMapping({
      mappingFilePath: testMappingPath,
      manifestFilePath: testManifestPath
    });
    assert(fileLoaded.approvedBy === 'Product Owner & Financial Auditor', 'REG-04: End-to-end verified detached manifest loading succeeds');

    // REG-05: Hash Mismatch on Single Byte Tampering
    fs.writeFileSync(testMappingPath, Buffer.from(mappingContent + ' ', 'utf8')); // 1 byte appended
    expectError(
      () => loadAndValidateMapping({
        mappingFilePath: testMappingPath,
        manifestFilePath: testManifestPath
      }),
      'FATAL_MAPPING_CHECKSUM_MISMATCH: Computed hash does not match manifest.',
      'REG-05: Single-byte tampering caught by detached manifest verification'
    );

    // REG-06: Cross-Tenant CenterGroup Collision
    const cgConflictConfig = createValidBaseConfig();
    cgConflictConfig.institutions[0].matchCriteria.centerGroupIds!.push('grp_cross_conflict');
    cgConflictConfig.institutions[1].matchCriteria.centerGroupIds!.push('grp_cross_conflict');
    expectError(
      () => validateMappingConfig(cgConflictConfig),
      "FATAL_CONFLICTING_TENANT_ASSIGNMENTS: Entity 'grp_cross_conflict' is declared in multiple institutions",
      'REG-06: Cross-Tenant CenterGroup Collision rejected'
    );

    // REG-07: Cross-Tenant Course Collision
    const crsConflictConfig = createValidBaseConfig();
    crsConflictConfig.institutions[0].matchCriteria.courseIds!.push('crs_cross_conflict');
    crsConflictConfig.institutions[1].matchCriteria.courseIds!.push('crs_cross_conflict');
    expectError(
      () => validateMappingConfig(crsConflictConfig),
      "FATAL_CONFLICTING_TENANT_ASSIGNMENTS: Entity 'crs_cross_conflict' is declared in multiple institutions",
      'REG-07: Cross-Tenant Course Collision rejected'
    );

    // REG-08: Online Branch Cross-Tenant Collision
    const onlineBranchConflict = createValidBaseConfig();
    onlineBranchConflict.institutions[0].onlineBranchId = 'br_shared_online';
    onlineBranchConflict.institutions[1].defaultBranchId = 'br_shared_online';
    expectError(
      () => validateMappingConfig(onlineBranchConflict),
      "FATAL_DUPLICATE_BRANCH_ID: Branch 'br_shared_online' claimed by multiple institutions",
      'REG-08: Online branch colliding with another default branch rejected'
    );

    // REG-09: No First-Match-Wins (Inverted Index Guarantee)
    const indexTestConfig = createValidBaseConfig();
    const indexResult = validateMappingConfig(indexTestConfig);
    const student1Target = indexResult.entityToInstitutionMap.get('usr_alpha_1');
    const student2Target = indexResult.entityToInstitutionMap.get('usr_beta_1');
    assert(student1Target?.institutionCode === 'ALPHA_EDU', 'REG-09: Entity usr_alpha_1 unambiguously resolves to ALPHA_EDU');
    assert(student2Target?.institutionCode === 'BETA_EDU', 'REG-09: Entity usr_beta_1 unambiguously resolves to BETA_EDU');
    assert(indexResult.entityToInstitutionMap.get('non_existent') === undefined, 'REG-09: Non-existent entity returns undefined (no silent fallback)');

    // REG-10: Fail-Closed When No Mapping Options Provided
    expectError(
      () => loadAndValidateMapping({}),
      'FATAL_MISSING_TENANT_MAPPING: Backfill execution rejected. No authoritative institution mapping supplied',
      'REG-10: Fail-closed when no mapping configuration is provided'
    );

    // REG-11: Missing Dataset ID Rejection
    const missingDatasetConfig = createValidBaseConfig() as any;
    delete missingDatasetConfig.datasetId;
    expectError(
      () => validateMappingConfig(missingDatasetConfig),
      "FATAL_INVALID_TENANT_MAPPING: Missing required 'datasetId'.",
      'REG-11: Missing datasetId rejected in standard mode'
    );

  } finally {
    // Cleanup temporary test directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log('\n===================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMappingValidatorTests().catch(err => {
  console.error('Fatal test harness error:', err);
  process.exit(1);
});
