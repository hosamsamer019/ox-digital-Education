import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContextualGuidanceBanner, { resolveStateAwareGuidance } from '../components/shared/ContextualGuidanceBanner';

let currentMockUser: any = null;
let currentLanguage = 'ar';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    token: 'mock-token',
    logout: vi.fn(),
    isAuthenticated: !!currentMockUser,
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: currentLanguage,
    setLanguage: vi.fn(),
    t: (key: string, fallback?: string) => fallback || key,
    dir: currentLanguage === 'ar' ? 'rtl' : 'ltr',
    isRtl: currentLanguage === 'ar',
  }),
  t: (key: string, fallback?: string) => fallback || key,
}));

vi.mock('../services/course.service', () => ({
  courseService: {
    getCourses: vi.fn().mockResolvedValue({ courses: [] }),
  },
}));

vi.mock('../services/homework.service', () => ({
  homeworkService: {
    getHomeworks: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../services/accounting.service', () => ({
  accountingService: {
    getExpenses: vi.fn().mockResolvedValue({ vouchers: [] }),
  },
}));

describe('State-Aware Contextual User Guidance & Onboarding Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    currentLanguage = 'ar';
    currentMockUser = null;
  });

  it('1. Student Journey: Unenrolled Online Student guided to explore courses', () => {
    const user = {
      id: 'student-online-1',
      role: 'ONLINE_STUDENT',
      financialAccessStatus: 'ACTIVE'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 0,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance).not.toBeNull();
    expect(guidance?.stepId).toBe('STUDENT_EXPLORE_COURSES');
    expect(guidance?.actionRoute).toBe('/student/online/courses');
    expect(guidance?.actionTextAr).toBe('استعراض المقررات');
  });

  it('2. Student Journey: Unenrolled Center Student guided to center courses', () => {
    const user = {
      id: 'student-center-1',
      role: 'CENTER_STUDENT',
      financialAccessStatus: 'ACTIVE'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 0,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('STUDENT_EXPLORE_COURSES');
    expect(guidance?.actionRoute).toBe('/student/center/courses');
    expect(guidance?.actionTextAr).toBe('مقررات المركز');
  });

  it('3. Student Journey: Student with pending homework guided to submit assignments', () => {
    const user = {
      id: 'student-hw-1',
      role: 'ONLINE_STUDENT',
      financialAccessStatus: 'ACTIVE'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 2,
      pendingHomeworkCount: 3,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('STUDENT_PENDING_HOMEWORK');
    expect(guidance?.actionRoute).toBe('/student/online/homework');
    expect(guidance?.actionTextAr).toBe('تسليم الواجبات');
  });

  it('4. Student Journey: Student with 0 pending homework guided to continue learning', () => {
    const user = {
      id: 'student-up-to-date',
      role: 'ONLINE_STUDENT',
      financialAccessStatus: 'ACTIVE'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 2,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('STUDENT_CONTINUE_LEARNING');
    expect(guidance?.actionRoute).toBe('/student/online/courses');
    expect(guidance?.actionTextAr).toBe('متابعة الدروس');
  });

  it('5. Student Journey: Financially restricted student receives blocker banner', () => {
    const user = {
      id: 'student-restricted-1',
      role: 'CENTER_STUDENT',
      financialAccessStatus: 'RESTRICTED'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 2,
      pendingHomeworkCount: 1,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('STUDENT_FINANCIAL_RESTRICTION');
    expect(guidance?.isBlocker).toBe(true);
    expect(guidance?.actionRoute).toBe('/student/center/subscriptions');
    expect(guidance?.titleAr).toContain('تم تعليق صلاحية الوصول الأكاديمي مالياً');
  });

  it('6. Teacher Journey: Teacher without branch receives administrative notice blocker', () => {
    const user = {
      id: 'teacher-no-branch',
      role: 'TEACHER',
      branchId: null
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 0,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('TEACHER_AWAITING_BRANCH');
    expect(guidance?.isBlocker).toBe(true);
    expect(guidance?.actionRoute).toBe('/teacher/profile');
    expect(guidance?.titleAr).toContain('لم يتم إسنادك إلى فرع بعد');
  });

  it('7. Teacher Journey: Teacher assigned to branch with 0 courses guided to create course', () => {
    const user = {
      id: 'teacher-with-branch',
      role: 'TEACHER',
      branchId: 'branch-001'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 0,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('TEACHER_CREATE_COURSE');
    expect(guidance?.actionRoute).toBe('/teacher/courses');
    expect(guidance?.titleAr).toContain('ابدأ ببناء مقررك التعليمي الأول');
  });

  it('8. Teacher Journey: Teacher with courses guided to monitor students', () => {
    const user = {
      id: 'teacher-active',
      role: 'TEACHER',
      branchId: 'branch-001'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 0,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 3,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('TEACHER_MONITOR_STUDENTS');
    expect(guidance?.actionRoute).toBe('/teacher/students');
    expect(guidance?.actionTextAr).toBe('قائمة الطلاب');
  });

  it('9. Accountant Journey: Accountant with approved vouchers guided to expenses desk', () => {
    const user = {
      id: 'acc-1',
      role: 'ACCOUNTANT'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 0,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 2,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('ACCOUNTANT_PENDING_DISBURSEMENT');
    expect(guidance?.actionRoute).toBe('/accountant/expenses');
    expect(guidance?.titleAr).toContain('سندات صرف معتمدة بانتظار الصرف');
  });

  it('10. Accountant Journey: Accountant with 0 pending vouchers guided to daily collection', () => {
    const user = {
      id: 'acc-2',
      role: 'ACCOUNTANT'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 0,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('ACCOUNTANT_COLLECTIONS_DESK');
    expect(guidance?.actionRoute).toBe('/accountant/collections');
  });

  it('11. Primary Manager Journey: Pending vouchers guide to approvals', () => {
    const user = {
      id: 'mgr-1',
      role: 'PRIMARY_MANAGER'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 0,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 4,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('MANAGER_PENDING_APPROVALS');
    expect(guidance?.actionRoute).toBe('/admin/approvals');
  });

  it('12. Primary Manager Journey: 0 pending vouchers guide to branch governance', () => {
    const user = {
      id: 'mgr-2',
      role: 'PRIMARY_MANAGER'
    };

    const guidance = resolveStateAwareGuidance(user, {
      enrolledCoursesCount: 0,
      pendingHomeworkCount: 0,
      teacherCoursesCount: 0,
      pendingDisbursementsCount: 0,
      pendingApprovalsCount: 0,
      childrenCount: 0
    });

    expect(guidance?.stepId).toBe('MANAGER_BRANCHES_SETUP');
    expect(guidance?.actionRoute).toBe('/admin/branches');
  });

  it('13. Persistence: Dismissal is scoped per user, role, and stepId', () => {
    currentMockUser = {
      id: 'teacher-dismiss-test',
      role: 'TEACHER',
      branchId: 'branch-001'
    };

    const { rerender } = render(
      <MemoryRouter>
        <ContextualGuidanceBanner
          mockState={{
            teacherCoursesCount: 0
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('ابدأ ببناء مقررك التعليمي الأول')).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText('إغلاق الإرشاد');
    fireEvent.click(dismissBtn);

    // Dismissal key in localStorage must be scoped by role, user ID, and step ID
    const expectedKey = 'ox_guidance_dismissed_TEACHER_teacher-dismiss-test_TEACHER_CREATE_COURSE';
    expect(localStorage.getItem(expectedKey)).toBe('true');

    // Banner is dismissed
    expect(screen.queryByText('ابدأ ببناء مقررك التعليمي الأول')).not.toBeInTheDocument();
  });

  it('14. State Transition Re-engagement: Moving to a new state displays new guidance even if previous step was dismissed', () => {
    currentMockUser = {
      id: 'student-transition-test',
      role: 'ONLINE_STUDENT',
      financialAccessStatus: 'ACTIVE'
    };

    // Pre-dismiss the first step (STUDENT_EXPLORE_COURSES)
    localStorage.setItem('ox_guidance_dismissed_ONLINE_STUDENT_student-transition-test_STUDENT_EXPLORE_COURSES', 'true');

    // Student now has enrolled courses and pending homework (state changed!)
    render(
      <MemoryRouter>
        <ContextualGuidanceBanner
          mockState={{
            enrolledCoursesCount: 1,
            pendingHomeworkCount: 2
          }}
        />
      </MemoryRouter>
    );

    // The new step guidance is displayed and NOT blocked by the previous step's dismissal!
    expect(screen.getByText('لديك واجبات وتطبيقات دراسية بانتظار التسليم')).toBeInTheDocument();
    expect(screen.getByText('تسليم الواجبات')).toBeInTheDocument();
  });

  it('15. English Localization: Displays English guidance copy when English locale selected', () => {
    currentMockUser = {
      id: 'student-en',
      role: 'ONLINE_STUDENT',
      financialAccessStatus: 'ACTIVE'
    };
    currentLanguage = 'en';

    render(
      <MemoryRouter>
        <ContextualGuidanceBanner
          forceShow
          mockState={{
            enrolledCoursesCount: 0
          }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('First Step: Explore Available Courses & Enroll')).toBeInTheDocument();
    expect(screen.getByText('Explore Courses')).toBeInTheDocument();
  });
});
