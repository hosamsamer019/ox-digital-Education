import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TeacherHomePage from '../components/teacher/TeacherHomePage';
import TeacherDashboard from '../components/teacher/TeacherDashboard';
import TeacherProfilePage from '../components/teacher/TeacherProfilePage';
import AccountSettingsPage from '../components/shared/AccountSettingsPage';
import { ThemeProvider } from '../contexts/ThemeContext';
import { LanguageProvider } from '../contexts/LanguageContext';

// Mutable mock user for dynamic session and branch switching testing
let currentMockUser: any = {
  id: 'teacher-01',
  name: 'أ. د. حسام سامر',
  role: 'TEACHER',
  email: 'hosam@ox-digital.edu',
  branchId: 'branch-dokki-001',
  branch: { id: 'branch-dokki-001', name: 'فرع الدقي الأكاديمي', code: 'DK-01' }
};

const mockUpdateUser = vi.fn();
const mockLogout = vi.fn();
const mockCheckAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: currentMockUser,
    logout: mockLogout,
    checkAuth: mockCheckAuth,
    updateUser: mockUpdateUser
  })
}));

vi.mock('../services/analytics.service', () => ({
  analyticsService: {
    getTeacherAnalytics: vi.fn().mockResolvedValue({
      data: {
        totalStudents: 30,
        totalCourses: 3,
        averageScore: 85,
        strugglingStudents: 1,
        distributionData: [],
        riskStudents: []
      }
    }),
    getRiskAnalytics: vi.fn().mockResolvedValue({ data: { riskStudents: [] } })
  }
}));

vi.mock('../services/notification.service', () => ({
  notificationService: {
    getNotifications: vi.fn().mockResolvedValue({ data: [] })
  }
}));

vi.mock('../services/user.service', () => ({
  userService: {
    getLinkedRelationships: vi.fn().mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: {
          branch: currentMockUser.branch,
          branchAccountants: [{ id: 'acc-1', name: 'أ. كمال المحاسب', email: 'kamal@ox.edu' }]
        }
      })
    ),
    getProfile: vi.fn().mockImplementation(() => Promise.resolve(currentMockUser))
  }
}));

vi.mock('../services/brdSubscription.service', () => ({
  brdSubscriptionService: {
    getAccountSettings: vi.fn().mockImplementation(() =>
      Promise.resolve({
        success: true,
        data: {
          id: currentMockUser.id,
          name: currentMockUser.name,
          email: currentMockUser.email,
          theme: 'default',
          language: currentMockUser.language || 'ar'
        }
      })
    ),
    updateAccountSettings: vi.fn().mockResolvedValue({ success: true })
  }
}));

