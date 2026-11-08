import { render, screen, act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { LanguageProvider, useLanguage, t } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import SharedLayout, { MenuItem } from '../components/shared/SharedLayout';
import { AccountantDashboard } from '../components/accountant/AccountantDashboard';
import TeacherDashboard from '../components/teacher/TeacherDashboard';
import StudentCenterDashboard from '../components/student-center/StudentCenterDashboard';
import StudentOnlineDashboard from '../components/student-online/StudentOnlineDashboard';
import ParentDashboard from '../components/parent/ParentDashboard';
import { PrimaryManagerDashboard } from '../components/primary-manager/PrimaryManagerDashboard';
import { translations } from '../utils/translations';
import { UI_TRANSLATIONS_EN } from '../utils/translationsDictionary';
import { userService } from '../services/user.service';
import { notificationService } from '../services/notification.service';
import { homeworkService } from '../services/homework.service';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn()
  }
}));

// Mock services
vi.mock('../services/user.service', () => ({
  userService: {
    getProfile: vi.fn().mockResolvedValue({ id: 'u-1', name: 'أ. حسام الدين', role: 'TEACHER', language: 'en' }),
    getChildren: vi.fn().mockResolvedValue({ data: [] }),
    getUsers: vi.fn().mockResolvedValue({ data: { users: [], total: 0 } }),
  }
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getNotifications: vi.fn().mockResolvedValue({ data: [] })
  }
}));

vi.mock('../services/homework.service', () => ({
  homeworkService: {
    getHomeworks: vi.fn().mockResolvedValue({ data: [] })
  }
}));

