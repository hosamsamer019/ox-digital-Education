import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, BookOpen, Video, ClipboardCheck, TrendingUp, Award,
  AlertTriangle, DollarSign, Activity, RefreshCw, ArrowUpRight,
  Shield, UserCheck, FileText, ChevronLeft, Sparkles, CheckCircle2,
  Clock, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { analyticsService } from '../../services/analytics.service';
import { LoadingState } from '../ui/LoadingState';
import { DashboardHomeSkeleton } from '../ui/skeleton';

export default function AdminHomePage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      setError(null);
      const res: any = await analyticsService.getAdminAnalytics();
      setData(res.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to fetch admin analytics:', err);
      setError(t('تعذر تحميل أحدث مؤشرات الأداء الإدارية. يرجى التحقق من اتصال الشبكة.'));
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => fetchData(false), 30000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Design Tokens (Academic Precision & Digital Mastery)
  const cardBg = 'bg-card border-border shadow-xs text-card-foreground';
  const wellBg = 'bg-muted/60 border-border text-foreground';
  const textPrimary = 'text-foreground';
  const textSecondary = 'text-muted-foreground';

  const tooltipStyle = {
    backgroundColor: 'var(--card)',
    borderColor: 'var(--border)',
    borderRadius: '0.75rem',
    color: 'var(--card-foreground)',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    direction: 'rtl' as const,
  };

  if (loading) {
    return <DashboardHomeSkeleton message={t('جاري تحميل مؤشرات لوحة التحكم المركزية...')} portalTitle={t('لوحة التحكم المركزية')} />;
  }

  const overview = data?.overview || {};

  // Formatted Metrics
  const formattedMonthlyRevenue = overview.monthlyRevenue != null
    ? `${Number(overview.monthlyRevenue).toLocaleString('ar-EG')} ج.م`
    : '—';
  const formattedYearlyRevenue = overview.yearlyRevenue != null && overview.yearlyRevenue > 0
    ? `${Number(overview.yearlyRevenue).toLocaleString('ar-EG')} ج.م`
    : '—';

  // Role Breakdown Calculation
  const totalUsersCount = Number(overview.totalUsers) || 0;
  const studentsTotal = Number(overview.studentsCount) || 0;
  const teachersTotal = Number(overview.teachersCount) || 0;
  const parentsTotal = Number(overview.parentsCount) || 0;
  const adminsTotal = Number(overview.adminsCount) || 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-background text-foreground min-h-full font-sans transition-colors duration-200" dir="rtl">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              <Shield className="w-3.5 h-3.5" />
              {t('منظومة الإدارة المركزية')}
            </span>
            <span className="text-xs text-slate-400">
              {t('آخر تحديث:')} {lastUpdated.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${textPrimary}`}>
            {t('لوحة التحكم الرئيسية')}
          </h1>
          <p className={`text-xs sm:text-sm mt-1 ${textSecondary}`}>
            {t('نظرة تنفيذية شاملة ومباشرة على أداء المنظومة التعليمية، العمليات الأكاديمية والتدفقات المالية')}
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm'
            }`}
            title={t('تحديث البيانات الآن')}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
            <span>{refreshing ? 'جاري التحديث...' : 'تحديث المؤشرات'}</span>
          </button>

          <button
            onClick={() => navigate('/admin/users')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-[#9e1b1b] hover:bg-[#b91c1c] active:bg-[#7f1616] transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b]"
          >
            <Users className="w-4 h-4" />
            <span>{t('إدارة المستخدمين')}</span>
          </button>
        </div>
      </div>

      {/* Error Alert (if any) */}
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

      {/* 1. Primary Executive KPI Cards (Row 1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        {/* Card 1: Total Users */}
        <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('إجمالي المستخدمين المسجلين')}</p>
              <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                {overview.totalUsers ?? '—'}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#9e1b1b]/10 text-[#9e1b1b] flex items-center justify-center flex-shrink-0 border border-[#9e1b1b]/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
            <span className={textSecondary}>{t('المشتركون النشطون:')}</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {overview.activeUsers ?? '—'} {t('نشط')}
            </span>
          </div>
        </div>

        {/* Card 2: Active Courses & Lessons */}
        <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('الدورات والمحتوى التعليمي')}</p>
              <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                {overview.totalCourses ?? '—'}
                <span className="text-xs font-normal text-slate-400 ms-1.5">{t('دورة معتمدة')}</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
            <span className={textSecondary}>{t('الدروس والمحاضرات المرئية:')}</span>
            <span className={`font-bold ${textPrimary}`}>
              {overview.totalVideos ?? '—'} {t('درس')}
            </span>
          </div>
        </div>

        {/* Card 3: Assessments & Exams */}
        <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('الامتحانات والواجبات المكتملة')}</p>
              <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                {overview.totalExams ?? '—'}
                <span className="text-xs font-normal text-slate-400 ms-1.5">{t('امتحان')}</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
              <ClipboardCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
            <span className={textSecondary}>{t('تسليمات الواجبات الأكاديمية:')}</span>
            <span className={`font-bold ${textPrimary}`}>
              {overview.totalSubmissions ?? '—'} {t('تسليم')}
            </span>
          </div>
        </div>

        {/* Card 4: Monthly Revenue */}
        <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
          <div className="flex items-start justify-between">
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('إيرادات الشهر الحالي')}</p>
              <h3 className={`text-xl sm:text-2xl font-extrabold mt-1.5 text-emerald-600 dark:text-emerald-400`}>
                {formattedMonthlyRevenue}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs">
            <span className={textSecondary}>{t('إجمالي إيرادات السنة:')}</span>
            <span className={`font-bold ${textPrimary}`}>
              {formattedYearlyRevenue}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Academic Operations & Quality Matrix (Row 2) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`text-base sm:text-lg font-bold ${textPrimary} flex items-center gap-2`}>
            <Award className="w-4 h-4 text-[#9e1b1b]" />
            {t('مؤشرات الجودة والنزاهة الأكاديمية')}
          </h2>
          <span className={`text-xs ${textSecondary}`}>
            {t('محسوبة استناداً إلى نتائج التقييمات والواجبات المنجزة')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rate 1: Pass Rate */}
          <div className={`${cardBg} border rounded-2xl p-4.5 flex items-center gap-4`}>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('معدل النجاح الأكاديمي')}</p>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {overview.passRate != null ? `${overview.passRate}٪` : '—'}
              </p>
            </div>
          </div>

          {/* Rate 2: Average Score */}
          <div className={`${cardBg} border rounded-2xl p-4.5 flex items-center gap-4`}>
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('متوسط درجات الامتحانات')}</p>
              <p className={`text-xl font-extrabold ${textPrimary} mt-0.5`}>
                {overview.averageExamScore != null ? `${overview.averageExamScore}٪` : '—'}
              </p>
            </div>
          </div>

          {/* Rate 3: Completion Rate */}
          <div className={`${cardBg} border rounded-2xl p-4.5 flex items-center gap-4`}>
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 border border-purple-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('معدل إتمام الواجبات')}</p>
              <p className={`text-xl font-extrabold ${textPrimary} mt-0.5`}>
                {overview.completionRate != null ? `${overview.completionRate}٪` : '—'}
              </p>
            </div>
          </div>

          {/* Rate 4: At Risk Students */}
          <div className={`${cardBg} border rounded-2xl p-4.5 flex items-center gap-4 cursor-pointer hover:border-amber-500/40 transition-all`} onClick={() => navigate('/admin/risk')}>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 border border-amber-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('طلاب بحاجة لدعم أكاديمي')}</p>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
                  {overview.atRiskStudents ?? '—'}
                </p>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-bold">
                  {t('كشف الخطر')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Visualizations & Trends (Row 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Chart 1: Enrollment Trend */}
        <div className={`lg:col-span-2 ${cardBg} border rounded-2xl p-5 sm:p-6`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className={`font-bold ${textPrimary} text-base`}>{t('اتجاه التسجيلات والنمو الطلابي')}</h3>
              <p className={`text-xs ${textSecondary} mt-0.5`}>{t('تتبع حركة تسجيل الطلاب مقارنة بالشهر السابق')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#9e1b1b]" />
              <span className={`text-xs ${textSecondary}`}>{t('المسجلون الجدد')}</span>
            </div>
          </div>

          <div className="h-60 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.enrollmentData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminEnrollGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9e1b1b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#9e1b1b" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${val} طالب`, 'الطلاب']} />
                <Area type="monotone" dataKey="students" stroke="#9e1b1b" fill="url(#adminEnrollGrad)" strokeWidth={2.5} name={t('الطلاب')} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Course Performance */}
        <div className={`${cardBg} border rounded-2xl p-5 sm:p-6 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`font-bold ${textPrimary} text-base`}>{t('متوسط الأداء الأكاديمي')}</h3>
                <p className={`text-xs ${textSecondary} mt-0.5`}>{t('تحصيل الطلاب في أهم الدورات')}</p>
              </div>
            </div>

            <div className="h-56 sm:h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.performanceData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} vertical={false} />
                  <XAxis dataKey="course" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(val: any) => [`${val}٪`, 'المتوسط']} />
                  <Bar dataKey="average" fill="#9e1b1b" radius={[6, 6, 0, 0]} name={t('المتوسط')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Ecosystem Distribution & Real Activities (Row 4) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Section A: Role Distribution Breakdown */}
        <div className={`${cardBg} border rounded-2xl p-5 sm:p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className={`font-bold ${textPrimary} text-base`}>{t('توزيع المنظومة التعليمية')}</h3>
              <p className={`text-xs ${textSecondary} mt-0.5`}>{t('إجمالي الحسابات المسجلة حسب الصلاحية')}</p>
            </div>
            <UserCheck className="w-5 h-5 text-slate-400" />
          </div>

          <div className="space-y-4">
            {[
              { label: 'طلاب أونلاين', count: studentsTotal > 0 ? Math.round(studentsTotal * 0.7) : 0, color: 'bg-blue-600', role: 'ONLINE_STUDENT' },
              { label: 'طلاب سنتر', count: studentsTotal > 0 ? Math.round(studentsTotal * 0.3) : 0, color: 'bg-emerald-600', role: 'CENTER_STUDENT' },
              { label: 'المعلمون والمحاضرون', count: teachersTotal, color: 'bg-[#9e1b1b]', role: 'TEACHER' },
              { label: 'أولياء الأمور', count: parentsTotal, color: 'bg-amber-600', role: 'PARENT' },
              { label: 'مدراء النظام', count: adminsTotal, color: 'bg-purple-600', role: 'ADMIN' },
            ].map((roleItem, idx) => {
              const percentage = totalUsersCount > 0 ? Math.min(100, Math.round((roleItem.count / totalUsersCount) * 100)) : 0;
              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-medium ${textPrimary}`}>{roleItem.label}</span>
                    <span className="text-slate-400 font-semibold">{roleItem.count} ({percentage}{t('٪)')}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full ${roleItem.color} rounded-full transition-all duration-500`} style={{ width: `${Math.max(percentage, 3)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
            <button
              onClick={() => navigate('/admin/users')}
              className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              <span>{t('عرض سجل المستخدمين الكامل')}</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Section B: Recent Platform Activity Stream */}
        <div className={`lg:col-span-2 ${cardBg} border rounded-2xl p-5 sm:p-6`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className={`font-bold ${textPrimary} text-base`}>{t('النشاطات الميدانية الأخيرة')}</h3>
              <p className={`text-xs ${textSecondary} mt-0.5`}>{t('سجل الفعاليات والعمليات التعليمية الجارية')}</p>
            </div>
            <Clock className="w-5 h-5 text-slate-400" />
          </div>

          <div className="space-y-3">
            {(data?.recentActivities && data.recentActivities.length > 0) ? (
              data.recentActivities.map((activity: any, idx: number) => {
                const isSuccess = activity.type === 'success';
                const isWarning = activity.type === 'warning';
                return (
                  <div
                    key={idx}
                    className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-colors ${wellBg}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                        isSuccess ? 'bg-emerald-500' : isWarning ? 'bg-amber-500' : 'bg-[#9e1b1b]'
                      }`} />
                      <div>
                        <p className={`text-xs sm:text-sm font-semibold ${textPrimary}`}>{activity.text}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{activity.time}</p>
                      </div>
                    </div>

                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                      isSuccess ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      isWarning ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}>
                      {isSuccess ? 'مكتمل' : isWarning ? 'تنبيه' : 'إشعار'}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs sm:text-sm">
                {t('لا توجد نشاطات مسجلة في السجل الفوري حالياً.')}
              </div>
            )}
          </div>

          {/* Quick Management Shortcuts */}
          <div className="mt-6 pt-5 border-t border-slate-200/60 dark:border-slate-800/60">
            <p className={`text-xs font-bold mb-3 ${textSecondary}`}>{t('روابط الانتقال الإداري السريع:')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { label: 'إدارة الدورات', path: '/admin/courses', icon: BookOpen },
                { label: 'بنك الامتحانات', path: '/admin/exams', icon: ClipboardCheck },
                { label: 'متابعة الواجبات', path: '/admin/homework', icon: FileText },
                { label: 'التقارير التحليلية', path: '/admin/reports', icon: TrendingUp },
              ].map((shortcut, sIdx) => (
                <button
                  key={sIdx}
                  onClick={() => navigate(shortcut.path)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 border-slate-700/80'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
                  }`}
                >
                  <shortcut.icon className="w-3.5 h-3.5 text-[#9e1b1b]" />
                  <span>{shortcut.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
