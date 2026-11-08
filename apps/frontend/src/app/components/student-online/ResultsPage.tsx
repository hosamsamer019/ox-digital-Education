import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Award, Target, Download, CheckCircle2, ChevronLeft, AlertCircle } from 'lucide-react';
import { analyticsService } from '../../services/analytics.service';
import { useTheme } from '../../contexts/ThemeContext';
import { LoadingState } from '../ui/LoadingState';

export default function ResultsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<{
    gpa: number;
    attendanceRate: number;
    completedAssignments: number;
    rank: number | null;
    academic?: any;
  }>({
    gpa: 0,
    attendanceRate: 0,
    completedAssignments: 0,
    rank: null
  });

  const [performanceData, setPerformanceData] = useState<{ month: string; score: number }[]>([]);
  const [subjectProgress, setSubjectProgress] = useState<{ subject: string; progress: number }[]>([]);
  const [recentResults, setRecentResults] = useState<any[]>([]);

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-xs';
  const wellBg = isDark ? 'bg-[#161c28]/70 border-slate-800/60' : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewRes, chartsRes, recentRes] = await Promise.all([
        analyticsService.getStudentOverview().catch(() => ({ data: null })),
        analyticsService.getStudentCharts().catch(() => ({ data: null })),
        analyticsService.getStudentRecent().catch(() => ({ data: [] }))
      ]);

      if (overviewRes?.data) {
        const rawRank = overviewRes.data.rank;
        const validRank = typeof rawRank === 'number' && rawRank > 0 ? rawRank : null;
        setOverview({
          gpa: typeof overviewRes.data.gpa === 'number' ? overviewRes.data.gpa : 0,
          attendanceRate: typeof overviewRes.data.attendanceRate === 'number' ? overviewRes.data.attendanceRate : 0,
          completedAssignments: typeof overviewRes.data.completedAssignments === 'number' ? overviewRes.data.completedAssignments : 0,
          rank: validRank,
          academic: overviewRes.data.academic
        });
      }

      if (chartsRes?.data) {
        const perf = Array.isArray(chartsRes.data.performanceData) ? chartsRes.data.performanceData : [];
        const subj = Array.isArray(chartsRes.data.subjectProgress) ? chartsRes.data.subjectProgress : [];
        setPerformanceData(perf.filter((p: any) => p.month !== 'لا توجد بيانات'));
        setSubjectProgress(subj.filter((s: any) => s.subject !== 'لا توجد بيانات'));
      }

      const recent = Array.isArray(recentRes?.data) ? recentRes.data : [];
      setRecentResults(recent);
    } catch (err: any) {
      console.error('Failed to fetch analytics', err);
      setError(t('تعذر تحميل سجل النتائج الأكاديمية. يرجى إعادة المحاولة.'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #report-content, #report-content * { visibility: visible; }
        #report-content { position: absolute; left: 0; top: 0; width: 100%; }
        .recharts-wrapper { max-width: 100% !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    }, 1000);
  };

  if (loading) {
    return <LoadingState message={t('جاري إعداد تقرير النتائج الأكاديمية...')} />;
  }

  const gpaPercentage = Math.round((overview.gpa / 4.0) * 100);

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo'] font-sans`}
      dir="rtl"
    >
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              {t('التقارير الأكاديمية')}
            </span>
            <span className="text-xs text-slate-400">{t('سجل الدرجات والأداء التحصيلي')}</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
            {t('النتائج والتقارير')}
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            {t('سجل تقييماتك الدورية ونسب إتقان المفاهيم في المقررات المسجلة')}
          </p>
        </div>

        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 bg-[#9e1b1b] hover:bg-[#851717] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>{t('طباعة / تصدير التقرير (PDF)')}</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <button onClick={fetchAnalytics} className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400">
              {t('إعادة المحاولة')}
            </button>
          </div>
        </div>
      )}

      <div id="report-content" className="space-y-8">
        {/* KPI Row (4 Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-[#9e1b1b]`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${textSecondary}`}>{t('المعدل التراكمي (GPA)')}</span>
              <TrendingUp className="w-4 h-4 text-[#9e1b1b]" />
            </div>
            <div className={`text-2xl font-extrabold ${textPrimary} font-sans`}>
              {overview.gpa.toFixed(1)} / 4.0
            </div>
            <p className={`text-xs ${textSecondary} mt-1`}>
              {gpaPercentage > 0 ? `يعادل تقريباً ${gpaPercentage}%` : 'بانتظار مزيد من التقييمات'}
            </p>
          </div>

          <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-emerald-600`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${textSecondary}`}>{t('نسبة الالتزام بالحضور')}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-500 font-sans">
              {overview.attendanceRate}%
            </div>
            <p className={`text-xs ${textSecondary} mt-1`}>{t('سجل الحضور في الحصص والمحاضرات')}</p>
          </div>

          <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-blue-600`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${textSecondary}`}>{t('المهام المنجزة')}</span>
              <Award className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-extrabold text-blue-500 font-sans">
              {overview.completedAssignments}
            </div>
            <p className={`text-xs ${textSecondary} mt-1`}>{t('إجمالي الامتحانات والواجبات المسلمة')}</p>
          </div>

          <div className={`${cardBg} border rounded-2xl p-5 border-r-4 border-r-amber-600`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${textSecondary}`}>{t('المستوى الأكاديمي')}</span>
              <Target className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-extrabold text-amber-500 font-sans">
              {gpaPercentage >= 85 ? 'ممتاز' : gpaPercentage >= 65 ? 'جيد جداً' : 'قيد التطوير'}
            </div>
            <p className={`text-xs ${textSecondary} mt-1`}>{t('بناءً على التقييمات المعتمدة')}</p>
          </div>
        </div>

        {/* OD-01 & OD-02: Independent Academic Assessment Dimension */}
        <div className={`${cardBg} border rounded-2xl p-6 relative overflow-hidden`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#9e1b1b]/10 flex items-center justify-center text-[#9e1b1b]">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-base font-bold ${textPrimary}`}>
                    {t('التقييم الأكاديمي (البعد المستقل)')}
                  </h3>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    overview.academic?.status === 'AVAILABLE'
                      ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                      : overview.academic?.status === 'PERIOD_CONFIGURATION_REQUIRED'
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      : overview.academic?.status === 'BLOCKED_PENDING_POLICY'
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      : overview.academic?.status === 'BLOCKED_UNVERIFIABLE_COMPLETION'
                      ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  }`}>
                    {overview.academic?.status === 'AVAILABLE'
                      ? (overview.academic?.periodStatus === 'SPECIFIED' && overview.academic?.rollingDays
                          ? `متاح (نافذة متجددة: ${overview.academic.rollingDays} يوم)`
                          : 'متاح (فترة غير محددة)')
                      : overview.academic?.status === 'PERIOD_CONFIGURATION_REQUIRED'
                      ? 'معلق (إعداد الفترة)'
                      : overview.academic?.status === 'BLOCKED_PENDING_POLICY'
                      ? 'معلق (سياسة الإعادة)'
                      : overview.academic?.status === 'BLOCKED_UNVERIFIABLE_COMPLETION'
                      ? 'غير قابل للتحقق'
                      : 'بيانات غير كافية'}
                  </span>
                </div>
                <p className={`text-xs ${textSecondary} mt-0.5`}>
                  {t('المتوسط الحسابي البسيط للاختبارات المؤهلة (OD-01 و OD-02)')}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              {overview.academic?.status === 'AVAILABLE' && overview.academic.average !== null ? (
                <div>
                  <div className={`text-2xl font-black ${textPrimary} font-sans`}>
                    {overview.academic.average}%
                  </div>
                  <span className="text-xs font-medium text-blue-600">
                    {overview.academic?.periodStatus === 'SPECIFIED' && overview.academic?.rollingDays
                      ? `متوسط حسابي (نافذة متجددة: ${overview.academic.rollingDays} يوم)`
                      : 'متوسط حسابي (فترة غير محددة)'}
                  </span>
                </div>
              ) : overview.academic?.status === 'PERIOD_CONFIGURATION_REQUIRED' ? (
                <div>
                  <div className="text-sm font-bold text-amber-600">
                    {t('معلق (إعداد الفترة)')}
                  </div>
                  <span className={`text-xs ${textSecondary}`}>{t('تتطلب سياسة التقييم تحديد مدة النافذة الزمنية (OD-12)')}</span>
                </div>
              ) : overview.academic?.status === 'BLOCKED_PENDING_POLICY' ? (
                <div>
                  <div className="text-sm font-bold text-amber-600">
                    {t('معلق (قيد الاعتماد)')}
                  </div>
                  <span className={`text-xs ${textSecondary}`}>{t('محاولات إعادة متعددة (OD-11)')}</span>
                </div>
              ) : overview.academic?.status === 'BLOCKED_UNVERIFIABLE_COMPLETION' ? (
                <div>
                  <div className="text-sm font-bold text-rose-600">
                    {t('غير متاح')}
                  </div>
                  <span className={`text-xs ${textSecondary}`}>{t('اكتمال غير موثق')}</span>
                </div>
              ) : (
                <div>
                  <div className="text-sm font-bold text-amber-600">
                    {t('قيد الاحتساب (')}{overview.academic?.eligibleAssessmentCount || 0} / 3)
                  </div>
                  <span className={`text-xs ${textSecondary}`}>{t('يتطلب 3 تقييمات على الأقل')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className={textSecondary}>
              {overview.academic?.explanationAr || (
                overview.academic?.status === 'AVAILABLE'
                  ? `تم احتساب هذا المعدل كمتوسط حسابي مباشر لـ ${overview.academic.eligibleAssessmentCount} تقييمات دراسية مؤهلة دون أي أوزان ترجيحية.`
                  : overview.academic?.status === 'PERIOD_CONFIGURATION_REQUIRED'
                  ? 'تتطلب سياسة النافذة الزمنية المتجددة تحديد مدة النافذة واعتمادها من قبل إدارة النظام (OD-12).'
                  : overview.academic?.status === 'BLOCKED_PENDING_POLICY'
                  ? 'تم رصد محاولات متعددة مكتملة ومصححة لنفس التقييم. التقييم الأكاديمي معلق لحين اعتماد سياسة الإعادة من قبل إدارة النظام (OD-11).'
                  : overview.academic?.status === 'BLOCKED_UNVERIFIABLE_COMPLETION'
                  ? 'لا يمكن التحقق من اكتمال التقييم أو الدرجة العظمى من واقع سجلات الاختبارات في قاعدة البيانات.'
                  : 'لا تتوفر تقييمات كافية حتى الآن. يلزم وجود 3 تقييمات مصححة على الأقل لعرض التقييم الأكاديمي.'
              )}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0 text-slate-400">
              <span>{t('الحد الأدنى المطلوب: 3 تقييمات')}</span>
              <span>•</span>
              <span>{t('التقييمات المكتملة:')} {overview.academic?.eligibleAssessmentCount || 0}</span>
            </div>
          </div>

          {/* Remediation B: Neutral Warning Banner for Unverifiable Attempts */}
          {Boolean(overview.academic?.hasUnverifiableAttempts) && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                {overview.academic?.dataIntegrityNoticeAr ||
                  'توجد محاولات سابقة تعذر التحقق من اكتمالها أو درجاتها، لذلك لا تدخل في حساب المتوسط الأكاديمي.'}
              </span>
            </div>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Performance over time */}
          <div className={`${cardBg} border rounded-2xl p-6`}>
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-[#9e1b1b]" />
              <h2 className={`text-base sm:text-lg font-bold ${textPrimary}`}>
                {t('تطور الأداء الأكاديمي عبر الشهور')}
              </h2>
            </div>

            {performanceData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} />
                    <XAxis
                      dataKey="month"
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#0f131d' : '#ffffff',
                        borderColor: isDark ? '#334155' : '#cbd5e1',
                        borderRadius: '0.75rem',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        fontSize: '12px'
                      }}
                      formatter={(val: any) => [`${val}%`, 'الدرجة']}
                    />
                    <Bar dataKey="score" fill="#9e1b1b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-slate-400 text-xs sm:text-sm">
                <TrendingUp className="w-8 h-8 text-slate-500 mb-2 opacity-50" />
                <p>{t('لا توجد بيانات أداء شهري كافية حتى الآن')}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t('ستظهر المؤشرات فور إتمام امتحانات الفصول.')}</p>
              </div>
            )}
          </div>

          {/* Chart 2: Subject Progress */}
          <div className={`${cardBg} border rounded-2xl p-6`}>
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-5 h-5 text-emerald-500" />
              <h2 className={`text-base sm:text-lg font-bold ${textPrimary}`}>
                {t('متوسط الإتقان حسب المقرر الدراسي')}
              </h2>
            </div>

            {subjectProgress.length > 0 ? (
              <div className="space-y-4">
                {subjectProgress.map((subj, idx) => (
                  <div key={idx} className={`${wellBg} p-4 rounded-xl border`}>
                    <div className="flex items-center justify-between text-xs sm:text-sm mb-2 font-medium">
                      <span className={`font-bold ${textPrimary}`}>{subj.subject}</span>
                      <span className="font-bold text-slate-300 font-sans">{subj.progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800/80 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, subj.progress))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-slate-400 text-xs sm:text-sm">
                <Award className="w-8 h-8 text-slate-500 mb-2 opacity-50" />
                <p>{t('لا توجد بيانات مقررات مسجلة حتى الآن')}</p>
                <p className="text-xs text-slate-500 mt-0.5">{t('سجل في المقررات لحساب نسب الإتقان لكل مادة.')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Results Table */}
        <div className={`${cardBg} border rounded-2xl p-6 sm:p-7`}>
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800/80">
            <h2 className={`text-base sm:text-lg font-bold ${textPrimary}`}>
              {t('سجل التقييمات والنتائج التفصيلية')}
            </h2>
            <span className="text-xs text-slate-400">
              {t('إجمالي السجلات:')} {recentResults.length}
            </span>
          </div>

          {recentResults.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800/80 text-slate-400 font-semibold">
                    <th className="py-3 px-4">{t('عنوان التقييم')}</th>
                    <th className="py-3 px-4">{t('النوع')}</th>
                    <th className="py-3 px-4">{t('الدرجة المحققة')}</th>
                    <th className="py-3 px-4">{t('تاريخ الإنجاز')}</th>
                    <th className="py-3 px-4 text-center">{t('المراجعة الأكاديمية')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {recentResults.map((result, idx) => {
                    const isExam = result.type === 'exam' || result.type === 'امتحان';
                    const score = typeof result.score === 'number' ? result.score : 0;
                    const scoreColor =
                      score >= 85
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : score >= 65
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20';

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className={`py-3.5 px-4 font-bold ${textPrimary}`}>{result.title}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-slate-300">
                            {isExam ? 'امتحان إلكتروني' : 'واجب منزلي'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${scoreColor}`}>
                            {score}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {new Date(result.date || Date.now()).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {result.assessmentId && result.id ? (
                            <button
                              onClick={() => navigate(`/student/online/assessment/${result.assessmentId}/review/${result.id}`)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#9e1b1b] hover:underline cursor-pointer bg-[#9e1b1b]/10 px-3 py-1 rounded-lg border border-[#9e1b1b]/20"
                            >
                              <span>{t('عرض نموذج الإجابة')}</span>
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs sm:text-sm">
              <Award className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-60" />
              <p className="font-semibold text-slate-300">{t('لا توجد سجلات تقييم منجزة حتى الآن')}</p>
              <p className="text-xs mt-0.5">{t('ستظهر جميع الدرجات والواجبات المعتمدة هنا فور إنهائها.')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
