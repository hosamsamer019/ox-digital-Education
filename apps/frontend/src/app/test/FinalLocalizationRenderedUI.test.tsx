import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { LanguageProvider, useLanguage } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import AccountantHomePage from '../components/accountant/AccountantHomePage';
import TeacherAttendancePage from '../components/teacher/TeacherAttendancePage';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { QuestionPreview } from '../components/ui/QuestionPreview';
import AssessmentReview from '../components/ui/AssessmentReview';
import { translations } from '../utils/translations';
import { UI_TRANSLATIONS_EN } from '../utils/translationsDictionary';

// Test harness component to switch language interactively
function LanguageTestHarness({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <LanguageProvider>
        <ThemeProvider>
          <LanguageSwitcherWidget />
          {children}
        </ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

function LanguageSwitcherWidget() {
  const { language, setLanguage, isRtl } = useLanguage();
  return (
    <div data-testid="language-widget" data-lang={language} data-rtl={isRtl.toString()}>
      <button data-testid="switch-to-en" onClick={() => setLanguage('en')}>
        Switch to English
      </button>
      <button data-testid="switch-to-ar" onClick={() => setLanguage('ar')}>
        Switch to Arabic
      </button>
    </div>
  );
}

// Mock services for isolation
vi.mock('../services/accounting.service', () => ({
  accountingService: {
    getCashboxes: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getDailyClosingRecords: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getExpenseVouchers: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getExpenses: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getDailyReconciliationSummary: vi.fn().mockResolvedValue({
      success: true,
      data: { totalCollections: 1500, tillLiquidity: 5000, pendingVouchersCount: 2, totalPendingAmount: 450 }
    })
  }
}));

vi.mock('../services/brdSubscription.service', () => ({
  brdSubscriptionService: {
    getBranchReceipts: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getAccountantReceipts: vi.fn().mockResolvedValue({ success: true, data: [] })
  }
}));

describe('Final UI Localization — Rendered UI Acceptance Test Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute('lang', 'ar');
    document.documentElement.setAttribute('dir', 'rtl');
  });

  describe('1. Common Feedback States (EmptyState & LoadingState)', () => {
    it('renders localized empty state and switches dynamically between Arabic and English', () => {
      render(
        <LanguageTestHarness>
          <EmptyState />
        </LanguageTestHarness>
      );

      // Default Arabic
      expect(screen.getByText('لا توجد بيانات حالياً')).toBeInTheDocument();
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');

      // Switch to English interactively
      act(() => {
        screen.getByTestId('switch-to-en').click();
      });

      // Rendered text updates immediately without reload
      expect(screen.getByText('No data currently available')).toBeInTheDocument();
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');

      // Switch back to Arabic
      act(() => {
        screen.getByTestId('switch-to-ar').click();
      });
      expect(screen.getByText('لا توجد بيانات حالياً')).toBeInTheDocument();
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    });

    it('renders localized loading state and switches dynamically', () => {
      render(
        <LanguageTestHarness>
          <LoadingState />
        </LanguageTestHarness>
      );

      expect(screen.getByText('جاري التحميل...')).toBeInTheDocument();

      act(() => {
        screen.getByTestId('switch-to-en').click();
      });

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('2. Accountant Role Secondary Views (AccountantHomePage)', () => {
    it('renders Arabic UI text by default and translates all Category A text to English on switch', async () => {
      render(
        <LanguageTestHarness>
          <AccountantHomePage />
        </LanguageTestHarness>
      );

      // Verify Arabic UI elements exist
      expect(screen.getByText('مكتب التحصيل والسداد المعتمد')).toBeInTheDocument();
      expect(screen.getByText('سندات الصرف')).toBeInTheDocument();
      expect(screen.getByText('تحصيلات اليوم الفعلية')).toBeInTheDocument();
      expect(screen.getByText('سيولة خزائن الفرع')).toBeInTheDocument();
      expect(screen.getByText('سجل رسمي')).toBeInTheDocument();

      // Switch to English
      act(() => {
        screen.getByTestId('switch-to-en').click();
      });

      // Verify rendered UI text is now in English
      expect(screen.getByText('Approved Collection Desk')).toBeInTheDocument();
      expect(screen.getByText('Expense Vouchers')).toBeInTheDocument();
      expect(screen.getByText("Today's Actual Collections")).toBeInTheDocument();
      expect(screen.getByText('Branch Cashbox Liquidity')).toBeInTheDocument();
      expect(screen.getByText('Official Record')).toBeInTheDocument();
    });
  });

  describe('3. Teacher Role Secondary Views (TeacherAttendancePage)', () => {
    it('renders attendance table headers and filters in Arabic, translating to English dynamically', () => {
      render(
        <LanguageTestHarness>
          <TeacherAttendancePage />
        </LanguageTestHarness>
      );

      // Verify Arabic UI elements
      expect(screen.getByText('سجل الحضور المدرسي')).toBeInTheDocument();
      expect(screen.getByText(/حفظ الحضور/i)).toBeInTheDocument();

      // Switch to English
      act(() => {
        screen.getByTestId('switch-to-en').click();
      });

      // Verify English rendered UI
      expect(screen.getByText('School Attendance Record')).toBeInTheDocument();
      expect(screen.getByText(/Save Attendance/i)).toBeInTheDocument();
    });
  });

  describe('4. Assessment & Academic Content Distinction (Category A vs Category C)', () => {
    it('translates UI surrounding labels (Question, Score, Correct Answer) while preserving authored academic mathematics (Category C)', () => {
      const mockAcademicQuestion = {
        id: 'q-math-01',
        questionText: 'أوجد قيمة س في المعادلة التربيعية: س² - ٥س + ٦ = ٠',
        type: 'MULTIPLE_CHOICE' as const,
        points: 5,
        options: [
          { id: 'opt-1', text: 'س = ٢ أو س = ٣' },
          { id: 'opt-2', text: 'س = -٢ أو س = -٣' },
          { id: 'opt-3', text: 'س = ١ أو س = ٦' },
          { id: 'opt-4', text: 'س = ٠' }
        ],
        correctAnswer: 'opt-1',
        explanation: 'بالتحليل إلى عوامل: (س - ٢)(س - ٣) = ٠، إذن س = ٢ أو س = ٣'
      };

      render(
        <LanguageTestHarness>
          <QuestionPreview question={mockAcademicQuestion} showSolution={true} isTeacher={true} />
        </LanguageTestHarness>
      );

      // Verify Category C content is in authentic authored Arabic
      expect(document.body.textContent).toContain('أوجد قيمة س');
      expect(document.body.textContent).toContain('س = ٠');

      // Verify Category A surrounding UI labels are present in Arabic
      expect(screen.getByText('الخيارات:')).toBeInTheDocument();
      expect(screen.getByText('✓ صحيح')).toBeInTheDocument();

      // Switch to English
      act(() => {
        screen.getByTestId('switch-to-en').click();
      });

      // In English mode:
      // Category A labels MUST be translated
      expect(screen.getByText('Options:')).toBeInTheDocument();
      expect(screen.getByText('✓ Correct')).toBeInTheDocument();

      // Category C authored mathematics MUST remain authentic Arabic!
      expect(document.body.textContent).toContain('أوجد قيمة س');
      expect(document.body.textContent).toContain('س = ٠');
    });
  });

  describe('5. Translation Dictionary Completeness & Integrity', () => {
    it('ensures UI_TRANSLATIONS_EN contains all core domain terms with non-empty translations', () => {
      expect(Object.keys(UI_TRANSLATIONS_EN).length).toBeGreaterThan(2500);

      // Check critical representative keys
      expect(UI_TRANSLATIONS_EN['لوحة العمليات اليومية']).toBe('Daily Operations Board');
      expect(UI_TRANSLATIONS_EN['مكتب التحصيل والسداد']).toBe('Collection Desk');
      expect(UI_TRANSLATIONS_EN['سندات الصرف']).toBe('Expense Vouchers');
      expect(UI_TRANSLATIONS_EN['المحاسبة المالية']).toBe('Financial Accounting');
      expect(UI_TRANSLATIONS_EN['الفرع الرئيسي (الدقي)']).toBe('Main Branch (Dokki)');
      expect(UI_TRANSLATIONS_EN['تحديث البيانات']).toBe('Refresh Data');
      expect(UI_TRANSLATIONS_EN['جاري التحميل...']).toBe('Loading...');
      expect(UI_TRANSLATIONS_EN['لا توجد بيانات متاحة']).toBe('No data available');
      expect(UI_TRANSLATIONS_EN['تم الحفظ بنجاح']).toBe('Saved successfully');
      expect(UI_TRANSLATIONS_EN['تسليم الاختبار']).toBe('Submit Exam');
      expect(UI_TRANSLATIONS_EN['بدء الاختبار']).toBe('Start Exam');
      expect(UI_TRANSLATIONS_EN['الإجابة الصحيحة']).toBe('Correct Answer');
      expect(UI_TRANSLATIONS_EN['السؤال']).toBe('Question');
      expect(UI_TRANSLATIONS_EN['الدرجة']).toBe('Score');
    });

    it('ensures bidirectional translations do not produce undefined or object references', () => {
      const sampleKeys = [
        'dashboard',
        'attendance',
        'homework',
        'exams',
        'courses',
        'students',
        'save',
        'cancel',
        'delete',
        'confirm',
        'retry',
        'close'
      ];

      sampleKeys.forEach(k => {
        const arVal = (translations.ARABIC as any)[k];
        const enVal = (translations.ENGLISH as any)[k];
        expect(typeof arVal).toBe('string');
        expect(typeof enVal).toBe('string');
        expect(arVal.length).toBeGreaterThan(0);
        expect(enVal.length).toBeGreaterThan(0);
      });
    });
  });
});
