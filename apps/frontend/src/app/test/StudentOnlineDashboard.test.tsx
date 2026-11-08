import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StudentOnlineDashboard from '../components/student-online/StudentOnlineDashboard';
import StudentHomePage from '../components/student-online/StudentHomePage';
import ResultsPage from '../components/student-online/ResultsPage';
import AdaptiveLearningPage from '../components/ai/AdaptiveLearningPage';
import { courseService } from '../services/course.service';
import { analyticsService } from '../services/analytics.service';
import { homeworkService } from '../services/homework.service';
import { userService } from '../services/user.service';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';

const mockStudentUser = {
  id: 'student-online-01',
  name: 'عمر خالد',
  role: 'ONLINE_STUDENT',
  email: 'omar@ox-digital.edu'
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockStudentUser,
    logout: vi.fn(),
    checkAuth: vi.fn(),
  }),
}));

vi.mock('../contexts/SocketContext', () => ({
  useSocket: () => ({
    socket: null,
    isConnected: false,
  }),
}));

vi.mock('../services/course.service', () => ({
  courseService: {
    getCourses: vi.fn(),
    getAvailableCourses: vi.fn(),
    getStudentCourseStats: vi.fn(),
    getCourseDetails: vi.fn(),
    enrollCourse: vi.fn(),
  },
}));

vi.mock('../services/analytics.service', () => ({
  analyticsService: {
    getStudentOverview: vi.fn(),
    getStudentCharts: vi.fn(),
    getStudentRecent: vi.fn(),
  },
}));

vi.mock('../services/homework.service', () => ({
  homeworkService: {
    getHomeworks: vi.fn(),
    getHomeworkDetails: vi.fn(),
    submitHomework: vi.fn(),
  },
}));

vi.mock('../services/user.service', () => ({
  userService: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getNotifications: vi.fn().mockResolvedValue({ data: [] }),
    getUnreadCount: vi.fn().mockResolvedValue({ data: { unreadCount: 0 } }),
  },
}));

