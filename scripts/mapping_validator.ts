/**
 * OX-DIGITAL Education — Task 7.1 Staging Foundation
 * Authoritative Tenancy Mapping Validator & Integrity Engine
 *
 * Implements GAP-01, GAP-02, GAP-03, and GAP-04 remediation:
 * - GAP-01: Manifest identity & envelope validation (formatVersion ^1.0.0, datasetId)
 * - GAP-02: Cryptographic detached SHA-256 manifest integrity verification
 * - GAP-03: Global identity collision detection & disjointness engine
 * - GAP-04: Cross-institution branch identity uniqueness validation
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import semver from 'semver';

export interface MatchCriteria {
  teacherIds?: string[];
  centerGroupIds?: string[];
  userIds?: string[];
  courseIds?: string[];
}

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
  matchCriteria: MatchCriteria;
}

export interface BackfillMappingConfig {
  $schema?: string;
  formatVersion?: string;
  datasetId?: string;
  generatorVersion?: string;
  sha256Fingerprint?: string;
  approvedBy: string;
  approvedAt: string;
  institutions: InstitutionMappingRule[];
}

export interface DetachedManifest {
  mappingFilename: string;
  sha256: string;
  fileSizeBytes?: number;
  generatedAt?: string;
  approvedBy?: string;
}

export interface PreflightRelationalData {
  courseEnrollments?: {
    courseId: string;
    studentId: string;
  }[];
  superAdminEmails?: string[];
}

export interface ValidationOptions {
  allowLegacyDev?: boolean;
  requireManifest?: boolean;
  manifestFilePath?: string;
  preflightData?: PreflightRelationalData;
}

export interface ValidatedMappingConfig extends BackfillMappingConfig {
  entityToInstitutionMap: Map<string, {
    institutionId: string;
    institutionCode: string;
    defaultBranchId: string;
  }>;
  branchToInstitutionMap: Map<string, string>;
  checksum: string;
}

export interface ValidatedMappingResult {
  config: ValidatedMappingConfig;
  entityToInstitutionMap: Map<string, {
    institutionId: string;
    institutionCode: string;
    defaultBranchId: string;
  }>;
  branchToInstitutionMap: Map<string, string>;
  checksum: string;
}

export interface BackfillOptions {
  dryRun?: boolean;
  mappingConfig?: BackfillMappingConfig;
  mappingFilePath?: string;
  manifestFilePath?: string;
  requireManifest?: boolean;
  legacyDevMode?: boolean;
  strictEnvelopeValidation?: boolean;
  preflightData?: PreflightRelationalData;
}

/**
 * GAP-02: Verifies detached SHA-256 manifest before parsing untrusted mapping content.
 * Fails closed on missing, malformed, or mismatched checksums.
 */
export function verifyDetachedManifest(
  rawBytes: Buffer,
  manifestOrPath: string | DetachedManifest
): { verified: boolean; computedHash: string } {
  let manifest: DetachedManifest;

  if (typeof manifestOrPath === 'string') {
    if (!fs.existsSync(manifestOrPath)) {
      throw new Error(`FATAL_MISSING_MANIFEST: Checksum manifest not found for mapping file at ${manifestOrPath}`);
    }
    const rawManifest = fs.readFileSync(manifestOrPath, 'utf8');
    try {
      manifest = JSON.parse(rawManifest);
    } catch (e: any) {
      throw new Error(`FATAL_INVALID_MANIFEST: Manifest file is malformed JSON: ${e.message}`);
    }
  } else {
    manifest = manifestOrPath;
  }

  if (!manifest || typeof manifest.sha256 !== 'string' || manifest.sha256.trim() === '') {
    throw new Error('FATAL_INVALID_MANIFEST: Manifest missing required sha256 checksum.');
  }

  const computedHash = crypto.createHash('sha256').update(rawBytes).digest('hex');

  if (computedHash.toLowerCase() !== manifest.sha256.trim().toLowerCase()) {
    throw new Error('FATAL_MAPPING_CHECKSUM_MISMATCH: Computed hash does not match manifest.');
  }

  return { verified: true, computedHash };
}

/**
 * Validates a mapping configuration against GAP-01, GAP-03, and GAP-04 rules.
 */
