import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeworkPage from '../components/student-shared/HomeworkPage';
import { homeworkService } from '../services/homework.service';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { toast } from 'sonner';

vi.mock('../services/homework.service', () => ({
  homeworkService: {
    getHomeworks: vi.fn(),
    getHomeworkDetails: vi.fn(),
    submitHomework: vi.fn(),
  },
}));

let currentMockUser: any = { id: 'stu-1', name: 'طالب تجريبي', role: 'ONLINE_STUDENT' };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    token: 'mock-token',
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

function renderHomeworkPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LanguageProvider>
          <HomeworkPage />
        </LanguageProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('HomeworkPage Status, Expiry & Lock Consistency Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'mock-token');
    currentMockUser = { id: 'stu-1', name: 'طالب تجريبي', role: 'ONLINE_STUDENT' };
  });

  it('renders available, pending (from draft), unavailable, completed, and locked statuses accurately while filtering expired closeAt/deadline items', async () => {
    const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
    const PAST = new Date(Date.now() - 86_400_000).toISOString();

    vi.mocked(homeworkService.getHomeworks).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'hw-available',
            title: 'واجب متاح الآن',
            status: 'available',
            closeAt: FUTURE,
            isLocked: false,
          },
          {
            id: 'hw-pending-draft',
            title: 'واجب بانتظار الحل',
            status: 'draft',
            deadline: FUTURE,
            isLocked: false,
          },
          {
            id: 'hw-unavailable',
            title: 'واجب لم يفتح بعد',
            status: 'unavailable',
            closeAt: FUTURE,
            isLocked: false,
          },
          {
            id: 'hw-expired-closeat',
            title: 'واجب منتهي عبر closeAt',
            status: 'unavailable',
            closeAt: PAST,
            deadline: null,
            isLocked: false,
          },
          {
            id: 'hw-expired-deadline',
            title: 'واجب منتهي عبر deadline',
            status: 'available',
            deadline: PAST,
            isLocked: false,
          },
          {
            id: 'hw-completed',
            title: 'واجب مكتمل ومصحح',
            status: 'completed',
            score: 94,
            closeAt: PAST,
            isLocked: false,
          },
          {
            id: 'hw-locked',
            title: 'واجب مقفل بمشاهدة الفيديو',
            status: 'available',
            closeAt: FUTURE,
            isLocked: true,
          },
        ],
      },
    } as any);

    vi.mocked(homeworkService.getHomeworkDetails).mockResolvedValue({
      data: {
        id: 'hw-available',
        questions: [],
      },
    } as any);

    renderHomeworkPage();

    expect(await screen.findByText('واجب متاح الآن')).toBeInTheDocument();
    expect(screen.getByText('واجب بانتظار الحل')).toBeInTheDocument();
    expect(screen.getByText('واجب لم يفتح بعد')).toBeInTheDocument();
    expect(screen.getByText('واجب مكتمل ومصحح')).toBeInTheDocument();
    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText('واجب مقفل بمشاهدة الفيديو')).toBeInTheDocument();

    // Expired non-completed items (both closeAt and deadline) must be filtered out
    expect(screen.queryByText('واجب منتهي عبر closeAt')).not.toBeInTheDocument();
    expect(screen.queryByText('واجب منتهي عبر deadline')).not.toBeInTheDocument();

    // Unavailable homework gets dedicated label and is NOT labeled awaiting submission
    expect(screen.getByText('غير متاح حالياً')).toBeInTheDocument();
    expect(screen.getAllByText('بانتظار التسليم')).toHaveLength(2);
    expect(screen.getByText('تم التسليم والتقييم')).toBeInTheDocument();
    expect(screen.getByText('مقفل (يتطلب إتمام الدرس)')).toBeInTheDocument();

    // Unavailable homework cannot be opened and shows info toast
    fireEvent.click(screen.getByText('واجب لم يفتح بعد'));
    expect(homeworkService.getHomeworkDetails).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('هذا الواجب غير متاح للتسليم حالياً');

    // Locked homework cannot be opened
    fireEvent.click(screen.getByText('واجب مقفل بمشاهدة الفيديو'));
    expect(homeworkService.getHomeworkDetails).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('يجب إكمال مشاهدة فيديو الدرس قبل فتح الواجب');

    // Completed homework cannot be opened for resubmission
    fireEvent.click(screen.getByText('واجب مكتمل ومصحح'));
    expect(homeworkService.getHomeworkDetails).not.toHaveBeenCalled();

    // Available homework opens details cleanly
    fireEvent.click(screen.getByText('واجب متاح الآن'));
    await waitFor(() => {
      expect(homeworkService.getHomeworkDetails).toHaveBeenCalledWith('hw-available');
    });
  });

  it('enforces identical unavailable/expired/locked behavior for CENTER_STUDENT', async () => {
    currentMockUser = { id: 'stu-center-1', name: 'طالب سنتر', role: 'CENTER_STUDENT' };
    const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

    vi.mocked(homeworkService.getHomeworks).mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'hw-c-unavail',
            title: 'واجب سنتر غير متاح',
            status: 'unavailable',
            closeAt: FUTURE,
            isLocked: false,
          },
        ],
      },
    } as any);

    renderHomeworkPage();

    expect(await screen.findByText('واجب سنتر غير متاح')).toBeInTheDocument();
    expect(screen.getByText('غير متاح حالياً')).toBeInTheDocument();
    expect(screen.queryByText('بانتظار التسليم')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('واجب سنتر غير متاح'));
    expect(homeworkService.getHomeworkDetails).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith('هذا الواجب غير متاح للتسليم حالياً');
  });
});
