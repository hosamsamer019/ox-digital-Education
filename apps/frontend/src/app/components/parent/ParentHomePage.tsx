import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  CheckCircle,
  BookOpen,
  Bell,
  Award,
  Calendar,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  UserCheck
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { analyticsService } from '../../services/analytics.service';
import { userService } from '../../services/user.service';
import { notificationService, Notification } from '../../services/notification.service';
import { LoadingState } from '../ui/LoadingState';
import { EmptyState } from '../ui/EmptyState';
import { useSelectedChild } from './useSelectedChild';
import { ChildSelector } from './ChildSelector';

export const ParentHomePage: React.FC = () => {
  const navigate = useNavigate();
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
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [childDetailsLoading, setChildDetailsLoading] = useState<boolean>(false);
  const [childDetailsError, setChildDetailsError] = useState<string | null>(null);

  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Request race condition prevention ref
  const activeChildIdRef = useRef<string | null>(null);

  const cardBg = isDark
    ? 'bg-[#0f131d] border-slate-800/90 shadow-lg shadow-black/20'
    : 'bg-white border-slate-200/90 shadow-sm';
  const wellBg = isDark
    ? 'bg-[#161c28]/70 border-slate-800/60'
    : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  // Fetch Child Specific Details with stale-response protection
  const fetchChildDetails = useCallback(
    async (childId: string) => {
      activeChildIdRef.current = childId;
      setChildDetailsLoading(true);
      setChildDetailsError(null);

      try {
        const [overviewRes, attendanceRes] = await Promise.all([
          analyticsService.getParentChildOverview(childId).catch((err) => {
            console.error('Error in getParentChildOverview:', err);
            return null;
          }),
          userService.getStudentAttendanceById(childId).catch((err) => {
            console.error('Error in getStudentAttendanceById:', err);
            return null;
          }),
        ]);

        // Stale check: ignore if selected child changed during flight
        if (activeChildIdRef.current !== childId) {
          return;
        }

        if (overviewRes && overviewRes.data) {
          setChildData(overviewRes.data);
        } else {
          setChildData(null);
          setChildDetailsError('تعذر تحميل البيانات الأكاديمية للطالب المحدد.');
        }

        if (attendanceRes && attendanceRes.summary) {
          setAttendanceSummary(attendanceRes.summary);
        } else {
          setAttendanceSummary(null);
        }
      } catch (err: any) {
        if (activeChildIdRef.current === childId) {
          console.error('Failed to load child overview:', err);
          setChildDetailsError('حدث خطأ أثناء تحميل بيانات الطالب. يرجى إعادة المحاولة.');
        }
      } finally {
        if (activeChildIdRef.current === childId) {
          setChildDetailsLoading(false);
        }
      }
    },
    []
  );

  // Fetch recent notifications once
  const fetchRecentNotifications = useCallback(async () => {
    try {
      const res = await notificationService.getNotifications({ limit: 5 });
      setRecentNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch notifications for parent home:', err);
    }
  }, []);

  useEffect(() => {
    fetchRecentNotifications();
  }, [fetchRecentNotifications]);

  useEffect(() => {
    if (selectedChildId) {
      fetchChildDetails(selectedChildId);
    } else {
      setChildData(null);
      setAttendanceSummary(null);
    }
  }, [selectedChildId, fetchChildDetails]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchChildren(),
      fetchRecentNotifications(),
      selectedChildId ? fetchChildDetails(selectedChildId) : Promise.resolve(),
    ]);
    setRefreshing(false);
  };

  if (childrenLoading) {
    return <LoadingState message="جاري تحميل بيانات لوحة ولي الأمر..." />;
  }

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-sans`}
      dir="rtl"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              بوابة ولي الأمر
            </span>
            <span className="text-xs text-slate-400">نظام المتابعة الأكاديمية الأسرية</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
            لوحة المتابعة العامة
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            نظرة شاملة ومباشرة على مستوى التحصيل، الحضور والواجبات لأبنائك المسجلين
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer self-start sm:self-auto ${
            isDark
              ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
          <span>تحديث المؤشرات</span>
        </button>
      </div>

      {/* Global Error Banner if children query failed */}
      {childrenError && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{childrenError}</p>
            <button
              onClick={() => refetchChildren()}
              className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
            >
              إعادة تحميل بيانات الأبناء
            </button>
          </div>
        </div>
      )}

      {/* Case 1: No linked children */}
      {children.length === 0 && !childrenLoading && !childrenError ? (
        <div className="my-8">
          <EmptyState
            message="لا يوجد أبناء مرتبطين بحسابك حالياً"
            subMessage="يرجى مراجعة إدارة المنظومة التعليمية لربط الحسابات الأكاديمية لأبنائك برقم هاتفك أو بريدك المسجل."
          />
        </div>
      ) : (
        <>
          {/* Child Selector Tabs */}
          <ChildSelector
            childrenList={children}
            selectedChildId={selectedChildId}
            onSelectChild={selectChild}
          />

          {/* Child Detail Error Alert */}
          {childDetailsError && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{childDetailsError}</p>
                {selectedChildId && (
                  <button
                    onClick={() => fetchChildDetails(selectedChildId)}
                    className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
                  >
                    إعادة المحاولة للطالب المحدد
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Selected Child KPI Row */}
          {childDetailsLoading ? (
            <div className={`${cardBg} border rounded-2xl p-8 mb-8 text-center`}>
              <RefreshCw className="w-6 h-6 text-[#9e1b1b] animate-spin mx-auto mb-2" />
              <p className={`text-xs ${textSecondary}`}>جاري تحميل تقرير الطالب...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Card 1: Overall Average */}
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
                <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 truncate">
                  {childData?.overview?.overallRate != null
                    ? 'متوسط درجات الاختبارات والتطبيقات المصححة'
                    : 'لا توجد تقييمات مصححة مسجلة بعد'}
                </p>
              </div>

              {/* Card 2: Exams Completed */}
              <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs font-semibold ${textSecondary}`}>الامتحانات المنجزة</p>
                    <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                      {childData?.overview?.examsCompleted ?? '—'}
                      <span className="text-xs font-normal text-slate-400 ms-1.5">امتحان</span>
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 truncate">
                  اختبارات تم تقديمها وتقييمها
                </p>
              </div>

              {/* Card 3: Homework Completed */}
              <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs font-semibold ${textSecondary}`}>الواجبات والتطبيقات</p>
                    <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                      {childData?.overview?.homeworksCompleted ?? '—'}
                      <span className="text-xs font-normal text-slate-400 ms-1.5">واجب مسلّم</span>
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 border border-emerald-500/20">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 truncate">
                  {childData?.overview?.pendingGradingCount
                    ? `تسليمات الواجبات (${childData.overview.pendingGradingCount} قيد التصحيح)`
                    : 'كافة تسليمات الواجبات المعتمدة'}
                </p>
              </div>

              {/* Card 4: Attendance Rate */}
              <div className={`${cardBg} border rounded-2xl p-5 relative overflow-hidden group hover:border-[#9e1b1b]/40 transition-all`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs font-semibold ${textSecondary}`}>نسبة الانضباط والحضور</p>
                    <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                      {attendanceSummary?.percentage != null
                        ? `${attendanceSummary.percentage}٪`
                        : '—'}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center flex-shrink-0 border border-teal-500/20">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-800/50 truncate">
                  {attendanceSummary && attendanceSummary.totalSessions > 0
                    ? `حاضر: ${attendanceSummary.presentCount || 0} • متأخر: ${attendanceSummary.lateCount || 0} • غائب: ${attendanceSummary.absentCount || 0}`
                    : 'سجل الحضور الرسمي (لا توجد بيانات مسجلة بعد)'}
                </p>
              </div>
            </div>
          )}

          {/* Two-Column Details Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Column A: Recent Results for Selected Child */}
            <div className={`${cardBg} border rounded-2xl p-5 sm:p-6`}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#9e1b1b]" />
                  <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                    أحدث النتائج والتقييمات
                  </h2>
                </div>
                {selectedChildId && (
                  <button
                    onClick={() => navigate(`/parent/reports?child=${selectedChildId}`)}
                    className="text-xs font-bold text-[#9e1b1b] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>عرض كافة التقارير</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {childData?.recent && childData.recent.length > 0 ? (
                  childData.recent.slice(0, 5).map((item: any, idx: number) => {
                    const isExam = item.type === 'exam' || item.type === 'امتحان';
                    const isPending = item.score == null || item.status === 'PENDING_GRADING';
                    const score = isPending ? null : Number(item.score);
                    const isHigh = score !== null && score >= 85;
                    const isMid = score !== null && score >= 65 && score < 85;

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-colors ${wellBg}`}
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
                            <h3 className={`text-xs sm:text-sm font-bold ${textPrimary}`}>
                              {item.title}
                            </h3>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{item.date}</p>
                        </div>

                        {isPending ? (
                          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            قيد التصحيح
                          </span>
                        ) : (
                          <div
                            className={`px-3 py-1 rounded-xl text-xs sm:text-sm font-extrabold ${
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
                  <div className="text-center py-10 text-slate-400 text-xs sm:text-sm">
                    لا توجد تقييمات أو نتائج مسجلة لهذا الطالب مؤخراً.
                  </div>
                )}
              </div>
            </div>

            {/* Column B: Recent Notifications */}
            <div className={`${cardBg} border rounded-2xl p-5 sm:p-6`}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-[#9e1b1b]" />
                  <h2 className={`font-bold text-base sm:text-lg ${textPrimary}`}>
                    التنبيهات المدرسية الأخيرة
                  </h2>
                </div>
                <button
                  onClick={() => navigate('/parent/notifications')}
                  className="text-xs font-bold text-[#9e1b1b] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>كافة التنبيهات</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {recentNotifications.length > 0 ? (
                  recentNotifications.map((notif: any) => {
                    const notifDate = notif.createdAt ? new Date(notif.createdAt) : null;
                    const dateStr =
                      notifDate && !isNaN(notifDate.getTime())
                        ? notifDate.toLocaleDateString('ar-EG')
                        : 'مؤخراً';

                    return (
                      <div
                        key={notif.id}
                        className={`p-3.5 rounded-xl border transition-colors ${
                          !notif.read
                            ? isDark
                              ? 'bg-[#161c28] border-[#9e1b1b]/40'
                              : 'bg-red-50/40 border-[#9e1b1b]/30'
                            : wellBg
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              !notif.read ? 'bg-[#9e1b1b]' : 'bg-slate-400/40'
                            }`}
                          />
                          <div className="flex-1">
                            {notif.title && (
                              <h4 className={`text-xs sm:text-sm font-bold ${textPrimary} mb-0.5`}>
                                {notif.title}
                              </h4>
                            )}
                            <p className={`text-xs ${textSecondary} line-clamp-2`}>
                              {notif.message}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">{dateStr}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-slate-400 text-xs sm:text-sm">
                    لا توجد تنبيهات جديدة في الوقت الحالي.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ParentHomePage;
