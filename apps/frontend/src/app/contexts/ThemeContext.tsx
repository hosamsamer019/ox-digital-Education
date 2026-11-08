import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export type Theme = 'default' | 'light' | 'dark' | 'blue' | 'green' | 'purple' | 'warm-orange';

export const DARK_THEMES: Theme[] = ['dark', 'blue', 'green', 'purple', 'warm-orange'];
export const LIGHT_THEMES: Theme[] = ['default', 'light'];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function resolveThemeAlias(raw: string | null | undefined): Theme | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'navy') return 'blue';
  if (normalized === 'sepia') return 'warm-orange';
  if (normalized === 'high-contrast') return 'dark';
  if (['default', 'light', 'dark', 'blue', 'green', 'purple', 'warm-orange'].includes(normalized)) {
    return normalized as Theme;
  }
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = resolveThemeAlias(
        localStorage.getItem('preferred_theme') || localStorage.getItem('edu-theme')
      );
      if (saved) return saved;

      const eduUser = localStorage.getItem('edu-user');
      if (eduUser) {
        const parsed = JSON.parse(eduUser);
        const userTheme = resolveThemeAlias(parsed?.theme);
        if (userTheme) return userTheme;
      }

      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // Fallback in case of restricted environment
    }
    return 'dark'; // Canonical platform default for unauthenticated guest splash & initial state
  });

  const applyThemeToDOM = useCallback((targetTheme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', targetTheme);

    if (DARK_THEMES.includes(targetTheme)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    try {
      localStorage.setItem('edu-theme', targetTheme);
      localStorage.setItem('preferred_theme', targetTheme);
      const userRaw = localStorage.getItem('edu-user');
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        if (parsed.theme !== targetTheme) {
          parsed.theme = targetTheme;
          localStorage.setItem('edu-user', JSON.stringify(parsed));
        }
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    const resolved = resolveThemeAlias(newTheme) || 'default';
    setThemeState(resolved);
    applyThemeToDOM(resolved);
  }, [applyThemeToDOM]);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme, applyThemeToDOM]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'preferred_theme' || e.key === 'edu-theme') {
        const resolved = resolveThemeAlias(e.newValue);
        if (resolved && resolved !== theme) {
          setThemeState(resolved);
          applyThemeToDOM(resolved);
        }
      }
    };
    const handleSync = (e: any) => {
      const syncTheme = resolveThemeAlias(e.detail?.theme);
      if (syncTheme && syncTheme !== theme) {
        setThemeState(syncTheme);
        applyThemeToDOM(syncTheme);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('app:preference-sync', handleSync);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('app:preference-sync', handleSync);
    };
  }, [theme, applyThemeToDOM]);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const nextTheme: Theme = DARK_THEMES.includes(current) ? 'default' : 'dark';
      applyThemeToDOM(nextTheme);
      return nextTheme;
    });
  }, [applyThemeToDOM]);

  const isDark = DARK_THEMES.includes(theme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