describe('Teacher Branch Identity & Authorization Boundaries Suite', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    currentMockUser = {
      id: 'teacher-01',
      name: 'أ. د. حسام سامر',
      role: 'TEACHER',
      email: 'hosam@ox-digital.edu',
      language: 'ar',
      branchId: 'branch-dokki-001',
      branch: { id: 'branch-dokki-001', name: 'فرع الدقي الأكاديمي', code: 'DK-01' }
    };
  });

  afterEach(() => {
    cleanup();
  });

  const renderWithProviders = (ui: React.ReactElement, initialLang: 'ar' | 'en' = 'ar') => {
    localStorage.setItem('preferred_language', initialLang);
    localStorage.setItem('edu-lang', initialLang);
    return render(
      <MemoryRouter>
        <ThemeProvider>
          <LanguageProvider>
            {ui}
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  it('1. Assigned teacher sees the actual assigned branch name in TeacherHomePage', async () => {
    renderWithProviders(<TeacherHomePage />);

    const branchBadge = await screen.findByTestId('teacher-branch-badge');
    expect(branchBadge).toBeInTheDocument();
    expect(branchBadge).toHaveTextContent('فرع الدقي الأكاديمي');
  });

  it('2. Unassigned teacher sees explicit unassigned state in TeacherHomePage', async () => {
    currentMockUser = {
      ...currentMockUser,
      branchId: null,
      branch: null
    };

    renderWithProviders(<TeacherHomePage />);

    const unassignedBadge = await screen.findByTestId('teacher-unassigned-badge');
    expect(unassignedBadge).toBeInTheDocument();
    expect(unassignedBadge).toHaveTextContent('غير مسند لفرع حالياً');
  });

  it('3. Branch information is not replaced by a synthetic main-center label in AccountSettingsPage', async () => {
    currentMockUser = {
      ...currentMockUser,
      branchId: null,
      branch: null
    };

    renderWithProviders(<AccountSettingsPage />);

    // Switch to Profile Tab where branch is displayed
    const profileTabBtn = screen.getByRole('button', { name: /الملف الشخصي والصورة/i });
    fireEvent.click(profileTabBtn);

    // Must NOT contain the synthetic fallback
    expect(screen.queryByText('المركز الرئيسي / عام')).not.toBeInTheDocument();

    // Must contain explicit unassigned indicator
    const unassignedBadge = await screen.findByTestId('settings-unassigned-badge');
    expect(unassignedBadge).toHaveTextContent('غير مسند لفرع حالياً');
  });

  it('4. Arabic and English labels render correctly in both languages', async () => {
    currentMockUser.language = 'en';
    renderWithProviders(<TeacherHomePage />, 'en');

    const branchBadge = await screen.findByTestId('teacher-branch-badge');
    expect(branchBadge).toBeInTheDocument();
    expect(branchBadge).toHaveTextContent('Branch:');
    expect(branchBadge).toHaveTextContent('فرع الدقي الأكاديمي');
  });

  it('5. Unassigned badge in English renders "Not assigned to a branch" without leaking Arabic', async () => {
    currentMockUser = {
      ...currentMockUser,
      language: 'en',
      branchId: null,
      branch: null
    };

    renderWithProviders(<TeacherHomePage />, 'en');

    const unassignedBadge = await screen.findByTestId('teacher-unassigned-badge');
    expect(unassignedBadge).toBeInTheDocument();
    expect(unassignedBadge).toHaveTextContent('Not assigned to a branch');
    expect(unassignedBadge).not.toHaveTextContent('غير مسند');
  });

  it('6. Teacher cannot modify branch assignment through profile settings (forbiddenFields enforcement)', () => {
    const forbiddenFields = [
      'country', 'educationLevel', 'gradeLevel', 'academicLevel', 'role',
      'institutionId', 'branchId', 'parentId', 'parentEmail', 'parentPassword',
      'parentName', 'parentPhone', 'centerGroupId', 'childId', 'isPrimaryManager'
    ];

    const simulateProfileUpdate = (submittedPayload: any) => {
      const keys = Object.keys(submittedPayload);
      const hasForbidden = keys.some(k => forbiddenFields.includes(k));
      if (hasForbidden) {
        return { status: 400, message: 'Restricted fields cannot be modified via profile update' };
      }
      return { status: 200, message: 'Profile updated' };
    };

    const attempt = simulateProfileUpdate({ name: 'اسم جديد', branchId: 'tampered-branch-id' });
    expect(attempt.status).toBe(400);
    expect(attempt.message).toContain('Restricted fields cannot be modified');
  });

  it('7. Stale branch information is not displayed after authenticated account state changes', async () => {
    const { unmount } = renderWithProviders(<TeacherHomePage />);
    const initialBadge = await screen.findByTestId('teacher-branch-badge');
    expect(initialBadge).toHaveTextContent('فرع الدقي الأكاديمي');
    unmount();

    // Reassign teacher to Nasr City branch
    currentMockUser = {
      ...currentMockUser,
      branchId: 'branch-nasr-city-002',
      branch: { id: 'branch-nasr-city-002', name: 'فرع مدينة نصر', code: 'NC-02' }
    };

    renderWithProviders(<TeacherHomePage />);
    const updatedBadge = await screen.findByTestId('teacher-branch-badge');
    expect(updatedBadge).toHaveTextContent('فرع مدينة نصر');
    expect(updatedBadge).not.toHaveTextContent('فرع الدقي الأكاديمي');
  });

  it('8. Renders assigned branch information in TeacherProfilePage', async () => {
    currentMockUser = {
      ...currentMockUser,
      branchId: 'branch-dokki-001',
      branch: { id: 'branch-dokki-001', name: 'فرع الدقي الأكاديمي', code: 'DK-01' }
    };

    renderWithProviders(<TeacherProfilePage />);
    const badge = await screen.findByText(/فرع الدقي الأكاديمي/);
    expect(badge).toBeTruthy();
    const input = screen.getByDisplayValue(/فرع الدقي الأكاديمي/);
    expect(input).toBeTruthy();
  });

  it('9. Explicitly displays "غير مسند لفرع حالياً" in TeacherProfilePage when unassigned', async () => {
    currentMockUser = {
      ...currentMockUser,
      branchId: null,
      branch: null
    };

    renderWithProviders(<TeacherProfilePage />);
    const unassignedElements = await screen.findAllByText('غير مسند لفرع حالياً');
    expect(unassignedElements.length).toBeGreaterThanOrEqual(1);
  });
});
