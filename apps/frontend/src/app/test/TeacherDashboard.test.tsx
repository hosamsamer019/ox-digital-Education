import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TeacherDashboard from '../components/teacher/TeacherDashboard';
import TeacherHomePage from '../components/teacher/TeacherHomePage';
import TeacherAnalyticsPage from '../components/teacher/TeacherAnalyticsPage';
import TeacherProfilePage from '../components/teacher/TeacherProfilePage';
import TeacherNotificationsPage from '../components/teacher/TeacherNotificationsPage';
import TeacherStudentsPage from '../components/teacher/TeacherStudentsPage';
import TeacherAIPage from '../components/teacher/TeacherAIPage';
import { analyticsService } from '../services/analytics.service';
import { notificationService } from '../services/notification.service';
import { userService } from '../services/user.service';
import { aiService } from '../services/ai.service';
import { questionService } from '../services/question.service';
import { brdSubscriptionService } from '../services/brdSubscription.service';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';

const mockTeacherOverview = {
  totalStudents: 42,
  totalCourses: 5,
  averageScore: 78.4,
  strugglingStudents: 3,
  subjectPerformance: [
    { name: 'الجبر', score: 82 },
    { name: 'الهندسة', score: 74 },
  ],
  distributionData: [
    { range: '٩٠-١٠٠', count: 12 },
    { range: '٧٥-٨٩', count: 18 },
    { range: '٦٠-٧٤', count: 9 },
    { range: 'أقل من ٦٠', count: 3 },
  ],
  riskStudents: [
    {
      id: 'student-risk-1',
      name: 'محمود عادل',
      email: 'mahmoud@ox.edu',
      avg: 42,
      avgScore: 42,
      risk: 'عالي',
      riskLevel: 'عالي',
      reasons: ['انخفاض درجات امتحانات الجبر'],
      issue: 'انخفاض درجات امتحانات الجبر',
      lastActive: 'منذ يومين',
    },
  ],
};

const mockNotifications = {
  data: [
    { id: 'notif-1', title: 'تسليم امتحان جديد', message: 'قام أحمد حسام بتسليم امتحان الجبر', read: false, createdAt: '2026-10-27T10:00:00.000Z' },
    { id: 'notif-2', title: 'تنبيه نظام', message: 'تم تحديث بنك الأسئلة الموحد', read: true, createdAt: '2026-10-26T08:00:00.000Z' },
  ],
};

const mockStudents = [
  {
    id: 'student-01',
    name: 'أحمد حسام',
    role: 'ONLINE_STUDENT',
    grade: 'الصف الأول الثانوي',
    avgScore: 85,
    homeworkScore: 90,
    examScore: 80,
    attendancePercentage: 95,
  },
  {
    id: 'student-02',
    name: 'محمود عادل',
    role: 'CENTER_STUDENT',
    grade: 'الصف الأول الثانوي',
    avgScore: 42,
    homeworkScore: 40,
    examScore: 44,
    attendancePercentage: 60,
  },
];

const mockUser = { id: 'teacher-01', name: 'أ. د. حسام سامر', role: 'TEACHER', email: 'hosam@ox-digital.edu' };

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    logout: vi.fn(),
    checkAuth: vi.fn(),
  }),
}));

vi.mock('../services/analytics.service', () => ({
  analyticsService: {
    getTeacherAnalytics: vi.fn(),
    getRiskAnalytics: vi.fn(),
  },
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
  },
}));

vi.mock('../services/user.service', () => ({
  userService: {
    getUsers: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    deleteUser: vi.fn(),
    markAttendance: vi.fn(),
  },
}));

vi.mock('../services/ai.service', () => ({
  aiService: {
    generateQuestions: vi.fn(),
  },
}));

vi.mock('../services/question.service', () => ({
  questionService: {
    getQuestions: vi.fn(),
    createQuestionsBatch: vi.fn(),
  },
}));

vi.mock('../services/brdSubscription.service', () => ({
  brdSubscriptionService: {
    getTeacherStudents: vi.fn(),
  },
}));

vi.mock('../services/api', () => ({
  analyticsApi: {
    get: vi.fn().mockResolvedValue({ data: { totalMessages: 120, totalSessions: 45, activeStudents: 22, conversations: [] } }),
  },
}));

// Mock recharts responsive container to avoid size zero issues in Vitest JSDOM
vi.mock('recharts', async () => {
  const actual: any = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 500, height: 300 }}>{children}</div>,
  };
});

