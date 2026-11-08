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
      setError(t('تعذر تحميل بيانات المقررات الدراسية. يرجى إعادة المحاولة.'));
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
    }, 20000); // 20s interval

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchCourses();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (socket) {
      const handleSync = () => fetchCourses();
      socket.on('course_created', handleSync);
      socket.on('course_updated', handleSync);
      socket.on('course_deleted', handleSync);

      return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        socket.off('course_created', handleSync);
        socket.off('course_updated', handleSync);
        socket.off('course_deleted', handleSync);
      };
    }

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, fetchCourses]);

  if (loading) {
    return <LoadingState message={t('جاري تحميل المقررات الدراسية...')} />;
  }

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo'] font-sans`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              {t('المقررات والمناهج')}
            </span>
            <span className="text-xs text-slate-400">{t('إدارة مساقاتك التعليمية')}</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
            {t('المقررات الدراسية')}
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            {t('تصفح المقررات المسجل بها أو استكشف المناهج المتاحة لمرحلتك الدراسية')}
          </p>
        </div>

        <button
          onClick={() => fetchCourses(true)}
          disabled={refreshing}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer self-start sm:self-auto ${
            isDark
              ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
          <span>{t('تحديث')}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-800/80 mb-8">
        <button
          onClick={() => setActiveTab('my_courses')}
          className={`pb-3 px-3 font-bold text-sm sm:text-base border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'my_courses'
              ? 'text-[#9e1b1b] border-[#9e1b1b]'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <span>{t('مقرراتي المسجلة')}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {courses.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('available_courses')}
          className={`pb-3 px-3 font-bold text-sm sm:text-base border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'available_courses'
              ? 'text-[#9e1b1b] border-[#9e1b1b]'
              : 'text-slate-400 border-transparent hover:text-slate-200'
          }`}
        >
          <span>{t('استعراض المناهج المتاحة')}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            {availableCourses.length}
          </span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => fetchCourses(true)}
              className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
            >
              {t('إعادة المحاولة')}
            </button>
          </div>
        </div>
      )}

      {/* Tab 1: Enrolled Courses */}
      {activeTab === 'my_courses' && courses.length === 0 && (
        <div className={`${cardBg} border rounded-2xl p-8 text-center`}>
          <BookOpen className="w-12 h-12 text-[#9e1b1b] mx-auto mb-3 opacity-70" />
          <h3 className={`text-base font-bold ${textPrimary} mb-1`}>{t('لا توجد مقررات دراسية مسجلة حالياً')}</h3>
          <p className={`text-xs sm:text-sm ${textSecondary} mb-4 max-w-md mx-auto`}>
            {t('يمكنك تصفح المناهج المتاحة والاشتراك بها للوصول إلى الدروس والاختبارات التفاعلية.')}
          </p>
          <button
            onClick={() => setActiveTab('available_courses')}
            className="px-5 py-2.5 bg-[#9e1b1b] hover:bg-[#851717] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {t('استعراض المناهج المتاحة')}
          </button>
        </div>
      )}

      {activeTab === 'my_courses' && courses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course: any) => (
            <div
              key={course.id}
              onClick={() => navigate(`/student/online/courses/${course.id}`)}
              className={`${cardBg} border rounded-2xl overflow-hidden cursor-pointer hover:border-slate-700 hover:shadow-lg transition-all flex flex-col group`}
            >
              <div className="h-40 bg-[#161c28] border-b border-slate-800/80 flex items-center justify-center relative overflow-hidden">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-12 h-12 text-[#9e1b1b] group-hover:scale-110 transition-transform" />
                )}
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-900/80 text-slate-300 border border-slate-700/60">
                  {course.category}
                </span>
                {course.progress > 0 && (
                  <span className="absolute bottom-3 left-3 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#9e1b1b] text-white shadow-xs">
                    {course.progress}%
                  </span>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className={`font-bold text-base ${textPrimary} group-hover:text-[#9e1b1b] transition-colors mb-3 line-clamp-2`}>
                    {course.title}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-slate-400 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-slate-400" />
                      <span>{course.lessons} {t('درس')}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{course.completed} {t('مكتمل')}</span>
                    </div>
                  </div>
                </div>

                <div>
                  {course.progress > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-slate-800/80 overflow-hidden mb-3">
                      <div
                        className="h-full bg-[#9e1b1b] rounded-full transition-all duration-500"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  )}

                  <button className="w-full py-2.5 rounded-xl bg-[#9e1b1b] hover:bg-[#851717] text-white text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <span>{t('متابعة المقرر')}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Available Courses */}
      {activeTab === 'available_courses' && availableCourses.length === 0 && (
        <div className={`${cardBg} border rounded-2xl p-8 text-center`}>
          <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-60" />
          <h3 className={`text-base font-bold ${textPrimary} mb-1`}>{t('لا توجد مقررات إضافية متاحة حالياً')}</h3>
          <p className={`text-xs sm:text-sm ${textSecondary}`}>
            {t('لقد قمت بالتسجيل في جميع المناهج المتاحة لمرحلتك التعليمية.')}
          </p>
        </div>
      )}

      {activeTab === 'available_courses' && availableCourses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableCourses.map((course: any) => (
            <div
              key={course.id}
              className={`${cardBg} border rounded-2xl overflow-hidden hover:border-slate-700 hover:shadow-lg transition-all flex flex-col`}
            >
              <div className="h-40 bg-[#161c28] border-b border-slate-800/80 flex items-center justify-center relative overflow-hidden">
                {course.thumbnail ? (
                  <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="w-12 h-12 text-slate-500" />
                )}
                <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-900/80 text-slate-300 border border-slate-700/60">
                  {course.category || 'عام'}
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className={`font-bold text-base ${textPrimary} mb-2 line-clamp-2`}>
                    {course.title}
                  </h3>
                  <p className={`text-xs ${textSecondary} mb-4 line-clamp-2`}>
                    {course.description || 'مقرر تعليمي شامل مع شروحات واختبارات دورية.'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-slate-400" />
                      <span>{course._count?.lessons || 0} {t('درس')}</span>
                    </div>
                    <span className="font-bold text-slate-200">
                      {course.price > 0 ? `${course.price} ج.م` : 'متاح مجاناً'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleEnroll(course.id)}
                  disabled={enrolling === course.id}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white transition-colors cursor-pointer flex items-center justify-center gap-2 ${
                    enrolling === course.id
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-[#9e1b1b] hover:bg-[#851717]'
                  }`}
                >
                  {enrolling === course.id ? (
                    <span>{t('جاري التسجيل...')}</span>
                  ) : (
                    <>
                      <span>{t('التسجيل في المقرر')}</span>
                      <ChevronLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
