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
                duration: l.duration || 'غير محدد',
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
        setError(t('تعذر تحميل تفاصيل المقرر الدراسي.'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [courseId]);

  if (loading) {
    return <LoadingState message={t('جاري إعداد محتوى ومحاضرات المقرر...')} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8" dir="rtl">
      {/* Back button and Course Header */}
      <div>
        <button
          onClick={() => navigate('/student/center/courses')}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#9e1b1b] dark:text-red-400 hover:underline mb-4"
        >
          <ChevronRight className="w-4 h-4" />
          <span>{t('العودة لقائمة الدورات والمناهج')}</span>
        </button>

        <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} tracking-tight`}>
          {course.title}
        </h1>
        {course.description && (
          <p className={`text-sm ${textSecondary} mt-2 max-w-3xl leading-relaxed`}>
            {course.description}
          </p>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* 3 Metric Cards for Course Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className={`${cardBg} rounded-2xl p-5 sm:p-6 border`}>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#9e1b1b] dark:text-red-400 mb-1 font-mono">
            {loading ? '-' : stats.totalLessons}
          </div>
          <div className={`text-xs font-bold ${textSecondary}`}>{t('إجمالي الدروس')}</div>
        </div>

        <div className={`${cardBg} rounded-2xl p-5 sm:p-6 border`}>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mb-1 font-mono">
            {loading ? '-' : stats.completedLessons}
          </div>
          <div className={`text-xs font-bold ${textSecondary}`}>{t('الدروس المكتملة')}</div>
        </div>

        <div className={`${cardBg} rounded-2xl p-5 sm:p-6 border`}>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 mb-1 font-mono">
            {loading ? '-' : `${stats.completionPercentage}%`}
          </div>
          <div className={`text-xs font-bold ${textSecondary}`}>{t('نسبة الإنجاز')}</div>
        </div>
      </div>

      {/* Lessons List Section */}
      <div className={`${cardBg} rounded-2xl border p-6`}>
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className={`text-lg font-bold ${textPrimary}`}>{t('فهرس المحاضرات والدروس')}</h2>
          <span className="text-xs font-mono font-bold text-slate-400">
            {lessons.length} {t('درس متوفر')}
          </span>
        </div>

        {lessons.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <BookOpen className="w-10 h-10 mx-auto text-slate-500" />
            <p className="text-sm font-bold">{t('لا توجد دروس مضافة لهذا المقرر بعد.')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => !lesson.locked && navigate(`/student/center/videos/${lesson.id}`)}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  lesson.locked
                    ? 'border-slate-200 dark:border-slate-800/80 bg-slate-500/5 cursor-not-allowed opacity-75'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-[#9e1b1b]/50 cursor-pointer hover:shadow-xs'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    lesson.completed
                      ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                      : lesson.locked
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                      : 'bg-[#9e1b1b]/10 text-[#9e1b1b] dark:bg-[#9e1b1b]/20 dark:text-red-400'
                  }`}
                >
                  {lesson.completed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : lesson.locked ? (
                    <Lock className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 fill-current translate-x-[-1px]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-sm ${textPrimary} truncate`}>{lesson.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{lesson.duration}</span>
                    {lesson.completed && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">{t('• مكتمل')}</span>
                    )}
                    {lesson.locked && (
                      <span className="text-slate-400 font-bold">{t('• مغلق')}</span>
                    )}
                  </div>
                </div>

                <div>
                  {lesson.locked ? (
                    <span className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                      {t('مغلق')}
                    </span>
                  ) : (
                    <button className="px-4 py-2 rounded-xl text-xs font-bold bg-[#9e1b1b] text-white hover:bg-[#b01e1e] transition-colors">
                      {t('مشاهدة المحاضرة')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
