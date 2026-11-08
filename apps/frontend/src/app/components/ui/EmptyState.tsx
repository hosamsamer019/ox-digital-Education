import * as React from 'react';
import { FileQuestion, LucideIcon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

export interface EmptyStateProps {
  icon?: LucideIcon;
  message?: string;
  subMessage?: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = FileQuestion,
  message,
  subMessage,
  actionText,
  onAction,
  className = '',
}: EmptyStateProps) {
  const { isDark } = useTheme();
  const { isRtl, t } = useLanguage();
  const displayMessage = message || t('noDataAvailable', t('لا توجد بيانات حالياً'));

  return (
    <div
      role="region"
      aria-label={displayMessage}
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center font-sans ${
        isDark ? 'text-slate-400' : 'text-slate-500'
      } ${className}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
          isDark
            ? 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
            : 'bg-slate-100 text-slate-500 border border-slate-200'
        }`}
        aria-hidden="true"
      >
        <Icon className="w-7 h-7 sm:w-8 sm:h-8 opacity-75" />
      </div>

      <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1">
        {displayMessage}
      </p>

      {subMessage && (
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-5 leading-relaxed">
          {subMessage}
        </p>
      )}

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-1 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#9e1b1b] hover:bg-[#b91c1c] text-white shadow-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
