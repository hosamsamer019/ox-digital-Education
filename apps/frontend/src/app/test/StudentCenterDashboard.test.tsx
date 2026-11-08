import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StudentCenterDashboard from '../components/student-center/StudentCenterDashboard';
import StudentHomePage from '../components/student-center/StudentHomePage';
import AttendancePage from '../components/student-center/AttendancePage';
import ResultsPage from '../components/student-center/ResultsPage';
import CourseDetailsPage from '../components/student-center/CourseDetailsPage';
import { courseService } from '../services/course.service';
import { analyticsService } from '../services/analytics.service';
import { homeworkService } from '../services/homework.service';
import { userService } from '../services/user.service';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';

const mockCenterStudent = {
  id: 'student-center-01',
  name: 'أحمد محمود',
  role: 'CENTER_STUDENT',
  email: 'ahmed@ox-digital.edu'
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockCenterStudent,
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
    getAttendance: vi.fn(),
  },
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getNotifications: vi.fn().mockResolvedValue({ data: [] }),
    getUnreadCount: vi.fn().mockResolvedValue({ data: { unreadCount: 0 } }),
  },
}));

const renderWithProviders = (ui: React.ReactElement, initialRoute = '/student/center/home') => {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/student/center/*" element={ui} />
            <Route path="*" element={ui} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
};

describe('Student Center Dashboard Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(userService.getProfile).mockResolvedValue({
      id: 'student-center-01',
      name: 'أحمد محمود',
      role: 'CENTER_STUDENT',
    } as any);

    vi.mocked(userService.getAttendance).mockResolvedValue({
      data: [
        { id: 'att-1', studentId: 'student-center-01', status: 'PRESENT', date: '2026-10-25' },
        { id: 'att-2', studentId: 'student-center-01', status: 'LATE', date: '2026-10-20' },
        { id: 'att-3', studentId: 'student-center-01', status: 'ABSENT', date: '2026-10-15' },
      ],
      summary: {
        totalSessions: 3,
        presentCount: 1,
        absentCount: 1,
        lateCount: 1,
        percentage: 67
      }
    });

    vi.mocked(courseService.getStudentCourseStats).mockResolvedValue({
      data: {
        enrolledCoursesCount: 4,
        totalLessons: 24,
        completedLessons: 16,
        completionPercentage: 67,
      }
    } as any);

    vi.mocked(analyticsService.getStudentOverview).mockResolvedValue({
      data: {
        gpa: 3.75,
        attendanceRate: 88,
        completedAssignments: 14,
        rank: 3,
      }
    } as any);

    vi.mocked(courseService.getCourses).mockResolvedValue({
      data: [
        {
          id: 'course-1',
          title: 'الفيزياء المتقدمة - الميكانيكا',
          progress: 50,
          lessons: [
            { id: 'lesson-101', title: 'قوانين نيوتن للحركة', duration: '45 دقيقة', progress: [{ progress: 100, status: 'COMPLETED' }] },
            { id: 'lesson-102', title: 'كمية الحركة والتصادم', duration: '35 دقيقة', progress: [{ progress: 45, status: 'IN_PROGRESS' }] },
            { id: 'lesson-103', title: 'الحركة الدائرية', duration: '40 دقيقة', progress: [{ progress: 0 }] }
          ]
        }
      ]
    } as any);

    vi.mocked(analyticsService.getStudentRecent).mockResolvedValue({
      data: [
        {
          id: 'att-10',
          assessmentId: 'exam-10',
          title: 'اختبار نصف الفصل - الميكانيكا',
          type: 'exam',
          score: 92,
          date: '2026-10-22',
          status: 'COMPLETED'
        }
      ]
    } as any);

    vi.mocked(analyticsService.getStudentCharts).mockResolvedValue({
      data: {
        performanceData: [
          { month: 'سبتمبر', score: 85 },
          { month: 'أكتوبر', score: 92 }
        ],
        subjectProgress: [
          { subject: 'الميكانيكا', progress: 78 },
          { subject: 'الديناميكا الحرارية', progress: 60 }
        ]
      }
    } as any);

    vi.mocked(homeworkService.getHomeworks).mockResolvedValue({
      data: [
        { id: 'hw-1', title: 'واجب الحركة التوافقية', status: 'pending', course: { title: 'الفيزياء المتقدمة' } }
      ]
    } as any);
  });

  describe('1. Student Center Shell & Navigation', () => {
    it('renders the dashboard shell with institutional branding and profile subtitle', async () => {
      renderWithProviders(<StudentCenterDashboard />);

      await waitFor(() => {
        expect(screen.getAllByText(/OX-DIGITAL Education/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/أحمد محمود/).length).toBeGreaterThan(0);
      });

      // Verify Center-specific and standard menu items
      expect(screen.getAllByText(/الغياب والحضور/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/دوراتي/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/الواجبات/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/نتائجي/).length).toBeGreaterThan(0);

      // Verify standalone 'الدروس والفيديوهات' is NOT present
      expect(screen.queryByText('الدروس والفيديوهات')).not.toBeInTheDocument();
    });

    it('attaches visibility-aware polling and cleans up interval on unmount', () => {
      const addEventSpy = vi.spyOn(document, 'addEventListener');
      const removeEventSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = renderWithProviders(<StudentCenterDashboard />);
      expect(addEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

      unmount();
      expect(removeEventSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  describe('2. Student Home Hub Data & Derivations', () => {
    it('renders live KPI cards from courseStats, analytics overview, and attendance', async () => {
      renderWithProviders(<StudentHomePage />);

      await waitFor(() => {
        // Enrolled courses count (4)
        expect(screen.getByText('4')).toBeInTheDocument();
        // GPA (3.75)
        expect(screen.getByText('3.75')).toBeInTheDocument();
        // Completed lessons (16)
        expect(screen.getByText('16')).toBeInTheDocument();
        // Attendance percentage (67%)
        expect(screen.getByText('67٪')).toBeInTheDocument();
      });
    });

    it('derives active in-progress lesson for the Continue Watching hero', async () => {
      renderWithProviders(<StudentHomePage />);

      await waitFor(() => {
        expect(screen.getByText('كمية الحركة والتصادم')).toBeInTheDocument();
        expect(screen.getByText('45%')).toBeInTheDocument();
        expect(screen.getAllByText(/الفيزياء المتقدمة - الميكانيكا/).length).toBeGreaterThan(0);
      });
    });

    it('displays error banner with retry trigger when primary APIs fail', async () => {
      vi.mocked(courseService.getStudentCourseStats).mockRejectedValueOnce(new Error('Network failure'));
      vi.mocked(analyticsService.getStudentOverview).mockRejectedValueOnce(new Error('Network failure'));
      vi.mocked(courseService.getCourses).mockRejectedValueOnce(new Error('Network failure'));
      vi.mocked(userService.getAttendance).mockRejectedValueOnce(new Error('Network failure'));

      renderWithProviders(<StudentHomePage />);

      await waitFor(() => {
        expect(screen.getByText(/تعذر تحميل بيانات لوحة طالب السنتر بشكل كامل/)).toBeInTheDocument();
        expect(screen.getByText('إعادة المحاولة')).toBeInTheDocument();
      });
    });
  });

  describe('3. Center Attendance Tracking & Semantics', () => {
    it('renders attendance summary and verifies LATE is counted as attended', async () => {
      renderWithProviders(<AttendancePage />, '/student/center/attendance');

      await waitFor(() => {
        expect(screen.getByText('سجل الحضور والغياب الميداني')).toBeInTheDocument();
        // Total sessions = 3
        expect(screen.getByText('3')).toBeInTheDocument();
        // Percentage = 67%
        expect(screen.getByText('67٪')).toBeInTheDocument();
      });

      // Status badges in table
      expect(screen.getAllByText(/حاضر/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/متأخر/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/غائب/).length).toBeGreaterThan(0);
    });

    it('computes fallback summary correctly if API returns plain array', async () => {
      vi.mocked(userService.getAttendance).mockResolvedValueOnce([
        { id: '1', status: 'PRESENT', date: '2026-10-01' },
        { id: '2', status: 'LATE', date: '2026-10-02' },
        { id: '3', status: 'PRESENT', date: '2026-10-03' },
        { id: '4', status: 'ABSENT', date: '2026-10-04' }
      ] as any);

      renderWithProviders(<AttendancePage />, '/student/center/attendance');

      await waitFor(() => {
        // Total = 4, Present = 2, Late = 1, Absent = 1 -> Percentage = (2 + 1) / 4 = 75%
        expect(screen.getByText('4')).toBeInTheDocument();
        expect(screen.getByText('75٪')).toBeInTheDocument();
      });
    });
  });

  describe('4. Course Details Verification (CourseStatistics Parity)', () => {
    it('handles zero lessons safely in center course details', async () => {
      vi.mocked(courseService.getCourseDetails).mockResolvedValueOnce({
        data: {
          id: 'c-zero',
          title: 'مقرر تجريبي جديد',
          description: 'لا توجد دروس بعد',
          totalLessons: 0,
          completedLessons: 0,
          completionPercentage: 0,
          lessons: []
        }
      } as any);

      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/student/center/courses/c-zero']}>
            <Routes>
              <Route path="/student/center/courses/:courseId" element={<CourseDetailsPage />} />
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('مقرر تجريبي جديد')).toBeInTheDocument();
      });

      // Total and completed both 0
      expect(screen.getAllByText('0')).toHaveLength(2);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('5. Results & Reports Contract Mapping', () => {
    it('renders results page with performance charts, valid rank, and assessment review link', async () => {
      renderWithProviders(<ResultsPage />, '/student/center/results');

      await waitFor(() => {
        expect(screen.getByText('النتائج والتقارير الأكاديمية')).toBeInTheDocument();
        expect(screen.getByText('3.8 / 4.0')).toBeInTheDocument(); // 3.75 formatted as 3.8
        expect(screen.getByText('اختبار نصف الفصل - الميكانيكا')).toBeInTheDocument();
        expect(screen.getByText('92%')).toBeInTheDocument();
        expect(screen.getByText('مراجعة الإجابات')).toBeInTheDocument();
        // Valid positive numeric rank rendering
        expect(screen.getByText('الترتيب التحصيلي')).toBeInTheDocument();
        expect(screen.getByText('المرتبة 3')).toBeInTheDocument();
        expect(screen.getByText('بين طلاب المستوى الدراسي')).toBeInTheDocument();
      });
    });

    it('handles rank: null by displaying honest unavailable status with minimum assessment requirement', async () => {
      vi.mocked(analyticsService.getStudentOverview).mockResolvedValueOnce({
        data: {
          gpa: 3.75,
          attendanceRate: 88,
          completedAssignments: 14,
          rank: null,
          rankStatus: 'INSUFFICIENT_DATA'
        }
      } as any);

      renderWithProviders(<ResultsPage />, '/student/center/results');

      await waitFor(() => {
        expect(screen.getByText('الترتيب التحصيلي')).toBeInTheDocument();
        expect(screen.getByText('غير متوفر حالياً')).toBeInTheDocument();
        expect(screen.getByText('قيد الاحتساب — يتطلب إكمال 3 تقييمات على الأقل')).toBeInTheDocument();
      });

      // Verify fabricated 'المرتبة 1' is NEVER rendered
      expect(screen.queryByText('المرتبة 1')).not.toBeInTheDocument();
    });

    it('handles missing or zero rank safely without NaN or undefined', async () => {
      vi.mocked(analyticsService.getStudentOverview).mockResolvedValueOnce({
        data: {
          gpa: 3.75,
          attendanceRate: 88,
          completedAssignments: 14,
          rank: 0,
        }
      } as any);

      renderWithProviders(<ResultsPage />, '/student/center/results');

      await waitFor(() => {
        expect(screen.getByText('الترتيب التحصيلي')).toBeInTheDocument();
        expect(screen.getByText('غير متوفر حالياً')).toBeInTheDocument();
        expect(screen.getByText('قيد الاحتساب — يتطلب إكمال 3 تقييمات على الأقل')).toBeInTheDocument();
      });

      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
      expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    });
  });
});

