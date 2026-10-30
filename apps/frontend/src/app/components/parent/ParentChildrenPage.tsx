import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TrendingUp,
  CheckCircle,
  BookOpen,
  Award,
  Calendar,
  AlertCircle,
  RefreshCw,
  Clock,
  XCircle,
  UserCheck
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { analyticsService } from '../../services/analytics.service';
import { userService } from '../../services/user.service';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';
import { useSelectedChild } from './useSelectedChild';
import { ChildSelector } from './ChildSelector';

export const ParentChildrenPage: React.FC = () => {
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
  const [childAttendance, setChildAttendance] = useState<{ records: any[]; summary: any } | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

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

  const fetchChildData = useCallback(async (childId: string) => {
    activeChildIdRef.current = childId;
    setDetailsLoading(true);
    setDetailsError(null);
    setAttendanceError(null);

    try {
      const [analyticsRes, attendanceRes] = await Promise.all([
        analyticsService.getParentChildOverview(childId).catch((err) => {
          console.error('Error fetching child analytics:', err);
          return null;
        }),
        userService.getStudentAttendanceById(childId).catch((err) => {
          console.error('Error fetching child attendance:', err);
          return null;
        }),
      ]);

      // Check if childId is still active
      if (activeChildIdRef.current !== childId) return;

      if (analyticsRes && analyticsRes.data) {
        setChildData(analyticsRes.data);
      } else {
        setChildData(null);
        setDetailsError('تعذر تحميل البيانات الأكاديمية للطالب.');
      }

      if (attendanceRes) {
        setChildAttendance({
          records: Array.isArray(attendanceRes.data) ? attendanceRes.data : [],
          summary: attendanceRes.summary || null,
        });
      } else {
        setChildAttendance(null);
        setAttendanceError('تعذر تحميل سجل الحضور للطالب.');
      }
    } catch (err: any) {
      if (activeChildIdRef.current === childId) {
        setDetailsError('حدث خطأ أثناء تحميل تفاصيل الطالب.');
      }
    } finally {
      if (activeChildIdRef.current === childId) {
        setDetailsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      fetchChildData(selectedChildId);
    } else {
      setChildData(null);
      setChildAttendance(null);
    }
  }, [selectedChildId, fetchChildData]);

  if (childrenLoading) {
    return <LoadingState message="جاري تحميل قائمة الأبناء..." />;
  }

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-sans`}
      dir="rtl"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              ملف الطالب التفصيلي
            </span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
            متابعة الأبناء الأكاديمية
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            سجل التحصيل العلمي، أداء الاختبارات، تسليمات الواجبات، وانضباط الحضور والغياب
          </p>
        </div>

        {selectedChildId && (
          <button
            onClick={() => fetchChildData(selectedChildId)}
            disabled={detailsLoading}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer self-start sm:self-auto ${
              isDark
                ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${detailsLoading ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
            <span>تحديث البيانات</span>
          </button>
        )}
      </div>

      {/* Children Fetch Error Banner */}
      {childrenError && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{childrenError}</p>
            <button
              onClick={() => refetchChildren()}
              className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      )}

      {children.length === 0 && !childrenLoading && !childrenError ? (
        <div className="my-8">
          <EmptyState
            message="لا يوجد أبناء مسجلين بحسابك"
            subMessage="يرجى التواصل مع إدارة المدرسة أو المنظومة التعليمية لربط أبنائك بحساب ولي الأمر."
          />
        </div>
      ) : (
        <>
          {/* Reusable Child Selector */}
          <ChildSelector
            childrenList={children}
            selectedChildId={selectedChildId}
            onSelectChild={selectChild}
          />

          {/* Child Details Error */}
          {detailsError && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{detailsError}</p>
                {selectedChildId && (
                  <button
                    onClick={() => fetchChildData(selectedChildId)}
                    className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
                  >
                    إعادة تحميل تقرير الطالب
                  </button>
                )}
              </div>
            </div>
          )}

          {detailsLoading ? (
            <div className={`${cardBg} border rounded-2xl p-10 text-center mb-8`}>
              <RefreshCw className="w-8 h-8 text-[#9e1b1b] animate-spin mx-auto mb-3" />
              <p className={`text-sm font-semibold ${textPrimary}`}>جاري جلب تفاصيل الطالب الأكاديمية...</p>
            </div>
          ) : (
            childData && (
              <>
                {/* 3 Verified Metric Cards (Rank card removed per Decision 3) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  {/* Metric 1: Overall Average */}
                  <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-xs font-semibold ${textSecondary}`}>متوسط درجات التقييمات</p>
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
                        ? 'متوسط نتائج الاختبارات والتطبيقات المصححة'
                        : 'لا توجد تقييمات مصححة مسجلة بعد'}
                    </p>
                  </div>

                  {/* Metric 2: Completed Exams */}
                  <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-xs font-semibold ${textSecondary}`}>الامتحانات المكتملة</p>
                        <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                          {childData?.overview?.examsCompleted ?? '—'}
                          <span className="text-xs font-normal text-slate-400 ms-1.5">امتحان</span>
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50">
                      إجمالي الاختبارات التي أتم الطالب تسليمها
                    </p>
                  </div>

                  {/* Metric 3: Completed Homeworks */}
                  <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-xs font-semibold ${textSecondary}`}>الواجبات والتطبيقات</p>
                        <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                          {childData?.overview?.homeworksCompleted ?? '—'}
                          <span className="text-xs font-normal text-slate-400 ms-1.5">واجب</span>
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50">
                      الواجبات والتطبيقات المنزلية المعتمدة
                    </p>
                  </div>
                </div>

                {/* Section A: Recent Activities */}
                <div className={`${cardBg} border rounded-2xl p-5 sm:p-6 mb-8`}>
                  <div className="flex items-center gap-2 mb-5">
                    <BookOpen className="w-5 h-5 text-[#9e1b1b]" />
                    <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                      الأنشطة والتقييمات الأخيرة
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {childData.recent && childData.recent.length > 0 ? (
                      childData.recent.slice(0, 5).map((act: any, idx: number) => {
                        const isExam = act.type === 'exam' || act.type === 'امتحان';
                        const isPending = act.score == null || act.status === 'PENDING_GRADING';
                        const score = isPending ? null : Number(act.score);
                        const isHigh = score !== null && score >= 85;
                        const isMid = score !== null && score >= 65 && score < 85;

                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${wellBg}`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    isExam
                                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  }`}
                                >
                                  {isExam ? 'امتحان' : 'واجب'}
                                </span>
                                <h3 className={`text-sm font-bold ${textPrimary}`}>{act.title}</h3>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1">{act.date}</p>
                            </div>

                            {isPending ? (
                              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                قيد التصحيح
                              </span>
                            ) : (
                              <div
                                className={`px-3 py-1.5 rounded-xl text-sm font-extrabold ${
                                  isHigh
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : isMid
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                }`}
                              >
                                {score}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className={`text-xs sm:text-sm text-center py-6 ${textSecondary}`}>
                        لا توجد أنشطة أو تقييمات مسجلة لهذا الطالب بعد.
                      </p>
                    )}
                  </div>
                </div>

                {/* Section B: Attendance Records & Summary */}
                <div className={`${cardBg} border rounded-2xl p-5 sm:p-6 mb-8`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-emerald-600" />
                      <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                        سجل الحضور والانضباط المدرسي
                      </h2>
                    </div>

                    {childAttendance?.summary && (
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          حاضر: {childAttendance.summary.presentCount ?? 0}
                        </span>
                        <span className="font-bold text-amber-600 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                          متأخر: {childAttendance.summary.lateCount ?? 0}
                        </span>
                        <span className="font-bold text-red-600 bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20">
                          غائب: {childAttendance.summary.absentCount ?? 0}
                        </span>
                        {childAttendance.summary.percentage != null && (
                          <span className="font-bold text-[#9e1b1b] bg-[#9e1b1b]/10 px-2.5 py-1 rounded-lg border border-[#9e1b1b]/20">
                            نسبة الحضور: {childAttendance.summary.percentage}٪
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {attendanceError && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500">
                      {attendanceError}
                    </div>
                  )}

                  {childAttendance && childAttendance.records.length > 0 ? (
                    <div className="space-y-2.5">
                      {childAttendance.records.slice(0, 8).map((rec: any) => {
                        const recDate = rec.date ? new Date(rec.date) : null;
                        const dateStr =
                          recDate && !isNaN(recDate.getTime())
                            ? recDate.toLocaleDateString('ar-EG')
                            : '—';
                        const dayStr =
                          recDate && !isNaN(recDate.getTime())
                            ? recDate.toLocaleDateString('ar-EG', { weekday: 'long' })
                            : '';

                        return (
                          <div
                            key={rec.id}
                            className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${wellBg}`}
                          >
                            <div className="flex items-center gap-3">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className={`text-xs sm:text-sm font-bold ${textPrimary}`}>
                                  {dateStr}
                                </p>
                                {dayStr && (
                                  <p className="text-[11px] text-slate-400">{dayStr}</p>
                                )}
                              </div>
                            </div>

                            <div>
                              {rec.status === 'PRESENT' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
                                  <CheckCircle className="w-3.5 h-3.5" /> حاضر
                                </span>
                              ) : rec.status === 'LATE' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-xs font-bold border border-amber-500/20">
                                  <Clock className="w-3.5 h-3.5" /> متأخر
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full text-xs font-bold border border-red-500/20">
                                  <XCircle className="w-3.5 h-3.5" /> غائب
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs sm:text-sm text-slate-400">
                      لا توجد تسجيلات حضور أو غياب مدرجة لهذا الطالب حتى الآن.
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

export default ParentChildrenPage;
