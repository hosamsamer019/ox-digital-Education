import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import LandingPage from '../components/landing/LandingPage';
import { describe, it, expect, beforeEach } from 'vitest';

describe('LandingPage UI & Responsive Verification', () => {
  beforeEach(() => {
    (window as any).IntersectionObserver = class {
      observe = () => null;
      unobserve = () => null;
      disconnect = () => null;
    };
  });

  const renderLandingPage = () => {
    return render(
      <MemoryRouter>
        <ThemeProvider>
          <LandingPage />
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  it('renders landing page with platform brand and authentic Arabic typography', () => {
    renderLandingPage();
    // Brand header & footer
    const brandHeadings = screen.getAllByText(/OX-DIGITAL Education/i);
    expect(brandHeadings.length).toBeGreaterThan(0);

    // Hero title in Arabic
    expect(screen.getByText(/التعليم الأكاديمي والذكي بمعايير رصينة/i)).toBeInTheDocument();
    expect(screen.getByText(/وتقنيات تقييم متقدمة لا تقبل المساومة/i)).toBeInTheDocument();

    // Section headings & authentic credentials
    expect(screen.getAllByText(/المنظومة التعليمية/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/المحرك الرياضي/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/المناهج والمراحل/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الأمان والنزاهة/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الأسئلة الشائعة/i).length).toBeGreaterThan(0);
  });

  it('verifies navigation actions and direct exam entry buttons', () => {
    renderLandingPage();

    // Direct exam code buttons in header
    const examButtons = screen.getAllByRole('button', { name: /دخول امتحان بكود|دخول الامتحان الآن/i });
    expect(examButtons.length).toBeGreaterThan(0);

    // Primary login button
    expect(screen.getAllByRole('button', { name: /تسجيل الدخول/i }).length).toBeGreaterThan(0);

    // Teacher portal button
    expect(screen.getAllByRole('button', { name: /بوابة المعلم/i }).length).toBeGreaterThan(0);
  });

  it('renders copyright statement in the footer', () => {
    renderLandingPage();

    // Ownership & copyright notice
    expect(
      screen.getByText(/جميع الحقوق محفوظة — منصة أو إكس الرقمية التعليمية \(OX-DIGITAL Education\)/i)
    ).toBeInTheDocument();
  });

  it('renders semantic HTML structure with exactly one h1 and proper sections', () => {
    renderLandingPage();

    expect(document.querySelector('header')).toBeInTheDocument();
    expect(document.querySelector('nav')).toBeInTheDocument();
    expect(document.querySelector('main#main-content')).toBeInTheDocument();
    expect(document.querySelector('footer')).toBeInTheDocument();

    const h1Elements = document.querySelectorAll('h1');
    expect(h1Elements.length).toBe(1);
    expect(h1Elements[0].textContent).toContain('التعليم الأكاديمي والذكي بمعايير رصينة');

    // Sections
    expect(document.querySelector('section#ecosystem')).toBeInTheDocument();
    expect(document.querySelector('section#math-engine')).toBeInTheDocument();
    expect(document.querySelector('section#curriculum')).toBeInTheDocument();
    expect(document.querySelector('section#security')).toBeInTheDocument();
    expect(document.querySelector('section#faq')).toBeInTheDocument();
  });

  it('renders Tri-Role Ecosystem and FAQ sections with factual content', () => {
    renderLandingPage();

    // Roles content
    expect(screen.getByText('للطلاب والدارسين')).toBeInTheDocument();
    expect(screen.getByText('للمعلمين والمشرفين والمراكز')).toBeInTheDocument();
    expect(screen.getByText('لأولياء الأمور')).toBeInTheDocument();

    // FAQ section content
    expect(screen.getByText('كيف يعمل نظام دخول الامتحان بكود للطالب الخارجي؟')).toBeInTheDocument();
    expect(screen.getByText('كيف يضمن مشغل الفيديو إتمام مشاهدة الدرس كاملاً؟')).toBeInTheDocument();
    expect(screen.getByText('ما هي ضوابط مكافحة محاولات الغش أثناء أداء الامتحان؟')).toBeInTheDocument();
  });

  it('renders theme toggle and toggles between light and dark themes', () => {
    localStorage.clear();
    renderLandingPage();

    // Find theme toggle button by aria-label
    const themeButtons = screen.getAllByRole('button', { name: /تبديل إلى الوضع/i });
    expect(themeButtons.length).toBeGreaterThan(0);

    // Initial theme should be set on documentElement
    const initialTheme = document.documentElement.getAttribute('data-theme');
    expect(['dark', 'light']).toContain(initialTheme);

    // Click theme toggle using fireEvent wrapped in act
    act(() => {
      fireEvent.click(themeButtons[0]);
    });

    const toggledTheme = document.documentElement.getAttribute('data-theme');
    expect(toggledTheme).not.toBe(initialTheme);
    expect(localStorage.getItem('edu-theme')).toBe(toggledTheme);
  });
});


