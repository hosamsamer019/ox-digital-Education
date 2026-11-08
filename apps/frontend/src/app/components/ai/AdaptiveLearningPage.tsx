import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { Target, Brain, BookOpen, AlertCircle, Sparkles, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { analyticsService } from '../../services/analytics.service';
import { courseService } from '../../services/course.service';
import { useTheme } from '../../contexts/ThemeContext';
import { LoadingState } from '../ui/LoadingState';

export default function AdaptiveLearningPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [subjectProgress, setSubjectProgress] = useState<{ subject: string; progress: number }[]>([]);
  const [courseStats, setCourseStats] = useState({
    enrolledCoursesCount: 0,
    totalLessons: 0,
    completedLessons: 0,
    completionPercentage: 0
  });

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-xs';
  const wellBg = isDark ? 'bg-[#161c28]/70 border-slate-800/60' : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        setLoading(true);
        const [chartsRes, statsRes] = await Promise.all([
          analyticsService.getStudentCharts().catch(() => ({ data: null })),
          courseService.getStudentCourseStats().catch(() => ({ data: null }))
        ]);

        if (chartsRes?.data?.subjectProgress && Array.isArray(chartsRes.data.subjectProgress)) {
          setSubjectProgress(
            chartsRes.data.subjectProgress.filter((s: any) => s.subject && s.subject !== 'لا توجد بيانات')
          );
        }

        if (statsRes?.data) {
          setCourseStats({
            enrolledCoursesCount: statsRes.data.enrolledCoursesCount ?? 0,
            totalLessons: statsRes.data.totalLessons ?? 0,
            completedLessons: statsRes.data.completedLessons ?? 0,
            completionPercentage: statsRes.data.completionPercentage ?? 0
          });
        }
      } catch (err) {
        console.error('Failed to load real learning path data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRealData();
  }, []);

  if (loading) {
    return <LoadingState message={t('جاري تحليل مؤشرات الإتقان الأكاديمي...')} />;
  }

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo'] font-sans`}
      dir="rtl"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
            {t('مسار التعلم والإتقان')}
          </span>
          <span className="text-xs text-slate-400">{t('تحليل الأداء الأكاديمي المباشر')}</span>
        </div>
        <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} mb-2`}>
          {t('مسار التعلم الأكاديمي')}
        </h1>
        <p className={`text-xs sm:text-sm ${textSecondary} max-w-3xl`}>
          {t('متابعة مباشرة لمعدلات إتقان المناهج الدراسية بناءً على درجاتك الحقيقية في التقييمات والاختبارات الدورية.')}
        </p>
      </div>

      {/* Honest Institutional Notice Banner */}
      <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3.5 text-xs sm:text-sm text-amber-500">
        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
        <div className="flex-1 leading-relaxed">
          <p className="font-bold text-amber-400">{t('إشعار الشفافية الأكاديمية:')}</p>
          <p className="text-slate-300 dark:text-slate-300 text-xs mt-1">
            {t('خوارزميات التوصية التكيفية التلقائية بالذكاء الاصطناعي قيد التدريب والتطوير لتتوافق مع معايير المناهج المصرية الرسمية. تعرض البيانات الحالية مستويات إتقانك الفعلية المستخرجة مباشرة من نتائج امتحاناتك وواجباتك المسجلة على المنصة دون أي درجات افتراضية.')}
          </p>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-[#9e1b1b]`}>
          <div className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} mb-1 font-sans`}>
            {courseStats.enrolledCoursesCount}
          </div>
          <div className={`text-xs sm:text-sm ${textSecondary}`}>{t('مقررات يتم تتبع مسارها')}</div>
        </div>

        <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-emerald-600`}>
          <div className={`text-2xl sm:text-3xl font-extrabold text-emerald-500 mb-1 font-sans`}>
            {courseStats.completedLessons} / {courseStats.totalLessons}
          </div>
          <div className={`text-xs sm:text-sm ${textSecondary}`}>{t('الدروس المنجزة في المناهج')}</div>
        </div>

        <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-blue-600`}>
          <div className={`text-2xl sm:text-3xl font-extrabold text-blue-500 mb-1 font-sans`}>
            {courseStats.completionPercentage}%
          </div>
          <div className={`text-xs sm:text-sm ${textSecondary}`}>{t('نسبة الإنجاز الكلي للمقررات')}</div>
        </div>
      </div>

      {/* Real Subject Mastery Section */}
      <div className={`${cardBg} border rounded-2xl p-6 sm:p-7 mb-8`}>
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800/80">
          <Target className="w-5 h-5 text-[#9e1b1b]" />
          <h2 className={`text-base sm:text-lg font-bold ${textPrimary}`}>
            {t('مؤشرات الإتقان الأكاديمي الحقيقية')}
          </h2>
        </div>

        {subjectProgress.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
            <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-slate-300">{t('لا توجد بيانات تقييم كافية لحساب نسب الإتقان')}</p>
            <p className="text-xs mt-0.5 mb-4">
              {t('أكمل امتحاناتك وواجباتك الدورية في المقررات ليتم احتساب نسبة استيعابك لكل مادة دراسية.')}
            </p>
            <button
              onClick={() => navigate('/student/online/courses')}
              className="px-5 py-2 bg-[#9e1b1b] hover:bg-[#851717] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {t('استعراض المقررات')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {subjectProgress.map((item, idx) => {
              const pct = Math.min(100, Math.max(0, item.progress));
              const statusColor =
                pct >= 85
                  ? 'text-emerald-500'
                  : pct >= 65
                  ? 'text-blue-500'
                  : 'text-amber-500';

              return (
                <div key={idx} className={`${wellBg} p-4 sm:p-5 rounded-xl border`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${statusColor}`} />
                      <h3 className={`font-bold text-sm sm:text-base ${textPrimary}`}>{item.subject}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={textSecondary}>{t('نسبة الاستيعاب المعتمدة:')}</span>
                      <span className={`font-bold ${statusColor} text-sm font-sans`}>{pct}%</span>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        pct >= 85 ? 'bg-emerald-500' : pct >= 65 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-400 mt-1">
                    {pct >= 85
                      ? 'مستوى ممتاز في المادة — استمر في تثبيت المفاهيم وحل المسائل المتقدمة.'
                      : pct >= 65
                      ? 'مستوى جيد جداً — ركز على مراجعة التمارين التي ارتكبت فيها أخطاء بالتقييمات الأخيرة.'
                      : 'المادة بحاجة لتركيز إضافي — ينصح بإعادة مشاهدة الدروس واستخدام المساعد الذكي لتوضيح النقاط غير المفهومة.'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Suggested Academic Next Steps */}
      <div className={`${cardBg} border rounded-2xl p-6 sm:p-7`}>
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/80">
          <Brain className="w-5 h-5 text-[#9e1b1b]" />
          <h2 className={`text-base sm:text-lg font-bold ${textPrimary}`}>
            {t('توجيهات لتعزيز مسارك الدراسي')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => navigate('/student/online/solver')}
            className={`${wellBg} p-4 rounded-xl border cursor-pointer hover:border-slate-700 transition-colors group flex items-start gap-3`}
          >
            <div className="w-9 h-9 rounded-lg bg-[#9e1b1b]/10 text-[#9e1b1b] flex items-center justify-center flex-shrink-0 group-hover:bg-[#9e1b1b] group-hover:text-white transition-colors">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h4 className={`text-sm font-bold ${textPrimary} group-hover:text-[#9e1b1b] transition-colors mb-1`}>
                {t('حل وتفكيك المسائل بالذكاء الاصطناعي')}
              </h4>
              <p className={`text-xs ${textSecondary}`}>
                {t('استخدم أداة حل المسائل الرياضية خطوة بخطوة باللغة العربية لشرح المعادلات والرموز المعقدة.')}
              </p>
            </div>
          </div>

          <div
            onClick={() => navigate('/student/online/chatbot')}
            className={`${wellBg} p-4 rounded-xl border cursor-pointer hover:border-slate-700 transition-colors group flex items-start gap-3`}
          >
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className={`text-sm font-bold ${textPrimary} group-hover:text-blue-500 transition-colors mb-1`}>
                {t('المحادثة مع المساعد التعليمي الذكي')}
              </h4>
              <p className={`text-xs ${textSecondary}`}>
                {t('اطرح استفساراتك الأكاديمية مباشرة على المعلم الذكي للحصول على إجابات وتوضيحات فورية.')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
