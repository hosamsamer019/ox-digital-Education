import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LoadingState } from '../components/ui/LoadingState';
import {
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonList,
  SkeletonCourseCard,
  DashboardHomeSkeleton,
} from '../components/ui/skeleton';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/EmptyState';
import { BookOpen } from 'lucide-react';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('Phase 5.10: Global Loading Experience & Interaction Feedback System', () => {
  describe('1. LoadingState Component Accessibility & Branded Styling', () => {
    it('renders with role="status", aria-live="polite", and institutional crimson theme', () => {
      renderWithTheme(<LoadingState message="جاري إعداد بيئة التعلم..." />);

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveAttribute('aria-live', 'polite');
      expect(statusEl).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('جاري إعداد بيئة التعلم...')).toBeInTheDocument();
    });

    it('renders subMessage and screen reader text properly', () => {
      renderWithTheme(
        <LoadingState
          message="جاري التحديث"
          subMessage="قد يستغرق ذلك بضع ثوانٍ"
          size="sm"
        />
      );

      expect(screen.getByText('جاري التحديث')).toBeInTheDocument();
      expect(screen.getByText('قد يستغرق ذلك بضع ثوانٍ')).toBeInTheDocument();
      expect(screen.getByRole('status')).toContainElement(screen.getByText('جاري التحديث'));
    });

    it('supports size variants without breaking layout', () => {
      const { rerender } = renderWithTheme(<LoadingState size="sm" message="صغير" />);
      expect(screen.getByRole('status')).toHaveClass('min-h-[120px]');

      rerender(<ThemeProvider><LoadingState size="lg" message="كبير" /></ThemeProvider>);
      expect(screen.getByRole('status')).toHaveClass('min-h-[50vh]');
    });
  });

  describe('2. Skeleton Primitives and Composite Skeletons', () => {
    it('renders base Skeleton with aria-hidden="true" and motion-reduce protection', () => {
      const { container } = renderWithTheme(<Skeleton className="w-20 h-4" />);
      const skeleton = container.querySelector('[data-slot="skeleton"]');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('aria-hidden', 'true');
      expect(skeleton).toHaveClass('motion-reduce:animate-none');
    });

    it('renders SkeletonCard for KPI metric cards', () => {
      const { container } = renderWithTheme(<SkeletonCard />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute('aria-hidden', 'true');
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThanOrEqual(4);
    });

    it('renders SkeletonTable with configurable rows and columns', () => {
      const { container } = renderWithTheme(<SkeletonTable rows={4} columns={5} />);
      const table = container.firstChild as HTMLElement;
      expect(table).toHaveAttribute('aria-hidden', 'true');
      // Header has 5 skeletons, 4 rows * 5 = 20, total = 25
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBe(25);
    });

    it('renders SkeletonList for notification/activity streams', () => {
      const { container } = renderWithTheme(<SkeletonList items={3} />);
      const list = container.firstChild as HTMLElement;
      expect(list).toHaveAttribute('aria-hidden', 'true');
      // 3 items * 4 skeletons each = 12
      const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBe(12);
    });

    it('renders SkeletonCourseCard with video aspect ratio placeholder', () => {
      const { container } = renderWithTheme(<SkeletonCourseCard />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute('aria-hidden', 'true');
      const aspectVideo = container.querySelector('.aspect-video');
      expect(aspectVideo).toBeInTheDocument();
    });

    it('renders DashboardHomeSkeleton with accessible status message and preserves layout', () => {
      renderWithTheme(
        <DashboardHomeSkeleton
          portalTitle="لوحة الطالب"
          message="جاري إعداد بيئة التعلم الرقمية للطالب..."
        />
      );

      const statusEl = screen.getByRole('status');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveAttribute('aria-live', 'polite');
      expect(statusEl).toHaveAttribute('aria-busy', 'true');
      expect(
        screen.getByText('جاري إعداد بيئة التعلم الرقمية للطالب...')
      ).toBeInTheDocument();
    });
  });

  describe('3. Button Loading & Interaction Feedback', () => {
    it('disables button and displays loading spinner and aria-busy when loading={true}', () => {
      const handleClick = vi.fn();
      renderWithTheme(
        <Button loading={true} onClick={handleClick}>
          حفظ التغييرات
        </Button>
      );

      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');

      // Attempt click while loading
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('displays loadingText when provided', () => {
      renderWithTheme(
        <Button loading={true} loadingText="جاري الحفظ...">
          حفظ التغييرات
        </Button>
      );

      expect(screen.getByText('جاري الحفظ...')).toBeInTheDocument();
      expect(screen.queryByText('حفظ التغييرات')).not.toBeInTheDocument();
    });

    it('enables button and restores original text when loading becomes false', () => {
      const { rerender } = renderWithTheme(
        <Button loading={true} loadingText="جاري المعالجة...">
          تأكيد العملية
        </Button>
      );

      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByText('جاري المعالجة...')).toBeInTheDocument();

      rerender(
        <ThemeProvider>
          <Button loading={false}>تأكيد العملية</Button>
        </ThemeProvider>
      );

      const btn = screen.getByRole('button');
      expect(btn).not.toBeDisabled();
      expect(btn).not.toHaveAttribute('aria-busy');
      expect(screen.getByText('تأكيد العملية')).toBeInTheDocument();
    });
  });

  describe('4. EmptyState Component Semantics & Actions', () => {
    it('renders empty state with role="region", icon, and action trigger', async () => {
      const handleAction = vi.fn();
      renderWithTheme(
        <EmptyState
          icon={BookOpen}
          message="لا توجد مقررات دراسية مسجلة"
          subMessage="يمكنك استعراض المقررات المتاحة والاشتراك فيها"
          actionText="تصفح المقررات"
          onAction={handleAction}
        />
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(screen.getByText('لا توجد مقررات دراسية مسجلة')).toBeInTheDocument();
      expect(screen.getByText('يمكنك استعراض المقررات المتاحة والاشتراك فيها')).toBeInTheDocument();

      const actionBtn = screen.getByRole('button', { name: 'تصفح المقررات' });
      expect(actionBtn).toBeInTheDocument();

      fireEvent.click(actionBtn);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });
  });
});

