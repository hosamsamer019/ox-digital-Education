import fs from 'fs';
import {
  MediaLifecycleService,
  DataPreservationService,
  LessonRecord,
  ProcessedMediaRecord
} from '../../packages/shared/src/tenant/lifecycle.service.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, errorMsg?: string) {
  if (condition) {
    console.log(`[PASS] [UNIT/MOCKED] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] [UNIT/MOCKED] ${testName} -> ${errorMsg || 'Condition failed'}`);
    failed++;
  }
}

async function runLifecycleSafetiesTests() {
  console.log('===================================================================');
  console.log('OX-DIGITAL Task 7.1 — Lifecycle Safeties & Remediation Verification');
  console.log('===================================================================\n');

  // Suite 1: Media Lifecycle & Circular Deletion Deadlock Break
  console.log('--- Suite 1: Media Lifecycle & Circular Deletion Deadlock Break ---');
  
  const lesson: LessonRecord = {
    id: 'lesson-uuid-101',
    courseId: 'course-uuid-001',
    activeMediaId: 'media-active-001'
  };

  const existingMediaList: ProcessedMediaRecord[] = [
    { id: 'media-active-001', lessonId: 'lesson-uuid-101', status: 'ACTIVE' },
    { id: 'media-old-000', lessonId: 'lesson-uuid-101', status: 'SUPERSEDED' }
  ];

  // 1. Safe Media Replacement
  const mediaReplacementPlan = MediaLifecycleService.planMediaReplacement(
    lesson,
    'media-new-002',
    existingMediaList
  );
  assert(mediaReplacementPlan.updatedLesson.activeMediaId === 'media-new-002', 'Updates lesson activeMediaId pointer to new media');
  assert(mediaReplacementPlan.supersededMediaIds.includes('media-active-001'), 'Former active media added to superseded list');
  assert(!mediaReplacementPlan.supersededMediaIds.includes('media-new-002'), 'New media is not in superseded list');

  // 2. Lesson Archival Cycle Breaking
  const lessonArchivalPlan = MediaLifecycleService.planLessonArchival(
    lesson,
    existingMediaList
  );
  assert(lessonArchivalPlan.clearedPointerLesson.activeMediaId === null, 'Step 1 breaks circular FK by setting activeMediaId to NULL');
  assert(lessonArchivalPlan.clearedPointerLesson.deletedAt instanceof Date, 'Step 2 sets deletedAt timestamp on lesson');
  assert(lessonArchivalPlan.retiredMediaIds.length === 2, 'All child media IDs collected for safe retirement');

  // 3. ProcessedMedia Quarantine Evaluation (OD-720)
  console.log('\n--- Suite 2: ProcessedMedia Cold Archival Quarantine (OD-720) ---');
  const orphanMedia = {
    id: 'media-orphan-999',
    lessonId: null,
    institutionId: null
  };
  const orphanEval = MediaLifecycleService.evaluateMediaQuarantine(orphanMedia);
  assert(orphanEval.isQuarantined === true, 'Unlinked media with null lessonId is flagged for quarantine');
  assert(orphanEval.quarantineReason === 'ORPHAN_MEDIA_NULL_LESSON', 'Reason identifies orphan media with null lesson');

  const linkedMedia = {
    id: 'media-linked-111',
    lessonId: 'lesson-uuid-101',
    institutionId: 'inst-001'
  };
  const linkedEval = MediaLifecycleService.evaluateMediaQuarantine(linkedMedia);
  assert(linkedEval.isQuarantined === false, 'Media linked to a valid lesson is not quarantined');

  // Suite 3: Payment Data Preservation (OD-708)
  console.log('\n--- Suite 3: Payment Zero Deletion Invariant (OD-708) ---');
  let deletionBlocked = false;
  try {
    DataPreservationService.assertPaymentDeletionProhibited('payment-uuid-555');
  } catch (e: any) {
    if (e.status === 403 && e.message.includes('Physical deletion of Payment record')) {
      deletionBlocked = true;
    }
  }
  assert(deletionBlocked === true, 'Direct deletion of Payment record is unconditionally prohibited (OD-708)');

  // Suite 4: Remediation C — Database-Level Payment Protection Verification
  console.log('\n--- Suite 4: Remediation C — Database-Level Payment Protection ---');
  const schemaPath = 'D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/schema.prisma';
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const paymentModelMatch = schemaContent.match(/model Payment \{[\s\S]*?\n\}/);
  assert(paymentModelMatch !== null, 'Payment model found in schema.prisma');
  const paymentModel = paymentModelMatch ? paymentModelMatch[0] : '';
  assert(paymentModel.includes('onDelete: Restrict'), 'Payment.userId is configured with onDelete: Restrict in schema.prisma');
  assert(!paymentModel.includes('onDelete: Cascade'), 'Payment.userId does NOT contain onDelete: Cascade');

  // Suite 5: Remediation A — PostgreSQL TEXT Foreign Key Type Compatibility
  console.log('\n--- Suite 5: Remediation A — PostgreSQL TEXT Type Compatibility ---');
  const migrationPath = 'D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/packages/database/prisma/migrations/20261102_task_7_1_institution_branch_foundation/migration.sql';
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');

  // Verify Institution.primaryManagerId is TEXT (matching User.id TEXT)
  assert(!migrationContent.includes('"primaryManagerId" UUID'), 'Institution.primaryManagerId is NOT UUID');
  assert(migrationContent.includes('"primaryManagerId" TEXT'), 'Institution.primaryManagerId is TEXT (compatible with User.id)');
  assert(!migrationContent.includes('"acceptedByUserId" UUID'), 'PrimaryManagerInvitation.acceptedByUserId is NOT UUID');
  assert(migrationContent.includes('"acceptedByUserId" TEXT'), 'PrimaryManagerInvitation.acceptedByUserId is TEXT (compatible with User.id)');

  // Suite 6: Remediation B — Quarantine Table Contract Consistency
  console.log('\n--- Suite 6: Remediation B — Quarantine Contract Consistency ---');
  assert(migrationContent.includes('CREATE TABLE IF NOT EXISTS "_migration_quarantine"'), 'Quarantine table defined in migration SQL');
  assert(migrationContent.includes('"entity_type" VARCHAR(100) NOT NULL'), 'Quarantine table defines entity_type column');
  assert(migrationContent.includes('"entity_id" TEXT NOT NULL'), 'Quarantine table defines entity_id column');
  assert(migrationContent.includes('CONSTRAINT "unq_migration_quarantine_entity" UNIQUE ("entity_type", "entity_id")'), 'Quarantine table defines exact UNIQUE constraint on (entity_type, entity_id)');

  const backfillPath = 'D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/scripts/backfill_task_7_1_tenancy.ts';
  const backfillContent = fs.readFileSync(backfillPath, 'utf8');
  assert(backfillContent.includes('ON CONFLICT ("entity_type", "entity_id") DO NOTHING'), 'Backfill ON CONFLICT target matches quarantine table UNIQUE constraint');

  // Suite 7: Historical Attendance & Course Ownership
  console.log('\n--- Suite 7: Historical Attendance & Course Ownership ---');
  const historicalAttendance = {
    id: 'attendance-rec-001',
    studentId: 'student-uuid-77'
  };
  const attendanceResolution = DataPreservationService.resolveHistoricalAttendanceBranch(historicalAttendance);
  assert(attendanceResolution.historicalBranchId === null, 'historicalBranchId is preserved as NULL');
  assert(attendanceResolution.isUnresolved === true, 'isUnresolved is marked TRUE to prevent false historical provenance');

  const institutionalOwnership = DataPreservationService.resolveCourseInstitutionalOwnership(
    { id: 'course-uuid-404', teacherId: 'teacher-uuid-88' },
    'inst-target-uuid-001',
    null
  );
  assert(institutionalOwnership.institutionId === 'inst-target-uuid-001', 'Course belongs to institution regardless of missing teacher');

  console.log('\n===================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runLifecycleSafetiesTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