describe('Phase 5.3: Approved Teacher Dashboard Remediation & Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('token', 'mock-token');
    vi.mocked(analyticsService.getTeacherAnalytics).mockResolvedValue({ data: mockTeacherOverview } as any);
    vi.mocked(analyticsService.getRiskAnalytics).mockResolvedValue({ data: { riskStudents: mockTeacherOverview.riskStudents } } as any);
    vi.mocked(notificationService.getNotifications).mockResolvedValue(mockNotifications as any);
    vi.mocked(notificationService.getUnreadCount).mockResolvedValue({ data: { unreadCount: 1 } } as any);
    vi.mocked(userService.getUsers).mockResolvedValue({ data: mockStudents } as any);
    vi.mocked(brdSubscriptionService.getTeacherStudents).mockResolvedValue({ data: mockStudents } as any);
  });

  const renderWithRouter = (ui: React.ReactElement, initialRoute = '/home') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <LanguageProvider>
          <ThemeProvider>{ui}</ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );
  };

  // 1. Teacher Shell & Navigation
  it('renders TeacherDashboard shell with institutional branding and teacher name', async () => {
    renderWithRouter(<TeacherDashboard />, '/home');

    expect(screen.getAllByText('OX-DIGITAL Education').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/المعلم: أ\. د\. حسام سامر/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/لوحة المؤشرات|الرئيسية/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/التحليلات والتقارير|التحليلات الأكاديمية/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/التنبيهات المدرسية|الإشعارات/i).length).toBeGreaterThanOrEqual(1);

    // Verify unread badge in sidebar
    await waitFor(() => {
      const badges = screen.getAllByText('1');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  // 2. Verified KPI Mappings on TeacherHomePage
  it('renders verified KPI fields accurately without undefined or fabricated metrics', async () => {
    renderWithRouter(<TeacherHomePage />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('78.4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Verify labels
    expect(screen.getByText('إجمالي الطلاب المسجلين')).toBeInTheDocument();
    expect(screen.getByText('المقررات الدراسية النشطة')).toBeInTheDocument();
    expect(screen.getByText('متوسط درجات التقييمات')).toBeInTheDocument();
    expect(screen.getByText('طلاب بحاجة لمتابعة')).toBeInTheDocument();

    // Confirm NO undefined% or NaN is displayed
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });

  // 3. Missing, Malformed, and Genuine Zero Handling
  it('handles genuine zero values honestly and distinguishes from missing data', async () => {
    vi.mocked(analyticsService.getTeacherAnalytics).mockResolvedValue({
      data: {
        totalStudents: 0,
        totalCourses: 0,
        averageScore: 0,
        strugglingStudents: 0,
        subjectPerformance: [],
        distributionData: [],
        riskStudents: [],
      },
    } as any);

    renderWithRouter(<TeacherHomePage />);

    // Zero should render as 0, NOT as "—" or NaN
    await waitFor(() => {
      const zeroes = screen.getAllByText('0');
      expect(zeroes.length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  // 4. Empty and Failure States
  it('renders failure state and retry button when analytics API fails', async () => {
    vi.mocked(analyticsService.getTeacherAnalytics).mockRejectedValueOnce(new Error('Network Error'));

    renderWithRouter(<TeacherHomePage />);

    expect(await screen.findByText(/تعذر تحميل بيانات لوحة المعلم/i)).toBeInTheDocument();
    expect(screen.getByText('إعادة المحاولة')).toBeInTheDocument();
  });

  // 5. At-Risk Student Navigation
  it('renders at-risk student queue and verified navigation button to student details', async () => {
    renderWithRouter(<TeacherHomePage />);

    expect(await screen.findByText('محمود عادل')).toBeInTheDocument();
    expect(screen.getByText('انخفاض درجات امتحانات الجبر')).toBeInTheDocument();
    
    // Find detail action button
    const detailBtn = screen.getByRole('button', { name: /عرض تقرير الطالب/i });
    expect(detailBtn).toBeInTheDocument();
  });

  // 6. Elimination of Fake Weekly Activity Chart
  it('does NOT render unsupported weeklyProgress chart on TeacherHomePage', async () => {
    renderWithRouter(<TeacherHomePage />);

    await waitFor(() => {
      expect(screen.getByText('توزيع المستويات الأكاديمية')).toBeInTheDocument();
    });

    // Verify weeklyProgress area chart text is NOT present
    expect(screen.queryByText(/النشاط الأسبوعي/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/معدل المشاهدات الأسبوعية/i)).not.toBeInTheDocument();
  });

  // 7. TeacherAnalyticsPage: Removal of Fabricated Datasets & Print Action
  it('verifies TeacherAnalyticsPage contains NO fabricated mock arrays and has working print action', async () => {
    window.print = vi.fn();
    const printSpy = vi.spyOn(window, 'print');

    renderWithRouter(<TeacherAnalyticsPage />);

    expect(await screen.findByText('التحليلات ومؤشرات الأداء')).toBeInTheDocument();

    // Confirm purged fake student names from audit are NOT present
    expect(screen.queryByText('أحمد علي')).not.toBeInTheDocument();
    expect(screen.queryByText('سارة محمد')).not.toBeInTheDocument();
    expect(screen.queryByText('عمر خالد')).not.toBeInTheDocument();
    expect(screen.queryByText(/توقعات نسبة النجاح في الامتحان القادم/i)).not.toBeInTheDocument();

    // Verify print button calls window.print()
    const printBtn = screen.getByRole('button', { name: /طباعة التقرير/i });
    fireEvent.click(printBtn);
    expect(printSpy).toHaveBeenCalled();
  });

  // 8. TeacherProfilePage: Real API Shape Extraction & No Fake Badges
  it('verifies TeacherProfilePage extracts real stats and omits fake 4.9 rating and fake awards', async () => {
    vi.mocked(analyticsService.getTeacherAnalytics).mockResolvedValue({
      data: {
        totalCourses: 7,
        totalStudents: 85,
        averageScore: 82,
      },
    } as any);

    renderWithRouter(<TeacherProfilePage />);

    // Check stats extracted from root
    expect(await screen.findByText(/7 مقررات منشورة/i)).toBeInTheDocument();
    expect(screen.getByText(/85 طالب مسجل/i)).toBeInTheDocument();

    // Confirm fake rating and fake badge are eliminated
    expect(screen.queryByText('٤.٩')).not.toBeInTheDocument();
    expect(screen.queryByText(/أفضل معلم ٢٠٢٦/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/معلم معتمد من الوزارة/i)).not.toBeInTheDocument();
  });

  // 9. TeacherNotificationsPage: Supported Notification Service Verification
  it('verifies TeacherNotificationsPage loads notifications, filters unread, and supports markAsRead', async () => {
    renderWithRouter(<TeacherNotificationsPage />);

    expect(await screen.findByText('تسليم امتحان جديد')).toBeInTheDocument();
    expect(screen.getByText('تنبيه نظام')).toBeInTheDocument();

    // Filter by unread
    const unreadTab = screen.getByRole('button', { name: /غير المقروءة/i });
    fireEvent.click(unreadTab);

    // Only unread notif-1 should be visible
    expect(screen.getByText('تسليم امتحان جديد')).toBeInTheDocument();
    expect(screen.queryByText('تنبيه نظام')).not.toBeInTheDocument();

    // Mark as read
    const markBtn = screen.getByRole('button', { name: /تحديد كمقروء/i });
    fireEvent.click(markBtn);
    expect(notificationService.markAsRead).toHaveBeenCalledWith('notif-1');
  });

  // 10. TeacherStudentsPage: Roster, Search, and Removal of Dead Alert
  it('verifies TeacherStudentsPage displays real students and removes dead alert messaging', async () => {
    renderWithRouter(<TeacherStudentsPage />);

    expect(await screen.findByText('أحمد حسام')).toBeInTheDocument();
    expect(screen.getByText('محمود عادل')).toBeInTheDocument();

    // Verify dead alert messaging button is removed from table rows
    expect(screen.queryByTitle('محادثة')).not.toBeInTheDocument();
    expect(screen.queryByText('مراسلة')).not.toBeInTheDocument();
  });

  // 11. TeacherAIPage: Honest AI State and Generator Contract
  it('verifies TeacherAIPage provides active solver tool and honest advisory panels for upcoming features', async () => {
    renderWithRouter(<TeacherAIPage />);

    expect(screen.getByText('توليد الأسئلة والواجبات الذكي')).toBeInTheDocument();
    expect(screen.getByText('متاح ومفعل')).toBeInTheDocument();

    // Click upcoming feature
    const adaptivePathBtn = screen.getByText('مسارات التعلم التكيفية');
    fireEvent.click(adaptivePathBtn);

    // Should display honest panel instead of fake echoed chat
    expect(await screen.findByText(/هذه الوحدة تخضع حاليًا للتحقق الأكاديمي/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/اطلب من الذكاء الاصطناعي/i)).not.toBeInTheDocument();
  });

  // 12. RTL & Design System Verification
  it('verifies RTL direction and institutional theme styling', async () => {
    const { container } = renderWithRouter(<TeacherHomePage />);

    await waitFor(() => {
      const rootElement = container.querySelector('[dir="rtl"]');
      expect(rootElement).toBeInTheDocument();
      expect(rootElement).toHaveClass("font-['Cairo']");
    });
  });
});