const renderWithProviders = (ui: React.ReactElement, initialRoute = '/student/online/home') => {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/student/online/*" element={ui} />
            <Route path="*" element={ui} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
};

describe('Online Student Dashboard Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(userService.getProfile).mockResolvedValue({
      id: 'student-online-01',
      name: 'عمر خالد',
      role: 'ONLINE_STUDENT',
      email: 'omar@ox-digital.edu',
    } as any);

    vi.mocked(courseService.getStudentCourseStats).mockResolvedValue({
      data: {
        enrolledCoursesCount: 3,
        totalLessons: 18,
        completedLessons: 7,
        completionPercentage: 39,
      },
    } as any);

    vi.mocked(analyticsService.getStudentOverview).mockResolvedValue({
      data: {
        gpa: 3.5,
        attendanceRate: 92,
        completedAssignments: 8,
        rank: 1,
      },
    } as any);

    vi.mocked(courseService.getCourses).mockResolvedValue({
      data: {
        data: [
          {
            id: 'course-1',
            title: 'الرياضيات التطبيقية - الصف الأول الثانوي',
            category: 'رياضيات',
            lessons: [
              {
                id: 'lesson-101',
                title: 'مقدمة في الجبر الخطي والمصفوفات',
                duration: 25,
                progress: [{ progress: 45, watched: false, status: 'IN_PROGRESS' }],
              },
            ],
          },
        ],
      },
    } as any);

    vi.mocked(analyticsService.getStudentRecent).mockResolvedValue({
      data: [
        {
          id: 'attempt-1',
          assessmentId: 'exam-1',
          title: 'امتحان الجبر الفصلي',
          type: 'exam',
          score: 88,
          date: '2026-10-28',
          status: 'excellent',
        },
      ],
    } as any);

    vi.mocked(homeworkService.getHomeworks).mockResolvedValue({
      data: {
        data: [
          {
            id: 'hw-1',
            title: 'واجب المصفوفات والمحددات',
            status: 'pending',
            deadline: '2026-11-05',
          },
          {
            id: 'hw-2',
            title: 'واجب المتجهات في الفراغ',
            status: 'draft',
            deadline: '2026-11-08',
          },
        ],
      },
    } as any);

    vi.mocked(analyticsService.getStudentCharts).mockResolvedValue({
      data: {
        performanceData: [
          { month: 'سبتمبر', score: 82 },
          { month: 'أكتوبر', score: 88 },
        ],
        subjectProgress: [
          { subject: 'الجبر الخطي', progress: 85 },
          { subject: 'الهندسة الفراغية', progress: 72 },
        ],
      },
    } as any);
  });

  describe('1. Dashboard Shell & Navigation', () => {
    it('renders institutional branding title and user name subtitle', async () => {
      renderWithProviders(<StudentOnlineDashboard />);

      await waitFor(() => {
        expect(screen.getAllByText('OX-DIGITAL Education').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/عمر خالد/).length).toBeGreaterThan(0);
      });
    });

    it('renders all student navigation items', async () => {
      renderWithProviders(<StudentOnlineDashboard />);

      await waitFor(() => {
        expect(screen.getAllByText('الرئيسية').length).toBeGreaterThan(0);
        expect(screen.getAllByText('دوراتي').length).toBeGreaterThan(0);
        expect(screen.getAllByText('الواجبات').length).toBeGreaterThan(0);
        expect(screen.getAllByText('الامتحانات').length).toBeGreaterThan(0);
        expect(screen.getAllByText('نتائجي').length).toBeGreaterThan(0);
        expect(screen.getAllByText('حل المسائل AI').length).toBeGreaterThan(0);
        expect(screen.getAllByText('مسار التعلم').length).toBeGreaterThan(0);
        expect(screen.getAllByText('المساعد الذكي').length).toBeGreaterThan(0);
        expect(screen.getAllByText('إعدادات الحساب والمظهر').length).toBeGreaterThan(0);
      });
    });

    it('computes dynamic pending homework badge count', async () => {
      renderWithProviders(<StudentOnlineDashboard />);

      await waitFor(() => {
        // 2 pending homeworks (hw-1 pending, hw-2 draft)
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
      });
    });
  });

  describe('2. Student Home Page Data Mapping', () => {
    it('maps verified course stats from getStudentCourseStats without NaN or undefined', async () => {
      renderWithProviders(<StudentHomePage />);

      await waitFor(() => {
        expect(screen.getByText('المقررات الدراسية')).toBeInTheDocument();
        // 3 enrolled courses
        expect(screen.getByText('3')).toBeInTheDocument();
        // 7 / 18 lessons completed
        expect(screen.getByText('7 / 18')).toBeInTheDocument();
        // 39% completion
        expect(screen.getByText('39%')).toBeInTheDocument();
        // 8 completed assignments
        expect(screen.getByText('8')).toBeInTheDocument();
      });
    });

    it('derives and renders the active continue-watching lesson correctly', async () => {
      renderWithProviders(<StudentHomePage />);

      await waitFor(() => {
        expect(screen.getByText('مقدمة في الجبر الخطي والمصفوفات')).toBeInTheDocument();
        expect(screen.getAllByText(/الرياضيات التطبيقية/).length).toBeGreaterThan(0);
        expect(screen.getByText('45%')).toBeInTheDocument();
        expect(screen.getByText('متابعة الدرس')).toBeInTheDocument();
      });
    });

    it('renders recent verified results and upcoming tasks', async () => {
      renderWithProviders(<StudentHomePage />);

      await waitFor(() => {
        expect(screen.getByText('امتحان الجبر الفصلي')).toBeInTheDocument();
        expect(screen.getByText('88%')).toBeInTheDocument();
        expect(screen.getByText('واجب المصفوفات والمحددات')).toBeInTheDocument();
      });
    });

    it('renders retryable error banner on API failure', async () => {
      vi.mocked(courseService.getStudentCourseStats).mockRejectedValue(new Error('Network Error'));
      vi.mocked(analyticsService.getStudentOverview).mockRejectedValue(new Error('Network Error'));
      vi.mocked(courseService.getCourses).mockRejectedValue(new Error('Network Error'));

      renderWithProviders(<StudentHomePage />);

      await waitFor(() => {
        expect(screen.getByText(/تعذر تحميل بيانات لوحة الطالب/)).toBeInTheDocument();
        expect(screen.getByText('إعادة المحاولة')).toBeInTheDocument();
      });
    });

    it('renders encouraging empty state when student has no courses', async () => {
      vi.mocked(courseService.getCourses).mockResolvedValueOnce({ data: { data: [] } } as any);
      vi.mocked(courseService.getStudentCourseStats).mockResolvedValueOnce({
        data: { enrolledCoursesCount: 0, totalLessons: 0, completedLessons: 0, completionPercentage: 0 },
      } as any);

      renderWithProviders(<StudentHomePage />);

      await waitFor(() => {
        expect(screen.getByText(/أنت غير مسجل في أي مقرر دراسي/)).toBeInTheDocument();
      });
    });
  });

  describe('3. Results Page Contract Mapping', () => {
    it('maps performanceData and subjectProgress correctly to charts and summary', async () => {
      renderWithProviders(<ResultsPage />);

      await waitFor(() => {
        expect(screen.getByText('النتائج والتقارير')).toBeInTheDocument();
        expect(screen.getByText('3.5 / 4.0')).toBeInTheDocument();
        expect(screen.getByText('92%')).toBeInTheDocument();
        expect(screen.getByText('الجبر الخطي')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });

    it('renders export PDF button with clean handler', async () => {
      renderWithProviders(<ResultsPage />);

      await waitFor(() => {
        const exportBtn = screen.getByText(/طباعة \/ تصدير التقرير/);
        expect(exportBtn).toBeInTheDocument();
      });
    });
  });

  describe('4. Adaptive Learning Honest Remediation', () => {
    it('displays the transparency notice and authentic subject mastery without mock grades', async () => {
      renderWithProviders(<AdaptiveLearningPage />);

      await waitFor(() => {
        expect(screen.getByText(/إشعار الشفافية الأكاديمية/)).toBeInTheDocument();
        expect(screen.getByText('الجبر الخطي')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
        // Fabricated mock score from previous version (92% for 'أساسيات الجبر') should not exist
        expect(screen.queryByText('أساسيات الجبر')).not.toBeInTheDocument();
      });
    });
  });
});
