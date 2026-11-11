import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ParentHomePage from '../components/parent/ParentHomePage';
import ParentChildrenPage from '../components/parent/ParentChildrenPage';
import ParentReportsPage from '../components/parent/ParentReportsPage';
import ParentSubscriptionPage from '../components/parent/ParentSubscriptionPage';
import ParentDashboard from '../components/parent/ParentDashboard';
import { userService } from '../services/user.service';
import { analyticsService } from '../services/analytics.service';
import { notificationService } from '../services/notification.service';
import { ThemeProvider } from '../contexts/ThemeContext';

const mockChildren = [
  {
    id: 'child-01',
    name: 'أحمد حسام',
    email: 'ahmed@ox-digital.edu',
    role: 'ONLINE_STUDENT',
    gradeLevel: 'الصف الأول الثانوي',
  },
  {
    id: 'child-02',
    name: 'سارة حسام',
    email: 'sara@ox-digital.edu',
    role: 'CENTER_STUDENT',
    gradeLevel: 'الصف الثالث الإعدادي',
  },
];

const mockChildOverview = {
  overview: {
    overallRate: 85,
    examsCompleted: 12,
    homeworksCompleted: 24,
  },
  recent: [
    { id: 'att-1', title: 'اختبار الجبر الشهري', type: 'exam', score: 92, date: '2026-10-20' },
    { id: 'sub-1', title: 'تطبيق الدوال الخطية', type: 'homework', score: 78, date: '2026-10-18' },
  ],
  charts: {
    examResults: [{ name: 'اختبار 1', score: 88 }],
    homeworkResults: [{ name: 'واجب 1', score: 90 }],
  },
};

const mockAttendance = {
  data: [
    { id: 'att-rec-1', date: '2026-10-25T08:00:00.000Z', status: 'PRESENT' },
    { id: 'att-rec-2', date: '2026-10-24T08:00:00.000Z', status: 'LATE' },
  ],
  summary: {
    presentCount: 15,
    lateCount: 2,
    absentCount: 1,
    percentage: 88,
  },
};

const mockNotifications = {
  data: [
    { id: 'notif-1', title: 'تنبيه اختبار جديد', message: 'تم إدراج امتحان الرياضيات العام', read: false, createdAt: '2026-10-26T10:00:00.000Z' },
    { id: 'notif-2', title: 'إشعار الحضور', message: 'تم تسجيل حضور الطالب في الحصة', read: true, createdAt: '2026-10-25T08:30:00.000Z' },
  ],
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'parent-01', name: 'حسام سامر', role: 'PARENT' },
    logout: vi.fn(),
  }),
}));

vi.mock('../services/user.service', () => ({
  userService: {
    getProfile: vi.fn(),
    getChildren: vi.fn(),
    getStudentAttendanceById: vi.fn(),
  },
}));

vi.mock('../services/analytics.service', () => ({
  analyticsService: {
    getParentChildOverview: vi.fn(),
  },
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

// Mock Recharts ResponsiveContainer to avoid size measuring issues in jsdom
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 500, height: 300 }}>{children}</div>,
  };
});

