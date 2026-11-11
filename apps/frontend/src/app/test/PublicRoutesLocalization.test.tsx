import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import LandingPage from '../components/landing/LandingPage';
import LoginPage from '../components/auth/LoginPage';
import AdminLoginPage from '../components/auth/AdminLoginPage';

describe('Public Routes Complete English & Arabic Localization (Defect B)', () => {
  beforeEach(() => {
    localStorage.clear();
    (window as any).IntersectionObserver = class {
      observe = () => null;
      unobserve = () => null;
      disconnect = () => null;
    };
  });

  const renderWithProviders = (ui: React.ReactElement, initialLang: 'ar' | 'en' = 'ar') => {
    localStorage.setItem('preferred_language', initialLang);
    localStorage.setItem('edu-lang', initialLang === 'ar' ? 'ARABIC' : 'ENGLISH');
    return render(
      <MemoryRouter>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              {ui}
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );
  };

  describe('1. Route / (LandingPage)', () => {
    it('renders 100% Arabic with dir="rtl" by default', () => {
      const { container } = renderWithProviders(<LandingPage />, 'ar');
      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.getAttribute('dir')).toBe('rtl');
      expect(document.documentElement.getAttribute('lang')).toBe('ar');
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');

      // Hero in Arabic
      expect(screen.getByText(/التعليم الأكاديمي والذكي بمعايير رصينة/i)).toBeInTheDocument();
      expect(screen.getByText(/وتقنيات تقييم متقدمة لا تقبل المساومة/i)).toBeInTheDocument();
      expect(screen.getByText(/ابدأ كطالب في المنصة/i)).toBeInTheDocument();

      // Quick Exam Terminal in Arabic
      expect(screen.getByText(/دخول الامتحان بكود الاختبار/i)).toBeInTheDocument();
      expect(screen.getByText(/دخول الامتحان الآن/i)).toBeInTheDocument();

      // Footer
      expect(screen.getByText(/جميع الحقوق محفوظة — منصة أو إكس الرقمية التعليمية/i)).toBeInTheDocument();
    });

    it('renders clean English with dir="ltr" when preferred_language="en"', () => {
      const { container } = renderWithProviders(<LandingPage />, 'en');
      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');

      // Hero in English without broken regex fragments
      expect(screen.getByText(/Academic & Intelligent Education with Rigorous Standards,/i)).toBeInTheDocument();
      expect(screen.getByText(/and Advanced Assessment Technologies Built Without Compromise\./i)).toBeInTheDocument();
      expect(screen.getByText(/Start as a Student/i)).toBeInTheDocument();
      expect(screen.getByText(/Educators & Centers Portal/i)).toBeInTheDocument();

      // Quick Exam Terminal in English
      expect(screen.getByText(/Enter Exam with Test Code/i)).toBeInTheDocument();
      expect(screen.getByText(/Access Exam Now/i)).toBeInTheDocument();
      expect(screen.getByText(/Instant Automated Grading/i)).toBeInTheDocument();
      expect(screen.getByText(/Strict Timer Windows/i)).toBeInTheDocument();

      // Role Ecosystem in English
      expect(screen.getByText(/Integrated Educational Ecosystem/i)).toBeInTheDocument();
      expect(screen.getByText(/Dedicated Pedagogical Environment Uniting All Stakeholders/i)).toBeInTheDocument();

      // Footer in English
      expect(screen.getByText(/All rights reserved — OX-DIGITAL Education Platform/i)).toBeInTheDocument();
      expect(screen.getByText(/100% Encrypted & Secure Connection/i)).toBeInTheDocument();

      // Check that broken regex replacement strings NEVER appear
      expect(container.textContent).not.toContain('التعليم الأكاديمي and Smart');
      expect(container.textContent).not.toContain('no تقبل');
      expect(container.textContent).not.toContain('ابدأ كطالب in Platform');
      expect(container.textContent).not.toContain('دخول Teachers');
      expect(container.textContent).not.toContain('100% Second Second');
    });

    it('toggles language from Arabic to English via LanguageToggle button', async () => {
      renderWithProviders(<LandingPage />, 'ar');
      const toggleBtn = screen.getByRole('button', { name: /Switch to English/i });
      expect(toggleBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(toggleBtn);
      });

      expect(localStorage.getItem('preferred_language')).toBe('en');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('lang')).toBe('en');
      expect(screen.getByText(/Academic & Intelligent Education with Rigorous Standards,/i)).toBeInTheDocument();
    });
  });

  describe('2. Route /login (LoginPage)', () => {
    it('renders 100% Arabic with dir="rtl" by default', () => {
      const { container } = renderWithProviders(<LoginPage />, 'ar');
      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.getAttribute('dir')).toBe('rtl');

      expect(screen.getByText(/بوابة الدخول الموحدة/i)).toBeInTheDocument();
      expect(screen.getByText(/إدارة المنظومة والسنتر/i)).toBeInTheDocument();
      expect(screen.getByText(/معلم \/ محاضر/i)).toBeInTheDocument();
      expect(screen.getByText(/محاسب الفرع/i)).toBeInTheDocument();
      expect(screen.getByText(/طالب أونلاين/i)).toBeInTheDocument();
      expect(screen.getByText(/طالب سنتر/i)).toBeInTheDocument();
      expect(screen.getByText(/ولي أمر/i)).toBeInTheDocument();
    });

    it('renders clean English with dir="ltr" and all 6 role cards in English when preferred_language="en"', () => {
      const { container } = renderWithProviders(<LoginPage />, 'en');
      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');

      // Title & Subtitle in English
      expect(screen.getByText(/Unified Access Portal/i)).toBeInTheDocument();
      expect(screen.getByText(/Select your role to proceed to your dashboard/i)).toBeInTheDocument();

      // All 6 roles rendered in English
      expect(screen.getByText(/System & Center Administration/i)).toBeInTheDocument();
      expect(screen.getByText(/Executive Governance/i)).toBeInTheDocument();

      expect(screen.getByText(/Teacher \/ Lecturer/i)).toBeInTheDocument();
      expect(screen.getByText(/Academic Teacher Suite/i)).toBeInTheDocument();

      expect(screen.getByText(/Branch Accountant/i)).toBeInTheDocument();
      expect(screen.getByText(/Branch Accounts & Invoicing/i)).toBeInTheDocument();

      expect(screen.getByText(/Online Student/i)).toBeInTheDocument();
      expect(screen.getByText(/Distance Learning/i)).toBeInTheDocument();

      expect(screen.getByText(/Center Student/i)).toBeInTheDocument();
      expect(screen.getByText(/Center Cohorts & Attendance/i)).toBeInTheDocument();

      expect(screen.getByText(/Parent \/ Guardian/i)).toBeInTheDocument();
      expect(screen.getByText(/Family Oversight/i)).toBeInTheDocument();

      // Check form transition
      const teacherRoleCard = screen.getByText(/Teacher \/ Lecturer/i).closest('button')!;
      act(() => {
        fireEvent.click(teacherRoleCard);
      });

      expect(screen.getByText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByText(/^Password$/i)).toBeInTheDocument();
      expect(screen.getByText(/Forgot password\?/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });
  });

  describe('3. Route /admin/login (AdminLoginPage)', () => {
    it('renders 100% Arabic with dir="rtl" by default', () => {
      const { container } = renderWithProviders(<AdminLoginPage />, 'ar');
      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.getAttribute('dir')).toBe('rtl');

      expect(screen.getByText(/بوابة الإدارة العامة المحمية/i)).toBeInTheDocument();
      expect(screen.getByText(/دخول إدارة المنظومة/i)).toBeInTheDocument();
      expect(screen.getByText(/البريد الإلكتروني للإدارة/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /دخول لوحة الإدارة/i })).toBeInTheDocument();
    });

    it('renders clean English with dir="ltr" when preferred_language="en"', () => {
      const { container } = renderWithProviders(<AdminLoginPage />, 'en');
      const rootDiv = container.firstElementChild as HTMLElement;
      expect(rootDiv.getAttribute('dir')).toBe('ltr');
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');

      expect(screen.getByText(/Protected Administrative Gateway/i)).toBeInTheDocument();
      expect(screen.getByText(/System Administration Login/i)).toBeInTheDocument();
      expect(screen.getByText(/Administrator Email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Access Admin Console/i })).toBeInTheDocument();
      expect(screen.getByText(/TLS 1\.3 Encrypted Session/i)).toBeInTheDocument();
    });
  });
});
