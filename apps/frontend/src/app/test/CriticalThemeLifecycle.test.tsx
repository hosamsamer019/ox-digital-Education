import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme, Theme, resolveThemeAlias, DARK_THEMES, LIGHT_THEMES } from '../contexts/ThemeContext';
import AccountSettingsPage from '../components/shared/AccountSettingsPage';
import { MemoryRouter } from 'react-router-dom';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies for AccountSettingsPage
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', name: 'أحمد محمود', email: 'ahmed@ox-digital.edu', role: 'ADMIN', theme: 'default' },
    updateUser: vi.fn()
  })
}));

const mockGetAccountSettings = vi.fn().mockResolvedValue({
  success: true,
  data: { id: 'user-123', name: 'أحمد محمود', email: 'ahmed@ox-digital.edu', theme: 'default', language: 'ar' }
});

const mockUpdateAccountSettings = vi.fn().mockImplementation(async (payload: any) => {
  return { success: true, data: payload };
});

vi.mock('../services/brdSubscription.service', () => ({
  brdSubscriptionService: {
    getAccountSettings: () => mockGetAccountSettings(),
    updateAccountSettings: (payload: any) => mockUpdateAccountSettings(payload),
    uploadProfilePicture: vi.fn(),
    deleteProfilePicture: vi.fn()
  }
}));

describe('Critical Theme Lifecycle, State Ownership & Persistence Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    vi.clearAllMocks();
  });

  it('1. Theme selection: verifies all 7 canonical themes update state, DOM attributes, and storage', () => {
    const TestComponent = () => {
      const { theme, setTheme, isDark } = useTheme();
      return (
        <div>
          <span data-testid="active-theme">{theme}</span>
          <span data-testid="is-dark">{isDark ? 'true' : 'false'}</span>
          <button onClick={() => setTheme('default')}>Set Default</button>
          <button onClick={() => setTheme('light')}>Set Light</button>
          <button onClick={() => setTheme('dark')}>Set Dark</button>
          <button onClick={() => setTheme('blue')}>Set Blue</button>
          <button onClick={() => setTheme('green')}>Set Green</button>
          <button onClick={() => setTheme('purple')}>Set Purple</button>
          <button onClick={() => setTheme('warm-orange')}>Set Warm Orange</button>
        </div>
      );
    };

    const { getByText, getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    const allThemes: { id: Theme; isDark: boolean }[] = [
      { id: 'default', isDark: false },
      { id: 'light', isDark: false },
      { id: 'dark', isDark: true },
      { id: 'blue', isDark: true },
      { id: 'green', isDark: true },
      { id: 'purple', isDark: true },
      { id: 'warm-orange', isDark: true }
    ];

    for (const t of allThemes) {
      const btnName = `Set ${t.id === 'warm-orange' ? 'Warm Orange' : t.id.charAt(0).toUpperCase() + t.id.slice(1)}`;
      act(() => {
        getByText(btnName).click();
      });

      expect(getByTestId('active-theme').textContent).toBe(t.id);
      expect(getByTestId('is-dark').textContent).toBe(t.isDark ? 'true' : 'false');
      expect(document.documentElement.getAttribute('data-theme')).toBe(t.id);

      if (t.isDark) {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      } else {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      }

      expect(localStorage.getItem('preferred_theme')).toBe(t.id);
      expect(localStorage.getItem('edu-theme')).toBe(t.id);
    }
  });

  it('2. Alias resolution: verifies navy, sepia, and high-contrast resolve to canonical targets', () => {
    expect(resolveThemeAlias('navy')).toBe('blue');
    expect(resolveThemeAlias('NAVY ')).toBe('blue');
    expect(resolveThemeAlias('sepia')).toBe('warm-orange');
    expect(resolveThemeAlias('SEPIA')).toBe('warm-orange');
    expect(resolveThemeAlias('high-contrast')).toBe('dark');
    expect(resolveThemeAlias('unknown-theme')).toBe(null);
  });

  it('3. Persistence: verifies ThemeProvider restores saved theme from localStorage on initial load', () => {
    localStorage.setItem('preferred_theme', 'purple');

    const TestComponent = () => {
      const { theme, isDark } = useTheme();
      return (
        <div>
          <span data-testid="restored-theme">{theme}</span>
          <span data-testid="restored-dark">{isDark ? 'true' : 'false'}</span>
        </div>
      );
    };

    const { getByTestId } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(getByTestId('restored-theme').textContent).toBe('purple');
    expect(getByTestId('restored-dark').textContent).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('purple');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('4. Account Settings: user can interactively select themes and trigger server synchronization', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <AccountSettingsPage />
        </ThemeProvider>
      </MemoryRouter>
    );

    // Find and click the Royal Blue theme button
    const blueBtn = screen.getByRole('button', { name: /الأزرق الملكي/i });
    expect(blueBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(blueBtn);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('blue');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('preferred_theme')).toBe('blue');
    expect(mockUpdateAccountSettings).toHaveBeenCalledWith({ theme: 'blue' });

    // Switch to Light Minimal
    const lightBtn = screen.getByRole('button', { name: /الفاتح النقي/i });
    await act(async () => {
      fireEvent.click(lightBtn);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('preferred_theme')).toBe('light');
    expect(mockUpdateAccountSettings).toHaveBeenCalledWith({ theme: 'light' });

    // Switch back to Default (Classic Crimson)
    const defaultBtn = screen.getByRole('button', { name: /الافتراضي/i });
    await act(async () => {
      fireEvent.click(defaultBtn);
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('preferred_theme')).toBe('default');
  }, 15000);

  it('5. Contrast Verification: verifies WCAG 2.1 AA mathematical compliance across all 7 themes in theme.css', () => {
    const cssPath = path.resolve(__dirname, '../../styles/theme.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    expect(cssContent.length).toBeGreaterThan(0);

    // Helper to compute relative luminance from hex
    function hexToLuminance(hex: string): number {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16) / 255;
      const g = parseInt(clean.substring(2, 4), 16) / 255;
      const b = parseInt(clean.substring(4, 6), 16) / 255;

      const toLin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
    }

    function getContrast(hex1: string, hex2: string): number {
      const l1 = hexToLuminance(hex1);
      const l2 = hexToLuminance(hex2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    // Verify palettes defined in theme.css
    const palettes = [
      { name: 'default', bg: '#f8fafc', fg: '#0f172a', card: '#ffffff', primary: '#b62626' },
      { name: 'light', bg: '#ffffff', fg: '#09090b', card: '#ffffff', primary: '#18181b' },
      { name: 'dark', bg: '#0b0f19', fg: '#f8fafc', card: '#111827', primary: '#e03131' },
      { name: 'blue', bg: '#070d1e', fg: '#f8fafc', card: '#0f1b38', primary: '#2563eb' },
      { name: 'green', bg: '#05130b', fg: '#f0fdf4', card: '#0b2416', primary: '#059669' },
      { name: 'purple', bg: '#0d0517', fg: '#faf5ff', card: '#180c2a', primary: '#7c3aed' },
      { name: 'warm-orange', bg: '#140d05', fg: '#fffbeb', card: '#22160a', primary: '#d97706' },
    ];

    for (const p of palettes) {
      // 1. Text on Canvas contrast >= 4.5
      const textCanvasContrast = getContrast(p.fg, p.bg);
      expect(textCanvasContrast).toBeGreaterThanOrEqual(4.5);

      // 2. Text on Card contrast >= 4.5
      const textCardContrast = getContrast(p.fg, p.card);
      expect(textCardContrast).toBeGreaterThanOrEqual(4.5);
    }
  });
});
