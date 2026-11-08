/**
 * OX-DIGITAL Education — Financial Core Engine
 * Phase 2.0B — Physical Education Center Accounting Integration
 * Lifecycle A: Academic Attendance & Lesson Delivery Evidence
 */

import {
  InvalidEvidenceError,
  PrematurePostingError,
  CrossInstitutionError
} from '../errors.js';
import { assertApprovedRole, assertNotSaaSSuperAdmin, CenterRole } from './roles.js';

export type AttendanceProofStatus = 'PRESENT' | 'EXCUSED' | 'ABSENT';

export interface StudentAttendanceProof {
  studentId: string;
  status: AttendanceProofStatus;
  checkInTime?: Date;
  verifiedByTeacher: boolean;
}

export type DeliveryEvidenceStatus =
  | 'DELIVERED_PENDING_VERIFICATION'
  | 'CERTIFIED'
  | 'SUPERSEDED'
  | 'REJECTED';

export interface LessonDeliveryEvidenceProps {
  evidenceId: string;
  institutionId: string;
  branchId: string;
  isPhysicalBranch: boolean;
  centerGroupId: string;
  lessonId: string;
  courseId: string;
  teacherId: string;
  scheduledAt: Date;
  deliveredAt: Date;
  attendedStudents: StudentAttendanceProof[];
  status?: DeliveryEvidenceStatus;
  certifiedByUserId?: string;
  certifiedAt?: Date;
  notes?: string;
}

/**
 * LessonDeliveryEvidence represents the supervisor-certified proof that an
 * educational lesson was actually conducted in a physical center.
 *
 * Core Guarantees:
 * 1. Pure academic delivery evidence.
 * 2. Creation or certification does NOT post journal entries or recognize revenue.
 * 3. Physical campus verification: must belong to a physical branch (isPhysicalBranch: true).
 * 4. Certifier must have the 'PRIMARY_MANAGER' role (or authorized supervisor) and cannot be admin@edu.com.
 */
export class LessonDeliveryEvidence {
  public readonly evidenceId: string;
  public readonly institutionId: string;
  public readonly branchId: string;
  public readonly isPhysicalBranch: boolean;
  public readonly centerGroupId: string;
  public readonly lessonId: string;
  public readonly courseId: string;
  public readonly teacherId: string;
  public readonly scheduledAt: Date;
  public readonly deliveredAt: Date;
  public readonly attendedStudents: ReadonlyArray<StudentAttendanceProof>;
  public readonly status: DeliveryEvidenceStatus;
  public readonly certifiedByUserId?: string;
  public readonly certifiedAt?: Date;
  public readonly notes?: string;

  constructor(props: LessonDeliveryEvidenceProps) {
    if (!props.evidenceId) throw new InvalidEvidenceError('evidenceId is required.');
    if (!props.institutionId) throw new InvalidEvidenceError('institutionId is required.');
    if (!props.branchId) throw new InvalidEvidenceError('branchId is required.');
    if (!props.isPhysicalBranch) {
      throw new InvalidEvidenceError(
        `Physical Center Invariant: Lesson delivery evidence can only be created for physical campus branches. Branch '${props.branchId}' is marked as non-physical.`
      );
    }
    if (!props.centerGroupId) throw new InvalidEvidenceError('centerGroupId is required.');
    if (!props.lessonId) throw new InvalidEvidenceError('lessonId is required.');
    if (!props.courseId) throw new InvalidEvidenceError('courseId is required.');
    if (!props.teacherId) throw new InvalidEvidenceError('teacherId is required.');
    assertNotSaaSSuperAdmin(props.teacherId, 'Teacher role');

    if (!props.attendedStudents || props.attendedStudents.length === 0) {
      throw new InvalidEvidenceError('Delivery evidence must contain at least one student attendance record.');
    }

    this.evidenceId = props.evidenceId;
    this.institutionId = props.institutionId;
    this.branchId = props.branchId;
    this.isPhysicalBranch = props.isPhysicalBranch;
    this.centerGroupId = props.centerGroupId;
    this.lessonId = props.lessonId;
    this.courseId = props.courseId;
    this.teacherId = props.teacherId;
    this.scheduledAt = new Date(props.scheduledAt);
    this.deliveredAt = new Date(props.deliveredAt);
    this.attendedStudents = Object.freeze([...props.attendedStudents]);
    this.status = props.status || 'DELIVERED_PENDING_VERIFICATION';
    this.certifiedByUserId = props.certifiedByUserId;
    this.certifiedAt = props.certifiedAt ? new Date(props.certifiedAt) : undefined;
    this.notes = props.notes;

    Object.freeze(this);
  }

  /**
   * Certifies the delivery evidence by a Primary Manager.
   * Does NOT recognize revenue or post ledger entries.
   */
  public certify(certifierUserId: string, certifierRole: CenterRole, certifiedAt: Date = new Date()): LessonDeliveryEvidence {
    assertNotSaaSSuperAdmin(certifierUserId, 'Primary Manager certification');
    const validRole = assertApprovedRole(certifierRole);

    if (validRole !== 'PRIMARY_MANAGER') {
      throw new InvalidEvidenceError(
        `Certification authority rejected: Only a Primary Manager can certify physical center lesson delivery evidence. Provided role: '${certifierRole}'.`
      );
    }

    if (this.status === 'CERTIFIED') {
      return this; // Idempotent
    }

    if (this.status === 'REJECTED' || this.status === 'SUPERSEDED') {
      throw new InvalidEvidenceError(`Cannot certify delivery evidence in '${this.status}' state.`);
    }

    return new LessonDeliveryEvidence({
      evidenceId: this.evidenceId,
      institutionId: this.institutionId,
      branchId: this.branchId,
      isPhysicalBranch: this.isPhysicalBranch,
      centerGroupId: this.centerGroupId,
      lessonId: this.lessonId,
      courseId: this.courseId,
      teacherId: this.teacherId,
      scheduledAt: this.scheduledAt,
      deliveredAt: this.deliveredAt,
      attendedStudents: [...this.attendedStudents],
      status: 'CERTIFIED',
      certifiedByUserId: certifierUserId,
      certifiedAt,
      notes: this.notes
    });
  }

  /**
   * Invariant Guard: Confirms that delivery evidence alone CANNOT trigger general ledger posting.
   */
  public postToGeneralLedger(): never {
    throw new PrematurePostingError(
      'Lifecycle A (Academic Delivery Evidence)',
      'Direct General Ledger Posting'
    );
  }

  public getAttendedStudentCount(): number {
    return this.attendedStudents.filter((s) => s.status === 'PRESENT').length;
  }

  public isStudentAttended(studentId: string): boolean {
    return this.attendedStudents.some((s) => s.studentId === studentId && s.status === 'PRESENT');
  }
}

