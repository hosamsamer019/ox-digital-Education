import { useLanguage, t } from '../../contexts/LanguageContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Video, Lock, CheckCircle2, ChevronLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { courseService } from '../../services/course.service';
import { useSocket } from '../../contexts/SocketContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LoadingState } from '../ui/LoadingState';

export default function CoursesPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'my_courses' | 'available_courses'>('my_courses');
  const [courses, setCourses] = useState<any[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-xs';
  const wellBg = isDark ? 'bg-[#161c28]/70 border-slate-800/60' : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  const fetchCourses = useCallback(async (isManual = false) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    if (isManual) setRefreshing(true);
    setError(null);

    try {
      const [myRes, availRes]: [any, any] = await Promise.all([
        courseService.getCourses().catch(() => ({ data: [] })),
        courseService.getAvailableCourses().catch(() => ({ data: [] }))
      ]);

      const myData = myRes.data?.data ? myRes.data.data : Array.isArray(myRes.data) ? myRes.data : [];
      if (Array.isArray(myData)) {
        const mapped = myData.map((c: any) => ({
          id: c.id,
          title: c.title,
          category: c.category || 'عام',
          progress: typeof c.progress === 'number' ? Math.min(100, Math.max(0, c.progress)) : 0,
          lessons: c.lessonsCount ?? c.totalLessons ?? c._count?.lessons ?? (Array.isArray(c.lessons) ? c.lessons.length : 0),
          completed: c.completedCount ?? c.completedLessons ?? c.completed ?? (
            Array.isArray(c.lessons)
              ? c.lessons.filter((l: any) => {
                  const p = Array.isArray(l.progress) ? l.progress[0] : (l.progress || null);
                  return p?.watched || p?.status === 'COMPLETED' || (p?.progress && p.progress >= 90);
                }).length
              : 0
          ),
          thumbnail: c.thumbnail,
          locked: false
        }));
        setCourses(mapped);
      } else {
        setCourses([]);
      }

      const availData = availRes.data?.data ? availRes.data.data : Array.isArray(availRes.data) ? availRes.data : [];
      setAvailableCourses(Array.isArray(availData) ? availData : []);
    } catch (err: any) {
      console.error('Failed to load courses from API:', err);
      setError(t('تعذر تحميل بيانات الدورات والمناهج. يرجى إعادة المحاولة.'));
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      if (isManual) setRefreshing(false);
    }
  }, []);

  const handleEnroll = async (courseId: string) => {
    try {
      setEnrolling(courseId);
      await courseService.enrollCourse(courseId);
      fetchCourses();
      setActiveTab('my_courses');
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل التسجيل في الدورة');
    } finally {
      setEnrolling(null);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const { socket } = useSocket();

  // Visibility-aware background polling & real-time socket events
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchCourses();
    }, 20000);

    const handleVisibility = () => {
      if (!document.hidden) fetchCourses();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    if (socket) {
      const handleSync = () => fetchCourses();
      socket.on('course_updated', handleSync);
      socket.on('course_deleted', handleSync);

      return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibility);
        socket.off('course_updated', handleSync);
        socket.off('course_deleted', handleSync);
      };
    }

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [socket, fetchCourses]);

  if (loading) {
    return <LoadingState message={t('جاري إعداد قائمة الدورات والمناهج...')} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} tracking-tight`}>
            {t('الدورات والمناهج التعليمية')}
          </h1>
          <p className={`text-sm ${textSecondary} mt-1`}>
            {t('تصفح المقررات المسجلة في السنتر وتابع تقدمك في الدروس والمحاضرات.')}
          </p>
        </div>

        <button
          onClick={() => fetchCourses(true)}
          disabled={refreshing}
          className={`self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-xs ${
            isDark
              ? 'bg-[#161c28] hover:bg-[#1f2737] text-slate-200 border border-slate-800'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
          <span>{t('تحديث')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('my_courses')}
          className={`pb-3.5 px-3 font-bold text-sm sm:text-base transition-colors relative ${
            activeTab === 'my_courses'
              ? 'text-[#9e1b1b] dark:text-red-400'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span>{t('دوراتي المسجلة')}</span>
          {courses.length > 0 && (
            <span className="mr-2 text-xs px-2 py-0.5 rounded-full bg-[#9e1b1b]/10 text-[#9e1b1b] dark:bg-[#9e1b1b]/20 dark:text-red-300 font-mono">
              {courses.length}
            </span>
          )}
          {activeTab === 'my_courses' && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-[#9e1b1b]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('available_courses')}
          className={`pb-3.5 px-3 font-bold text-sm sm:text-base transition-colors relative ${
            activeTab === 'available_courses'
              ? 'text-[#9e1b1b] dark:text-red-400'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <span>{t('تصفح المناهج المتاحة')}</span>
          {availableCourses.length > 0 && (
            <span className="mr-2 text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
              {availableCourses.length}
            </span>
          )}
          {activeTab === 'available_courses' && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-[#9e1b1b]" />
          )}
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          </div>
          <button
            onClick={() => fetchCourses(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            {t('إعادة المحاولة')}
          </button>
        </div>
      )}

      {/* My Courses Tab */}
      {activeTab === 'my_courses' && courses.length === 0 && !error && (
        <div className={`${cardBg} rounded-2xl p-12 border text-center space-y-3`}>
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto" />
          <p className={`font-bold ${textPrimary}`}>{t('لا توجد دورات مسجلة حالياً')}</p>
          <p className={`text-xs ${textSecondary}`}>{t('يمكنك استعراض المقررات المتاحة في السنتر والانضمام إليها.')}</p>
          <button
            onClick={() => setActiveTab('available_courses')}
            className="mt-2 px-5 py-2 rounded-xl text-xs font-bold bg-[#9e1b1b] text-white hover:bg-[#b01e1e] transition-colors"
          >
            {t('تصفح المقررات المتاحة')}
          </button>
        </div>
      )}

      {activeTab === 'my_courses' && courses.length > 0 && (
        <div className="space-y-8">
          {Object.entries(
            courses.reduce((acc, course) => {
              const cat = course.category || 'المقررات الأساسية';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(course);
              return acc;
            }, {} as Record<string, any[]>)
          ).map(([category, categoryCourses]: [string, any]) => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                <BookOpen className="w-4 h-4 text-[#9e1b1b]" />
                <span>{category}</span>
                <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                  {categoryCourses.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {categoryCourses.map((course: any) => (
                  <div
                    key={course.id}
                    onClick={() => !course.locked && navigate(`/student/center/courses/${course.id}`)}
                    className={`${cardBg} rounded-2xl overflow-hidden border transition-all duration-200 ${
                      course.locked
                        ? 'opacity-80 cursor-not-allowed'
                        : 'cursor-pointer hover:border-[#9e1b1b]/50 hover:shadow-md'
                    } flex flex-col justify-between`}
                  >
                    <div>
                      <div className="relative h-44 bg-slate-900">
                        {course.thumbnail ? (
                          <img
                            src={course.thumbnail}
                            alt={course.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#161c28] to-[#090b10]">
                            <BookOpen className="w-10 h-10 text-slate-600" />
                          </div>
                        )}

                        {course.locked && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white gap-2">
                            <Lock className="w-5 h-5 text-red-400" />
                            <span className="text-xs font-bold">{t('المقرر مغلق')}</span>
                          </div>
                        )}

                        {!course.locked && course.progress > 0 && (
                          <span className="absolute top-3 left-3 bg-black/80 backdrop-blur-xs text-white text-xs font-mono font-bold px-2.5 py-0.5 rounded-full">
                            {course.progress}%
                          </span>
                        )}
                      </div>

                      <div className="p-5 space-y-3">
                        <h3 className={`font-bold text-base ${textPrimary} line-clamp-2`}>
                          {course.title}
                        </h3>

                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5" />
                            <span>{course.lessons} {t('درس')}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{course.completed} {t('مكتمل')}</span>
                          </div>
                        </div>

                        {!course.locked && course.progress > 0 && (
                          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#9e1b1b] h-full rounded-full transition-all"
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-5 pt-0">
                      <button
                        disabled={course.locked}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 ${
                          course.locked
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : 'bg-[#9e1b1b] text-white hover:bg-[#b01e1e]'
                        }`}
                      >
                        <span>{course.locked ? 'مغلق حالياً' : 'متابعة المقرر'}</span>
                        {!course.locked && <ChevronLeft className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Available Courses Tab */}
      {activeTab === 'available_courses' && availableCourses.length === 0 && !error && (
        <div className={`${cardBg} rounded-2xl p-12 border text-center space-y-2`}>
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto" />
          <p className={`font-bold ${textPrimary}`}>{t('لا توجد مناهج إضافية متاحة حالياً')}</p>
          <p className={`text-xs ${textSecondary}`}>{t('تم تسجيلك بالفعل في جميع المناهج المتاحة بالمركز.')}</p>
        </div>
      )}

      {activeTab === 'available_courses' && availableCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {availableCourses.map((course: any) => (
            <div
              key={course.id}
              className={`${cardBg} rounded-2xl overflow-hidden border flex flex-col justify-between`}
            >
              <div>
                <div className="relative h-44 bg-slate-900">
                  {course.thumbnail ? (
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#161c28] to-[#090b10]">
                      <BookOpen className="w-10 h-10 text-slate-600" />
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-2">
                  <h3 className={`font-bold text-base ${textPrimary}`}>{course.title}</h3>
                  {course.description && (
                    <p className={`text-xs ${textSecondary} line-clamp-2`}>{course.description}</p>
                  )}
                  <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>{course._count?.lessons || 0} {t('درس')}</span>
                    <span className="font-bold text-[#9e1b1b] dark:text-red-400">
                      {course.price > 0 ? `${course.price} ج.م` : 'مقرر متاح مجاناً'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0">
                <button
                  onClick={() => handleEnroll(course.id)}
                  disabled={enrolling === course.id}
                  className="w-full py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#9e1b1b] text-white hover:bg-[#b01e1e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {enrolling === course.id ? 'جاري التسجيل...' : 'التسجيل في المقرر'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
