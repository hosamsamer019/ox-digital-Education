import { useLanguage, t } from '../../contexts/LanguageContext';
import React from 'react';
import { User as UserIcon } from 'lucide-react';
import { User } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface ChildSelectorProps {
  childrenList: User[];
  selectedChildId: string | null;
  onSelectChild: (childId: string) => void;
  className?: string;
}

export const ChildSelector: React.FC<ChildSelectorProps> = ({
  childrenList,
  selectedChildId,
  onSelectChild,
  className = '',
}) => {
  const { isDark } = useTheme();
  const { isRtl, t } = useLanguage();

  if (childrenList.length === 0) return null;

  return (
    <div className={`mb-6 ${className}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {t('تحديد الطالب للمتابعة:')}
        </span>
        {childrenList.length > 1 && (
          <span className="text-[11px] text-slate-400 sm:hidden">
            {t('(اسحب أفقياً لاختيار الطالب)')}
          </span>
        )}
      </div>

      <div
        role="tablist"
        aria-label={t('قائمة الأبناء')}
        className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x focus:outline-none"
      >
        {childrenList.map((child) => {
          const isSelected = child.id === selectedChildId;
          const initial = child.name ? child.name.trim().charAt(0) : 'ط';

          return (
            <button
              key={child.id}
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectChild(child.id)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all flex-shrink-0 cursor-pointer snap-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] ${
                isSelected
                  ? 'bg-[#9e1b1b] text-white border-[#9e1b1b] shadow-md shadow-[#9e1b1b]/20 font-bold'
                  : isDark
                  ? 'bg-[#0f131d] text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-[#161c28]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-xs'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                  isSelected
                    ? 'bg-white/20 text-white'
                    : isDark
                    ? 'bg-slate-800 text-slate-200'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {initial}
              </div>

              <div className="text-right">
                <p className="text-sm leading-tight font-bold">{child.name}</p>
                <p
                  className={`text-[11px] leading-normal mt-0.5 ${
                    isSelected
                      ? 'text-white/80'
                      : isDark
                      ? 'text-slate-400'
                      : 'text-slate-500'
                  }`}
                >
                  {(child as any).gradeLevel || (child as any).academicLevel || 'طالب مسجل'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChildSelector;
