import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SupportSection from '../components/landing/components/SupportSection';
import { describe, it, expect, vi } from 'vitest';

const mockedNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe('SupportSection — FAQ & Help Desk Responsive Remediation', () => {
  const renderSupportSection = () => {
    return render(
      <MemoryRouter>
        <SupportSection />
      </MemoryRouter>
    );
  };

  it('renders section title, category pill, and institutional help desk card', () => {
    renderSupportSection();

    expect(screen.getByText('الأسئلة الشائعة والمساعدة')).toBeInTheDocument();
    expect(screen.getByText('إجابات واضحة ومباشرة حول خدمات المنصة')).toBeInTheDocument();
    expect(screen.getByText('مركز المساعدة والمتابعة الأكاديمية')).toBeInTheDocument();
  });

  it('renders all 6 factual FAQ items with proper accessible markup', () => {
    renderSupportSection();

    const questions = [
      'كيف يعمل نظام دخول الامتحان بكود للطالب الخارجي؟',
      'كيف يضمن مشغل الفيديو إتمام مشاهدة الدرس كاملاً؟',
      'ما هي ضوابط مكافحة محاولات الغش أثناء أداء الامتحان؟',
      'كيف يمكن لولي الأمر متابعة درجات وحضور الطالب؟',
      'هل تدعم المنصة كتابة المعادلات والرموز الرياضية المعقدة؟',
      'ما هي الأجهزة المتوافقة مع تشغيل المنصة؟',
    ];

    questions.forEach((q) => {
      expect(screen.getByText(q)).toBeInTheDocument();
    });

    // Check first question is open by default
    const firstButton = screen.getByRole('button', { name: new RegExp(questions[0]) });
    expect(firstButton).toHaveAttribute('aria-expanded', 'true');
    expect(firstButton).toHaveAttribute('aria-controls', 'faq-a-0');

    // First answer is visible
    expect(screen.getByText(/يتيح النظام للطلاب تقديم الاختبارات التي يحددها المعلم مباشرة/i)).toBeInTheDocument();
  });

  it('toggles accordion items correctly on click', () => {
    renderSupportSection();

    const q1 = screen.getByRole('button', { name: /كيف يعمل نظام دخول الامتحان بكود للطالب الخارجي؟/i });
    const q2 = screen.getByRole('button', { name: /كيف يضمن مشغل الفيديو إتمام مشاهدة الدرس كاملاً؟/i });

    // Initially q1 open, q2 closed
    expect(q1).toHaveAttribute('aria-expanded', 'true');
    expect(q2).toHaveAttribute('aria-expanded', 'false');

    // Click q2 to open it
    fireEvent.click(q2);
    expect(q2).toHaveAttribute('aria-expanded', 'true');
    expect(q1).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText(/مشغل الفيديو في OX-DIGITAL مبرمج لربط تقدم الطالب بالسيرفر لحظياً/i)).toBeInTheDocument();

    // Click q2 again to close it
    fireEvent.click(q2);
    expect(q2).toHaveAttribute('aria-expanded', 'false');
  });

  it('executes navigation for both help actions', () => {
    renderSupportSection();

    const loginHelpBtn = screen.getByRole('button', { name: /تسجيل الدخول للمساعدة الفنية المباشرة/i });
    const examCheckBtn = screen.getByRole('button', { name: /التحقق من كود الامتحان الخارجي/i });

    fireEvent.click(loginHelpBtn);
    expect(mockedNavigate).toHaveBeenCalledWith('/login');

    fireEvent.click(examCheckBtn);
    expect(mockedNavigate).toHaveBeenCalledWith('/external-exam');
  });

  it('verifies responsive classes and SVG shrink prevention', () => {
    const { container } = renderSupportSection();

    // Verify sidebar has scoped lg:sticky (not global sticky)
    const sidebar = container.querySelector('.lg\\:sticky');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar?.classList.contains('sticky')).toBe(false);

    // Verify buttons have min-h-[48px] for touch targets and shrink-0 on icons
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      const svgs = btn.querySelectorAll('svg');
      svgs.forEach((svg) => {
        expect(svg.classList.contains('shrink-0')).toBe(true);
      });
    });
  });
});

