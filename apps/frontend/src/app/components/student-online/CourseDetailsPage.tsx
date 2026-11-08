import { useLanguage, t } from '../../contexts/LanguageContext';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Play, Lock, CheckCircle2, Clock, ChevronRight, BookOpen, AlertCircle } from 'lucide-react';
import { courseService } from '../../services/course.service';
import { useTheme } from '../../contexts/ThemeContext';
import { LoadingState } from '../ui/LoadingState';

export default function CourseDetailsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { courseId } = useParams();
  const { isDark } = useTheme();

  const [course, setCourse] = useState<any>({ title: 'جاري التحميل...', description: '' });
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalLessons: 0,
    completedLessons: 0,
    completionPercentage: 0
  });

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-xs';
  const wellBg = isDark ? 'bg-[#161c28]/70 border-slate-800/60' : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setError(null);

    courseService.getCourseDetails(courseId)
      .then((res) => {
        const data = res.data?.data ? res.data.data : res.data;
        if (data) {
          setCourse(data);
          const rawLessons = Array.isArray(data.lessons) ? data.lessons : [];
          if (rawLessons.length > 0) {
            const mappedLessons = rawLessons.map((l: any) => {
              const prog = Array.isArray(l.progress) ? l.progress[0] : (l.progress || null);
              const isCompleted = !!(
                l.completed ||
                prog?.watched ||
                prog?.status === 'COMPLETED' ||
                (prog?.progress && prog.progress >= 90)
              );
              return {
                id: l.id,
                title: l.title,
                duration: l.duration ? `${l.duration} دقيقة` : 'غير محدد',
                completed: isCompleted,
                locked: false
              };
            });
            setLessons(mappedLessons);

            const total = typeof data.totalLessons === 'number' ? data.totalLessons : mappedLessons.length;
            const completed = typeof data.completedLessons === 'number'
              ? data.completedLessons
              : mappedLessons.filter((l: any) => l.completed).length;
            const pct = typeof data.completionPercentage === 'number'
              ? data.completionPercentage
              : (total > 0 ? Math.min(100, Math.max(0, Math.round((completed / total) * 100))) : 0);

            setStats({
              totalLessons: total,
              completedLessons: completed,
              completionPercentage: isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct))
            });
          } else {
            setLessons([]);
            setStats({ totalLessons: 0, completedLessons: 0, completionPercentage: 0 });
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load course details:', err);
        setError(t('تعذر تحميل تفاصيل المقرر الدراسي. تأكد من اتصال الخادم.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [courseId]);

  if (loading) {
    return <LoadingState message={t('جاري تحميل تفاصيل المقرر والدروس...')} />;
  }

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo'] font-sans`}
      dir="rtl"
    >
      {/* Back button & Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/student/online/courses')}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#9e1b1b] hover:underline mb-3 cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
          <span>{t('العودة لقائمة المقررات')}</span>
        </button>

        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
            {course.category || 'مقرر دراسي'}
          </span>
          <span className="text-xs text-slate-400">{t('تفاصيل المحاضرات والتقدم')}</span>
        </div>

        <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} mb-2`}>
          {course.title}
        </h1>
        <p className={`text-xs sm:text-sm ${textSecondary} max-w-3xl`}>
          {course.description || 'شروحات وافية ومحاضرات مصورة مع بنك أسئلة واختبارات قياس مستوى.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="font-semibold">{error}</p>
        </div>
      )}

      {/* Course Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-[#9e1b1b]`}>
          <div className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} mb-1 font-sans`}>
            {stats.totalLessons}
          </div>
          <div className={`text-xs sm:text-sm ${textSecondary}`}>{t('إجمالي الدروس في المقرر')}</div>
        </div>
        <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-emerald-600`}>
          <div className={`text-2xl sm:text-3xl font-extrabold text-emerald-500 mb-1 font-sans`}>
            {stats.completedLessons}
          </div>
          <div className={`text-xs sm:text-sm ${textSecondary}`}>{t('الدروس المكتملة')}</div>
        </div>
        <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-blue-600`}>
          <div className={`text-2xl sm:text-3xl font-extrabold text-blue-500 mb-1 font-sans`}>
            {stats.completionPercentage}%
          </div>
          <div className={`text-xs sm:text-sm ${textSecondary}`}>{t('نسبة إنجاز المقرر')}</div>
        </div>
      </div>

      {/* Lessons List */}
      <div className={`${cardBg} border rounded-2xl p-6 sm:p-7`}>
        <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800/80">
          <BookOpen className="w-5 h-5 text-[#9e1b1b]" />
          <h2 className={`text-lg sm:text-xl font-bold ${textPrimary}`}>{t('فهرس الدروس والمحاضرات')}</h2>
        </div>

        {lessons.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
            <BookOpen className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-60" />
            <p className="font-semibold text-slate-300">{t('لا توجد دروس مضافة لهذا المقرر بعد')}</p>
            <p className="text-xs mt-0.5">{t('سيقوم المعلم برفع الشروحات والمحاضرات قريباً.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson, idx) => (
              <div
                key={lesson.id}
                onClick={() => !lesson.locked && navigate(`/student/online/videos/${lesson.id}`)}
                className={`${wellBg} p-4 rounded-xl border flex items-center justify-between gap-4 cursor-pointer hover:border-slate-700 transition-all group`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      lesson.completed
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : lesson.locked
                        ? 'bg-slate-800 text-slate-500'
                        : 'bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20 group-hover:bg-[#9e1b1b] group-hover:text-white transition-colors'
                    }`}
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : lesson.locked ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-current translate-x-[-1px]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        {t('الدرس')} {idx + 1}
                      </span>
                      <h3 className={`text-sm sm:text-base font-bold ${textPrimary} truncate group-hover:text-[#9e1b1b] transition-colors`}>
                        {lesson.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{lesson.duration}</span>
                      </span>
                      {lesson.completed && (
                        <span className="text-emerald-500 font-semibold">{t('• مكتمل')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/student/online/videos/${lesson.id}`);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    lesson.completed
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      : 'bg-[#9e1b1b] hover:bg-[#851717] text-white shadow-xs'
                  }`}
                >
                  <span>{lesson.completed ? 'إعادة المشاهدة' : 'مشاهدة الآن'}</span>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
