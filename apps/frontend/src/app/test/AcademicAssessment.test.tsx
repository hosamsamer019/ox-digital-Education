import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResultsPageCenter from '../components/student-center/ResultsPage';
import ResultsPageOnline from '../components/student-online/ResultsPage';
import { analyticsService } from '../services/analytics.service';
import { ThemeProvider } from '../contexts/ThemeContext';

// Import pure calculator functions and types
import {
  calculateAcademicAssessment,
  AcademicAssessmentResult
} from '../../../../../services/analytics-service/src/services/academicAssessment.calculator';

vi.mock('../services/analytics.service', () => ({
  analyticsService: {
    getStudentOverview: vi.fn(),
    getStudentCharts: vi.fn(),
    getStudentRecent: vi.fn(),
    getAcademicAssessment: vi.fn()
  }
}));

describe('Phase 6.2B.2.2 — Academic Assessment Source Code Integrity Remediation Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. OD-01: MATHEMATICAL ARITHMETIC MEAN & EQUAL WEIGHTING ───────
  describe('OD-01: Simple Arithmetic Mean (Equal Weighting)', () => {
    it('1. calculates exact arithmetic mean for three eligible unique assessments', () => {
      const attempts = [
        { assessmentId: 'a1', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' },
        { assessmentId: 'a2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED' },
        { assessmentId: 'a3', score: 70, totalPoints: 100, percentage: 70, status: 'GRADED' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('AVAILABLE');
      expect(result.average).toBe(80.0);
      expect(result.eligibleAssessmentCount).toBe(3);
      expect(result.retakeConflict).toBe(false);
      expect(result.periodStatus).toBe('UNSPECIFIED');
      expect(result.assessmentPeriod).toBeNull();
      expect(result.classification).toBeNull();
    });

    it('2. enforces equal weighting regardless of assessment type or maximum points', () => {
      const attempts = [
        { assessmentId: 'quiz-1', score: 10, totalPoints: 10, percentage: 100, status: 'GRADED' }, // 100%
        { assessmentId: 'exam-1', score: 25, totalPoints: 50, percentage: 50, status: 'GRADED' },   // 50%
        { assessmentId: 'exam-2', score: 60, totalPoints: 100, percentage: 60, status: 'GRADED' }  // 60%
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('AVAILABLE');
      expect(result.average).toBe(70.0); // (100 + 50 + 60) / 3 = 70.0
    });

    it('3. rounds average safely to exactly one decimal place', () => {
      const attempts = [
        { assessmentId: 'a1', score: 82.5, totalPoints: 100, percentage: 82.5, status: 'GRADED' },
        { assessmentId: 'a2', score: 88.3, totalPoints: 100, percentage: 88.3, status: 'GRADED' },
        { assessmentId: 'a3', score: 91.7, totalPoints: 100, percentage: 91.7, status: 'GRADED' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('AVAILABLE');
      expect(result.average).toBe(87.5);
    });
  });

  // ─── 2. REMEDIATION A: ACADEMIC PERIOD SPOOFING NEUTRALIZATION ─────
  describe('Remediation A: Academic Period Neutralization (OD-12 Unapproved)', () => {
    const validAttempts = [
      { assessmentId: 'a1', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' },
      { assessmentId: 'a2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED' },
      { assessmentId: 'a3', score: 70, totalPoints: 100, percentage: 70, status: 'GRADED' }
    ];

    it('4. strictly enforces periodStatus: UNSPECIFIED and assessmentPeriod: null when no period is supplied', () => {
      const result = calculateAcademicAssessment(validAttempts);
      expect(result.periodStatus).toBe('UNSPECIFIED');
      expect(result.assessmentPeriod).toBeNull();
      expect(result.explanationAr).toContain('فترة غير محددة');
    });

    it('5. prevents arbitrary term query parameter from establishing an approved period', () => {
      const result = calculateAcademicAssessment(validAttempts, { assessmentPeriod: 'Fall2026' });
      expect(result.periodStatus).toBe('UNSPECIFIED');
      expect(result.assessmentPeriod).toBeNull();
      expect(result.explanationAr).toContain('فترة غير محددة');
    });

    it('6. prevents arbitrary startDate and endDate from establishing an approved period', () => {
      const result = calculateAcademicAssessment(validAttempts, {
        startDate: '2026-09-01',
        endDate: '2026-12-31'
      });
      expect(result.periodStatus).toBe('UNSPECIFIED');
      expect(result.assessmentPeriod).toBeNull();
    });

    it('7. strictly enforces UNSPECIFIED when all period parameters are provided together', () => {
      const result = calculateAcademicAssessment(validAttempts, {
        assessmentPeriod: 'Term 1 2026/2027',
        startDate: '2026-09-01',
        endDate: '2026-12-31'
      });
      expect(result.periodStatus).toBe('UNSPECIFIED');
      expect(result.assessmentPeriod).toBeNull();
    });

    it('8. safely handles empty strings or malformed date inputs in options', () => {
      const result = calculateAcademicAssessment(validAttempts, {
        assessmentPeriod: '',
        startDate: 'invalid-date-string',
        endDate: ''
      });
      expect(result.periodStatus).toBe('UNSPECIFIED');
      expect(result.assessmentPeriod).toBeNull();
      expect(result.status).toBe('AVAILABLE');
    });
  });

  // ─── 3. REMEDIATION B: UNVERIFIABLE EVIDENCE DISCLOSURE ─────────────
  describe('Remediation B: Unverifiable Evidence Disclosure', () => {
    it('9. discloses unverifiable attempts when valid evidence is below threshold (INSUFFICIENT_DATA)', () => {
      const attempts = [
        { assessmentId: 'a1', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' },
        { assessmentId: 'a2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED' },
        { examId: 'legacy-exam', score: 50 } // Unverifiable: missing totalPoints in schema
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.average).toBeNull();
      expect(result.eligibleAssessmentCount).toBe(2);
      expect(result.minimumRequired).toBe(3);
      expect(result.unverifiableAttemptsCount).toBe(1);
      expect(result.hasUnverifiableAttempts).toBe(true);
      expect(result.dataIntegrityNoticeAr).toContain('توجد محاولات سابقة تعذر التحقق من اكتمالها أو درجاتها');
    });

    it('10. discloses unverifiable attempts when valid evidence meets threshold (AVAILABLE)', () => {
      const attempts = [
        { assessmentId: 'a1', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' },
        { assessmentId: 'a2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED' },
        { assessmentId: 'a3', score: 70, totalPoints: 100, percentage: 70, status: 'GRADED' },
        { examId: 'legacy-exam', score: 40 } // Unverifiable: missing totalPoints
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('AVAILABLE');
      expect(result.average).toBe(80.0);
      expect(result.eligibleAssessmentCount).toBe(3); // Only the 3 valid are counted
      expect(result.unverifiableAttemptsCount).toBe(1);
      expect(result.hasUnverifiableAttempts).toBe(true);
      expect(result.dataIntegrityNoticeAr).toContain('لا تدخل في حساب المتوسط الأكاديمي');
    });

    it('11. returns BLOCKED_UNVERIFIABLE_COMPLETION when all attempts are unverifiable', () => {
      const attempts = [
        { examId: 'legacy-1', score: 50 },
        { examId: 'legacy-2', score: 60 }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('BLOCKED_UNVERIFIABLE_COMPLETION');
      expect(result.average).toBeNull();
      expect(result.unverifiableAttemptsCount).toBe(2);
      expect(result.hasUnverifiableAttempts).toBe(true);
      expect(result.explanationAr).toContain('سجلات الاختبارات');
    });

    it('12. does not show unverifiable notice when unverifiable count is zero', () => {
      const attempts = [
        { assessmentId: 'a1', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.unverifiableAttemptsCount).toBe(0);
      expect(result.hasUnverifiableAttempts).toBe(false);
      expect(result.dataIntegrityNotice).toBeNull();
      expect(result.dataIntegrityNoticeAr).toBeNull();
    });
  });

  // ─── 4. REMEDIATION C: EXAM ATTEMPT SUBMISSION TEST INTEGRITY ───────
  describe('Remediation C: ExamAttempt Submission Lifecycle & Non-Assumption', () => {
    it('13. excludes started exam with score: 0 and answers: null (abandoned exam)', () => {
      const attempts = [
        { examId: 'exam-1', score: 0, answers: null, createdAt: new Date() }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.eligibleAssessmentCount).toBe(0);
      expect(result.average).toBeNull();
    });

    it('14. excludes abandoned exam even when score is positive if answers are null', () => {
      const attempts = [
        { examId: 'exam-1', score: 10, answers: null, totalPoints: 100 }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.eligibleAssessmentCount).toBe(0);
    });

    it('15. treats legacy exam with autosaved answers as unverifiable without submission proof', () => {
      // In PostgreSQL, autosave updates answers to [] or [...] before submission.
      // Legacy ExamAttempt records lack totalPoints and submittedAt.
      const attempts = [
        { examId: 'exam-legacy', score: 0, answers: [] } // autosaved empty answers
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('BLOCKED_UNVERIFIABLE_COMPLETION');
      expect(result.unverifiableAttemptsCount).toBe(1);
      expect(result.eligibleAssessmentCount).toBe(0);
    });

    it('16. treats legacy ExamAttempt with missing maximum marks as unverifiable (never defaults to 100)', () => {
      const attempts = [
        { examId: 'exam-legacy', score: 45, answers: [{ q: 1, a: 'b' }] } // missing totalPoints
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('BLOCKED_UNVERIFIABLE_COMPLETION');
      expect(result.unverifiableAttemptsCount).toBe(1);
    });
  });

  // ─── 5. REMEDIATION D: RETAKE NEUTRALIZATION & PRECEDENCE ───────────
  describe('Remediation D: Retake Neutralization & Evidence Precedence', () => {
    it('17. selects chronologically latest eligible graded attempt per OD-11 approved policy', () => {
      const attempts = [
        { id: 'att-1', assessmentId: 'exam-101', score: 60, totalPoints: 100, percentage: 60, status: 'GRADED', createdAt: '2026-10-01T10:00:00Z' },
        { id: 'att-2', assessmentId: 'exam-101', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED', createdAt: '2026-10-15T10:00:00Z' }, // Latest attempt: 90%
        { id: 'att-3', assessmentId: 'exam-102', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED', createdAt: '2026-10-05T10:00:00Z' },
        { id: 'att-4', assessmentId: 'exam-103', score: 85, totalPoints: 100, percentage: 85, status: 'GRADED', createdAt: '2026-10-10T10:00:00Z' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('AVAILABLE');
      expect(result.retakeConflict).toBe(false);
      expect(result.eligibleAssessmentCount).toBe(3);
      // Average uses latest attempt: (90 + 80 + 85) / 3 = 85.0
      expect(result.average).toBe(85.0);
      const exam101Selected = result.eligibleAssessments.find(a => a.assessmentId === 'exam-101');
      expect(exam101Selected?.id).toBe('att-2');
      expect(exam101Selected?.percentage).toBe(90);
    });

    it('17b. tie-breaks identically timestamped retakes using stable ID descending (OD-11)', () => {
      const attempts = [
        { id: 'att-first', assessmentId: 'exam-101', score: 70, totalPoints: 100, percentage: 70, status: 'GRADED', createdAt: '2026-10-01T10:00:00Z' },
        { id: 'att-second', assessmentId: 'exam-101', score: 95, totalPoints: 100, percentage: 95, status: 'GRADED', createdAt: '2026-10-01T10:00:00Z' }, // Same time, 'att-second' > 'att-first'
        { id: 'att-other1', assessmentId: 'exam-102', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED', createdAt: '2026-10-05T10:00:00Z' },
        { id: 'att-other2', assessmentId: 'exam-103', score: 85, totalPoints: 100, percentage: 85, status: 'GRADED', createdAt: '2026-10-10T10:00:00Z' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('AVAILABLE');
      const exam101Selected = result.eligibleAssessments.find(a => a.assessmentId === 'exam-101');
      expect(exam101Selected?.id).toBe('att-second');
      expect(exam101Selected?.percentage).toBe(95);
    });

    it('17c. later non-graded/cheating/abandoned retake NEVER displaces an earlier valid graded attempt (OD-11)', () => {
      const attempts = [
        { id: 'att-valid', assessmentId: 'exam-101', score: 88, totalPoints: 100, percentage: 88, status: 'GRADED', isGraded: true, createdAt: '2026-10-01T10:00:00Z' },
        { id: 'att-cheating', assessmentId: 'exam-101', score: 0, status: 'CHEATING', isGraded: false, cheatingDetected: true, createdAt: '2026-10-20T10:00:00Z' },
        { id: 'att-other1', assessmentId: 'exam-102', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED', createdAt: '2026-10-05T10:00:00Z' },
        { id: 'att-other2', assessmentId: 'exam-103', score: 82, totalPoints: 100, percentage: 82, status: 'GRADED', createdAt: '2026-10-10T10:00:00Z' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('AVAILABLE');
      const exam101Selected = result.eligibleAssessments.find(a => a.assessmentId === 'exam-101');
      expect(exam101Selected?.id).toBe('att-valid');
      expect(exam101Selected?.percentage).toBe(88);
    });

    it('18. does NOT mistake an unfinished in-progress attempt for a completed graded retake', () => {
      const attempts = [
        { assessmentId: 'exam-101', score: 85, totalPoints: 100, percentage: 85, status: 'GRADED' }, // Completed
        { assessmentId: 'exam-101', score: 0, status: 'IN_PROGRESS' }, // In-progress retake attempt
        { assessmentId: 'exam-102', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' },
        { assessmentId: 'exam-103', score: 75, totalPoints: 100, percentage: 75, status: 'GRADED' }
      ];
      const result = calculateAcademicAssessment(attempts);
      // In-progress attempt must be ignored; exam-101 has only 1 graded attempt -> no retake conflict!
      expect(result.retakeConflict).toBe(false);
      expect(result.status).toBe('AVAILABLE');
      expect(result.average).toBe(80.0); // (85 + 80 + 75) / 3
      expect(result.eligibleAssessmentCount).toBe(3);
    });

    it('19. marks attempt with ambiguous assessment identity as unverifiable', () => {
      const attempts = [
        { id: 'att-1', score: 85, totalPoints: 100, percentage: 85, status: 'GRADED' } // missing assessmentId & examId
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('BLOCKED_UNVERIFIABLE_COMPLETION');
      expect(result.unverifiableAttemptsCount).toBe(1);
    });
  });

  // ─── 6. ASSESSMENT ATTEMPT & TIME_EXPIRED SEMANTICS ────────────────
  describe('AssessmentAttempt Status and TIME_EXPIRED Semantics', () => {
    it('20. accepts TIME_EXPIRED when a valid final auto-grade exists', () => {
      const attempts = [
        { assessmentId: 'a1', score: 80, totalPoints: 100, percentage: 80, status: 'TIME_EXPIRED', cheatingDetected: false },
        { assessmentId: 'a2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED', cheatingDetected: false },
        { assessmentId: 'a3', score: 70, totalPoints: 100, percentage: 70, status: 'GRADED', cheatingDetected: false }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('AVAILABLE');
      expect(result.eligibleAssessmentCount).toBe(3);
      expect(result.average).toBe(80.0);
    });

    it('21. excludes TIME_EXPIRED when final score or percentage is missing', () => {
      const attempts = [
        { assessmentId: 'a1', score: null, totalPoints: 100, percentage: null, status: 'TIME_EXPIRED' },
        { assessmentId: 'a2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.eligibleAssessmentCount).toBe(1);
    });

    it('22. excludes cheating-flagged attempts regardless of score or status', () => {
      const attempts = [
        { assessmentId: 'a1', score: 100, totalPoints: 100, percentage: 100, status: 'GRADED', cheatingDetected: true },
        { assessmentId: 'a2', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' },
        { assessmentId: 'a3', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.eligibleAssessmentCount).toBe(2);
    });
  });

  // ─── 7. FRONTEND PRESENTATION & NULL SAFETY ─────────────────────────
  describe('Frontend ResultsPage Rendering & Data Disclosure', () => {
    it('23. renders AVAILABLE with unspecified period notice honestly and NEVER displays approved badge', async () => {
      vi.mocked(analyticsService.getStudentOverview).mockResolvedValue({
        data: {
          gpa: 3.5,
          attendanceRate: 90,
          completedAssignments: 5,
          rank: null,
          rankStatus: 'INSUFFICIENT_DATA',
          academic: {
            status: 'AVAILABLE',
            average: 85.0,
            eligibleAssessmentCount: 3,
            minimumRequired: 3,
            periodStatus: 'UNSPECIFIED',
            assessmentPeriod: null,
            retakeConflict: false,
            hasUnverifiableAttempts: false,
            unverifiableAttemptsCount: 0,
            explanationAr: 'تم احتساب المعدل الأكاديمي بنسبة 85% (فترة غير محددة).'
          }
        }
      } as any);
      vi.mocked(analyticsService.getStudentCharts).mockResolvedValue({ data: { performanceData: [], subjectProgress: [] } } as any);
      vi.mocked(analyticsService.getStudentRecent).mockResolvedValue({ data: [] } as any);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <ResultsPageCenter />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(await screen.findByText('التقييم الأكاديمي (البعد المستقل)')).toBeInTheDocument();
      // Must display honest unapproved period badge:
      expect(await screen.findByText('متاح (فترة غير محددة)')).toBeInTheDocument();
      expect(screen.queryByText('متاح ومعتمد')).not.toBeInTheDocument();
      expect(screen.queryByText('متوسط حسابي معتمد')).not.toBeInTheDocument();
      expect(await screen.findByText('85%')).toBeInTheDocument();
      expect(await screen.findByText('متوسط حسابي (فترة غير محددة)')).toBeInTheDocument();
    });

    it('24. renders unverifiable attempts warning banner when hasUnverifiableAttempts is true', async () => {
      vi.mocked(analyticsService.getStudentOverview).mockResolvedValue({
        data: {
          gpa: 3.0,
          attendanceRate: 85,
          completedAssignments: 4,
          rank: null,
          rankStatus: 'INSUFFICIENT_DATA',
          academic: {
            status: 'INSUFFICIENT_DATA',
            average: null,
            eligibleAssessmentCount: 2,
            minimumRequired: 3,
            periodStatus: 'UNSPECIFIED',
            retakeConflict: false,
            hasUnverifiableAttempts: true,
            unverifiableAttemptsCount: 1,
            dataIntegrityNoticeAr: 'توجد محاولات سابقة تعذر التحقق من اكتمالها أو درجاتها، لذلك لا تدخل في حساب المتوسط الأكاديمي.',
            explanationAr: 'لا تتوفر تقييمات كافية حتى الآن. تم رصد 2 من أصل 3 تقييمات مصححة مطلوبة.'
          }
        }
      } as any);
      vi.mocked(analyticsService.getStudentCharts).mockResolvedValue({ data: { performanceData: [], subjectProgress: [] } } as any);
      vi.mocked(analyticsService.getStudentRecent).mockResolvedValue({ data: [] } as any);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <ResultsPageOnline />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(await screen.findByText('التقييم الأكاديمي (البعد المستقل)')).toBeInTheDocument();
      expect(await screen.findByText('بيانات غير كافية')).toBeInTheDocument();
      expect(await screen.findByText('قيد الاحتساب (2 / 3)')).toBeInTheDocument();
      // Must render Arabic warning banner:
      expect(await screen.findByText(/توجد محاولات سابقة تعذر التحقق من اكتمالها أو درجاتها/)).toBeInTheDocument();
    });

    it('25. renders BLOCKED_PENDING_POLICY state honestly with Arabic explanation in ResultsPage', async () => {
      vi.mocked(analyticsService.getStudentOverview).mockResolvedValue({
        data: {
          gpa: 3.0,
          attendanceRate: 85,
          completedAssignments: 4,
          rank: null,
          rankStatus: 'INSUFFICIENT_DATA',
          academic: {
            status: 'BLOCKED_PENDING_POLICY',
            average: null,
            eligibleAssessmentCount: 0,
            minimumRequired: 3,
            periodStatus: 'UNSPECIFIED',
            retakeConflict: true,
            hasUnverifiableAttempts: false,
            unverifiableAttemptsCount: 0,
            explanationAr: 'تم رصد محاولات متعددة مكتملة ومصححة لنفس التقييم. التقييم الأكاديمي معلق لحين اعتماد سياسة الإعادة من قبل إدارة النظام (OD-11).'
          }
        }
      } as any);
      vi.mocked(analyticsService.getStudentCharts).mockResolvedValue({ data: { performanceData: [], subjectProgress: [] } } as any);
      vi.mocked(analyticsService.getStudentRecent).mockResolvedValue({ data: [] } as any);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <ResultsPageOnline />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(await screen.findByText('التقييم الأكاديمي (البعد المستقل)')).toBeInTheDocument();
      expect(await screen.findByText('معلق (سياسة الإعادة)')).toBeInTheDocument();
      expect(await screen.findByText('معلق (قيد الاعتماد)')).toBeInTheDocument();
      expect(await screen.findByText(/محاولات متعددة مكتملة ومصححة/)).toBeInTheDocument();
    });

    it('26. renders BLOCKED_UNVERIFIABLE_COMPLETION state when completion cannot be verified', async () => {
      vi.mocked(analyticsService.getStudentOverview).mockResolvedValue({
        data: {
          gpa: 2.5,
          attendanceRate: 75,
          completedAssignments: 2,
          rank: null,
          rankStatus: 'INSUFFICIENT_DATA',
          academic: {
            status: 'BLOCKED_UNVERIFIABLE_COMPLETION',
            average: null,
            eligibleAssessmentCount: 0,
            minimumRequired: 3,
            periodStatus: 'UNSPECIFIED',
            retakeConflict: false,
            hasUnverifiableAttempts: true,
            unverifiableAttemptsCount: 2,
            explanationAr: 'لا يمكن التحقق من اكتمال التقييم أو الدرجة العظمى من واقع سجلات الاختبارات في قاعدة البيانات.'
          }
        }
      } as any);
      vi.mocked(analyticsService.getStudentCharts).mockResolvedValue({ data: { performanceData: [], subjectProgress: [] } } as any);
      vi.mocked(analyticsService.getStudentRecent).mockResolvedValue({ data: [] } as any);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <ResultsPageCenter />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(await screen.findByText('التقييم الأكاديمي (البعد المستقل)')).toBeInTheDocument();
      expect(await screen.findByText('غير قابل للتحقق')).toBeInTheDocument();
      expect(await screen.findByText('غير متاح')).toBeInTheDocument();
      expect(await screen.findByText(/لا يمكن التحقق من اكتمال التقييم/)).toBeInTheDocument();
    });

    it('27. handles null/undefined academic payload gracefully without crashing (null-safety)', async () => {
      vi.mocked(analyticsService.getStudentOverview).mockResolvedValue({
        data: {
          gpa: 3.2,
          attendanceRate: 88,
          completedAssignments: 3,
          rank: null,
          rankStatus: 'INSUFFICIENT_DATA',
          academic: null
        }
      } as any);
      vi.mocked(analyticsService.getStudentCharts).mockResolvedValue({ data: { performanceData: [], subjectProgress: [] } } as any);
      vi.mocked(analyticsService.getStudentRecent).mockResolvedValue({ data: [] } as any);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <ResultsPageCenter />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(await screen.findByText('التقييم الأكاديمي (البعد المستقل)')).toBeInTheDocument();
      expect(await screen.findByText('بيانات غير كافية')).toBeInTheDocument();
      expect(await screen.findByText('قيد الاحتساب (0 / 3)')).toBeInTheDocument();
    });
  });

  // ─── 8. PHASE 6.2C.2 OD-12: APPROVED ROLLING WINDOW PERIOD ────────
  describe('Phase 6.2C.2 OD-12: Approved Academic Evaluation Period (Rolling Window)', () => {
    const validAttempts = [
      { assessmentId: 'a1', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED', createdAt: new Date(Date.now() - 10 * 86400000).toISOString() },
      { assessmentId: 'a2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED', createdAt: new Date(Date.now() - 20 * 86400000).toISOString() },
      { assessmentId: 'a3', score: 70, totalPoints: 100, percentage: 70, status: 'GRADED', createdAt: new Date(Date.now() - 40 * 86400000).toISOString() }
    ];

    it('28. correctly applies configured rolling window (e.g. 30 days) and marks periodStatus: SPECIFIED', () => {
      const result = calculateAcademicAssessment(validAttempts, { rollingDays: 30 });
      expect(result.periodStatus).toBe('SPECIFIED');
      expect(result.assessmentPeriod).toBe('LAST_30_DAYS');
      expect(result.rollingDays).toBe(30);
      // a3 is 40 days old, outside 30 days window -> only 2 attempts within window -> INSUFFICIENT_DATA
      expect(result.eligibleAssessmentCount).toBe(2);
      expect(result.status).toBe('INSUFFICIENT_DATA');
    });

    it('29. returns AVAILABLE when enough attempts meet minimum within rolling window', () => {
      const attemptsWithRecent = [
        ...validAttempts,
        { assessmentId: 'a4', score: 85, totalPoints: 100, percentage: 85, status: 'GRADED', createdAt: new Date(Date.now() - 5 * 86400000).toISOString() }
      ];
      const result = calculateAcademicAssessment(attemptsWithRecent, { rollingDays: 30 });
      expect(result.status).toBe('AVAILABLE');
      expect(result.periodStatus).toBe('SPECIFIED');
      expect(result.assessmentPeriod).toBe('LAST_30_DAYS');
      // a1 (80), a2 (90), a4 (85) -> (80 + 90 + 85) / 3 = 85.0
      expect(result.average).toBe(85.0);
    });

    it('30. returns PERIOD_CONFIGURATION_REQUIRED when rolling window is required but unconfigured', () => {
      const result = calculateAcademicAssessment(validAttempts, { requireRollingPeriod: true });
      expect(result.status).toBe('PERIOD_CONFIGURATION_REQUIRED');
      expect(result.periodStatus).toBe('CONFIGURATION_REQUIRED');
      expect(result.explanationAr).toContain('تتطلب سياسة النافذة الزمنية المتجددة تحديد مدة النافذة');
    });

    it('31. renders PERIOD_CONFIGURATION_REQUIRED state honestly in ResultsPage', async () => {
      vi.mocked(analyticsService.getStudentOverview).mockResolvedValue({
        data: {
          gpa: 3.0,
          attendanceRate: 85,
          completedAssignments: 4,
          rank: null,
          rankStatus: 'INSUFFICIENT_DATA',
          academic: {
            status: 'PERIOD_CONFIGURATION_REQUIRED',
            average: null,
            eligibleAssessmentCount: 0,
            minimumRequired: 3,
            periodStatus: 'CONFIGURATION_REQUIRED',
            retakeConflict: false,
            hasUnverifiableAttempts: false,
            unverifiableAttemptsCount: 0,
            explanationAr: 'تتطلب سياسة النافذة الزمنية المتجددة تحديد مدة النافذة واعتمادها من قبل إدارة النظام (OD-12).'
          }
        }
      } as any);
      vi.mocked(analyticsService.getStudentCharts).mockResolvedValue({ data: { performanceData: [], subjectProgress: [] } } as any);
      vi.mocked(analyticsService.getStudentRecent).mockResolvedValue({ data: [] } as any);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <ResultsPageOnline />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(await screen.findByText('التقييم الأكاديمي (البعد المستقل)')).toBeInTheDocument();
      expect((await screen.findAllByText('معلق (إعداد الفترة)')).length).toBeGreaterThanOrEqual(1);
      expect(await screen.findByText(/تتطلب سياسة التقييم تحديد مدة النافذة الزمنية/)).toBeInTheDocument();
    });

    it('32. renders specified rolling window label when periodStatus is SPECIFIED in ResultsPage', async () => {
      vi.mocked(analyticsService.getStudentOverview).mockResolvedValue({
        data: {
          gpa: 3.5,
          attendanceRate: 90,
          completedAssignments: 5,
          rank: null,
          rankStatus: 'INSUFFICIENT_DATA',
          academic: {
            status: 'AVAILABLE',
            average: 86.5,
            eligibleAssessmentCount: 3,
            minimumRequired: 3,
            periodStatus: 'SPECIFIED',
            rollingDays: 30,
            assessmentPeriod: 'LAST_30_DAYS',
            retakeConflict: false,
            hasUnverifiableAttempts: false,
            unverifiableAttemptsCount: 0,
            explanationAr: 'تم احتساب المعدل الأكاديمي بناءً على المتوسط الحسابي لـ 3 تقييمات مصححة بنسبة 86.5% (نافذة متجددة: 30 يوم).'
          }
        }
      } as any);
      vi.mocked(analyticsService.getStudentCharts).mockResolvedValue({ data: { performanceData: [], subjectProgress: [] } } as any);
      vi.mocked(analyticsService.getStudentRecent).mockResolvedValue({ data: [] } as any);

      render(
        <ThemeProvider>
          <MemoryRouter>
            <ResultsPageOnline />
          </MemoryRouter>
        </ThemeProvider>
      );

      expect(await screen.findByText('التقييم الأكاديمي (البعد المستقل)')).toBeInTheDocument();
      expect(await screen.findByText('متاح (نافذة متجددة: 30 يوم)')).toBeInTheDocument();
      expect(await screen.findByText('86.5%')).toBeInTheDocument();
      expect(await screen.findByText('متوسط حسابي (نافذة متجددة: 30 يوم)')).toBeInTheDocument();
    });
  });

  // ─── 9. PHASE 6.2C.2.2 REMEDIATION & INVARIANT VERIFICATION ────────
  describe('Phase 6.2C.2.2 Remediation & Unified Invariant Suite', () => {
    it('33. DEF-02: handles unknown maximum score by excluding from average and marking unverifiable', () => {
      const attempts = [
        { assessmentId: 'e1', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' },
        { assessmentId: 'e2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED' },
        { assessmentId: 'e3', score: 15, totalPoints: null, percentage: null, status: 'GRADED' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.eligibleAssessmentCount).toBe(2);
      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.hasUnverifiableAttempts).toBe(true);
      expect(result.unverifiableAttemptsCount).toBe(1);
    });

    it('34. DEF-03: handles missing submittedAt deterministically via createdAt without fabricating timestamp', () => {
      const attempts = [
        { assessmentId: 'e1', score: 85, totalPoints: 100, percentage: 85, status: 'GRADED', submittedAt: null, createdAt: '2026-10-01T10:00:00Z' },
        { assessmentId: 'e2', score: 75, totalPoints: 100, percentage: 75, status: 'GRADED', submittedAt: null, createdAt: '2026-10-02T10:00:00Z' },
        { assessmentId: 'e3', score: 95, totalPoints: 100, percentage: 95, status: 'GRADED', submittedAt: null, createdAt: '2026-10-03T10:00:00Z' }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.status).toBe('AVAILABLE');
      expect(result.average).toBe(85.0);
      expect(result.eligibleAssessmentCount).toBe(3);
      for (const item of result.eligibleAssessments) {
        expect(item.submittedAt).toBeUndefined();
      }
    });

    it('35. Invariant: strictly excludes CHEATING and unverified TIME_EXPIRED attempts', () => {
      const attempts = [
        { assessmentId: 'e1', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' },
        { assessmentId: 'e2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED' },
        { assessmentId: 'e3', score: 0, totalPoints: 100, percentage: 0, status: 'CHEATING' },
        { assessmentId: 'e4', score: 40, totalPoints: 100, percentage: null, status: 'TIME_EXPIRED', isGraded: false }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.eligibleAssessmentCount).toBe(2);
      expect(result.status).toBe('INSUFFICIENT_DATA');
    });

    it('36. Invariant: handles legacy abandoned zero attempts without including in academic average', () => {
      const attempts = [
        { assessmentId: 'e1', score: 80, totalPoints: 100, percentage: 80, status: 'GRADED' },
        { assessmentId: 'e2', score: 90, totalPoints: 100, percentage: 90, status: 'GRADED' },
        { assessmentId: 'e3', score: 0, totalPoints: 100, status: 'STARTED', isGraded: false, answers: null }
      ];
      const result = calculateAcademicAssessment(attempts);
      expect(result.eligibleAssessmentCount).toBe(2);
      expect(result.status).toBe('INSUFFICIENT_DATA');
    });
  });
});
