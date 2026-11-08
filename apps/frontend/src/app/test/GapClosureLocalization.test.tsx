import { render, screen, act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { LanguageProvider, useLanguage, t } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { useExamAntiCheat } from '../hooks/useExamAntiCheat';
import { useSelectedChild } from '../components/parent/useSelectedChild';
import ErrorBoundary from '../components/shared/ErrorBoundary';
import ReceiptsManagementPage from '../components/accountant/ReceiptsManagementPage';
import AdminUsersPage from '../components/admin/AdminUsersPage';
import { ChildSelector } from '../components/parent/ChildSelector';
import { AccountantDashboard } from '../components/accountant/AccountantDashboard';
import { PrimaryManagerDashboard } from '../components/primary-manager/PrimaryManagerDashboard';
import { toast } from 'sonner';
import { translations } from '../utils/translations';
import { UI_TRANSLATIONS_EN } from '../utils/translationsDictionary';
import { userService } from '../services/user.service';
import { examService } from '../services/exam.service';
import { brdSubscriptionService } from '../services/brdSubscription.service';

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
    getChildren: vi.fn(),
    getUsers: vi.fn(),
    deleteUsersBulk: vi.fn()
  }
}));

vi.mock('../services/exam.service', () => ({
  examService: {
    reportViolation: vi.fn()
  }
}));

vi.mock('../services/brdSubscription.service', () => ({
  brdSubscriptionService: {
    getAccountantReceipts: vi.fn()
  }
}));

// Test harness with reactive language switcher
function TestHarness({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <LanguageSwitcher />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div data-testid="lang-switcher">
      <button data-testid="btn-en" onClick={() => setLanguage('en')}>Set EN</button>
      <button data-testid="btn-ar" onClick={() => setLanguage('ar')}>Set AR</button>
      <span data-testid="current-lang">{language}</span>
    </div>
  );
}

