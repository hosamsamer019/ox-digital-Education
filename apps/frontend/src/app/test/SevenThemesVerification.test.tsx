import { describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme, Theme } from '../contexts/ThemeContext';
import * as fs from 'fs';
import * as path from 'path';

// Helper component to test ThemeContext
const ThemeTestConsumer = () => {
  const { theme, setTheme, toggleTheme, isDark } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <span data-testid="is-dark">{isDark ? 'true' : 'false'}</span>
      <button onClick={() => setTheme('blue')}>Set Blue</button>
      <button onClick={() => setTheme('green')}>Set Green</button>
      <button onClick={() => setTheme('purple')}>Set Purple</button>
      <button onClick={() => setTheme('warm-orange')}>Set Warm Orange</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('default')}>Set Default</button>
      <button onClick={() => toggleTheme()}>Toggle Theme</button>
    </div>
  );
};

describe('Seven Distinct Appearance Themes Verification Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
  });

  it('verifies theme.css defines CSS variable palettes for all 7 required themes', () => {
    const cssPath = path.resolve(__dirname, '../../styles/theme.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // 1. Default (Classic Academic Crimson)
    expect(cssContent).toMatch(/\[data-theme=["']default["']\]/);
    expect(cssContent).toMatch(/--primary:\s*#b62626/);
    expect(cssContent).toMatch(/--background:\s*#f8fafc/);

    // 2. Light Minimal
    expect(cssContent).toMatch(/\[data-theme=["']light["']\]/);
    expect(cssContent).toMatch(/--primary:\s*#18181b/);
    expect(cssContent).toMatch(/--background:\s*#ffffff/);

    // 3. Dark (Midnight with Crimson Accent)
    expect(cssContent).toMatch(/\[data-theme=["']dark["']\]/);
    expect(cssContent).toMatch(/\.dark,/);
    expect(cssContent).toMatch(/--primary:\s*#e03131/);
    expect(cssContent).toMatch(/--card:\s*#111827/);

    // 4. Blue (Royal Blue)
    expect(cssContent).toMatch(/\[data-theme=["']blue["']\]/);
    expect(cssContent).toMatch(/--primary:\s*#2563eb/);
    expect(cssContent).toMatch(/--card:\s*#0f1b38/);

    // 5. Green (Emerald)
    expect(cssContent).toMatch(/\[data-theme=["']green["']\]/);
    expect(cssContent).toMatch(/--primary:\s*#059669/);
    expect(cssContent).toMatch(/--card:\s*#0b2416/);

    // 6. Purple (Deep Violet)
    expect(cssContent).toMatch(/\[data-theme=["']purple["']\]/);
    expect(cssContent).toMatch(/--primary:\s*#7c3aed/);
    expect(cssContent).toMatch(/--card:\s*#180c2a/);

    // 7. Warm Orange (Amber Espresso)
    expect(cssContent).toMatch(/\[data-theme=["']warm-orange["']\]/);
    expect(cssContent).toMatch(/--primary:\s*#d97706/);
    expect(cssContent).toMatch(/--card:\s*#22160a/);
  });

  it('verifies ThemeContext supports setting and persisting all 7 themes with correct luminance mapping', () => {
    const { getByText, getByTestId } = render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    const themesToTest: Theme[] = [
      'blue',
      'green',
      'purple',
      'warm-orange',
      'dark',
      'light',
      'default'
    ];

    for (const targetTheme of themesToTest) {
      const buttonName = `Set ${targetTheme === 'warm-orange' ? 'Warm Orange' : targetTheme.charAt(0).toUpperCase() + targetTheme.slice(1)}`;
      const btn = getByText(buttonName);
      
      act(() => {
        btn.click();
      });

      expect(getByTestId('current-theme').textContent).toBe(targetTheme);
      expect(document.documentElement.getAttribute('data-theme')).toBe(targetTheme);
      expect(localStorage.getItem('preferred_theme')).toBe(targetTheme);
      expect(localStorage.getItem('edu-theme')).toBe(targetTheme);

      if (['dark', 'blue', 'green', 'purple', 'warm-orange'].includes(targetTheme)) {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(getByTestId('is-dark').textContent).toBe('true');
      } else {
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(getByTestId('is-dark').textContent).toBe('false');
      }
    }
  });

  it('verifies theme toggling switches between dark mode and default mode seamlessly', () => {
    const { getByText, getByTestId } = render(
      <ThemeProvider>
        <ThemeTestConsumer />
      </ThemeProvider>
    );

    // Start by setting to default
    act(() => {
      getByText('Set Default').click();
    });
    expect(getByTestId('current-theme').textContent).toBe('default');
    expect(getByTestId('is-dark').textContent).toBe('false');

    // Toggle: should switch to dark
    act(() => {
      getByText('Toggle Theme').click();
    });
    expect(getByTestId('current-theme').textContent).toBe('dark');
    expect(getByTestId('is-dark').textContent).toBe('true');

    // Toggle again: should switch back to default
    act(() => {
      getByText('Toggle Theme').click();
    });
    expect(getByTestId('current-theme').textContent).toBe('default');
    expect(getByTestId('is-dark').textContent).toBe('false');
  });
});
