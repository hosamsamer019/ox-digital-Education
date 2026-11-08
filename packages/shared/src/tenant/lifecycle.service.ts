import { HttpError } from '../errorHandler';

export interface ProcessedMediaRecord {
  id: string;
  lessonId?: string | null;
  institutionId?: string | null;
  status: string;
  supersededAt?: Date | null;
}

export interface LessonRecord {
  id: string;
  courseId: string;
  activeMediaId?: string | null;
  deletedAt?: Date | null;
  publishedAt?: Date | null;
}

/**
 * ProcessedMedia & Lesson Lifecycle Service (Gate 1 & Gate 3)
 * Enforces safe operational sequences for bidirectional media relations,
 * avoiding circular foreign-key deletion deadlocks and preventing untracked orphan creation.
 */
export class MediaLifecycleService {
  /**
   * Safe Active Media Replacement Sequence
   * Updates Lesson.activeMediaId to the new media rendition while preserving
   * the container foreign key (ProcessedMedia.lessonId) and retiring the old rendition.
   */
  static planMediaReplacement(
    lesson: LessonRecord,
    newMediaId: string,
    existingMedia: ProcessedMediaRecord[]
  ): {
    updatedLesson: { activeMediaId: string };
    supersededMediaIds: string[];
  } {
    if (!newMediaId) {
      throw new HttpError(400, 'New media ID is required for active replacement');
    }

    const supersededMediaIds: string[] = [];

    // All prior media records associated with this lesson transition to SUPERSEDED
    for (const media of existingMedia) {
      if (media.id !== newMediaId && media.status !== 'SUPERSEDED') {
        supersededMediaIds.push(media.id);
      }
    }

    return {
      updatedLesson: { activeMediaId: newMediaId },
      supersededMediaIds
    };
  }

  /**
   * Safe Lesson Archival / Deletion Sequence (Cycle-Breaking Protocol)
   * Breaks the circular foreign-key dependency between Lesson and ProcessedMedia:
   * 1. Nullifies active pointer (Lesson.activeMediaId := NULL)
   * 2. Retires child media records (status := 'SUPERSEDED')
   * 3. Soft-deactivates lesson (Lesson.deletedAt := NOW())
   */
  static planLessonArchival(
    lesson: LessonRecord,
    childMedia: ProcessedMediaRecord[]
  ): {
    clearedPointerLesson: { activeMediaId: null; deletedAt: Date };
    retiredMediaIds: string[];
  } {
    const retiredMediaIds = childMedia.map(m => m.id);

    return {
      clearedPointerLesson: {
        activeMediaId: null,
        deletedAt: new Date()
      },
      retiredMediaIds
    };
  }

  /**
   * Evaluates historical ProcessedMedia records for quarantine under OD-720.
   * If lessonId is NULL, tenant ownership cannot be proven from schema foreign keys.
   * Mandates quarantine under OD-720 Indefinite Cold Archival without synthetic assignment.
   */
  static evaluateMediaQuarantine(media: { id: string; lessonId?: string | null; institutionId?: string | null }): {
    isQuarantined: boolean;
    quarantineReason?: string;
  } {
    if (!media.lessonId && !media.institutionId) {
      return {
        isQuarantined: true,
        quarantineReason: 'ORPHAN_MEDIA_NULL_LESSON'
      };
    }

    return { isQuarantined: false };
  }
}

/**
 * Data Preservation Invariants Service (OD-708 & Academic Preservation)
 */
export class DataPreservationService {
  /**
   * Enforces OD-708 Payment Deletion Protection Invariant.
   * Prohibits physical deletion of legal financial records under all conditions.
   */
  static assertPaymentDeletionProhibited(paymentId: string): never {
    throw new HttpError(
      403,
      `FATAL_INVARIANT_BREACH (OD-708): Physical deletion of Payment record ${paymentId} is strictly prohibited.`
    );
  }

  /**
   * Evaluates historical Attendance records for branch attribution.
   * Because the existing Attendance schema lacks centerGroupId or branch columns,
   * historical attendance branch cannot be reliably proven from current student group.
   * Explicitly assigns NULL / UNRESOLVED rather than inventing false provenance.
   */
  static resolveHistoricalAttendanceBranch(attendance: { id: string; studentId: string }): {
    historicalBranchId: null;
    isUnresolved: true;
    provenanceNote: string;
  } {
    return {
      historicalBranchId: null,
      isUnresolved: true,
      provenanceNote: 'Attendance record preserved. Historical branch unprovable from legacy schema without session capture.'
    };
  }

  /**
   * Evaluates Course ownership independent of mutable teacher association.
   * A Course is an institutional curriculum asset belonging directly to the migrated Institution.
   */
  static resolveCourseInstitutionalOwnership(
    course: { id: string; teacherId?: string | null },
    targetInstitutionId: string,
    teacher?: { id: string; institutionId?: string | null } | null
  ): {
    institutionId: string;
    requiresTeacherReview: boolean;
    note?: string;
  } {
    if (!targetInstitutionId) {
      throw new HttpError(400, 'Target institution ID is required');
    }

    let requiresTeacherReview = false;
    let note: string | undefined;

    if (!course.teacherId || !teacher) {
      requiresTeacherReview = true;
      note = 'Course assigned to institution; teacher is unassigned or deleted';
    } else if (teacher.institutionId && teacher.institutionId !== targetInstitutionId) {
      requiresTeacherReview = true;
      note = `Course assigned to institution ${targetInstitutionId}; teacher belongs to different institution ${teacher.institutionId}`;
    }

    return {
      institutionId: targetInstitutionId,
      requiresTeacherReview,
      note
    };
  }
}

