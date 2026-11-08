import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Download, AlertTriangle, Award, Target,
  BookOpen, Users, RefreshCw, AlertCircle, Printer
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { analyticsService } from '../../services/analytics.service';
import { LoadingState } from '../ui/LoadingState';

export default function TeacherAnalyticsPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [riskStudents, setRiskStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-xs';
  const wellBg = isDark ? 'bg-[#161c28]/70 border-slate-800/60' : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  const fetchAnalytics = useCallback(async (isManual = false) => {
    if (!user?.id) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [analyticsRes, riskRes] = await Promise.all([
        analyticsService.getTeacherAnalytics(user.id),
        analyticsService.getRiskAnalytics().catch(() => ({ data: { riskStudents: [] } }))
      ]);

      setAnalyticsData(analyticsRes.data);
      const risks = riskRes?.data?.riskStudents || (Array.isArray(riskRes?.data) ? riskRes.data : []);
      setRiskStudents(risks);
    } catch (err: any) {
      console.error('Failed to fetch teacher analytics:', err);
      setError(t('تعذر تحميل بيانات التحليلات الأكاديمية. يرجى المحاولة مرة أخرى.'));
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <LoadingState message={t('جاري تحليل البيانات الأكاديمية وتقارير المقررات...')} />;
  }

  const kpis = [
    {
      label: 'إجمالي الطلاب المسجلين',
      value: analyticsData?.totalStudents != null ? analyticsData.totalStudents : '—',
      icon: Users,
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
    },
    {
      label: 'المقررات الدراسية النشطة',
      value: analyticsData?.totalCourses != null ? analyticsData.totalCourses : '—',
      icon: BookOpen,
      color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'
    },
    {
      label: 'متوسط درجات التقييمات',
      value: analyticsData?.averageScore != null ? analyticsData.averageScore : '—',
      icon: Award,
      color: 'bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20'
    },
    {
      label: 'طلاب بحاجة لدعم ومتابعة',
      value: analyticsData?.strugglingStudents ?? 0,
      icon: AlertTriangle,
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
    },
  ];

  const subjectPerformance = analyticsData?.subjectPerformance || [];
  const distributionData = analyticsData?.distributionData || [];

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-sans`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              {t('التقارير الأكاديمية')}
            </span>
            <span className="text-xs text-slate-400">{t('تحليلات الأداء والتحصيل المعتمدة')}</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
            {t('التحليلات ومؤشرات الأداء')}
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            {t('رؤى إحصائية واقعية مبنية حصراً على بيانات نتائج امتحانات وواجبات طلابك')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
            <span>{t('تحديث البيانات')}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#9e1b1b] hover:bg-[#851616] text-white shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{t('طباعة التقرير')}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => fetchAnalytics(true)}
              className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
            >
              {t('إعادة المحاولة')}
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi, idx) => (
          <div
            key={idx}
            className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-xs font-semibold ${textSecondary}`}>{kpi.label}</p>
                <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                  {kpi.value}
                </h3>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Subject Performance Bar Chart */}
        <div className={`lg:col-span-2 ${cardBg} border rounded-2xl p-5 sm:p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                {t('متوسط درجات الطلاب حسب المقرر')}
              </h2>
              <p className={`text-xs ${textSecondary}`}>
                {t('النتائج الحقيقية المجمعة للامتحانات في كل دورة دراسية')}
              </p>
            </div>
          </div>

          {subjectPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={subjectPerformance} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                <YAxis dataKey="subject" type="category" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} width={120} />
                <RechartsTooltip
                  formatter={(val: any) => [`${val}`, 'متوسط الدرجات']}
                  contentStyle={{
                    background: isDark ? '#0f131d' : '#fff',
                    border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
                    borderRadius: 12
                  }}
                />
                <Bar dataKey="avg" fill="#9e1b1b" radius={[0, 6, 6, 0]} name={t('المتوسط')} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-16 text-slate-400 text-xs sm:text-sm">
              {t('لا توجد بيانات مقررات أو درجات امتحانات مسجلة بعد.')}
            </div>
          )}
        </div>

        {/* Student Level Distribution Pie Chart */}
        <div className={`${cardBg} border rounded-2xl p-5 sm:p-6`}>
          <h2 className={`font-bold text-base sm:text-lg ${textPrimary} mb-1`}>
            {t('توزيع المستويات الأكاديمية')}
          </h2>
          <p className={`text-xs ${textSecondary} mb-4`}>
            {t('تصنيف أداء الطلاب في امتحاناتك')}
          </p>

          {distributionData.length > 0 && distributionData.some((d: any) => d.value > 0) ? (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                  >
                    {distributionData.map((entry: any, index: number) => (
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
              <div className="space-y-2 mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-800/50">
                {distributionData.map((item: any, idx: number) => (
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
            <div className="text-center py-12 text-slate-400 text-xs sm:text-sm">
              {t('لا توجد درجات كافية لحساب التوزيع.')}
            </div>
          )}
        </div>
      </div>

      {/* Real At-Risk Students Evaluation Table (Replaces fabricated AI Predictions) */}
      <div className={`${cardBg} border rounded-2xl p-5 sm:p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                {t('سجل متابعة الطلاب المتعثرين')}
              </h2>
              <p className={`text-xs ${textSecondary}`}>
                {t('تقييم حقيقي لحالات تدني درجات الامتحانات والواجبات غير المسلمة')}
              </p>
            </div>
          </div>
        </div>

        {riskStudents.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs sm:text-sm">
            {t('لا توجد حالات تعثر أكاديمي مسجلة بين طلابك حالياً.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead>
                <tr className={`border-b ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                  <th className="py-3 px-3 font-semibold">{t('اسم الطالب')}</th>
                  <th className="py-3 px-3 font-semibold">{t('نوع التسجيل')}</th>
                  <th className="py-3 px-3 font-semibold">{t('متوسط الدرجات')}</th>
                  <th className="py-3 px-3 font-semibold">{t('درجة الخطورة')}</th>
                  <th className="py-3 px-3 font-semibold">{t('أسباب المتابعة')}</th>
                </tr>
              </thead>
              <tbody>
                {riskStudents.map((s: any) => (
                  <tr
                    key={s.id}
                    className={`border-b transition-colors ${
                      isDark
                        ? 'border-slate-800/60 hover:bg-slate-800/30'
                        : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <td className={`py-3 px-3 font-bold ${textPrimary}`}>{s.name}</td>
                    <td className={`py-3 px-3 text-xs ${textSecondary}`}>{s.grade || s.type || 'طالب'}</td>
                    <td className={`py-3 px-3 font-mono font-bold ${
                      s.avg < 50 ? 'text-red-500' : 'text-amber-500'
                    }`}>
                      {s.avg != null ? s.avg : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        s.risk === 'حرج'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                          : s.risk === 'عالي'
                          ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {s.risk}
                      </span>
                    </td>
                    <td className={`py-3 px-3 text-xs ${textSecondary}`}>
                      {Array.isArray(s.reasons) ? s.reasons.join(' • ') : 'أداء بحاجة للمتابعة'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