describe('OX-DIGITAL Education — Localization Final Gap Closure Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    vi.mocked(examService.reportViolation).mockResolvedValue({
      data: { violationCount: 1, status: 'WARNED', isDisqualified: false }
    } as any);

    vi.mocked(userService.getChildren).mockRejectedValue(new Error('Network Error'));

    vi.mocked(userService.getUsers).mockResolvedValue({
      data: [
        { id: 'usr-1', name: 'أحمد محمود علي', email: 'ahmed@ox.edu', role: 'TEACHER' },
        { id: 'usr-2', name: 'سارة إبراهيم محمد', email: 'sara@ox.edu', role: 'ONLINE_STUDENT' }
      ],
      total: 2,
      page: 1,
      totalPages: 1
    } as any);

    vi.mocked(brdSubscriptionService.getAccountantReceipts).mockResolvedValue({
      data: [
        {
          id: 'rcp-01',
          receiptNumber: 'RCP-2026-0001',
          amount: 2500,
          receivingMethod: 'CASH',
          monthsCovered: 'أكتوبر - نوفمبر',
          createdAt: '2026-10-15T10:00:00Z',
          student: { name: 'عمر شريف فاروق', gradeLevel: 'الصف الثالث الثانوي' },
          teacher: { name: 'أ / إبراهيم العوضي' },
          payment: { status: 'CONFIRMED' }
        }
      ]
    } as any);
  });

  // 1. Anti-Cheat Warning Toast in Arabic and English
  describe('1. Non-JSX Gap Remediations: useExamAntiCheat', () => {
    it('generates Arabic anti-cheat warning toast when language is Arabic', async () => {
      localStorage.setItem('preferred_language', 'ar');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LanguageProvider>{children}</LanguageProvider>
      );

      renderHook(() =>
        useExamAntiCheat({
          assessmentId: 'exam-101',
          attemptId: 'att-1',
          studentIdentifier: 'stu-1',
          enabled: true,
          onDisqualified: vi.fn()
        }),
        { wrapper }
      );

      await act(async () => {
        window.dispatchEvent(new Event('blur'));
      });

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith(
          expect.stringContaining('تحذير: تم رصد مغادرة شاشة الامتحان!')
        );
      });
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('(1 من 3)')
      );
    });

    it('generates English anti-cheat warning toast when language is English', async () => {
      localStorage.setItem('preferred_language', 'en');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <LanguageProvider>{children}</LanguageProvider>
      );

      renderHook(() =>
        useExamAntiCheat({
          assessmentId: 'exam-101',
          attemptId: 'att-1',
          studentIdentifier: 'stu-1',
          enabled: true,
          onDisqualified: vi.fn()
        }),
        { wrapper }
      );

      await act(async () => {
        window.dispatchEvent(new Event('blur'));
      });

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith(
          expect.stringContaining('Warning: Exam screen departure detected!')
        );
      });
      expect(toast.warning).toHaveBeenCalledWith(
        expect.stringContaining('(1 of 3)')
      );
    });
  });

  // 2. Parent Child-Selection Network Error in Arabic and English
  describe('2. Non-JSX Gap Remediations: useSelectedChild', () => {
    it('sets Arabic network error message when in Arabic mode', async () => {
      localStorage.setItem('preferred_language', 'ar');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter>
          <LanguageProvider>{children}</LanguageProvider>
        </MemoryRouter>
      );

      const { result } = renderHook(() => useSelectedChild(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('تعذر تحميل بيانات الأبناء. يرجى التحقق من اتصال الشبكة.');
    });

    it('sets English network error message when in English mode', async () => {
      localStorage.setItem('preferred_language', 'en');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter>
          <LanguageProvider>{children}</LanguageProvider>
        </MemoryRouter>
      );

      const { result } = renderHook(() => useSelectedChild(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load children data. Please check network connection.');
    });
  });

  // 3. ErrorBoundary Behavior Without Hooks
  describe('3. ErrorBoundary Class Component Localization', () => {
    it('renders localized network error without using hooks', () => {
      localStorage.setItem('preferred_language', 'ar');

      const ThrowingComp = () => {
        throw new Error('Network Error');
      };

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowingComp />
        </ErrorBoundary>
      );

      expect(screen.getByText('فشل الاتصال بالإنترنت')).toBeInTheDocument();
      spy.mockRestore();
    });

    it('renders English network error when preferred_language is en', () => {
      localStorage.setItem('preferred_language', 'en');

      const ThrowingComp = () => {
        throw new Error('Network Error');
      };

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowingComp />
        </ErrorBoundary>
      );

      expect(screen.getByText('Internet connection failed')).toBeInTheDocument();
      spy.mockRestore();
    });
  });

  // 4. Reactive Language Switching in Reviewed Components
  describe('4. Reactive Language Switching Without Reload', () => {
    it('dynamically translates ChildSelector direction and label on language toggle', () => {
      const mockChildren: any[] = [
        { id: 'c1', name: 'علي أحمد' },
        { id: 'c2', name: 'سارة أحمد' }
      ];

      render(
        <TestHarness>
          <ChildSelector
            childrenList={mockChildren}
            selectedChildId="c1"
            onSelectChild={vi.fn()}
          />
        </TestHarness>
      );

      // Default Arabic
      expect(screen.getByText('تحديد الطالب للمتابعة:')).toBeInTheDocument();
      const container = screen.getByText('تحديد الطالب للمتابعة:').closest('[dir]');
      expect(container).toHaveAttribute('dir', 'rtl');

      // Switch to English
      act(() => {
        screen.getByTestId('btn-en').click();
      });

      expect(screen.getByText('Select student to track:')).toBeInTheDocument();
      expect(container).toHaveAttribute('dir', 'ltr');

      // Switch back to Arabic
      act(() => {
        screen.getByTestId('btn-ar').click();
      });
      expect(screen.getByText('تحديد الطالب للمتابعة:')).toBeInTheDocument();
      expect(container).toHaveAttribute('dir', 'rtl');
    });

    it('dynamically translates AccountantDashboard subtitle on language toggle', () => {
      render(
        <TestHarness>
          <AccountantDashboard />
        </TestHarness>
      );

      // Default Arabic subtitle (appears in both desktop and mobile sidebar)
      expect(screen.getAllByText('قسم الحسابات والتحصيلات').length).toBeGreaterThan(0);

      // Switch to English
      act(() => {
        screen.getByTestId('btn-en').click();
      });

      expect(screen.getAllByText('Accounts & Collections Department').length).toBeGreaterThan(0);
    });

    it('dynamically translates PrimaryManagerDashboard subtitle on language toggle', () => {
      render(
        <TestHarness>
          <PrimaryManagerDashboard />
        </TestHarness>
      );

      // Default Arabic subtitle (appears in both desktop and mobile sidebar)
      expect(screen.getAllByText('الإدارة التنفيذية العامة والحوكمة').length).toBeGreaterThan(0);

      // Switch to English
      act(() => {
        screen.getByTestId('btn-en').click();
      });

      expect(screen.getAllByText('General Executive Management & Governance').length).toBeGreaterThan(0);
    });
  });

  // 5. ReceiptsManagementPage Interface Translations
  describe('5. ReceiptsManagementPage Localization', () => {
    it('renders all static UI labels in Arabic, translating cleanly to English', async () => {
      render(
        <TestHarness>
          <ReceiptsManagementPage />
        </TestHarness>
      );

      // Wait for receipts to load
      await waitFor(() => {
        expect(screen.getByText('عمر شريف فاروق')).toBeInTheDocument();
      });

      expect(screen.getByText('سجل الإيصالات المتسلسلة للفرع (Branch Receipts)')).toBeInTheDocument();
      expect(screen.getByText('تحديث السجل')).toBeInTheDocument();
      expect(screen.getByText('جميع طرق السداد')).toBeInTheDocument();
      expect(screen.getByText('معتمد')).toBeInTheDocument();

      // Category B: Student and Teacher names MUST remain authentic Arabic!
      expect(screen.getByText('عمر شريف فاروق')).toBeInTheDocument();
      expect(screen.getByText('أ / إبراهيم العوضي')).toBeInTheDocument();

      // Switch to English
      act(() => {
        screen.getByTestId('btn-en').click();
      });

      // Verify translated UI labels
      expect(screen.getByText('Sequential Branch Receipts Log')).toBeInTheDocument();
      expect(screen.getByText('Refresh Log')).toBeInTheDocument();
      expect(screen.getByText('All Payment Methods')).toBeInTheDocument();
      expect(screen.getByText('Approved')).toBeInTheDocument();

      // Category B student/teacher names remain unchanged!
      expect(screen.getByText('عمر شريف فاروق')).toBeInTheDocument();
      expect(screen.getByText('أ / إبراهيم العوضي')).toBeInTheDocument();
    });
  });

  // 6. AdminUsersPage Interface Translations
  describe('6. AdminUsersPage Localization', () => {
    it('renders admin users management interface in Arabic and translates to English', async () => {
      render(
        <TestHarness>
          <AdminUsersPage />
        </TestHarness>
      );

      // Wait for users table to load
      await waitFor(() => {
        expect(screen.getByText('أحمد محمود علي')).toBeInTheDocument();
      });

      // Verify Arabic headers
      expect(screen.getByText('إدارة المستخدمين')).toBeInTheDocument();
      expect(screen.getByText('إضافة وتعديل وحذف المستخدمين، وإدارة الصلاحيات')).toBeInTheDocument();
      expect(screen.getByText('إضافة مستخدم')).toBeInTheDocument();
      expect(screen.getByText('سارة إبراهيم محمد')).toBeInTheDocument();

      // Switch to English
      act(() => {
        screen.getByTestId('btn-en').click();
      });

      // Verify English headers
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Add, edit, and delete users, and manage permissions')).toBeInTheDocument();
      expect(screen.getByText('Add User')).toBeInTheDocument();

      // Category B: User names remain preserved
      expect(screen.getByText('أحمد محمود علي')).toBeInTheDocument();
      expect(screen.getByText('سارة إبراهيم محمد')).toBeInTheDocument();
    });
  });

  // 7. Academic Math Preservation (Category C) vs UI Controls (Category A)
  describe('7. Mathematical Content Integrity (Category C Preservation)', () => {
    it('preserves authentic Arabic mathematics expressions without corruption', () => {
      // Direct dictionary assertions
      expect(UI_TRANSLATIONS_EN['دخول الامتحان بكود الاختبار']).toBe('Enter Exam with Access Code');
      expect(UI_TRANSLATIONS_EN['تأكيد إنهاء وتسليم الامتحان']).toBe('Confirm Finish and Submit Exam');
      expect(UI_TRANSLATIONS_EN['الأسئلة المُجاب عليها:']).toBe('Answered Questions:');
      expect(UI_TRANSLATIONS_EN['إجمالي الأسئلة:']).toBe('Total Questions:');

      // Authored math expressions must NOT be in UI translation dictionaries
      expect((UI_TRANSLATIONS_EN as any)['أوجد قيمة س']).toBeUndefined();
      expect((UI_TRANSLATIONS_EN as any)['س = ٠']).toBeUndefined();
      expect((UI_TRANSLATIONS_EN as any)['د(س) = س²']).toBeUndefined();
    });
  });

  // 8. Technical Invariant Integrity
  describe('8. Technical Identifier Protection', () => {
    it('ensures route paths, role codes, and storage keys are never translated', () => {
      const technicalKeys = [
        '/teacher/home',
        '/admin/users',
        '/accountant/receipts',
        'ADMIN',
        'TEACHER',
        'ACCOUNTANT',
        'ONLINE_STUDENT',
        'CENTER_STUDENT',
        'PARENT',
        'preferred_language',
        'edu-lang',
        'edu-theme'
      ];

      technicalKeys.forEach(tk => {
        expect((UI_TRANSLATIONS_EN as any)[tk]).toBeUndefined();
      });
    });
  });
});
