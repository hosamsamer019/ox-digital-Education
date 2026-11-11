import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  BookOpen,
  GraduationCap,
  Building2,
  CreditCard,
  Users,
  AlertTriangle,
  ClipboardCheck,
  FileText,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { courseService } from '../../services/course.service';
import { homeworkService } from '../../services/homework.service';
import { accountingService } from '../../services/accounting.service';
import { userService } from '../../services/user.service';

export interface ContextualGuidanceBannerProps {
  forceShow?: boolean;
  onDismiss?: () => void;
  className?: string;
  // Test injection hooks
  mockState?: {
    enrolledCoursesCount?: number;
    pendingHomeworkCount?: number;
    teacherCoursesCount?: number;
    pendingDisbursementsCount?: number;
    pendingApprovalsCount?: number;
    childrenCount?: number;
    parentRelationshipLoading?: boolean;
    parentRelationshipFailed?: boolean;
  };
}

export interface StateAwareGuidanceConfig {
  stepId: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  actionTextAr: string;
  actionTextEn: string;
  actionRoute: string;
  isBlocker?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

export function resolveStateAwareGuidance(
  user: any,
  state: {
    enrolledCoursesCount?: number;
    pendingHomeworkCount?: number;
    teacherCoursesCount?: number;
    pendingDisbursementsCount?: number;
    pendingApprovalsCount?: number;
    childrenCount?: number;
    parentRelationshipLoading?: boolean;
    parentRelationshipFailed?: boolean;
  }
): StateAwareGuidanceConfig | null {
  if (!user) return null;
  const rawRole = (user.role || '').toUpperCase();
  const isCenter = rawRole === 'CENTER_STUDENT' || rawRole === 'STUDENT_CENTER';
  const isOnline = rawRole === 'ONLINE_STUDENT' || rawRole === 'STUDENT_ONLINE' || rawRole === 'STUDENT';

  // 1. Student Journey
  if (isCenter || isOnline) {
    if (user.financialAccessStatus === 'RESTRICTED') {
      return {
        stepId: 'STUDENT_FINANCIAL_RESTRICTION',
        titleAr: 'تنبيه: تم تعليق صلاحية الوصول الأكاديمي مالياً',
        titleEn: 'Notice: Academic Access Suspended Due to Overdue Fees',
        descAr: 'حسابك مقيد حالياً لوجود متأخرات مالية مستحقة. يرجى مراجعة إدارة المركز أو مكتب التحصيل لتسوية الرسوم واستئناف المشاهدة والامتحانات.',
        descEn: 'Your account is temporarily restricted due to overdue fees. Please contact the payment desk to settle fees and restore full video/exam access.',
        actionTextAr: 'مراجعة الاشتراكات',
        actionTextEn: 'Review Subscriptions',
        actionRoute: isCenter ? '/student/center/subscriptions' : '/student/online/subscriptions',
        isBlocker: true,
        icon: AlertTriangle,
      };
    }

    if (state.enrolledCoursesCount === 0) {
      return {
        stepId: 'STUDENT_EXPLORE_COURSES',
        titleAr: isCenter ? 'الخطوة التالية: مراجعة مقررات المركز المعتمدة' : 'الخطوة الأولى: استكشف المقررات المتاحة وسجل في أول مقرر',
        titleEn: isCenter ? 'Next Step: Review Enrolled Center Courses' : 'First Step: Explore Available Courses & Enroll',
        descAr: isCenter
          ? 'تابع حضورك وتوزيعك في مجموعات المركز الدراسي، واستعرض المقررات والواجبات المعتمدة لك.'
          : 'أنت لم تسجل في أي مقرر تعليمي بعد. استكشف المقررات الدراسية المتاحة وابدأ التسجيل لبدء مسارك.',
        descEn: isCenter
          ? 'Track your center group attendance, view assigned homework and approved course materials.'
          : 'You are not enrolled in any courses yet. Browse the catalog and register for your first course to begin learning.',
        actionTextAr: isCenter ? 'مقررات المركز' : 'استعراض المقررات',
        actionTextEn: isCenter ? 'Center Courses' : 'Explore Courses',
        actionRoute: isCenter ? '/student/center/courses' : '/student/online/courses',
        icon: GraduationCap,
      };
    }

    if ((state.pendingHomeworkCount ?? 0) > 0) {
      return {
        stepId: 'STUDENT_PENDING_HOMEWORK',
        titleAr: 'لديك واجبات وتطبيقات دراسية بانتظار التسليم',
        titleEn: 'You have pending homework assignments',
        descAr: 'تابع تطبيقاتك المدرسية وأجب على الأسئلة المسندة أولاً بأول للحفاظ على سجلك الأكاديمي.',
        descEn: 'Complete your pending coursework and submit your answers to keep your academic progress on track.',
        actionTextAr: 'تسليم الواجبات',
        actionTextEn: 'Submit Homework',
        actionRoute: isCenter ? '/student/center/homework' : '/student/online/homework',
        icon: ClipboardCheck,
      };
    }

    return {
      stepId: 'STUDENT_CONTINUE_LEARNING',
      titleAr: 'أنت على المسار التعليمي الصحيح',
      titleEn: 'You are on the right learning path',
      descAr: 'جميع واجباتك مسلّمة! تابع استكمال دروسك ومشاهدة المحاضرات الأكاديمية المصرحة لك ومراجعة التقييمات.',
      descEn: 'All your homework is up to date! Continue watching video lectures and taking practice quizzes.',
      actionTextAr: 'متابعة الدروس',
      actionTextEn: 'Continue Learning',
      actionRoute: isCenter ? '/student/center/courses' : '/student/online/courses',
      icon: BookOpen,
    };
  }

  // 2. Teacher Journey
  if (rawRole === 'TEACHER') {
    if (!user.branchId && !user.branch?.id) {
      return {
        stepId: 'TEACHER_AWAITING_BRANCH',
        titleAr: 'تنبيه إداري: لم يتم إسنادك إلى فرع بعد',
        titleEn: 'Notice: Not assigned to an institutional branch yet',
        descAr: 'يرجى التنسيق مع المدير التنفيذي لإسنادك إلى أحد فروع المؤسسة لتفعيل الحسابات المالية وحصص المركز.',
        descEn: 'Please coordinate with the primary manager to be assigned to an institutional branch.',
        actionTextAr: 'عرض الملف الشخصي',
        actionTextEn: 'View Profile',
        actionRoute: '/teacher/profile',
        isBlocker: true,
        icon: Building2,
      };
    }

    if ((state.teacherCoursesCount ?? 0) === 0) {
      return {
        stepId: 'TEACHER_CREATE_COURSE',
        titleAr: 'ابدأ ببناء مقررك التعليمي الأول',
        titleEn: 'Start by creating your first course',
        descAr: 'قم بإنشاء مقررك الأكاديمي، إضافة الدروس والفيديوهات، وإعداد بنك الأسئلة والامتحانات التفاعلية.',
        descEn: 'Build your course curriculum, upload video lessons, and author interactive questions.',
        actionTextAr: 'إدارة المقررات',
        actionTextEn: 'Manage Courses',
        actionRoute: '/teacher/courses',
        icon: BookOpen,
      };
    }

    return {
      stepId: 'TEACHER_MONITOR_STUDENTS',
      titleAr: 'مرحباً بك في منظومة المعلم الأكاديمية',
      titleEn: 'Welcome to Teacher Academic Portal',
      descAr: 'تابع حضور الطلاب، راقب نسب إتمام الدروس، واعتمد الواجبات والاختبارات التفاعلية لطلابك.',
      descEn: 'Monitor student attendance, track lesson completion rates, and grade interactive student homework.',
      actionTextAr: 'قائمة الطلاب',
      actionTextEn: 'My Students',
      actionRoute: '/teacher/students',
      icon: Users,
    };
  }

  // 3. Accountant Journey
  if (rawRole === 'ACCOUNTANT') {
    if ((state.pendingDisbursementsCount ?? 0) > 0) {
      return {
        stepId: 'ACCOUNTANT_PENDING_DISBURSEMENT',
        titleAr: 'سندات صرف معتمدة بانتظار الصرف الفعلي',
        titleEn: 'Approved expense vouchers awaiting payout',
        descAr: 'اعتمد المدير سندات صرف جديدة. يرجى مراجعة الصندوق وصرف المبالغ النقدية وقيد الحركة الرسمية.',
        descEn: 'Management has approved new expense vouchers. Please disburse cash from the cashbox and record payout.',
        actionTextAr: 'سندات الصرف',
        actionTextEn: 'Expense Vouchers',
        actionRoute: '/accountant/expenses',
        icon: FileText,
      };
    }

    return {
      stepId: 'ACCOUNTANT_COLLECTIONS_DESK',
      titleAr: 'مكتب التحصيل والسداد اليومي',
      titleEn: 'Daily Collection & Cashbox Desk',
      descAr: 'استقبل تحصيلات الطلاب، أصدر إيصالات السداد الرسمية، وقم بالجرد اليومي للخزائن المركزية.',
      descEn: 'Process student tuition payments, issue official receipts, and reconcile branch cashboxes.',
      actionTextAr: 'مكتب التحصيل والسداد',
      actionTextEn: 'Collection Desk',
      actionRoute: '/accountant/collections',
      icon: CreditCard,
    };
  }

  // 4. Primary Manager / Admin Journey
  if (rawRole === 'PRIMARY_MANAGER' || rawRole === 'ADMIN') {
    if ((state.pendingApprovalsCount ?? 0) > 0) {
      return {
        stepId: 'MANAGER_PENDING_APPROVALS',
        titleAr: 'طلبات مالية وسندات بانتظار الاعتماد',
        titleEn: 'Financial requests awaiting your approval',
        descAr: 'توجد سندات صرف مرفوعة من المحاسبين بانتظار التدقيق والاعتماد المالي الثنائي (Maker-Checker).',
        descEn: 'Accountants have submitted expense vouchers awaiting executive audit and dual-control approval.',
        actionTextAr: 'مركز الاعتمادات',
        actionTextEn: 'Approvals Center',
        actionRoute: '/admin/approvals',
        icon: ShieldCheck,
      };
    }

    return {
      stepId: 'MANAGER_BRANCHES_SETUP',
      titleAr: 'مرحباً بك في مركز الإدارة العامة والحوكمة',
      titleEn: 'Welcome to Governance & Executive Center',
      descAr: 'راقب أداء الفروع، وزّع المعلمين والمحاسبين على المقرات، وأدر سياسات المنصة المالية والرسوم.',
      descEn: 'Monitor branch performance, assign teachers and staff, and manage institutional financial policies.',
      actionTextAr: 'إدارة الفروع والتوزيع',
      actionTextEn: 'Manage Branches',
      actionRoute: '/admin/branches',
      icon: Building2,
    };
  }

  // 5. Parent Journey (uses authoritative parent-child relationship API; separate actionable tasks not implemented)
  if (rawRole === 'PARENT') {
    if (state.parentRelationshipLoading || state.parentRelationshipFailed) {
      return null;
    }
    if ((state.childrenCount ?? 0) === 0) {
      return {
        stepId: 'PARENT_NO_CHILDREN',
        titleAr: 'لا يوجد أبناء مرتبطين بحسابك حالياً',
        titleEn: 'No linked children found on your account',
        descAr: 'يرجى التواصل مع إدارة المؤسسة أو مسؤول الفرع لربط حسابات أبنائك الطلاب لتتمكن من متابعتهم.',
        descEn: 'Please contact administration to link your student children to your parent account.',
        actionTextAr: 'إعدادات ربط الأبناء',
        actionTextEn: 'Link Children',
        actionRoute: '/parent/settings?tab=linking',
        isBlocker: true,
        icon: Users,
      };
    }

    return {
      stepId: 'PARENT_MONITOR_CHILDREN',
      titleAr: 'مرحباً بك في بوابة متابعة ولي الأمر',
      titleEn: 'Welcome to Parent Monitoring Portal',
      descAr: 'تابع تقارير الحضور والغياب، نتائج الامتحانات، والواجبات المدرسية لأبنائك أولاً بأول بكل دقة.',
      descEn: "Track your children's grades, attendance reports, and assigned homework in real time.",
      actionTextAr: 'متابعة الأبناء',
      actionTextEn: 'View Children',
      actionRoute: '/parent/children',
      icon: Users,
    };
  }

  return null;
}

export default function ContextualGuidanceBanner({
  forceShow = false,
  onDismiss,
  className = '',
  mockState,
}: ContextualGuidanceBannerProps) {
  const { user } = useAuth();
  const { language, isRtl } = useLanguage();
  const navigate = useNavigate();

  const [guidanceState, setGuidanceState] = useState({
    enrolledCoursesCount: 0,
    pendingHomeworkCount: 0,
    teacherCoursesCount: 0,
    pendingDisbursementsCount: 0,
    pendingApprovalsCount: 0,
    childrenCount: 0,
    parentRelationshipLoading: false,
    parentRelationshipFailed: false,
  });

  const [dismissed, setDismissed] = useState<boolean>(true);

  const userId = user?.id;
  const userRole = user?.role;
  const hasMockState = Boolean(mockState);
  const mockEnrolledCoursesCount = mockState?.enrolledCoursesCount;
  const mockPendingHomeworkCount = mockState?.pendingHomeworkCount;
  const mockTeacherCoursesCount = mockState?.teacherCoursesCount;
  const mockPendingDisbursementsCount = mockState?.pendingDisbursementsCount;
  const mockPendingApprovalsCount = mockState?.pendingApprovalsCount;
  const mockChildrenCount = mockState?.childrenCount;
  const mockParentRelLoading = Boolean(mockState?.parentRelationshipLoading);
  const mockParentRelFailed = Boolean(mockState?.parentRelationshipFailed);

  // Load live authoritative account state
  useEffect(() => {
    if (hasMockState) {
      setGuidanceState({
        enrolledCoursesCount: mockEnrolledCoursesCount ?? 0,
        pendingHomeworkCount: mockPendingHomeworkCount ?? 0,
        teacherCoursesCount: mockTeacherCoursesCount ?? 0,
        pendingDisbursementsCount: mockPendingDisbursementsCount ?? 0,
        pendingApprovalsCount: mockPendingApprovalsCount ?? 0,
        childrenCount: mockChildrenCount ?? 0,
        parentRelationshipLoading: mockParentRelLoading,
        parentRelationshipFailed: mockParentRelFailed,
      });
      return;
    }

    if (!userId) return;
    const rawRole = (userRole || '').toUpperCase();
    let active = true;

    const fetchState = async () => {
      try {
        if (rawRole.includes('STUDENT')) {
          let enrolled = 0;
          let pendingHw = 0;
          try {
            const statsRes = await courseService.getStudentCourseStats();
            enrolled = statsRes?.data?.enrolledCoursesCount ?? 0;
          } catch {
            enrolled = 0;
          }
          try {
            if (typeof (homeworkService as any)?.getPendingCount === 'function') {
              const hwRes = await (homeworkService as any).getPendingCount();
              pendingHw = typeof hwRes?.data?.pendingCount === 'number' ? hwRes.data.pendingCount : 0;
            }
          } catch {
            pendingHw = 0;
          }
          if (active) {
            setGuidanceState(prev => ({ ...prev, enrolledCoursesCount: enrolled, pendingHomeworkCount: pendingHw }));
          }
        }

        if (rawRole === 'TEACHER') {
          try {
            const cRes = await courseService.getCourses();
            const total = cRes?.data?.total ?? (Array.isArray(cRes?.data) ? cRes.data.length : 0);
            if (active) {
              setGuidanceState(prev => ({ ...prev, teacherCoursesCount: total }));
            }
          } catch {
            // fallback
          }
        }

        if (rawRole === 'ACCOUNTANT') {
          try {
            const expRes = await accountingService.getExpenses({ status: 'APPROVED' });
            const rawList = Array.isArray(expRes?.vouchers) ? expRes.vouchers : [];
            const count =
              typeof expRes?.summary?.totalCount === 'number'
                ? expRes.summary.totalCount
                : typeof expRes?.pagination?.total === 'number'
                ? expRes.pagination.total
                : rawList.filter((v: any) => v && v.status === 'APPROVED' && !v.disbursedAt && !v.disbursedById).length;
            if (active) {
              setGuidanceState(prev => ({ ...prev, pendingDisbursementsCount: count }));
            }
          } catch {
            // fallback
          }
        }

        if (rawRole === 'PRIMARY_MANAGER' || rawRole === 'ADMIN') {
          try {
            const expRes = await accountingService.getExpenses({ status: 'PENDING_APPROVAL' });
            const rawList = Array.isArray(expRes?.vouchers) ? expRes.vouchers : [];
            const count =
              typeof expRes?.summary?.totalCount === 'number'
                ? expRes.summary.totalCount
                : typeof expRes?.pagination?.total === 'number'
                ? expRes.pagination.total
                : rawList.filter((v: any) => v && v.status === 'PENDING_APPROVAL').length;
            if (active) {
              setGuidanceState(prev => ({ ...prev, pendingApprovalsCount: count }));
            }
          } catch {
            // fallback
          }
        }

        if (rawRole === 'PARENT') {
          if (active) {
            setGuidanceState(prev => ({ ...prev, parentRelationshipLoading: true, parentRelationshipFailed: false }));
          }
          try {
            const childrenRes = await userService.getChildren();
            const list = Array.isArray(childrenRes)
              ? childrenRes
              : Array.isArray((childrenRes as any)?.data)
              ? (childrenRes as any).data
              : null;
            if (!list) {
              if (active) {
                setGuidanceState(prev => ({ ...prev, parentRelationshipLoading: false, parentRelationshipFailed: true }));
              }
            } else if (active) {
              setGuidanceState(prev => ({
                ...prev,
                childrenCount: list.length,
                parentRelationshipLoading: false,
                parentRelationshipFailed: false,
              }));
            }
          } catch {
            if (active) {
              setGuidanceState(prev => ({ ...prev, parentRelationshipLoading: false, parentRelationshipFailed: true }));
            }
          }
        }
      } catch {
        // fail closed gracefully
      }
    };

    fetchState();

    const handleRefresh = () => {
      fetchState();
    };
    window.addEventListener('ox:relationships-updated', handleRefresh);
    window.addEventListener('ox:counters-refresh', handleRefresh);

    return () => {
      active = false;
      window.removeEventListener('ox:relationships-updated', handleRefresh);
      window.removeEventListener('ox:counters-refresh', handleRefresh);
    };
  }, [
    userId,
    userRole,
    hasMockState,
    mockEnrolledCoursesCount,
    mockPendingHomeworkCount,
    mockTeacherCoursesCount,
    mockPendingDisbursementsCount,
    mockPendingApprovalsCount,
    mockChildrenCount,
    mockParentRelLoading,
    mockParentRelFailed,
  ]);

  const config = resolveStateAwareGuidance(user, guidanceState);
  const rawRole = (user?.role || '').toUpperCase();
  const stepId = config?.stepId || 'default';
  const storageKey = `ox_guidance_dismissed_${rawRole}_${user?.id || 'guest'}_${stepId}`;

  useEffect(() => {
    if (forceShow) {
      setDismissed(false);
      return;
    }
    if (typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem(storageKey) === 'true';
      setDismissed(isDismissed);
    }
  }, [storageKey, forceShow]);

  if (!config || (dismissed && !forceShow)) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, 'true');
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleAction = () => {
    navigate(config.actionRoute);
  };