export function validateMappingConfig(
  config: any,
  options: ValidationOptions = {}
): ValidatedMappingResult {
  // -------------------------------------------------------------
  // GAP-01: Manifest Identity & Envelope Validation
  // -------------------------------------------------------------
  if (!config || typeof config !== 'object') {
    throw new Error('FATAL_INVALID_TENANT_MAPPING: Configuration must be a valid object.');
  }

  // formatVersion
  if (!config.formatVersion) {
    if (options.allowLegacyDev) {
      console.warn('[WARN] Legacy mapping format detected without formatVersion. Assuming formatVersion 1.0.0.');
    } else {
      throw new Error("FATAL_UNSUPPORTED_MAPPING_VERSION: Missing required 'formatVersion'. Expected '^1.0.0'.");
    }
  } else {
    if (typeof config.formatVersion !== 'string' || !semver.satisfies(config.formatVersion, '^1.0.0')) {
      throw new Error(`FATAL_UNSUPPORTED_MAPPING_VERSION: Incompatible version '${config.formatVersion}'. Expected '^1.0.0'.`);
    }
  }

  // datasetId
  if (!options.allowLegacyDev) {
    if (!config.datasetId || typeof config.datasetId !== 'string' || config.datasetId.trim() === '') {
      throw new Error("FATAL_INVALID_TENANT_MAPPING: Missing required 'datasetId'.");
    }
  }

  // approvedBy & approvedAt
  if (!config.approvedBy || typeof config.approvedBy !== 'string' || config.approvedBy.trim() === '') {
    throw new Error("FATAL_INVALID_TENANT_MAPPING: Missing required 'approvedBy'.");
  }
  if (!config.approvedAt || isNaN(Date.parse(config.approvedAt))) {
    throw new Error("FATAL_INVALID_TENANT_MAPPING: Missing or invalid 'approvedAt' timestamp.");
  }

  // institutions array validation
  if (!Array.isArray(config.institutions) || config.institutions.length === 0) {
    throw new Error('FATAL_INVALID_TENANT_MAPPING: Configuration must specify at least one verified institution mapping.');
  }

  // -------------------------------------------------------------
  // GAP-04: Cross-Institution Branch Uniqueness Validation
  // -------------------------------------------------------------
  const branchToInstitutionMap = new Map<string, string>();

  for (const inst of config.institutions) {
    const instCode = inst.targetInstitutionCode || inst.targetInstitutionId || 'UNKNOWN';

    if (!inst.targetInstitutionId || !inst.targetInstitutionCode) {
      throw new Error(`FATAL_INVALID_TENANT_MAPPING: Incomplete institution specification for code: ${instCode}.`);
    }
    if (!inst.defaultBranchId || typeof inst.defaultBranchId !== 'string' || inst.defaultBranchId.trim() === '') {
      throw new Error(`FATAL_INVALID_TENANT_MAPPING: Incomplete institution specification for code: ${instCode}. Missing defaultBranchId.`);
    }

    const branchesToCheck: { id: string; name: string }[] = [
      { id: inst.defaultBranchId, name: 'defaultBranchId' }
    ];
    if (inst.onlineBranchId) {
      branchesToCheck.push({ id: inst.onlineBranchId, name: 'onlineBranchId' });
    }

    for (const b of branchesToCheck) {
      if (branchToInstitutionMap.has(b.id)) {
        const existingInst = branchToInstitutionMap.get(b.id)!;
        if (existingInst !== instCode) {
          throw new Error(`FATAL_DUPLICATE_BRANCH_ID: Branch '${b.id}' claimed by multiple institutions ('${existingInst}' and '${instCode}').`);
        }
      }
      branchToInstitutionMap.set(b.id, instCode);
    }
  }

  // -------------------------------------------------------------
  // GAP-03: Global Identity Collision Detection & Disjointness Engine
  // -------------------------------------------------------------
  const entityToInstitutionMap = new Map<string, {
    institutionId: string;
    institutionCode: string;
    defaultBranchId: string;
  }>();

  const globalEntityAssignments = new Map<string, string[]>();
  const superAdminEmails = new Set(
    (options.preflightData?.superAdminEmails || ['admin@edu.com']).map(e => e.toLowerCase())
  );

  for (const inst of config.institutions) {
    const instCode = inst.targetInstitutionCode;
    const match = inst.matchCriteria || {};

    const entityBuckets: { role: string; ids: string[] | undefined }[] = [
      { role: 'userIds', ids: match.userIds },
      { role: 'teacherIds', ids: match.teacherIds },
      { role: 'centerGroupIds', ids: match.centerGroupIds },
      { role: 'courseIds', ids: match.courseIds }
    ];

    // Intra-institution duplicate check
    const intraInstSeen = new Set<string>();

    for (const bucket of entityBuckets) {
      if (!bucket.ids || !Array.isArray(bucket.ids)) continue;

      for (const id of bucket.ids) {
        if (!id || typeof id !== 'string') continue;

        // NEG-10: Super-admin tenancy protection
        if (superAdminEmails.has(id.toLowerCase()) || id.toLowerCase() === 'admin@edu.com') {
          throw new Error('FATAL_SUPERADMIN_TENANCY_VIOLATION: admin@edu.com cannot be assigned institutional tenancy.');
        }

        // NEG-07: Intra-institution duplicate check
        if (intraInstSeen.has(id)) {
          throw new Error(`FATAL_DUPLICATE_SOURCE_ID: Duplicate entity '${id}' detected within institution '${instCode}'.`);
        }
        intraInstSeen.add(id);

        // Global cross-institution collision check
        if (!globalEntityAssignments.has(id)) {
          globalEntityAssignments.set(id, [instCode]);
        } else {
          const list = globalEntityAssignments.get(id)!;
          if (!list.includes(instCode)) {
            list.push(instCode);
            // NEG-05 / NEG-06: Conflicting tenant assignments
            throw new Error(`FATAL_CONFLICTING_TENANT_ASSIGNMENTS: Entity '${id}' is declared in multiple institutions: [${list.join(', ')}].`);
          }
        }

        entityToInstitutionMap.set(id, {
          institutionId: inst.targetInstitutionId,
          institutionCode: inst.targetInstitutionCode,
          defaultBranchId: inst.defaultBranchId
        });
      }
    }
  }

  // -------------------------------------------------------------
  // NEG-09: Preflight Cross-Tenant Referential Integrity Audit
  // -------------------------------------------------------------
  if (options.preflightData?.courseEnrollments) {
    for (const enrollment of options.preflightData.courseEnrollments) {
      const courseOwner = entityToInstitutionMap.get(enrollment.courseId);
      const studentOwner = entityToInstitutionMap.get(enrollment.studentId);

      if (courseOwner && studentOwner && courseOwner.institutionId !== studentOwner.institutionId) {
        throw new Error(
          `FATAL_CROSS_TENANT_RELATION: Course '${enrollment.courseId}' (${courseOwner.institutionCode}) cannot enroll student '${enrollment.studentId}' (${studentOwner.institutionCode}).`
        );
      }
    }
  }

  const validatedConfig: ValidatedMappingConfig = Object.assign(config, {
    entityToInstitutionMap,
    branchToInstitutionMap,
    checksum: config.sha256Fingerprint || ''
  });

  return {
    config: validatedConfig,
    entityToInstitutionMap,
    branchToInstitutionMap,
    checksum: config.sha256Fingerprint || ''
  };
}

