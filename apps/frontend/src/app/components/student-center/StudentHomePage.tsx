import { useLanguage, t } from '../../contexts/LanguageContext';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, BookOpen, ClipboardCheck, TrendingUp, Clock,
  RefreshCw, CheckCircle2, AlertCircle, Calendar, ArrowLeft,
  FileText, Award, ChevronLeft, Sparkles, UserCheck, XCircle
} from 'lucide-react';
import { courseService } from '../../services/course.service';
import { analyticsService } from '../../services/analytics.service';
import { userService } from '../../services/user.service';
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
  duration?: number | string;
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
  const [gpa, setGpa] = useState<number>(0);
  const [attendancePercentage, setAttendancePercentage] = useState<number | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState({
    totalSessions: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0
  });

  // Content state
  const [continueLesson, setContinueLesson] = useState<ContinueLesson | null>(null);
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
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
      const [statsRes, overviewRes, coursesRes, recentRes, attendanceRes, homeworksRes] = await Promise.all([
        courseService.getStudentCourseStats().catch(() => null),
        analyticsService.getStudentOverview().catch(() => null),
        courseService.getCourses().catch(() => null),
        analyticsService.getStudentRecent().catch(() => null),
        userService.getAttendance().catch(() => null),
        homeworkService.getHomeworks().catch(() => null)
      ]);

      if (!statsRes && !overviewRes && !coursesRes && !attendanceRes) {
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

      // 2. Overview / GPA & Attendance Rate
      if (overviewRes?.data) {
        setGpa(typeof overviewRes.data.gpa === 'number' ? overviewRes.data.gpa : 0);
        if (typeof overviewRes.data.attendanceRate === 'number') {
          setAttendancePercentage(overviewRes.data.attendanceRate);
        }
      }

      // 3. Center Attendance
      if (attendanceRes) {
        const records = Array.isArray(attendanceRes.data)
          ? attendanceRes.data
          : Array.isArray(attendanceRes)
          ? attendanceRes
          : [];
        setRecentAttendance(records.slice(0, 3));

        if (attendanceRes.summary) {
          setAttendanceSummary({
            totalSessions: attendanceRes.summary.totalSessions ?? 0,
            presentCount: attendanceRes.summary.presentCount ?? 0,
            absentCount: attendanceRes.summary.absentCount ?? 0,
            lateCount: attendanceRes.summary.lateCount ?? 0
          });
          if (attendanceRes.summary.percentage !== null && attendanceRes.summary.percentage !== undefined) {
            setAttendancePercentage(attendanceRes.summary.percentage);
          }
        } else if (records.length > 0) {
          const total = records.length;
          const present = records.filter((r: any) => r.status === 'PRESENT').length;
          const late = records.filter((r: any) => r.status === 'LATE').length;
          const absent = records.filter((r: any) => r.status === 'ABSENT').length;
          const pct = Math.round(((present + late) / total) * 100);
          setAttendanceSummary({
            totalSessions: total,
            presentCount: present,
            absentCount: absent,
            lateCount: late
          });
          setAttendancePercentage(pct);
        }
      }

      // 4. Courses & Continue Watching Resolution
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

      // 5. Recent Activity
      const recents = Array.isArray(recentRes?.data) ? recentRes.data : [];
      setRecentResults(recents.slice(0, 4));

      // 6. Pending Homeworks
      const homeworksData = homeworksRes?.data?.data ? homeworksRes.data.data : Array.isArray(homeworksRes?.data) ? homeworksRes.data : [];
      if (Array.isArray(homeworksData)) {
        const pending = homeworksData.filter((h: any) => h.status === 'draft' || h.status === 'pending');
        setPendingHomeworks(pending.slice(0, 3));
      }
    } catch (err: any) {
      console.error('Failed to load student center dashboard:', err);
      setError(t('تعذر تحميل بيانات لوحة طالب السنتر بشكل كامل. يرجى إعادة المحاولة.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <DashboardHomeSkeleton message={t('جاري إعداد منصة طالب السنتر...')} portalTitle={t('لوحة طالب السنتر')} />;
  }

  const statCards = [
    {
      title: 'الدورات المسجلة',
      value: courseStats.enrolledCoursesCount,
      subtext: `${courseStats.totalLessons} درس إجمالي`,
      icon: BookOpen,
      tone: 'crimson'
    },
    {
      title: 'نسبة حضور السنتر',
      value: attendancePercentage !== null ? `${attendancePercentage}٪` : '—',
      subtext: `${attendanceSummary.presentCount + attendanceSummary.lateCount} حضور من أصل ${attendanceSummary.totalSessions}`,
      icon: UserCheck,
      tone: 'emerald'
    },
    {
      title: 'المعدل التراكمي (GPA)',
      value: gpa > 0 ? `${gpa.toFixed(2)}` : '—',
      subtext: 'التقييم الأكاديمي العام',
      icon: TrendingUp,
      tone: 'amber'
    },
    {
      title: 'الدروس المنجزة',
      value: courseStats.completedLessons,
      subtext: `نسبة الإنجاز ${courseStats.completionPercentage}٪`,
      icon: Award,
      tone: 'slate'
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8" dir="rtl">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-[#9e1b1b]/10 text-[#9e1b1b] dark:bg-[#9e1b1b]/25 dark:text-red-300 border border-[#9e1b1b]/20">
              <Sparkles className="w-3.5 h-3.5" /> {t('طالب مركز تعليمي ميداني')}
            </span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} tracking-tight`}>
            {t('مرحباً بك،')} {user?.name || 'طالب السنتر'}
          </h1>
          <p className={`text-sm ${textSecondary} mt-1`}>
            {t('متابعة دقيقة لمسارك الأكاديمي، سجل حضور الحصص، والاختبارات الدورية.')}
          </p>
        </div>

        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className={`self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-xs ${
            isDark
              ? 'bg-[#161c28] hover:bg-[#1f2737] text-slate-200 border border-slate-800'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
          <span>{t('تحديث المنصة')}</span>
        </button>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            {t('إعادة المحاولة')}
          </button>
        </div>
      )}

      {/* 4 Verified Institutional Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat, idx) => (
          <div
            key={idx}
            className={`${cardBg} rounded-2xl p-5 border relative overflow-hidden transition-all duration-200 hover:border-slate-400/40`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold ${textSecondary}`}>{stat.title}</span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  stat.tone === 'crimson'
                    ? 'bg-[#9e1b1b]/10 text-[#9e1b1b] dark:bg-[#9e1b1b]/20 dark:text-red-400'
                    : stat.tone === 'emerald'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : stat.tone === 'amber'
                    ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                    : 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300'
                }`}
              >
                <stat.icon className="w-5 h-5" />
              </div>
            </div>
            <div className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} tracking-tight`}>
              {stat.value}
            </div>
            <p className={`text-xs ${textSecondary} mt-1.5`}>{stat.subtext}</p>
          </div>
        ))}
      </div>

      {/* Active "Continue Watching" Hero Card */}
      {continueLesson && (
        <div
          onClick={() => navigate(`/student/center/videos/${continueLesson.lessonId}`)}
          className="group relative rounded-2xl overflow-hidden cursor-pointer border border-[#9e1b1b]/40 shadow-sm transition-all duration-300 hover:shadow-lg bg-gradient-to-r from-[#090b10] via-[#120d13] to-[#1a0f12]"
        >
          <div className="absolute top-0 right-0 w-2 h-full bg-[#9e1b1b]" />
          <div className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#9e1b1b] text-white flex items-center justify-center shadow-md group-hover:scale-105 group-hover:bg-[#b01e1e] transition-transform shrink-0">
                <Play className="w-7 h-7 fill-white translate-x-[-1px]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {t('استئناف الدراسة والمشاهدة')}
                  </span>
                  <span className="text-xs text-slate-400">• {continueLesson.courseName}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white group-hover:text-red-200 transition-colors">
                  {continueLesson.lessonTitle}
                </h2>
                {continueLesson.progress > 0 && (
                  <div className="flex items-center gap-3 pt-2">
                    <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#9e1b1b] to-red-500 rounded-full transition-all"
                        style={{ width: `${continueLesson.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-red-300">
                      {continueLesson.progress}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="self-end md:self-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white font-bold text-sm backdrop-blur-xs group-hover:bg-[#9e1b1b] transition-colors">
              <span>{t('متابعة الدرس الآن')}</span>
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      )}

      {/* Split Section: Pending Tasks & Center Attendance / Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Left Column: Upcoming Tasks & Homework */}
        <div className={`${cardBg} rounded-2xl p-6 border flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#9e1b1b]/10 text-[#9e1b1b] dark:bg-[#9e1b1b]/20 dark:text-red-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className={`font-bold ${textPrimary}`}>{t('الواجبات والتكليفات المطلوبة')}</h3>
              </div>
              <button
                onClick={() => navigate('/student/center/homework')}
                className="text-xs font-bold text-[#9e1b1b] dark:text-red-400 hover:underline flex items-center gap-1"
              >
                <span>{t('عرض الكل')}</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {pendingHomeworks.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className={`text-sm font-semibold ${textPrimary}`}>{t('أحسنت! لا توجد واجبات معلقة')}</p>
                <p className={`text-xs ${textSecondary}`}>{t('تم تسليم جميع المهام والتكليفات بنجاح.')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingHomeworks.map((hw: any) => (
                  <div
                    key={hw.id}
                    className={`${wellBg} p-3.5 rounded-xl border flex items-center justify-between gap-3`}
                  >
                    <div className="space-y-0.5">
                      <p className={`text-sm font-bold ${textPrimary}`}>{hw.title}</p>
                      <p className={`text-xs ${textSecondary}`}>{hw.course?.title || 'دورة تعليمية'}</p>
                    </div>
                    <button
                      onClick={() => navigate('/student/center/homework')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#9e1b1b] text-white hover:bg-[#b01e1e] transition-colors shrink-0"
                    >
                      {t('حل الواجب')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Center Attendance & Recent Results */}
        <div className={`${cardBg} rounded-2xl p-6 border flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className={`font-bold ${textPrimary}`}>{t('سجل الحضور والنتائج الأخيرة')}</h3>
              </div>
              <button
                onClick={() => navigate('/student/center/attendance')}
                className="text-xs font-bold text-[#9e1b1b] dark:text-red-400 hover:underline flex items-center gap-1"
              >
                <span>{t('سجل الحضور')}</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Attendance Highlights */}
            {recentAttendance.length > 0 && (
              <div className="mb-4">
                <p className={`text-xs font-bold ${textSecondary} mb-2`}>{t('آخر حصص تم تسجيلها بالسنتر:')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {recentAttendance.map((rec: any) => {
                    const d = new Date(rec.date);
                    const isPresent = rec.status === 'PRESENT';
                    const isLate = rec.status === 'LATE';
                    return (
                      <div
                        key={rec.id}
                        className={`${wellBg} p-2.5 rounded-xl border text-center space-y-1`}
                      >
                        <span className="text-[11px] text-slate-400 font-mono block">
                          {isNaN(d.getTime()) ? '-' : d.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' })}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isPresent
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : isLate
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isPresent ? 'حاضر' : isLate ? 'متأخر' : 'غائب'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Results */}
            {recentResults.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                {t('لا توجد تقييمات مسجلة مؤخراً.')}
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className={`text-xs font-bold ${textSecondary}`}>{t('التقييمات الأكاديمية الأخيرة:')}</p>
                {recentResults.map((result: any, idx: number) => (
                  <div
                    key={idx}
                    className={`${wellBg} p-3 rounded-xl border flex items-center justify-between gap-3`}
                  >
                    <div>
                      <p className={`text-xs font-bold ${textPrimary}`}>{result.title}</p>
                      <p className="text-[11px] text-slate-400">{result.date}</p>
                    </div>
                    <span
                      className={`text-xs font-extrabold font-mono px-2 py-0.5 rounded-md ${
                        result.score >= 90
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : result.score >= 75
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {result.score}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enrolled Courses Shelf */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-lg font-bold ${textPrimary}`}>{t('الدورات والمناهج المقيد بها')}</h2>
            <p className={`text-xs ${textSecondary}`}>{t('متابعة المحاضرات والدروس والتمارين')}</p>
          </div>
          <button
            onClick={() => navigate('/student/center/courses')}
            className="text-xs font-bold text-[#9e1b1b] dark:text-red-400 hover:underline flex items-center gap-1"
          >
            <span>{t('عرض كل الدورات')}</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {enrolledCourses.length === 0 ? (
          <div className={`${cardBg} rounded-2xl p-10 border text-center space-y-3`}>
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto" />
            <p className={`font-bold ${textPrimary}`}>{t('لا توجد دورات مسجلة حالياً')}</p>
            <p className={`text-xs ${textSecondary}`}>{t('تصفح المناهج المتاحة في السنتر لبدء دراستك.')}</p>
            <button
              onClick={() => navigate('/student/center/courses')}
              className="mt-2 px-5 py-2 rounded-xl text-xs font-bold bg-[#9e1b1b] text-white hover:bg-[#b01e1e] transition-colors"
            >
              {t('استعراض الدورات المتاحة')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {enrolledCourses.slice(0, 4).map((course: any) => (
              <div
                key={course.id}
                onClick={() => navigate(`/student/center/courses/${course.id}`)}
                className={`${cardBg} rounded-2xl overflow-hidden border cursor-pointer group hover:border-[#9e1b1b]/50 transition-all duration-200 flex flex-col justify-between`}
              >
                <div>
                  <div className="h-32 bg-slate-900 relative overflow-hidden">
                    {course.thumbnail ? (
                      <img
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#161c28] to-[#090b10]">
                        <BookOpen className="w-10 h-10 text-slate-600" />
                      </div>
                    )}
                    {typeof course.progress === 'number' && course.progress > 0 && (
                      <span className="absolute top-2.5 left-2.5 bg-black/75 backdrop-blur-xs text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded-full">
                        {course.progress}%
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className={`text-sm font-bold ${textPrimary} line-clamp-2 group-hover:text-[#9e1b1b] dark:group-hover:text-red-400 transition-colors`}>
                      {course.title}
                    </h3>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>{course._count?.lessons || course.lessons?.length || 0} {t('درس')}</span>
                    <span className="text-[#9e1b1b] dark:text-red-400 font-bold flex items-center gap-0.5">
                      {t('فتح الدورة')} <ChevronLeft className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