function TestWrapper({ children, initialLang = 'en' }: { children: React.ReactNode; initialLang?: 'ar' | 'en' }) {
  localStorage.setItem('preferred_language', initialLang);
  localStorage.setItem('edu-lang', initialLang === 'ar' ? 'ARABIC' : 'ENGLISH');
  return (
    <MemoryRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe('OX-DIGITAL Comprehensive English Localization Remediation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. Dictionary Completeness & Key Resolution', () => {
    it('resolves unlinkingConfirm identifier in English and Arabic', () => {
      const { result: arResult } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper initialLang="ar">{children}</TestWrapper>
      });
      expect(arResult.current.t('unlinkingConfirm', 'تأكيد إلغاء الربط')).toBe('تأكيد إلغاء الربط');

      const { result: enResult } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper initialLang="en">{children}</TestWrapper>
      });
      expect(enResult.current.t('unlinkingConfirm', 'تأكيد إلغاء الربط')).toBe('Confirm Unlink');
    });

    it('resolves financial maker-checker and governance phrases in English', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper initialLang="en">{children}</TestWrapper>
      });

      const t = result.current.t;
      expect(t('إدارة التحصيلات النقدية، تدقيق حسابات الطلاب، وإعداد سندات الصرف وفق حوكمة الصانع والمراجع (Maker)'))
        .toContain('Maker-Checker governance');
      expect(t('حوكمة الصانع والمراجع (Maker-Checker) مفعلة بصرامة — لا يوجد اعتماد ذاتي للمصروفات'))
        .toContain('self-approval of expenses is prohibited');
      expect(t('التحقق الإلزامي من تسعيرة المعلم المحددة للمرحلة الدراسية بدون قبول دفعات جزئية عشوائية.'))
        .toContain('Mandatory verification of the teacher');
      expect(t('السجل المحاسبي للفرع نظيف. عند تحصيل أي اشتراك عبر مكتب التحصيل سيتم إدراج الإيصال المتسلسل هنا مباشرة.'))
        .toContain('The branch ledger is clear');
    });

    it('resolves student grace period and payment restriction phrases in English', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper initialLang="en">{children}</TestWrapper>
      });

      const t = result.current.t;
      expect(t('نظراً لانقضاء مهلة سداد الرسوم الشهرية المقررة، تم تعليق صلاحية دخول الدروس والاختبارات التفاعلية.'))
        .toContain('grace period');
      expect(t('أنت الآن في فترة السماح الشهرية. يرجى سداد الاشتراك قبل يوم الإغلاق لتجنب تعليق الوصول.'))
        .toContain('grace period');
      expect(t('بمجرد سداد الرسوم الشهرية كاملة وإصدار الإيصال الرسمي بالخزينة، يتم رفع التقييد تلقائياً.'))
        .toContain('access restrictions are lifted automatically');
    });

    it('resolves curriculum and landing presentation strings in English', () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper initialLang="en">{children}</TestWrapper>
      });

      const t = result.current.t;
      expect(t('الصف الثالث الثانوي')).toBe('3rd Secondary Grade');
      expect(t('شهادة الثانوية العامة')).toBe('General Secondary Certificate');
      expect(t('الرياضيات البحتة')).toBe('Pure Mathematics');
      expect(t('الرياضيات التطبيقية')).toBe('Applied Mathematics');
      expect(t('التفاضل والتكامل المتقدم')).toBe('Advanced Differential & Integral Calculus');
    });
  });

  describe('2. Navigation Menu Translation Across All Roles', () => {
    it('translates SharedLayout navigation items in English when labelKey is absent but label is Arabic', () => {
      const testMenu: MenuItem[] = [
        { path: '/test/1', label: 'لوحة القيادة التنفيذية' },
        { path: '/test/2', label: 'سجل الطلاب وتوزيع المعلمين' },
      ];

      render(
        <TestWrapper initialLang="en">
          <SharedLayout menuItems={testMenu} title="Test System" subtitle="Test Sub">
            <div>Page Content</div>
          </SharedLayout>
        </TestWrapper>
      );

      expect(screen.getAllByText('Executive Dashboard').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Student Registry & Teacher Assignment').length).toBeGreaterThan(0);
    });

    it('translates AccountantDashboard navigation menu into English', () => {
      render(
        <TestWrapper initialLang="en">
          <AccountantDashboard />
        </TestWrapper>
      );

      expect(screen.getAllByText('Accountant Overview').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Student Collections').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Daily Cash Reconciliation').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Teacher Session Evidence').length).toBeGreaterThan(0);
    });

    it('translates PrimaryManagerDashboard navigation menu into English', () => {
      render(
        <TestWrapper initialLang="en">
          <PrimaryManagerDashboard />
        </TestWrapper>
      );

      expect(screen.getAllByText('Executive Dashboard').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Branches & Accountants').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Student Registry & Teacher Assignment').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Pricing & Subscription Governance').length).toBeGreaterThan(0);
    });
  });

  describe('3. Preservation of Category D (Names) & Category E (Math Content)', () => {
    it('preserves authentic Egyptian author and user names without synthetic translation', () => {
      const rawAuthorName = 'د. محمد عبد الله';
      const studentName = 'مريم أحمد محمود';

      // Authentic user names are dynamic data from DB, not UI keys; t(name) falls back to name
      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper initialLang="en">{children}</TestWrapper>
      });

      expect(result.current.t(rawAuthorName)).toBe(rawAuthorName);
      expect(result.current.t(studentName)).toBe(studentName);
    });

    it('preserves authentic Arabic curriculum exam problems and equations', () => {
      const mathEquation = 'أوجد قيمة س إذا كانت: س² - ٥س + ٦ = ٠';
      const geometryProblem = 'في المثلث أ ب جـ، إذا كان قياس زاوية أ = ٦٠ درجة';

      const { result } = renderHook(() => useLanguage(), {
        wrapper: ({ children }) => <TestWrapper initialLang="en">{children}</TestWrapper>
      });

      expect(result.current.t(mathEquation)).toBe(mathEquation);
      expect(result.current.t(geometryProblem)).toBe(geometryProblem);
    });
  });

  describe('4. Dynamic Layout Direction (RTL / LTR)', () => {
    it('sets LTR and lang="en" when English is active', () => {
      render(
        <TestWrapper initialLang="en">
          <div data-testid="test-content">Content</div>
        </TestWrapper>
      );

      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });

    it('restores RTL and lang="ar" when Arabic is active', () => {
      render(
        <TestWrapper initialLang="ar">
          <div data-testid="test-content">Content</div>
        </TestWrapper>
      );

      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    });
  });
});
