import { Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

export interface LoadingStateProps {
  message?: string;
  subMessage?: string;
  size?: 'sm' | 'md' | 'lg';
  minHeight?: string;
  className?: string;
}

export function LoadingState({
  message,
  subMessage,
  size = 'md',
  minHeight,
  className = '',
}: LoadingStateProps) {
  const { isDark } = useTheme();
  const { isRtl, t } = useLanguage();
  const displayMessage = message || t('loading', t('جاري التحميل...'));

  const sizeClasses = {
    sm: {
      spinner: 'w-5 h-5',
      text: 'text-sm font-medium',
      sub: 'text-xs',
      gap: 'gap-2',
      defaultMinH: 'min-h-[120px]',
    },
    md: {
      spinner: 'w-8 h-8',
      text: 'text-base font-semibold',
      sub: 'text-xs sm:text-sm',
      gap: 'gap-3',
      defaultMinH: 'min-h-[220px]',
    },
    lg: {
      spinner: 'w-10 h-10',
      text: 'text-lg font-bold',
      sub: 'text-sm',
      gap: 'gap-3.5',
      defaultMinH: 'min-h-[50vh]',
    },
  }[size];

  const resolvedMinHeight = minHeight || sizeClasses.defaultMinH;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center p-6 text-center select-none font-sans ${resolvedMinHeight} ${
        isDark ? 'text-slate-200' : 'text-slate-700'
      } ${className}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="relative flex items-center justify-center mb-3">
        {/* Subtle institutional ambient glow */}
        <div className="absolute w-12 h-12 rounded-full bg-[#9e1b1b]/15 blur-lg pointer-events-none" />
        <Loader2
          className={`${sizeClasses.spinner} animate-spin motion-reduce:animate-none text-[#9e1b1b] relative z-10`}
          aria-hidden="true"
        />
      </div>

      <p className={`${sizeClasses.text} text-slate-900 dark:text-white leading-tight`}>
        {displayMessage}
      </p>

      {subMessage && (
        <p className={`mt-1.5 ${sizeClasses.sub} text-slate-500 dark:text-slate-400 max-w-sm leading-normal`}>
          {subMessage}
        </p>
      )}

    </div>
  );
}
