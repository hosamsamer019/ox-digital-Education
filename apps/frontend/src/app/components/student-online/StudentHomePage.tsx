import { useLanguage, t } from '../../contexts/LanguageContext';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, BookOpen, ClipboardCheck, TrendingUp, Clock,
  RefreshCw, CheckCircle2, AlertCircle, Calendar, ArrowLeft,
  FileText, Award, ChevronLeft, Sparkles
} from 'lucide-react';
import { courseService } from '../../services/course.service';
import { analyticsService } from '../../services/analytics.service';
import { homeworkService } from '../../services/homework.service';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState } from '../ui/LoadingState';
import { DashboardHomeSkeleton } from '../ui/skeleton';

interface ContinueLesson {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseName: string;
  progress: number;
  duration?: number;
}

export default function StudentHomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verified Metrics
  const [courseStats, setCourseStats] = useState({
    enrolledCoursesCount: 0,
    totalLessons: 0,
    completedLessons: 0,
    completionPercentage: 0
  });
  const [completedAssignments, setCompletedAssignments] = useState(0);

  // Content state
  const [continueLesson, setContinueLesson] = useState<ContinueLesson | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [pendingHomeworks, setPendingHomeworks] = useState<any[]>([]);

  const cardBg = 'bg-card border-border shadow-xs text-card-foreground';
  const wellBg = 'bg-muted/60 border-border text-foreground';
  const textPrimary = 'text-foreground';
  const textSecondary = 'text-muted-foreground';

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [statsRes, overviewRes, coursesRes, recentRes, homeworksRes] = await Promise.all([
        courseService.getStudentCourseStats().catch(() => null),
        analyticsService.getStudentOverview().catch(() => null),
        courseService.getCourses().catch(() => null),
        analyticsService.getStudentRecent().catch(() => null),
        homeworkService.getHomeworks().catch(() => null)
      ]);

      if (!statsRes && !overviewRes && !coursesRes) {
        throw new Error('All primary endpoints failed');
      }

      // 1. Course KPIs
      if (statsRes?.data) {
        setCourseStats({
          enrolledCoursesCount: statsRes.data.enrolledCoursesCount ?? 0,
          totalLessons: statsRes.data.totalLessons ?? 0,
          completedLessons: statsRes.data.completedLessons ?? 0,
          completionPercentage: statsRes.data.completionPercentage ?? 0
        });
      }

      // 2. Overview / Completed Assignments
      if (overviewRes?.data) {
        setCompletedAssignments(overviewRes.data.completedAssignments ?? 0);
      }

      // 3. Courses & Continue Watching Resolution
      const coursesData = coursesRes?.data?.data ? coursesRes.data.data : Array.isArray(coursesRes?.data) ? coursesRes.data : [];
      setEnrolledCourses(coursesData);

      let foundActiveLesson: ContinueLesson | null = null;
      let firstUncompletedLesson: ContinueLesson | null = null;

      for (const course of coursesData) {
        if (Array.isArray(course.lessons)) {
          for (const lesson of course.lessons) {
            const prog = Array.isArray(lesson.progress) ? lesson.progress[0] : (lesson.progress || null);
            const pct = prog?.progress ?? 0;
            const isCompleted = prog?.watched || prog?.status === 'COMPLETED' || pct >= 90;

            if (!isCompleted && pct > 0 && !foundActiveLesson) {
              foundActiveLesson = {
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                courseId: course.id,
                courseName: course.title,
                progress: Math.min(99, Math.max(1, pct)),
                duration: lesson.duration
              };
              break;
            }

            if (!isCompleted && !firstUncompletedLesson) {
              firstUncompletedLesson = {
                lessonId: lesson.id,
                lessonTitle: lesson.title,
                courseId: course.id,
                courseName: course.title,
                progress: pct,
                duration: lesson.duration
              };
            }
          }
        }
        if (foundActiveLesson) break;
      }

      setContinueLesson(foundActiveLesson || firstUncompletedLesson);

      // 4. Recent Verified Results
      const recent = Array.isArray(recentRes?.data) ? recentRes.data : [];
      setRecentResults(recent.slice(0, 4));

      // 5. Pending Homeworks
      const hwData = homeworksRes?.data?.data ? homeworksRes.data.data : Array.isArray(homeworksRes?.data) ? homeworksRes.data : [];
      if (Array.isArray(hwData)) {
        const pending = hwData.filter((h: any) => h.status === 'draft' || h.status === 'pending');
        setPendingHomeworks(pending.slice(0, 4));
      }
    } catch (err: any) {
      console.error('Failed to load student dashboard:', err);
      setError(t('تعذر تحميل بيانات لوحة الطالب التعليمية. يرجى إعادة المحاولة.'));
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <DashboardHomeSkeleton message={t('جاري إعداد بيئة التعلم الرقمية للطالب...')} portalTitle={t('لوحة الطالب')} />;
  }

  const currentDateStr = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  const statCards = [
    {
      label: 'المقررات الدراسية',
      value: courseStats.enrolledCoursesCount,
      subtext: 'مقررات مسجلة بنجاح',
      icon: BookOpen,
      accent: 'border-r-4 border-r-[#9e1b1b]'
    },
    {
      label: 'الدروس المنجزة',
      value: `${courseStats.completedLessons} / ${courseStats.totalLessons}`,
      subtext: 'دروس تم إتمامها',
      icon: CheckCircle2,
      accent: 'border-r-4 border-r-emerald-600'
    },
    {
      label: 'نسبة الإنجاز العام',
      value: `${courseStats.completionPercentage}%`,
      subtext: 'معدل التقدم الأكاديمي',
      icon: TrendingUp,
      accent: 'border-r-4 border-r-blue-600'
    },
    {
      label: 'المهام والتقييمات',
      value: completedAssignments,
      subtext: 'واجبات وامتحانات منجزة',
      icon: ClipboardCheck,
      accent: 'border-r-4 border-r-amber-600'
    },
  ];

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo'] font-sans`}
      dir="rtl"
    >
      {/* Executive Student Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              {t('بوابة الطالب')}
            </span>
            <span className="text-xs text-slate-400">{t('منظومة التعلم الذكي المتكاملة')}</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
            {t('أهلاً،')} {user?.name || 'الطالب'}
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            {currentDateStr} {t('• تابع مسارك التعليمي واستكمل دروسك واختباراتك بدقة')}
          </p>
        </div>

        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer self-start sm:self-auto ${
            isDark
              ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
          <span>{t('تحديث البيانات')}</span>
        </button>
      </div>

      {/* Retryable Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => fetchData(true)}
              className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
            >
              {t('إعادة المحاولة')}
            </button>
          </div>
        </div>
      )}

      {/* Action Hero: Continue Learning */}
      {continueLesson ? (
        <div
          onClick={() => navigate(`/student/online/videos/${continueLesson.lessonId}`)}
          className={`${cardBg} border rounded-2xl p-6 sm:p-7 mb-8 cursor-pointer hover:border-slate-700 transition-all border-r-4 border-r-[#9e1b1b] relative overflow-hidden group`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#9e1b1b] text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <Play className="w-7 h-7 fill-white translate-x-[-1px]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-[#9e1b1b]" />
                    {continueLesson.progress > 0 ? 'متابعة الدرس قيد المشاهدة' : 'الدرس التالي في مسارك'}
                  </span>
                  {continueLesson.duration ? (
                    <span className="text-xs text-slate-400">({continueLesson.duration} {t('دقيقة)')}</span>
                  ) : null}
                </div>
                <h2 className={`text-lg sm:text-xl font-bold ${textPrimary} group-hover:text-[#9e1b1b] transition-colors`}>
                  {continueLesson.lessonTitle}
                </h2>
                <p className={`text-xs sm:text-sm ${textSecondary} mt-0.5`}>
                  {t('المقرر:')} {continueLesson.courseName}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="min-w-[180px]">
                <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                  <span className={textSecondary}>{t('نسبة التقدم')}</span>
                  <span className={textPrimary}>{continueLesson.progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className="h-full bg-[#9e1b1b] rounded-full transition-all duration-500"
                    style={{ width: `${continueLesson.progress}%` }}
                  />
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/student/online/videos/${continueLesson.lessonId}`);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#9e1b1b] hover:bg-[#851717] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <span>{t('متابعة الدرس')}</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : !error && enrolledCourses.length === 0 ? (
        <div className={`${cardBg} border rounded-2xl p-6 sm:p-8 mb-8 text-center border-r-4 border-r-[#9e1b1b]`}>
          <BookOpen className="w-12 h-12 text-[#9e1b1b] mx-auto mb-3" />
          <h3 className={`text-lg font-bold ${textPrimary} mb-1`}>{t('أنت غير مسجل في أي مقرر دراسي حالياً')}</h3>
          <p className={`text-xs sm:text-sm ${textSecondary} max-w-md mx-auto mb-5`}>
            {t('تصفح المقررات الدراسية المتاحة لمرحلتك التعليمية وابدأ في دراسة الدروس والمحاضرات التفاعلية.')}
          </p>
          <button
            onClick={() => navigate('/student/online/courses')}
            className="px-6 py-2.5 bg-[#9e1b1b] hover:bg-[#851717] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {t('استعراض الدورات المتاحة')}
          </button>
        </div>
      ) : null}

      {/* Verified KPI Grid (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className={`${cardBg} border rounded-2xl p-5 ${stat.accent} transition-all hover:border-slate-700`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs sm:text-sm font-medium ${textSecondary}`}>{stat.label}</span>
              <div className="w-9 h-9 rounded-xl bg-slate-800/60 flex items-center justify-center text-slate-300">
                <stat.icon className="w-4 h-4 text-slate-200" />
              </div>
            </div>
            <div className={`text-xl sm:text-2xl font-extrabold ${textPrimary} tracking-tight font-sans`}>
              {stat.value}
            </div>
            <p className={`text-xs ${textSecondary} mt-1`}>{stat.subtext}</p>
          </div>
        ))}
      </div>

      {/* Priority Split Row: Upcoming Tasks & Recent Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Column A: Upcoming Homework & Tasks */}
        <div className={`${cardBg} border rounded-2xl p-6 flex flex-col`}>
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#9e1b1b]" />
              <h3 className={`font-bold text-base ${textPrimary}`}>{t('الواجبات والتكليفات المطلوبة')}</h3>
            </div>
            <button
              onClick={() => navigate('/student/online/homework')}
              className="text-xs text-[#9e1b1b] hover:underline font-semibold flex items-center gap-1"
            >
              <span>{t('عرض الكل')}</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-3">
            {pendingHomeworks.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs sm:text-sm">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-slate-300">{t('لا توجد واجبات معلقة حالياً')}</p>
                <p className="text-xs mt-0.5">{t('لقد أنجزت جميع التكليفات المسندة إليك بنجاح.')}</p>
              </div>
            ) : (
              pendingHomeworks.map((hw) => (
                <div
                  key={hw.id}
                  onClick={() => navigate('/student/online/homework')}
                  className={`${wellBg} p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer hover:border-slate-700 transition-colors`}
                >
                  <div className="min-w-0">
                    <h4 className={`text-sm font-bold ${textPrimary} truncate`}>{hw.title}</h4>
                    <p className={`text-xs ${textSecondary} flex items-center gap-1.5 mt-0.5`}>
                      <Calendar className="w-3.5 h-3.5 text-amber-500" />
                      <span>{t('الموعد النهائي:')} {new Date(hw.deadline || Date.now()).toLocaleDateString('ar-EG')}</span>
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 whitespace-nowrap">
                    {t('بانتظار التسليم')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column B: Recent Verified Academic Results */}
        <div className={`${cardBg} border rounded-2xl p-6 flex flex-col`}>
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-500" />
              <h3 className={`font-bold text-base ${textPrimary}`}>{t('أحدث النتائج والتقييمات')}</h3>
            </div>
            <button
              onClick={() => navigate('/student/online/results')}
              className="text-xs text-[#9e1b1b] hover:underline font-semibold flex items-center gap-1"
            >
              <span>{t('سجل النتائج')}</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-3">
            {recentResults.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs sm:text-sm">
                <Award className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-slate-300">{t('لا توجد نتائج مسجلة حتى الآن')}</p>
                <p className="text-xs mt-0.5">{t('ستظهر درجات امتحاناتك وواجباتك هنا فور اعتمادها.')}</p>
              </div>
            ) : (
              recentResults.map((item) => {
                const isExam = item.type === 'exam';
                const score = typeof item.score === 'number' ? item.score : 0;
                const scoreColor =
                  score >= 85
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    : score >= 65
                    ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20';

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.assessmentId) {
                        navigate(`/student/online/assessment/${item.assessmentId}/review/${item.id}`);
                      } else {
                        navigate('/student/online/results');
                      }
                    }}
                    className={`${wellBg} p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer hover:border-slate-700 transition-colors`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                          {isExam ? 'امتحان' : 'واجب'}
                        </span>
                        <h4 className={`text-sm font-bold ${textPrimary} truncate`}>{item.title}</h4>
                      </div>
                      <p className={`text-xs ${textSecondary} mt-1`}>
                        {t('تاريخ الإنجاز:')} {new Date(item.date || Date.now()).toLocaleDateString('ar-EG')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${scoreColor}`}>
                        {score}%
                      </span>
                      <ChevronLeft className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Enrolled Courses Shelf */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#9e1b1b]" />
            <h2 className={`text-lg sm:text-xl font-bold ${textPrimary}`}>{t('مقرراتي الدراسية')}</h2>
          </div>
          <button
            onClick={() => navigate('/student/online/courses')}
            className="text-xs text-[#9e1b1b] hover:underline font-semibold flex items-center gap-1"
          >
            <span>{t('جميع المقررات')}</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {enrolledCourses.length === 0 ? (
          <div className={`${cardBg} border rounded-2xl p-8 text-center`}>
            <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
            <h3 className={`text-base font-bold ${textPrimary} mb-1`}>{t('لا توجد مقررات دراسية مسجلة بعد')}</h3>
            <p className={`text-xs sm:text-sm ${textSecondary} mb-4`}>
              {t('ابدأ بالانضمام إلى أحد المقررات التعليمية المتاحة لمتابعة الدروس والتسجيلات.')}
            </p>
            <button
              onClick={() => navigate('/student/online/courses')}
              className="px-5 py-2 bg-[#9e1b1b] hover:bg-[#851717] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {t('استعراض المقررات')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {enrolledCourses.slice(0, 6).map((course) => {
              const lessonsCount = Array.isArray(course.lessons) ? course.lessons.length : (course.lessonsCount || 0);
              const completedCount = Array.isArray(course.lessons)
                ? course.lessons.filter((l: any) => {
                    const p = Array.isArray(l.progress) ? l.progress[0] : (l.progress || null);
                    return p?.watched || p?.status === 'COMPLETED' || (p?.progress && p.progress >= 90);
                  }).length
                : (course.completedLessons || 0);
              const progressPct = lessonsCount > 0 ? Math.round((completedCount / lessonsCount) * 100) : 0;

              return (
                <div
                  key={course.id}
                  onClick={() => navigate(`/student/online/courses/${course.id}`)}
                  className={`${cardBg} border rounded-2xl overflow-hidden cursor-pointer hover:border-slate-700 hover:shadow-md transition-all group flex flex-col`}
                >
                  <div className="h-32 bg-[#161c28] border-b border-slate-800/80 flex items-center justify-center relative overflow-hidden">
                    <BookOpen className="w-10 h-10 text-slate-500 group-hover:scale-110 transition-transform text-[#9e1b1b]" />
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-900/80 text-slate-300 border border-slate-700/60">
                      {course.category || 'عام'}
                    </span>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className={`font-bold text-sm sm:text-base ${textPrimary} line-clamp-2 group-hover:text-[#9e1b1b] transition-colors mb-2`}>
                        {course.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                        <span>{lessonsCount} {t('درس')}</span>
                        <span>{completedCount} {t('مكتمل')}</span>
                      </div>
                    </div>

                    <div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden mb-3">
                        <div
                          className="h-full bg-[#9e1b1b] rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-medium">{t('نسبة الإنجاز')}</span>
                        <span className={`font-bold ${textPrimary}`}>{progressPct}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
