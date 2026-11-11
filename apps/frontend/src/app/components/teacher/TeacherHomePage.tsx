import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, BookOpen, TrendingUp, AlertTriangle, RefreshCw,
  ArrowUpRight, Eye, AlertCircle, Calendar, PlusCircle, CheckCircle, Building2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsService } from '../../services/analytics.service';
import { LoadingState } from '../ui/LoadingState';
import { DashboardHomeSkeleton } from '../ui/skeleton';

export default function TeacherHomePage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState<any>(null);
  const [atRiskStudents, setAtRiskStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = 'bg-card border-border shadow-xs text-card-foreground';
  const wellBg = 'bg-muted/60 border-border text-foreground';
  const textPrimary = 'text-foreground';
  const textSecondary = 'text-muted-foreground';

  const fetchOverview = useCallback(async (isManual = false) => {
    if (!user?.id) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [overviewRes, riskRes] = await Promise.all([
        analyticsService.getTeacherAnalytics(user.id),
        analyticsService.getRiskAnalytics().catch(() => ({ data: { riskStudents: [] } }))
      ]);

      setOverview(overviewRes.data);
      const risks = riskRes?.data?.riskStudents || (Array.isArray(riskRes?.data) ? riskRes.data : []);
      setAtRiskStudents(risks);
    } catch (err: any) {
      console.error('Failed to fetch teacher overview:', err);
      setError(t('تعذر تحميل بيانات لوحة المعلم. يرجى إعادة المحاولة.'));
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  if (loading) {
    return <DashboardHomeSkeleton message={t('جاري تحميل لوحة المؤشرات التعليمية للمعلم...')} portalTitle={t('لوحة مؤشرات المعلم')} />;
  }

  const currentDateStr = new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  return (
    <div
      className="p-4 sm:p-6 lg:p-8 bg-background text-foreground min-h-full font-['Cairo'] font-sans"
      dir="rtl"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              {t('بوابة المعلم')}
            </span>
            <span className="text-xs text-slate-400">{t('منظومة الإشراف الأكاديمي والتدريس')}</span>
            {user?.branch?.name ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20" data-testid="teacher-branch-badge">
                <Building2 className="w-3.5 h-3.5" />
                <span>{t('branchColon', 'الفرع:')} {user.branch.name}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" data-testid="teacher-unassigned-badge">
                <Building2 className="w-3.5 h-3.5" />
                <span>{t('unassignedBranch', 'غير مسند لفرع حالياً')}</span>
              </span>
            )}
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
            {t('مرحباً، أ.')} {user?.name || 'المعلم'}
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            {currentDateStr} {t('• نظرة شاملة على مستويات الطلاب والأنشطة الأكاديمية')}
          </p>
        </div>

        <button
          onClick={() => fetchOverview(true)}
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

      {/* Global Error Banner if API failed */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => fetchOverview(true)}
              className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
            >
              {t('إعادة المحاولة')}
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Row (4 verified metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Total Students */}
        <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('إجمالي الطلاب المسجلين')}</p>
              <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                {overview?.totalStudents != null ? overview.totalStudents : '—'}
                <span className="text-xs font-normal text-slate-400 ms-1.5">{t('طالب')}</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 truncate">
            {t('إجمالي الطلاب في مقرراتك الدراسية')}
          </p>
        </div>

        {/* Card 2: Active Courses */}
        <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('المقررات الدراسية النشطة')}</p>
              <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                {overview?.totalCourses != null ? overview.totalCourses : '—'}
                <span className="text-xs font-normal text-slate-400 ms-1.5">{t('مقرر')}</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0 border border-teal-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 truncate">
            {t('دورات ومناهج تعليمية منشورة')}
          </p>
        </div>

        {/* Card 3: Average Exam Score (Honest raw average, no deceptive %) */}
        <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('متوسط درجات التقييمات')}</p>
              <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                {overview?.averageScore != null ? overview.averageScore : '—'}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#9e1b1b]/10 text-[#9e1b1b] flex items-center justify-center flex-shrink-0 border border-[#9e1b1b]/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 truncate">
            {overview?.averageScore != null
              ? 'متوسط نتائج امتحانات الطلاب المكتملة'
              : 'لا توجد نتائج اختبارات مسجلة بعد'}
          </p>
        </div>

        {/* Card 4: Struggling Students */}
        <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('طلاب بحاجة لمتابعة')}</p>
              <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${
                overview?.strugglingStudents > 0 ? 'text-amber-500' : textPrimary
              }`}>
                {overview?.strugglingStudents ?? 0}
                <span className="text-xs font-normal text-slate-400 ms-1.5">{t('طالب')}</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 truncate">
            {t('طلاب متوسط درجاتهم أقل من ٥٠٪')}
          </p>
        </div>
      </div>

      {/* Quick Academic Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <button
          onClick={() => navigate('/teacher/attendance')}
          className={`${cardBg} p-3.5 rounded-2xl border flex items-center gap-3 hover:border-[#9e1b1b]/40 transition-all cursor-pointer text-right`}
        >
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h4 className={`text-xs font-bold ${textPrimary}`}>{t('تسجيل الحضور')}</h4>
            <p className="text-[10px] text-slate-400">{t('سجل حضور اليوم')}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/teacher/exams')}
          className={`${cardBg} p-3.5 rounded-2xl border flex items-center gap-3 hover:border-[#9e1b1b]/40 transition-all cursor-pointer text-right`}
        >
          <div className="w-9 h-9 rounded-xl bg-[#9e1b1b]/10 text-[#9e1b1b] flex items-center justify-center flex-shrink-0">
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className={`text-xs font-bold ${textPrimary}`}>{t('إنشاء تقييم')}</h4>
            <p className="text-[10px] text-slate-400">{t('اختبار أو واجب')}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/teacher/courses')}
          className={`${cardBg} p-3.5 rounded-2xl border flex items-center gap-3 hover:border-[#9e1b1b]/40 transition-all cursor-pointer text-right`}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h4 className={`text-xs font-bold ${textPrimary}`}>{t('إدارة المقررات')}</h4>
            <p className="text-[10px] text-slate-400">{t('الدروس والوسائط')}</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/teacher/students')}
          className={`${cardBg} p-3.5 rounded-2xl border flex items-center gap-3 hover:border-[#9e1b1b]/40 transition-all cursor-pointer text-right`}
        >
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className={`text-xs font-bold ${textPrimary}`}>{t('قائمة الطلاب')}</h4>
            <p className="text-[10px] text-slate-400">{t('متابعة الأداء والتقارير')}</p>
          </div>
        </button>
      </div>

      {/* Two-Column Analytics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Real Subject Performance Bar Chart */}
        <div className={`lg:col-span-2 ${cardBg} border rounded-2xl p-5 sm:p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                {t('متوسط درجات الطلاب حسب المقرر الدراسي')}
              </h2>
              <p className={`text-xs ${textSecondary}`}>
                {t('بيانات فعلية محسوبة من نتائج اختبارات الطلاب في كل مقرر')}
              </p>
            </div>
          </div>

          {overview?.subjectPerformance && overview.subjectPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={overview.subjectPerformance} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                <YAxis dataKey="subject" type="category" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} width={120} />
                <RechartsTooltip
                  contentStyle={{
                    background: isDark ? '#0f131d' : '#fff',
                    border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                    borderRadius: 12
                  }}
                  formatter={(val: any) => [`${val}`, 'متوسط الدرجات']}
                />
                <Bar dataKey="avg" fill="#9e1b1b" radius={[0, 6, 6, 0]} name={t('المتوسط')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs sm:text-sm">
              {t('لا توجد درجات مقررات مسجلة حتى الآن.')}
            </div>
          )}
        </div>

        {/* Real Student Academic Level Distribution */}
        <div className={`${cardBg} border rounded-2xl p-5 sm:p-6`}>
          <h2 className={`font-bold text-base sm:text-lg ${textPrimary} mb-1`}>
            {t('توزيع المستويات الأكاديمية')}
          </h2>
          <p className={`text-xs ${textSecondary} mb-4`}>
            {t('تصنيف الطلاب بناءً على نتائج الاختبارات')}
          </p>

          {overview?.distributionData && overview.distributionData.some((d: any) => d.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={overview.distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                  >
                    {overview.distributionData.map((entry: any, index: number) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: any, name: any) => [`${val} طالب`, name]}
                    contentStyle={{
                      background: isDark ? '#0f131d' : '#fff',
                      border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                      borderRadius: 12
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                {overview.distributionData.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className={textSecondary}>{item.name}</span>
                    </div>
                    <span className={`font-bold ${textPrimary}`}>{item.value} {t('طالب')}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs sm:text-sm">
              {t('لا توجد تقييمات مكتملة لتوزيع المستويات بعد.')}
            </div>
          )}
        </div>
      </div>

      {/* Live At-Risk Students Container */}
      <div className={`${cardBg} border rounded-2xl p-5 sm:p-6`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                {t('طلاب بحاجة لمتابعة ودعم أكاديمي')}
              </h2>
              <p className={`text-xs ${textSecondary}`}>
                {t('تحليل تلقائي لمؤشرات ضعف التحصيل أو تكرار الغياب')}
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/teacher/students')}
            className="text-xs sm:text-sm font-bold text-[#9e1b1b] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>{t('كافة الطلاب')}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        {atRiskStudents.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs sm:text-sm">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
            <p className="font-semibold">{t('لا يوجد طلاب مسجلين بحالة تعثر حالياً.')}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t('كافة الطلاب في المقررات يؤدون بمستوى مستقر.')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {atRiskStudents.slice(0, 6).map((student: any) => {
              const isCritical = student.risk === 'حرج';
              const isHigh = student.risk === 'عالي';

              return (
                <div
                  key={student.id}
                  className={`p-4 rounded-xl border transition-all ${wellBg}`}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-800 dark:text-slate-200">
                        {student.name ? student.name.charAt(0) : 'ط'}
                      </div>
                      <div>
                        <p className={`text-xs sm:text-sm font-bold ${textPrimary}`}>{student.name}</p>
                        <p className="text-[10px] text-slate-400">{student.grade || student.type || 'طالب'}</p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        isCritical
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                          : isHigh
                          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      }`}
                    >
                      {student.risk || 'متابعة'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
                    <span>{student.reasons?.[0] || 'بحاجة لدعم دراسي'}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {t('متوسط:')} {student.avg != null ? student.avg : '—'}
                    </span>
                  </div>

                  <button
                    onClick={() => navigate(`/teacher/students/${student.id}`)}
                    className="w-full text-xs font-semibold text-[#9e1b1b] hover:bg-[#9e1b1b]/10 py-1.5 rounded-lg border border-[#9e1b1b]/30 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{t('عرض تقرير الطالب')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
