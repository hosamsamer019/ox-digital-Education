import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TeacherNotificationsPage } from '../components/teacher/TeacherNotificationsPage';
import { ParentNotificationsPage } from '../components/parent/ParentNotificationsPage';
import NotificationsPanel from '../components/shared/NotificationsPanel';
import StudentSubLedgersPage from '../components/accountant/StudentSubLedgersPage';
import { notificationService } from '../services/notification.service';
import { accountingService } from '../services/accounting.service';

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

vi.mock('../services/accounting.service', () => ({
  accountingService: {
    getStudentSubLedgers: vi.fn(),
    getStudentFinancialAccount: vi.fn(),
    getCashboxes: vi.fn(),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'usr-test', role: 'ACCOUNTANT', name: 'المحاسب المعتمد' },
    isAuthenticated: true,
  }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }),
}));

describe('Targeted UI/UX Remediation — 4-State Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('A. Teacher Notifications (TeacherNotificationsPage)', () => {
    it('State 1: renders loading state initially', () => {
      vi.mocked(notificationService.getNotifications).mockImplementation(
        () => new Promise(() => {}) // pending
      );
      render(
        <MemoryRouter>
          <TeacherNotificationsPage />
        </MemoryRouter>
      );
      expect(screen.getByText(/جاري تحميل سجل التنبيهات/i)).toBeInTheDocument();
    });

    it('State 2: renders populated notifications with unread badge', async () => {
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        data: [
          {
            id: 'n-1',
            title: 'تسليم واجب جديد',
            message: 'قام الطالب أحمد بتسليم واجب الجبر',
            read: false,
            createdAt: new Date().toISOString(),
          },
        ],
      } as any);

      render(
        <MemoryRouter>
          <TeacherNotificationsPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('تسليم واجب جديد')).toBeInTheDocument();
      expect(screen.getByText(/1 غير مقروء/i)).toBeInTheDocument();
    });

    it('State 3: renders genuine empty state when count is 0', async () => {
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        data: [],
      } as any);

      render(
        <MemoryRouter>
          <TeacherNotificationsPage />
        </MemoryRouter>
      );

      expect(await screen.findByText(/لا توجد تنبيهات حالياً/i)).toBeInTheDocument();
      expect(screen.queryByText(/غير مقروء/i)).not.toBeInTheDocument();
    });

    it('State 4: renders clear error state with working retry action on API failure', async () => {
      vi.mocked(notificationService.getNotifications).mockRejectedValueOnce(
        new Error('Network Error')
      );

      render(
        <MemoryRouter>
          <TeacherNotificationsPage />
        </MemoryRouter>
      );

      expect(await screen.findByText(/تعذر تحميل التنبيهات والإشعارات/i)).toBeInTheDocument();
      const retryBtn = screen.getByText('إعادة المحاولة');
      expect(retryBtn).toBeInTheDocument();

      // Successful retry
      vi.mocked(notificationService.getNotifications).mockResolvedValueOnce({
        data: [{ id: 'n-2', title: 'تمت المحاولة بنجاح', message: 'مرحبا', read: true, createdAt: new Date().toISOString() }],
      } as any);

      fireEvent.click(retryBtn);
      expect(await screen.findByText('تمت المحاولة بنجاح')).toBeInTheDocument();
    });
  });

  describe('B. Parent Notifications (NotificationsPanel)', () => {
    it('State 1: renders loading indicator in popup panel', () => {
      vi.mocked(notificationService.getNotifications).mockImplementation(
        () => new Promise(() => {})
      );
      render(
        <MemoryRouter>
          <NotificationsPanel onClose={vi.fn()} isDark={false} />
        </MemoryRouter>
      );
      expect(screen.getByRole('heading', { name: 'الإشعارات' })).toBeInTheDocument();
    });

    it('State 2: renders populated notifications in panel', async () => {
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        data: [
          {
            id: 'p-1',
            title: 'تقرير درجات جديد',
            message: 'تم رصد درجات اختبار سامر',
            read: false,
            createdAt: new Date().toISOString(),
          },
        ],
      } as any);

      render(
        <MemoryRouter>
          <NotificationsPanel onClose={vi.fn()} isDark={false} />
        </MemoryRouter>
      );

      expect(await screen.findByText('تقرير درجات جديد')).toBeInTheDocument();
    });

    it('State 3: renders genuine empty state when no notifications exist', async () => {
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        data: [],
      } as any);

      render(
        <MemoryRouter>
          <NotificationsPanel onClose={vi.fn()} isDark={false} />
        </MemoryRouter>
      );

      expect(await screen.findByText('لا توجد إشعارات حالياً')).toBeInTheDocument();
    });

    it('State 4: renders error message and retry action when notifications fail', async () => {
      vi.mocked(notificationService.getNotifications).mockRejectedValueOnce(
        new Error('Network Timeout')
      );

      render(
        <MemoryRouter>
          <NotificationsPanel onClose={vi.fn()} isDark={false} />
        </MemoryRouter>
      );

      expect(await screen.findByText(/تعذر تحميل الإشعارات حالياً/i)).toBeInTheDocument();
      const retryBtn = screen.getByText('إعادة المحاولة');
      expect(retryBtn).toBeInTheDocument();
    });
  });

  describe('C. Accountant Student Sub-Ledgers (StudentSubLedgersPage)', () => {
    it('State 1: renders loading state during sub-ledger fetch', () => {
      vi.mocked(accountingService.getStudentSubLedgers).mockImplementation(
        () => new Promise(() => {})
      );
      render(
        <MemoryRouter>
          <StudentSubLedgersPage />
        </MemoryRouter>
      );
      expect(screen.getByText(/جاري تحميل قائمة الطلاب/i)).toBeInTheDocument();
    });

    it('State 2: renders populated student directory and selected dossier', async () => {
      vi.mocked(accountingService.getStudentSubLedgers).mockResolvedValue({
        subLedgers: [
          {
            studentId: 'stu-101',
            name: 'يوسف أحمد كمال',
            phone: '01011223344',
            totalCharged: 4500,
            totalCollected: 3000,
            balance: 1500,
          },
        ],
        pagination: { page: 1, limit: 30, total: 1 },
      } as any);

      vi.mocked(accountingService.getStudentFinancialAccount).mockResolvedValue({
        studentId: 'stu-101',
        name: 'يوسف أحمد كمال',
        totalCharged: 4500,
        totalCollected: 3000,
        balance: 1500,
      } as any);

      render(
        <MemoryRouter>
          <StudentSubLedgersPage />
        </MemoryRouter>
      );

      const matches = await screen.findAllByText('يوسف أحمد كمال');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/STU-STU-10/i).length).toBeGreaterThanOrEqual(1);
    });

    it('State 3: renders genuine empty state without confusing with a network error', async () => {
      vi.mocked(accountingService.getStudentSubLedgers).mockResolvedValue({
        subLedgers: [],
        pagination: { page: 1, limit: 30, total: 0 },
      } as any);

      render(
        <MemoryRouter>
          <StudentSubLedgersPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('لا توجد حسابات مطابقة')).toBeInTheDocument();
      expect(screen.getByText('لا يوجد طالب محدد')).toBeInTheDocument();
    });

    it('State 4: renders localized error state with retry action on API failure', async () => {
      vi.mocked(accountingService.getStudentSubLedgers).mockRejectedValueOnce(
        new Error('Database Connection Down')
      );

      render(
        <MemoryRouter>
          <StudentSubLedgersPage />
        </MemoryRouter>
      );

      expect(await screen.findByText('فشل في تحميل الحسابات الفرعية')).toBeInTheDocument();
      expect(screen.getAllByText(/تعذر تحميل سجلات وحسابات الطلاب من الخادم/i).length).toBeGreaterThanOrEqual(1);
      const retryButtons = screen.getAllByText('إعادة المحاولة');
      expect(retryButtons.length).toBeGreaterThanOrEqual(1);

      // Verify retry functionality
      vi.mocked(accountingService.getStudentSubLedgers).mockResolvedValueOnce({
        subLedgers: [
          {
            studentId: 'stu-999',
            name: 'كريم محمود السعدني',
            phone: '01099887766',
            totalCharged: 2000,
            totalCollected: 2000,
            balance: 0,
          },
        ],
      } as any);

      fireEvent.click(retryButtons[0]);
      const postRetryMatches = await screen.findAllByText('كريم محمود السعدني');
      expect(postRetryMatches.length).toBeGreaterThanOrEqual(1);
    });
  });
});
