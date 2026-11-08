import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

describe('AdminDashboard Runtime & Settings Reference Verification', () => {
  it('exports adminMenuItems containing the Settings icon without ReferenceError', () => {
    expect(adminMenuItems).toBeDefined();
    expect(adminMenuItems.length).toBe(19);

    const settingsItem = adminMenuItems.find(item => item.path === '/admin/settings');
    expect(settingsItem).toBeDefined();
    expect(settingsItem?.icon).toBeDefined();
    expect(typeof settingsItem?.icon).toBe('object'); // Lucide icon forwardRef component
    expect(settingsItem?.labelKey).toBe('adminMenuSettings');
  });

  it('renders AdminDashboard successfully without throwing "Settings is not defined"', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/admin/home']}>
        <LanguageProvider>
          <ThemeProvider>
            <AdminDashboard />
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    expect(container).toBeDefined();
    // Verify title from SharedLayout is present
    expect(screen.getAllByText('OX-DIGITAL Education').length).toBeGreaterThan(0);
  });

  it('renders settings navigation item in English mode', () => {
    localStorage.setItem('preferred_language', 'en');
    localStorage.setItem('edu-lang', 'ENGLISH');

    render(
      <MemoryRouter initialEntries={['/admin/home']}>
        <LanguageProvider>
          <ThemeProvider>
            <AdminDashboard />
          </ThemeProvider>
        </LanguageProvider>
      </MemoryRouter>
    );

    // Verify Settings item label translates to English in navigation sidebar
    const settingsButtons = screen.getAllByRole('button', { name: /Platform & Appearance Settings/i });
    expect(settingsButtons.length).toBeGreaterThan(0);
  });
});
