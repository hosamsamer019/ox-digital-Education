import { useLanguage, t } from '../../contexts/LanguageContext';
import { useEffect, useState, useCallback } from 'react';
import { userService } from '../../services/user.service';
import {
  Calendar, CheckCircle, XCircle, Clock, AlertCircle,
  RefreshCw, BarChart3, UserCheck, Sparkles, ChevronLeft
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { LoadingState } from '../ui/LoadingState';

export default function AttendancePage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [attendances, setAttendances] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    totalSessions: 0,
    presentCount: 0,
    absentCount: 0,
    lateCount: 0,
    percentage: null
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttendance = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await userService.getAttendance();
      if (res && res.data && Array.isArray(res.data)) {
        setAttendances(res.data);
        if (res.summary) {
          setSummary(res.summary);
        } else {
          computeFallbackSummary(res.data);
        }
      } else if (Array.isArray(res)) {
        setAttendances(res);
        computeFallbackSummary(res);
      } else {
        setAttendances([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch attendance', err);
      setError(t('فشل في تحميل سجل الحضور والغياب من الخادم. يرجى إعادة المحاولة.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const computeFallbackSummary = (records: any[]) => {
    const total = records.length;
    const present = records.filter((r: any) => r.status === 'PRESENT').length;
    const absent = records.filter((r: any) => r.status === 'ABSENT').length;
    const late = records.filter((r: any) => r.status === 'LATE').length;
    // LATE counts as attended semantically
    const pct = total > 0 ? Math.round(((present + late) / total) * 100) : null;
    setSummary({
      totalSessions: total,
      presentCount: present,
      absentCount: absent,
      lateCount: late,
      percentage: pct
    });
  };

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-xs';
  const tableHeaderBg = isDark ? 'bg-[#161c28]/90' : 'bg-slate-50';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  if (loading) {
    return <LoadingState message={t('جاري تحميل سجل حضور وغياب السنتر...')} />;
  }

  const attendanceRate = summary.percentage;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
              <UserCheck className="w-3.5 h-3.5" /> {t('المتابعة الميدانية')}
            </span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} tracking-tight`}>
            {t('سجل الحضور والغياب الميداني')}
          </h1>
          <p className={`text-sm ${textSecondary} mt-1`}>
            {t('متابعة دقيقة وتفصيلية لحضورك في حصص ومحاضرات المركز التعليمي.')}
          </p>
        </div>

        <button
          onClick={() => fetchAttendance(true)}
          disabled={refreshing}
          className={`self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-xs ${
            isDark
              ? 'bg-[#161c28] hover:bg-[#1f2737] text-slate-200 border border-slate-800'
              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
          <span>{t('تحديث السجل')}</span>
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
            onClick={() => fetchAttendance(true)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            {t('إعادة المحاولة')}
          </button>
        </div>
      )}

      {/* 5 Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Sessions */}
        <div className={`${cardBg} rounded-2xl p-4 sm:p-5 border relative overflow-hidden`}>
          <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>{t('إجمالي الحصص')}</span>
          </div>
          <p className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} tracking-tight`}>
            {summary.totalSessions}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{t('المحاضرات المقررة')}</p>
        </div>

        {/* Present Count */}
        <div className={`${cardBg} rounded-2xl p-4 sm:p-5 border relative overflow-hidden`}>
          <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <CheckCircle className="w-4 h-4" />
            <span>{t('حاضر في الموعد')}</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {summary.presentCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{t('حصة مسجلة')}</p>
        </div>

        {/* Absent Count */}
        <div className={`${cardBg} rounded-2xl p-4 sm:p-5 border relative overflow-hidden`}>
          <div className="flex items-center gap-2 mb-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
            <XCircle className="w-4 h-4" />
            <span>{t('غائب')}</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
            {summary.absentCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{t('حصة فائتة')}</p>
        </div>

        {/* Late Count */}
        <div className={`${cardBg} rounded-2xl p-4 sm:p-5 border relative overflow-hidden`}>
          <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400 text-xs font-bold">
            <Clock className="w-4 h-4" />
            <span>{t('حضور متأخر')}</span>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight">
            {summary.lateCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">{t('يحتسب ضمن الحضور')}</p>
        </div>

        {/* Attendance Rate */}
        <div className={`${cardBg} rounded-2xl p-4 sm:p-5 border col-span-2 sm:col-span-2 lg:col-span-1 relative overflow-hidden`}>
          <div className="flex items-center gap-2 mb-2 text-[#9e1b1b] dark:text-red-400 text-xs font-bold">
            <BarChart3 className="w-4 h-4" />
            <span>{t('نسبة الحضور')}</span>
          </div>
          <p
            className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
              attendanceRate !== null && attendanceRate >= 75
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-[#9e1b1b] dark:text-red-400'
            }`}
          >
            {attendanceRate !== null ? `${attendanceRate}٪` : '—'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {attendanceRate !== null && attendanceRate >= 75 ? 'معدل انضباط ممتاز' : 'يحتاج إلى تحسين'}
          </p>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className={`${cardBg} rounded-2xl border overflow-hidden`}>
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className={`text-lg font-bold ${textPrimary}`}>{t('سجل الحصص التفصيلي')}</h2>
            <p className={`text-xs ${textSecondary}`}>{t('تفاصيل تواريخ الحضور وحالة كل حصة دراسية')}</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg font-bold">
              <CheckCircle className="w-3.5 h-3.5" /> {t('حاضر')}
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg font-bold">
              <Clock className="w-3.5 h-3.5" /> {t('متأخر')}
            </span>
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-lg font-bold">
              <XCircle className="w-3.5 h-3.5" /> {t('غائب')}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-right">
            <thead>
              <tr className={`border-b border-slate-100 dark:border-slate-800 ${tableHeaderBg}`}>
                <th className="py-3.5 px-6 text-xs font-bold text-slate-400">{t('تاريخ الحصة')}</th>
                <th className="py-3.5 px-6 text-xs font-bold text-slate-400">{t('اليوم')}</th>
                <th className="py-3.5 px-6 text-xs font-bold text-slate-400">{t('حالة الحضور')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {attendances.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-slate-400 text-sm">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                    {t('لا يوجد سجل حضور مسجل حتى الآن.')}
                  </td>
                </tr>
              ) : (
                attendances.map((record) => {
                  const recDate = new Date(record.date);
                  const isPresent = record.status === 'PRESENT';
                  const isLate = record.status === 'LATE';

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-500/5 transition-colors"
                    >
                      <td className="py-4 px-6 text-sm font-medium">
                        <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100 font-mono">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{isNaN(recDate.getTime()) ? '-' : recDate.toLocaleDateString('ar-EG')}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-300">
                        {isNaN(recDate.getTime()) ? '-' : recDate.toLocaleDateString('ar-EG', { weekday: 'long' })}
                      </td>
                      <td className="py-4 px-6">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold">
                            <CheckCircle className="w-3.5 h-3.5" /> {t('حاضر')}
                          </span>
                        ) : isLate ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-xs font-bold">
                            <Clock className="w-3.5 h-3.5" /> {t('متأخر')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full text-xs font-bold">
                            <XCircle className="w-3.5 h-3.5" /> {t('غائب')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
