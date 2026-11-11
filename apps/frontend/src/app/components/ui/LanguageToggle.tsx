import { Languages } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface LanguageToggleProps {
  id?: string;
  className?: string;
}

export default function LanguageToggle({ id = 'language-toggle', className = '' }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();

  const handleToggle = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const ariaText = language === 'ar' ? 'التبديل إلى اللغة الإنجليزية (Switch to English)' : 'Switch to Arabic (التبديل إلى اللغة العربية)';

  return (
    <button
      id={id}
      type="button"
      onClick={handleToggle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/90 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] cursor-pointer shrink-0 ${className}`}
      aria-label={ariaText}
      title={ariaText}
    >
      <Languages className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
      <span className="font-mono text-xs font-bold uppercase tracking-wider">{language === 'ar' ? 'EN' : 'عربي'}</span>
    </button>
  );
}