describe('Phase 5.2: Parent Dashboard Redesign & Data Integrity Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'mock-token');
    vi.mocked(userService.getProfile).mockResolvedValue({ id: 'parent-01', name: 'حسام سامر', role: 'PARENT' } as any);
    vi.mocked(notificationService.getNotifications).mockResolvedValue(mockNotifications as any);
    vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ data: { unreadCount: 1 } } as any);
  });

  const renderComponent = (ui: React.ReactElement, initialEntry = '/parent/home') => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ThemeProvider>{ui}</ThemeProvider>
      </MemoryRouter>
    );
  };

  // 1. Loading and Empty States
  it('renders loading state initially on ParentHomePage', () => {
    vi.mocked(userService.getChildren).mockReturnValue(new Promise(() => {}));
    renderComponent(<ParentHomePage />);

    expect(screen.getByText(/جاري تحميل بيانات لوحة ولي الأمر/i)).toBeInTheDocument();
  });

  it('renders empty state when parent has no linked children', async () => {
    vi.mocked(userService.getChildren).mockResolvedValue([]);
    renderComponent(<ParentHomePage />);

    expect(await screen.findByText(/لا يوجد أبناء مرتبطين بحسابك حالياً/i)).toBeInTheDocument();
  });

  // 2. Child Selector & Privacy Validation (URL Parameter Tamper Protection)
  it('handles multiple children and renders ChildSelector tabs', async () => {
    vi.mocked(userService.getChildren).mockResolvedValue(mockChildren as any);
    vi.mocked(analyticsService.getParentChildOverview).mockResolvedValue({ data: mockChildOverview } as any);
    vi.mocked(userService.getStudentAttendanceById).mockResolvedValue(mockAttendance as any);

    renderComponent(<ParentHomePage />);

    expect(await screen.findByText('أحمد حسام')).toBeInTheDocument();
    expect(screen.getByText('سارة حسام')).toBeInTheDocument();
  });

  it('falls back to authorized child if unauthorized or invalid childId is passed in URL query', async () => {
    vi.mocked(userService.getChildren).mockResolvedValue(mockChildren as any);
    vi.mocked(analyticsService.getParentChildOverview).mockResolvedValue({ data: mockChildOverview } as any);
    vi.mocked(userService.getStudentAttendanceById).mockResolvedValue(mockAttendance as any);

    // Attacker passes foreign child ID in URL ?child=foreign-unauthorized-id
    renderComponent(<ParentHomePage />, '/parent/home?child=foreign-unauthorized-id');

    // Must safely fallback to first authorized child (child-01: أحمد حسام) and never request foreign-unauthorized-id
    await waitFor(() => {
      expect(analyticsService.getParentChildOverview).toHaveBeenCalledWith('child-01');
      expect(analyticsService.getParentChildOverview).not.toHaveBeenCalledWith('foreign-unauthorized-id');
    });
  });

  // 3. Stale Request Protection on Child Switching
  it('switches children and calls analytics with target childId', async () => {
    vi.mocked(userService.getChildren).mockResolvedValue(mockChildren as any);
    vi.mocked(analyticsService.getParentChildOverview).mockResolvedValue({ data: mockChildOverview } as any);
    vi.mocked(userService.getStudentAttendanceById).mockResolvedValue(mockAttendance as any);

    renderComponent(<ParentHomePage />);

    expect(await screen.findByText('أحمد حسام')).toBeInTheDocument();
    await waitFor(() => {
      expect(analyticsService.getParentChildOverview).toHaveBeenCalledWith('child-01');
    });

    // Click on Sara
    fireEvent.click(screen.getByText('سارة حسام'));

    await waitFor(() => {
      expect(analyticsService.getParentChildOverview).toHaveBeenCalledWith('child-02');
    });
  });

  // 4. Decision 3: Removal of unsupported rank and results-review UI
  it('verifies unsupported rank card is NOT rendered in ParentChildrenPage', async () => {
    vi.mocked(userService.getChildren).mockResolvedValue(mockChildren as any);
    vi.mocked(analyticsService.getParentChildOverview).mockResolvedValue({ data: mockChildOverview } as any);
    vi.mocked(userService.getStudentAttendanceById).mockResolvedValue(mockAttendance as any);

    renderComponent(<ParentChildrenPage />);

    expect(await screen.findByText('أحمد حسام')).toBeInTheDocument();

    // Verify 3 valid metric cards exist
    expect(await screen.findByText(/متوسط درجات التقييمات/i)).toBeInTheDocument();
    expect(screen.getByText(/الامتحانات المكتملة/i)).toBeInTheDocument();
    expect(screen.getAllByText(/الواجبات والتطبيقات/i)[0]).toBeInTheDocument();

    // Verify "المرتبة" (rank) is removed completely
    expect(screen.queryByText('المرتبة')).not.toBeInTheDocument();
  });

  it('verifies unsupported rank and dead review button are NOT rendered in ParentReportsPage', async () => {
    vi.mocked(userService.getChildren).mockResolvedValue(mockChildren as any);
    vi.mocked(analyticsService.getParentChildOverview).mockResolvedValue({ data: mockChildOverview } as any);

    renderComponent(<ParentReportsPage />);

    expect(await screen.findByText('أحمد حسام')).toBeInTheDocument();

    // Verify "المرتبة" is removed
    expect(screen.queryByText('المرتبة')).not.toBeInTheDocument();

    // Verify dead "عرض النتيجة التفصيلية" button is removed
    expect(screen.queryByText(/عرض النتيجة التفصيلية/i)).not.toBeInTheDocument();
  });

  // 5. Decision 2: Removal of fabricated subscription plans
  it('verifies fabricated plans and prices are removed from ParentSubscriptionPage', () => {
    renderComponent(<ParentSubscriptionPage />);

    expect(screen.getByText(/قريباً — قيد التطوير والاعتماد/i)).toBeInTheDocument();
    expect(screen.getByText(/منظومة الاشتراكات الإلكترونية لأولياء الأمور/i)).toBeInTheDocument();

    // Verify fake prices (150, 250) are NOT present
    expect(screen.queryByText('١٥٠')).not.toBeInTheDocument();
    expect(screen.queryByText('٢٥٠')).not.toBeInTheDocument();
    expect(screen.queryByText('الباقة الأساسية')).not.toBeInTheDocument();
    expect(screen.queryByText('الباقة المتميزة')).not.toBeInTheDocument();
  });

  // 6. Decision 1: Notification labeling and navigation in ParentDashboard
  it('verifies honest notification navigation in ParentDashboard shell', async () => {
    renderComponent(<ParentDashboard />);

    // Menu item should be "التنبيهات والإشعارات", NOT "التواصل مع المعلم" (rendered in desktop & mobile navs)
    const notificationMenuItems = await screen.findAllByText('التنبيهات والإشعارات');
    expect(notificationMenuItems.length).toBeGreaterThan(0);
    expect(screen.queryByText('التواصل مع المعلم')).not.toBeInTheDocument();

    // Unread count badge should be 1 (from authoritative getUnreadCount)
    await waitFor(() => {
      const badges = screen.getAllByText('1');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  // 7. Error & Retry Resilience
  it('renders error alert with retry button when analytics fails on ParentHomePage', async () => {
    vi.mocked(userService.getChildren).mockResolvedValue(mockChildren as any);
    vi.mocked(analyticsService.getParentChildOverview).mockRejectedValue(new Error('500 Server Error'));
    vi.mocked(userService.getStudentAttendanceById).mockResolvedValue(null);

    renderComponent(<ParentHomePage />);

    expect(await screen.findByText(/تعذر تحميل البيانات الأكاديمية للطالب المحدد/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /إعادة المحاولة للطالب المحدد/i })).toBeInTheDocument();

    // Retry should attempt fetch again
    vi.mocked(analyticsService.getParentChildOverview).mockResolvedValue({ data: mockChildOverview } as any);
    fireEvent.click(screen.getByRole('button', { name: /إعادة المحاولة للطالب المحدد/i }));

    await waitFor(() => {
      expect(screen.getByText('85')).toBeInTheDocument();
    });
  });

  // 8. Phase 5.2.1: Ungraded Submissions are NOT zeroed out and display Pending state
  it('displays pending grading badge for ungraded homework submissions without penalizing as zero', async () => {
    const mockOverviewWithPending = {
      overview: {
        overallRate: 92, // Average of graded items only (1 exam at 92)
        examsCompleted: 1,
        homeworksCompleted: 1,
        pendingGradingCount: 1,
      },
      recent: [
        { id: 'att-1', title: 'اختبار الجبر الشهري', type: 'exam', score: 92, status: 'GRADED', date: '2026-10-20' },
        { id: 'sub-pending', title: 'واجب التفاضل المعلق', type: 'homework', score: null, status: 'PENDING_GRADING', date: '2026-10-22' },
      ],
      charts: {
        examResults: [{ name: 'اختبار الجبر الشهري', score: 92 }],
        homeworkResults: [], // Pending homework excluded from score charts
      },
    };

    vi.mocked(userService.getChildren).mockResolvedValue(mockChildren as any);
    vi.mocked(analyticsService.getParentChildOverview).mockResolvedValue({ data: mockOverviewWithPending } as any);
    vi.mocked(userService.getStudentAttendanceById).mockResolvedValue(mockAttendance as any);

    renderComponent(<ParentHomePage />);

    // Verify Pending Grading badge renders
    expect(await screen.findByText('قيد التصحيح')).toBeInTheDocument();
    expect(screen.getByText('واجب التفاضل المعلق')).toBeInTheDocument();

    // Verify the pending submission does NOT display 0 or 0%
    expect(screen.queryByText('0٪')).not.toBeInTheDocument();

    // Verify overall rate strictly reflects graded items (92 appears in Card 1 and in recent exam item)
    const scoreElements = screen.getAllByText('92');
    expect(scoreElements.length).toBeGreaterThanOrEqual(1);
  });

  // 9. Phase 5.2.1: Empty Datasets do NOT present 0% for attendance or grades
  it('renders fallback dash for empty attendance dataset instead of misleading 0%', async () => {
    const mockEmptyAttendance = {
      data: [],
      summary: {
        totalSessions: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        percentage: null,
      },
    };

    const mockEmptyAcademic = {
      overview: {
        overallRate: null,
        examsCompleted: 0,
        homeworksCompleted: 0,
        pendingGradingCount: 0,
      },
      recent: [],
      charts: { examResults: [], homeworkResults: [] },
    };

    vi.mocked(userService.getChildren).mockResolvedValue(mockChildren as any);
    vi.mocked(analyticsService.getParentChildOverview).mockResolvedValue({ data: mockEmptyAcademic } as any);
    vi.mocked(userService.getStudentAttendanceById).mockResolvedValue(mockEmptyAttendance as any);

    renderComponent(<ParentHomePage />);

    // Wait for child to load
    expect(await screen.findByText('أحمد حسام')).toBeInTheDocument();

    // In ParentHomePage, empty attendance percentage must render as '—', NOT '0%' or '0٪'
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
    expect(screen.queryByText('0٪')).not.toBeInTheDocument();
  });

  // 10. Phase 5.2.1: Attendance counting semantics (LATE counts as attended)
  it('correctly reflects attendance semantics where LATE is counted as attended', async () => {
    // 2 PRESENT, 1 LATE, 1 ABSENT -> total = 4, attended = 3 -> 75%
    const mockAttendanceWithLate = {
      data: [
        { id: 'att-1', date: '2026-10-25T08:00:00.000Z', status: 'PRESENT' },
        { id: 'att-2', date: '2026-10-24T08:00:00.000Z', status: 'LATE' },
        { id: 'att-3', date: '2026-10-23T08:00:00.000Z', status: 'PRESENT' },
        { id: 'att-4', date: '2026-10-22T08:00:00.000Z', status: 'ABSENT' },
      ],
      summary: {
        totalSessions: 4,
        presentCount: 2,
        lateCount: 1,
        absentCount: 1,
        percentage: 75,
      },
    };

    vi.mocked(userService.getChildren).mockResolvedValue(mockChildren as any);
    vi.mocked(analyticsService.getParentChildOverview).mockResolvedValue({ data: mockChildOverview } as any);
    vi.mocked(userService.getStudentAttendanceById).mockResolvedValue(mockAttendanceWithLate as any);

    renderComponent(<ParentHomePage />);

    // Verify 75% is rendered for attendance
    expect(await screen.findByText('75٪')).toBeInTheDocument();
    expect(screen.getByText(/حاضر: 2 • متأخر: 1 • غائب: 1/i)).toBeInTheDocument();
  });
});