  const Icon = config.icon || Sparkles;
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div
      role="region"
      aria-label={isRtl ? 'إرشاد الاستخدام المخصص' : 'Contextual User Guidance'}
      className={`mx-4 lg:mx-6 mt-4 p-4 rounded-2xl bg-card border shadow-xs relative overflow-hidden transition-all ${
        config.isBlocker ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          <div
            className={`p-2.5 rounded-xl flex-shrink-0 mt-0.5 sm:mt-0 ${
              config.isBlocker ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary'
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground">
                {language === 'ar' ? config.titleAr : config.titleEn}
              </h3>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  config.isBlocker
                    ? 'bg-destructive/15 text-destructive font-bold'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {config.isBlocker ? (
                  <AlertTriangle className="w-3 h-3" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {config.isBlocker
                  ? isRtl
                    ? 'تنبيه هام'
                    : 'Important Alert'
                  : isRtl
                  ? 'إرشاد الخطوة التالية'
                  : 'Next Step'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {language === 'ar' ? config.descAr : config.descEn}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
          <button
            onClick={handleAction}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer ${
              config.isBlocker
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            <span>{language === 'ar' ? config.actionTextAr : config.actionTextEn}</span>
            <ArrowIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDismiss}
            title={isRtl ? 'إغلاق الإرشاد' : 'Dismiss guide'}
            aria-label={isRtl ? 'إغلاق الإرشاد' : 'Dismiss guide'}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
