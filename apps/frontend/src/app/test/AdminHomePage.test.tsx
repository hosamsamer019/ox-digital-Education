import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminHomePage from '../components/admin/AdminHomePage';
import { analyticsService } from '../services/analytics.service';
import { ThemeProvider } from '../contexts/ThemeContext';

const mockAnalyticsData = {
  overview: {
    totalUsers: 1420,
    studentsCount: 1250,
    teachersCount: 45,
    parentsCount: 120,
    adminsCount: 5,
    activeUsers: 890,
    totalCourses: 36,
    totalVideos: 312,
    totalExams: 184,
    totalHomeworks: 92,
    totalEnrollments: 2450,
    totalSubmissions: 5240,
    averageExamScore: 82,
    passRate: 88,
    completionRate: 76,
    atRiskStudents: 14,
    totalRevenue: 345000,
    monthlyRevenue: 125000,
    yearlyRevenue: 1450000,
  },
  roleDistribution: [
    { role: 'ONLINE_STUDENT', _count: 850 },
    { role: 'CENTER_STUDENT', _count: 400 },
    { role: 'TEACHER', _count: 45 },
    { role: 'PARENT', _count: 120 },
    { role: 'ADMIN', _count: 5 },
  ],
  enrollmentData: [
    { month: 'الشهر الماضي', students: 340 },
    { month: 'الشهر الحالي', students: 480 },
  ],
  performanceData: [
    { course: 'رياضيات 1', average: 85 },
    { course: 'جبر متقدم', average: 78 },
  ],
  revenueData: [
    { month: '3/2026', revenue: 135000 },
    { month: '4/2026', revenue: 125000 },
  ],
  recentActivities: [
    { text: 'إجمالي الطلاب المسجلين: 1,250', time: 'محدث الآن', type: 'info' },
    { text: 'المدفوعات الناجحة: 24', time: 'محدث الآن', type: 'success' },
  ],
};

vi.mock('../services/analytics.service', () => ({
  analyticsService: {
    getAdminAnalytics: vi.fn(),
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

describe('Phase 5.1: AdminHomePage Component Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderAdminHome = () => {
    return render(
      <MemoryRouter>
        <ThemeProvider>
          <AdminHomePage />
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  it('renders loading state initially while fetching metrics', () => {
    vi.mocked(analyticsService.getAdminAnalytics).mockReturnValue(new Promise(() => {}));
    renderAdminHome();

    expect(screen.getByText(/جاري تحميل مؤشرات لوحة التحكم المركزية/i)).toBeInTheDocument();
  });

  it('renders executive metrics and institutional brand identity upon successful load', async () => {
    vi.mocked(analyticsService.getAdminAnalytics).mockResolvedValue({
      data: mockAnalyticsData,
    } as any);

    renderAdminHome();

    // Verify main header
    expect(await screen.findByText('لوحة التحكم الرئيسية')).toBeInTheDocument();
    expect(screen.getByText('منظومة الإدارة المركزية')).toBeInTheDocument();

    // Verify Executive KPIs
    expect(screen.getByText('1420')).toBeInTheDocument(); // totalUsers
    expect(screen.getByText(/36/)).toBeInTheDocument();   // totalCourses
    expect(screen.getByText(/184/)).toBeInTheDocument();  // totalExams
    expect(screen.getByText(/890 نشط/i)).toBeInTheDocument(); // activeUsers

    // Verify Quality Indicators
    expect(screen.getByText('88٪')).toBeInTheDocument(); // passRate
    expect(screen.getByText('82٪')).toBeInTheDocument(); // averageExamScore
    expect(screen.getByText('76٪')).toBeInTheDocument(); // completionRate
    expect(screen.getByText('14')).toBeInTheDocument();  // atRiskStudents

    // Verify Recent Activities Stream
    expect(screen.getByText(/إجمالي الطلاب المسجلين: 1,250/i)).toBeInTheDocument();
    expect(screen.getByText(/المدفوعات الناجحة: 24/i)).toBeInTheDocument();
  });

  it('displays institutional error alert with retry button when API fails', async () => {
    vi.mocked(analyticsService.getAdminAnalytics).mockRejectedValue(new Error('Network error'));

    renderAdminHome();

    expect(await screen.findByText(/تعذر تحميل أحدث مؤشرات الأداء الإدارية/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /إعادة المحاولة/i })).toBeInTheDocument();

    // Retry should trigger another call
    vi.mocked(analyticsService.getAdminAnalytics).mockResolvedValue({
      data: mockAnalyticsData,
    } as any);

    fireEvent.click(screen.getByRole('button', { name: /إعادة المحاولة/i }));

    await waitFor(() => {
      expect(screen.queryByText(/تعذر تحميل أحدث مؤشرات الأداء الإدارية/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText('1420')).toBeInTheDocument();
  });

  it('provides manual refresh action in the executive header', async () => {
    vi.mocked(analyticsService.getAdminAnalytics).mockResolvedValue({
      data: mockAnalyticsData,
    } as any);

    renderAdminHome();

    expect(await screen.findByText('لوحة التحكم الرئيسية')).toBeInTheDocument();
    const refreshBtn = screen.getByRole('button', { name: /تحديث المؤشرات/i });
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);
    expect(analyticsService.getAdminAnalytics).toHaveBeenCalledTimes(2);
  });
});