/**
 * Loads, verifies detached manifest (if file-based), and validates mapping configuration.
 * Fails closed if required parameters are missing.
 */
export function loadAndValidateMapping(options: BackfillOptions): ValidatedMappingConfig {
  if (options.mappingConfig) {
    const allowLegacy = options.legacyDevMode ?? (options.strictEnvelopeValidation === false && !options.mappingConfig.formatVersion);
    const res = validateMappingConfig(options.mappingConfig, {
      allowLegacyDev: allowLegacy,
      preflightData: options.preflightData
    });
    return res.config;
  }

  if (options.mappingFilePath) {
    if (!fs.existsSync(options.mappingFilePath)) {
      throw new Error(`FATAL_MISSING_TENANT_MAPPING: Mapping file not found at ${options.mappingFilePath}`);
    }

    const rawBytes = fs.readFileSync(options.mappingFilePath);

    // GAP-02: Detached Manifest Verification
    const manifestPath = options.manifestFilePath ||
      (fs.existsSync(`${options.mappingFilePath}.manifest.json`)
        ? `${options.mappingFilePath}.manifest.json`
        : path.join(path.dirname(options.mappingFilePath), 'mapping.manifest.json'));

    if (options.requireManifest !== false) {
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`FATAL_MISSING_MANIFEST: Checksum manifest not found for mapping file at ${manifestPath}`);
      }
      verifyDetachedManifest(rawBytes, manifestPath);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawBytes.toString('utf8'));
    } catch (e: any) {
      throw new Error(`FATAL_INVALID_TENANT_MAPPING: Failed to parse mapping JSON: ${e.message}`);
    }

    const res = validateMappingConfig(parsed, {
      allowLegacyDev: options.legacyDevMode ?? false,
      preflightData: options.preflightData
    });
    return res.config;
  }

  throw new Error(
    'FATAL_MISSING_TENANT_MAPPING: Backfill execution rejected. No authoritative institution mapping supplied (Remediation G). ' +
    'The backfill cannot invent synthetic institutions or blanket-assign unproven ownership.'
  );
}
