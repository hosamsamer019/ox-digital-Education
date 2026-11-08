import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminDashboard, { adminMenuItems } from '../components/admin/AdminDashboard';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ThemeProvider } from '../contexts/ThemeContext';

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-01',
      name: 'مدير المنظومة الموحدة',
      email: 'admin@ox-digital.edu',
      role: 'ADMIN',
      isActive: true,
    },
    logout: vi.fn(),
    isAuthenticated: true,
  }),
}));

// Mock Notification Service
vi.mock('../services/notification.service', () => ({
  notificationService: {
    getUnreadCount: vi.fn().mockResolvedValue({ data: { unreadCount: 0 } }),
  },
}));

// Mock User Service
vi.mock('../services/user.service', () => ({
  userService: {
    getUsers: vi.fn().mockResolvedValue({ data: [], totalPages: 1 }),
    deleteUser: vi.fn().mockResolvedValue({ success: true }),
    createUser: vi.fn().mockResolvedValue({ success: true }),
    updateUser: vi.fn().mockResolvedValue({ success: true }),
  },
}));

describe('AdminDashboard Runtime, Settings & isRtl Localization Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  });

  it('exports adminMenuItems containing the Settings icon without ReferenceError', () => {
    expect(adminMenuItems).toBeDefined();
    expect(adminMenuItems.length).toBe(19);

    const settingsItem = adminMenuItems.find(item => item.path === '/admin/settings');
    expect(settingsItem).toBeDefined();
    expect(settingsItem?.icon).toBeDefined();
    expect(typeof settingsItem?.icon).toBe('object'); // Lucide icon forwardRef component
    expect(settingsItem?.labelKey).toBe('adminMenuSettings');
  });

  it('renders AdminDashboard successfully without throwing "Settings is not defined" in Arabic RTL', () => {
    localStorage.setItem('preferred_language', 'ar');
    localStorage.setItem('edu-lang', 'ARABIC');

    const { container } = render(
      <MemoryRouter initialEntries={['/admin/home']}>
        <LanguageProvider>
          <ThemeProvider>
            <Routes>
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Routes>
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    expect(container).toBeDefined();
    expect(screen.getAllByText('OX-DIGITAL Education').length).toBeGreaterThan(0);
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('renders AdminDashboard successfully in English LTR mode', () => {
    localStorage.setItem('preferred_language', 'en');
    localStorage.setItem('edu-lang', 'ENGLISH');

    render(
      <MemoryRouter initialEntries={['/admin/home']}>
        <LanguageProvider>
          <ThemeProvider>
            <Routes>
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Routes>
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    expect(screen.getAllByText('OX-DIGITAL Education').length).toBeGreaterThan(0);
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.getAttribute('lang')).toBe('en');

    // Verify Settings item label translates to English in navigation sidebar
    const settingsButtons = screen.getAllByRole('button', { name: /Platform & Appearance Settings/i });
    expect(settingsButtons.length).toBeGreaterThan(0);
  });

  it('renders StudentsPage inside AdminDashboard without throwing "ReferenceError: isRtl is not defined" in Arabic RTL', async () => {
    localStorage.setItem('preferred_language', 'ar');
    localStorage.setItem('edu-lang', 'ARABIC');

    render(
      <MemoryRouter initialEntries={['/admin/students']}>
        <LanguageProvider>
          <ThemeProvider>
            <Routes>
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Routes>
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    // Verify StudentsPage table headers are rendered
    await waitFor(() => {
      const nameHeaders = screen.getAllByText('الاسم');
      expect(nameHeaders.length).toBeGreaterThan(0);
      // In Arabic RTL, isRtl is true -> text-right should be applied
      const th = nameHeaders[0].closest('th');
      expect(th?.className).toContain('text-right');
      expect(th?.className).not.toContain('text-left');
    });
  });

  it('renders StudentsPage inside AdminDashboard without throwing "ReferenceError: isRtl is not defined" in English LTR', async () => {
    localStorage.setItem('preferred_language', 'en');
    localStorage.setItem('edu-lang', 'ENGLISH');

    render(
      <MemoryRouter initialEntries={['/admin/students']}>
        <LanguageProvider>
          <ThemeProvider>
            <Routes>
              <Route path="/admin/*" element={<AdminDashboard />} />
            </Routes>
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    // Verify StudentsPage table headers are rendered in English with text-left
    await waitFor(() => {
      const nameHeaders = screen.getAllByText('Name');
      expect(nameHeaders.length).toBeGreaterThan(0);
      // In English LTR, isRtl is false -> text-left should be applied
      const th = nameHeaders[0].closest('th');
      expect(th?.className).toContain('text-left');
      expect(th?.className).not.toContain('text-right');
    });
  });
});
