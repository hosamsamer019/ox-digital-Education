import { useLanguage, t } from '../../../contexts/LanguageContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, ArrowLeft, ShieldCheck, CheckCircle2, Clock } from 'lucide-react';

export default function QuickExamTerminal() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [examCode, setExamCode] = useState('');
  const [inputError, setInputError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = examCode.trim().toUpperCase();

    if (!trimmed) {
      // If empty, navigate straight to the public external exam portal
      navigate('/external-exam');
      return;
    }

    // Basic client-side formatting check: at least 3 characters
    if (trimmed.length < 3) {
      setInputError(t('يرجى إدخال كود الامتحان المكون من أرقام أو حروف'));
      return;
    }

    setInputError('');
    // Pass code through existing supported mechanism
    navigate(`/external-exam?code=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div
      id="quick-exam"
      className="w-full max-w-lg mx-auto lg:mx-0 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl dark:shadow-black/40 overflow-hidden text-right transition-colors duration-200"
      dir="rtl"
    >
      {/* Terminal Title Bar */}
      <div className="bg-slate-50 dark:bg-[#141a27] px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t('بوابة الاختبارات المباشرة')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{t('مراقبة إلكترونية نشطة')}</span>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-5 sm:p-7">
        <div className="mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1.5 font-sans">
            {t('دخول الامتحان بكود الاختبار')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {t('للطلاب الخارجيين والمجموعات: ابدأ تقييمك المباشر فوراً باستخدام الكود الصادر من المعلم بدون الحاجة لإنشاء حساب مسبق.')}
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="hero-exam-code-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2"
            >
              {t('كود الدخول المخصص للاختبار')}
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-amber-500">
                <Key className="w-4 h-4" />
              </span>
              <input
                id="hero-exam-code-input"
                type="text"
                value={examCode}
                onChange={(e) => {
                  setExamCode(e.target.value.toUpperCase());
                  if (inputError) setInputError('');
                }}
                placeholder={t('مثال: 7TF4-WJ6J-ZGS6')}
                className="w-full pr-10 pl-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm sm:text-base font-mono font-bold tracking-wider text-center uppercase focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                dir="ltr"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            {inputError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{inputError}</p>
            )}
          </div>

          {/* Submission Action */}
          <button
            type="submit"
            className="w-full py-3.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-950/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span>{t('دخول الامتحان الآن')}</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </form>

        {/* Genuine Platform Capabilities */}
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{t('تصحيح آلي فوري')}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>{t('توقيت زمني محدد')}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span>{t('نظام رصد ومكافحة الغش')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
