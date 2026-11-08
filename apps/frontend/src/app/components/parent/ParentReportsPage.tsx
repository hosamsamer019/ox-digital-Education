import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  Award,
  Target,
  RefreshCw,
  AlertCircle,
  FileText,
  Calendar
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { analyticsService } from '../../services/analytics.service';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';
import { useSelectedChild } from './useSelectedChild';
import { ChildSelector } from './ChildSelector';

export const ParentReportsPage: React.FC = () => {
  const { t } = useLanguage();
  const { isDark } = useTheme();

  const {
    children,
    selectedChild,
    selectedChildId,
    selectChild,
    loading: childrenLoading,
    error: childrenError,
    refetchChildren,
  } = useSelectedChild();

  const [childData, setChildData] = useState<any>(null);
  const [reportsLoading, setReportsLoading] = useState<boolean>(false);
  const [reportsError, setReportsError] = useState<string | null>(null);

  // Stale request protection
  const activeChildIdRef = useRef<string | null>(null);

  const cardBg = isDark
    ? 'bg-[#0f131d] border-slate-800/90 shadow-lg shadow-black/20'
    : 'bg-white border-slate-200/90 shadow-sm';
  const wellBg = isDark
    ? 'bg-[#161c28]/70 border-slate-800/60'
    : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  const tooltipStyle = {
    backgroundColor: isDark ? '#0f131d' : '#ffffff',
    borderColor: isDark ? '#1e293b' : '#e2e8f0',
    borderRadius: '0.75rem',
    color: isDark ? '#f8fafc' : '#0f172a',
    fontSize: '0.75rem',
    fontFamily: 'inherit',
    direction: 'rtl' as const,
  };

  const fetchReports = useCallback(async (childId: string) => {
    activeChildIdRef.current = childId;
    setReportsLoading(true);
    setReportsError(null);

    try {
      const res = await analyticsService.getParentChildOverview(childId);

      // Check if childId is still active
      if (activeChildIdRef.current !== childId) return;

      if (res && res.data) {
        setChildData(res.data);
      } else {
        setChildData(null);
        setReportsError(t('تعذر تحميل التقارير الأكاديمية للطالب المحدد.'));
      }
    } catch (err: any) {
      if (activeChildIdRef.current === childId) {
        console.error('Failed to fetch child reports:', err);
        setReportsError(t('حدث خطأ أثناء الاتصال بالخادم لجلب التقارير.'));
      }
    } finally {
      if (activeChildIdRef.current === childId) {
        setReportsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      fetchReports(selectedChildId);
    } else {
      setChildData(null);
    }
  }, [selectedChildId, fetchReports]);

  if (childrenLoading) {
    return <LoadingState message={t('جاري تحميل قائمة الأبناء والتقارير...')} />;
  }

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-sans`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              {t('التقارير والتحليلات البيانية')}
            </span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
            {t('التقارير التحليلية لمستوى الطالب')}
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            {t('رصد بياني لمسار درجات الاختبارات، إنجاز الواجبات، ومؤشرات التطور الأكاديمي')}
          </p>
        </div>

        {selectedChildId && (
          <button
            onClick={() => fetchReports(selectedChildId)}
            disabled={reportsLoading}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer self-start sm:self-auto ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${reportsLoading ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
            <span>{t('تحديث التقارير')}</span>
          </button>
        )}
      </div>

      {childrenError && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{t(childrenError)}</p>
            <button
              onClick={() => refetchChildren()}
              className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
            >
              {t('إعادة المحاولة')}
            </button>
          </div>
        </div>
      )}

      {children.length === 0 && !childrenLoading && !childrenError ? (
        <div className="my-8">
          <EmptyState
            message={t('لا يوجد أبناء مسجلين بحسابك')}
            subMessage={t('يرجى مراجعة إدارة المنظومة التعليمية لربط الحسابات الأكاديمية لأبنائك.')}
          />
        </div>
      ) : (
        <>
          {/* Child Selector */}
          <ChildSelector
            childrenList={children}
            selectedChildId={selectedChildId}
            onSelectChild={selectChild}
          />

          {reportsError && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{reportsError}</p>
                {selectedChildId && (
                  <button
                    onClick={() => fetchReports(selectedChildId)}
                    className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
                  >
                    {t('إعادة تحميل التقارير')}
                  </button>
                )}
              </div>
            </div>
          )}

          {reportsLoading ? (
            <div className={`${cardBg} border rounded-2xl p-10 text-center mb-8`}>
              <RefreshCw className="w-8 h-8 text-[#9e1b1b] animate-spin mx-auto mb-3" />
              <p className={`text-sm font-semibold ${textPrimary}`}>{t('جاري توليد الرسوم والتقارير الأكاديمية...')}</p>
            </div>
          ) : (
            childData && (
              <>
                {/* 3 Verified Metric Cards (Rank card removed per Decision 3) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  {/* Card 1: Overall Average */}
                  <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-xs font-semibold ${textSecondary}`}>{t('متوسط درجات التقييمات المعتمدة')}</p>
                        <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                          {childData?.overview?.overallRate != null
                            ? childData.overview.overallRate
                            : '—'}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-[#9e1b1b]/10 text-[#9e1b1b] flex items-center justify-center flex-shrink-0 border border-[#9e1b1b]/20">
                        <Award className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50">
                      {childData?.overview?.overallRate != null
                        ? 'متوسط نتائج الاختبارات والواجبات المصححة'
                        : 'لا توجد تقييمات مصححة مسجلة بعد'}
                    </p>
                  </div>

                  {/* Card 2: Exams */}
                  <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-xs font-semibold ${textSecondary}`}>{t('إجمالي الاختبارات')}</p>
                        <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                          {childData?.overview?.examsCompleted ?? '—'}
                          <span className="text-xs font-normal text-slate-400 ms-1.5">{t('اختبار')}</span>
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50">
                      {t('اختبارات إلكترونية وميدانية منجزة')}
                    </p>
                  </div>

                  {/* Card 3: Homework */}
                  <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-xs font-semibold ${textSecondary}`}>{t('إجمالي تسليمات الواجبات')}</p>
                        <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                          {childData?.overview?.homeworksCompleted ?? '—'}
                          <span className="text-xs font-normal text-slate-400 ms-1.5">{t('واجب')}</span>
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                        <Target className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50">
                      {t('تطبيقات أسبوعية تم تصحيحها')}
                    </p>
                  </div>
                </div>

                {/* Analytical Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Chart 1: Exams Bar Chart */}
                  <div className={`${cardBg} border rounded-2xl p-5 sm:p-6`}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#9e1b1b]" />
                      <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                        {t('تطور درجات الامتحانات')}
                      </h2>
                    </div>

                    {childData.charts?.examResults && childData.charts.examResults.length > 0 ? (
                      <div className="w-full h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={childData.charts.examResults} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                            <XAxis
                              dataKey="name"
                              stroke={isDark ? '#64748b' : '#94a3b8'}
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              domain={[0, 100]}
                              stroke={isDark ? '#64748b' : '#94a3b8'}
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="score" fill="#9e1b1b" radius={[6, 6, 0, 0]} barSize={26} name={t('الدرجة')} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[260px] text-xs sm:text-sm text-slate-400">
                        {t('لا توجد نتائج اختبارات مسجلة بعد لهذا الطالب.')}
                      </div>
                    )}
                  </div>

                  {/* Chart 2: Homework Line Chart */}
                  <div className={`${cardBg} border rounded-2xl p-5 sm:p-6`}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                        {t('مسار درجات الواجبات والتطبيقات')}
                      </h2>
                    </div>

                    {childData.charts?.homeworkResults && childData.charts.homeworkResults.length > 0 ? (
                      <div className="w-full h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={childData.charts.homeworkResults} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                            <XAxis
                              dataKey="name"
                              stroke={isDark ? '#64748b' : '#94a3b8'}
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              domain={[0, 100]}
                              stroke={isDark ? '#64748b' : '#94a3b8'}
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Line
                              type="monotone"
                              dataKey="score"
                              stroke="#10b981"
                              strokeWidth={3}
                              dot={{ r: 4, strokeWidth: 2, fill: isDark ? '#0f131d' : '#ffffff' }}
                              activeDot={{ r: 6 }}
                              name={t('الدرجة')}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-[260px] text-xs sm:text-sm text-slate-400">
                        {t('لا توجد نتائج واجبات مسجلة بعد لهذا الطالب.')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Results Table Section (Dead review button column removed per Decision 3) */}
                <div className={`${cardBg} border rounded-2xl p-5 sm:p-6 mb-8`}>
                  <div className="flex items-center gap-2 mb-5">
                    <FileText className="w-5 h-5 text-[#9e1b1b]" />
                    <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                      {t('سجل النتائج التفصيلي')}
                    </h2>
                  </div>

                  {childData.recent && childData.recent.length > 0 ? (
                    <>
                      {/* Desktop Table View (hidden on mobile) */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-right text-xs sm:text-sm">
                          <thead>
                            <tr className={`border-b ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                              <th className="py-3 px-4 font-bold">{t('عنوان التقييم')}</th>
                              <th className="py-3 px-4 font-bold">{t('النوع')}</th>
                              <th className="py-3 px-4 font-bold">{t('الدرجة')}</th>
                              <th className="py-3 px-4 font-bold">{t('تاريخ التسليم')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {childData.recent.map((result: any, idx: number) => {
                              const isExam = result.type === 'exam' || result.type === 'امتحان';
                              const isPending = result.score == null || result.status === 'PENDING_GRADING';
                              const score = isPending ? null : Number(result.score);
                              const isHigh = score !== null && score >= 85;
                              const isMid = score !== null && score >= 65 && score < 85;

                              return (
                                <tr
                                  key={idx}
                                  className={`border-b transition-colors ${
                                    isDark
                                      ? 'border-slate-800/60 hover:bg-slate-800/40'
                                      : 'border-slate-100 hover:bg-slate-50/70'
                                  }`}
                                >
                                  <td className={`py-3.5 px-4 font-bold ${textPrimary}`}>
                                    {result.title}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                        isExam
                                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                      }`}
                                    >
                                      {isExam ? 'امتحان' : 'واجب'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    {isPending ? (
                                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        {t('قيد التصحيح')}
                                      </span>
                                    ) : (
                                      <span
                                        className={`font-extrabold ${
                                          isHigh
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : isMid
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-red-600 dark:text-red-400'
                                        }`}
                                      >
                                        {score}
                                      </span>
                                    )}
                                  </td>
                                  <td className={`py-3.5 px-4 text-xs ${textSecondary}`}>
                                    {result.date}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Stacked Cards View (shown on mobile to prevent clipping) */}
                      <div className="sm:hidden space-y-3">
                        {childData.recent.map((result: any, idx: number) => {
                          const isExam = result.type === 'exam' || result.type === 'امتحان';
                          const isPending = result.score == null || result.status === 'PENDING_GRADING';
                          const score = isPending ? null : Number(result.score);
                          const isHigh = score !== null && score >= 85;
                          const isMid = score !== null && score >= 65 && score < 85;

                          return (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border transition-colors ${wellBg}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span
                                    className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold mb-1.5 ${
                                      isExam
                                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    }`}
                                  >
                                    {isExam ? 'امتحان' : 'واجب'}
                                  </span>
                                  <h4 className={`text-xs font-bold ${textPrimary}`}>
                                    {result.title}
                                  </h4>
                                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>{result.date}</span>
                                  </p>
                                </div>

                                {isPending ? (
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    {t('قيد التصحيح')}
                                  </span>
                                ) : (
                                  <span
                                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                                      isHigh
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                        : isMid
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                    }`}
                                  >
                                    {score}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-10 text-xs sm:text-sm text-slate-400">
                      {t('لا توجد سجلات نتائج متوفرة لهذا الطالب حالياً.')}
                    </div>
                  )}
                </div>
              </>
            )
          )}
        </>
      )}
    </div>
  );
};

export default ParentReportsPage;
