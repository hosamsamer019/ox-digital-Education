import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { translations, TranslationKey } from '../utils/translations';
import { UI_TRANSLATIONS_EN } from '../utils/translationsDictionary';

export type Language = 'ar' | 'en' | 'ARABIC' | 'ENGLISH';

interface LanguageContextType {
  language: 'ar' | 'en';
  setLanguage: (lang: Language) => void;
  isRtl: boolean;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function normalizeLanguage(raw: string | null | undefined): 'ar' | 'en' {
  if (!raw) return 'ar';
  const lower = raw.trim().toLowerCase();
  if (lower === 'en' || lower === 'english') return 'en';
  return 'ar';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<'ar' | 'en'>(() => {
    try {
      const saved = localStorage.getItem('preferred_language') || localStorage.getItem('edu-lang');
      if (saved) return normalizeLanguage(saved);

      const eduUser = localStorage.getItem('edu-user');
      if (eduUser) {
        const parsed = JSON.parse(eduUser);
        if (parsed?.language) return normalizeLanguage(parsed.language);
      }
    } catch {
      // Fallback on restricted storage
    }
    return 'ar';
  });

  const applyLanguageToDOM = useCallback((targetLang: 'ar' | 'en') => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const isRtl = targetLang === 'ar';

    root.setAttribute('lang', targetLang);
    root.setAttribute('dir', isRtl ? 'rtl' : 'ltr');

    try {
      localStorage.setItem('preferred_language', targetLang);
      localStorage.setItem('edu-lang', targetLang === 'ar' ? 'ARABIC' : 'ENGLISH');

      const userRaw = localStorage.getItem('edu-user');
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        if (parsed.language !== targetLang) {
          parsed.language = targetLang;
          localStorage.setItem('edu-user', JSON.stringify(parsed));
        }
      }
    } catch {
      // Storage restricted
    }
  }, []);

  useEffect(() => {
    applyLanguageToDOM(language);
  }, [language, applyLanguageToDOM]);

  useEffect(() => {
    const handleSync = (e: any) => {
      const syncLang = e.detail?.language;
      if (syncLang) {
        const normalized = normalizeLanguage(syncLang);
        setLanguageState(normalized);
        applyLanguageToDOM(normalized);
      }
    };
    window.addEventListener('app:preference-sync', handleSync);
    return () => window.removeEventListener('app:preference-sync', handleSync);
  }, [applyLanguageToDOM]);

  const setLanguage = useCallback((newLang: Language) => {
    const normalized = normalizeLanguage(newLang);
    setLanguageState(normalized);
    applyLanguageToDOM(normalized);
  }, [applyLanguageToDOM]);

  const t = useCallback((key: string, fallback?: string): string => {
    const dict = (translations as any)[language] || (translations as any).ar;
    if (dict && dict[key]) {
      return dict[key];
    }
    if (language === 'en') {
      if (UI_TRANSLATIONS_EN && (UI_TRANSLATIONS_EN as any)[key]) {
        return (UI_TRANSLATIONS_EN as any)[key];
      }
      if (fallback !== undefined) {
        return fallback;
      }
    }
    // Fallback to Arabic dictionary if key exists there
    const arabicDict = (translations as any).ar;
    if (arabicDict && arabicDict[key]) {
      return fallback || arabicDict[key];
    }
    return fallback !== undefined ? fallback : key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRtl: language === 'ar', t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    const fallbackT = (key: string, fallback?: string): string => {
      const arabicDict = (translations as any).ar || {};
      return fallback !== undefined ? fallback : (arabicDict[key] || key);
    };
    return {
      language: 'ar' as Language,
      setLanguage: () => {},
      isRtl: true,
      t: fallbackT
    };
  }
  return ctx;
}

export function t(key: string, fallback?: string): string {
  let lang = 'ar';
  try {
    const saved = localStorage.getItem('preferred_language') || localStorage.getItem('edu-lang');
    if (saved) {
      const lower = saved.trim().toLowerCase();
      if (lower === 'en' || lower === 'english') lang = 'en';
    }
  } catch {}

  const dict = (translations as any)[lang] || (translations as any).ar;
  if (dict && dict[key]) {
    return dict[key];
  }
  if (lang === 'en') {
    if (UI_TRANSLATIONS_EN && (UI_TRANSLATIONS_EN as any)[key]) {
      return (UI_TRANSLATIONS_EN as any)[key];
    }
    if (fallback !== undefined) return fallback;
  }
  const arabicDict = (translations as any).ar;
  if (arabicDict && arabicDict[key]) {
    return fallback || arabicDict[key];
  }
  return fallback !== undefined ? fallback : key;
}
