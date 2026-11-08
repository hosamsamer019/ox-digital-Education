import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, Calendar, CreditCard, Wallet,
  Receipt, ArrowUpRight, Printer, AlertCircle, RefreshCw, FileText, User
} from 'lucide-react';
import { brdSubscriptionService } from '../../services/brdSubscription.service';

export default function ManagerTeacherIncomePage() {
  const { t } = useLanguage();
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<{
    teacherId?: string;
    totalReceiptsCount: number;
    monthlyTotals: Record<string, {
      total: number;
      count: number;
      byGrade: Record<string, number>;
      byMethod: { CASH: number; BANK_TRANSFER: number; WALLET: number };
    }>;
    receipts?: Array<{
      id: string;
      receiptNumber: string;
      studentName: string;
      gradeLevel: string;
      amount: number;
      receivingMethod: string;
      monthsCovered: string;
      createdAt: string;
    }>;
  } | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const loadTeachers = async () => {
    try {
      const res = await brdSubscriptionService.getManagerStudents();
      const map = new Map();
      res.students?.forEach((s: any) => {
        if (s.responsibleTeacher) map.set(s.responsibleTeacher.id, s.responsibleTeacher);
      });
      const list = Array.from(map.values());
      setTeachers(list);
      if (list.length > 0) {
        setSelectedTeacherId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load teachers', err);
    }
  };

  const loadReport = async (tId?: string) => {
    const tid = tId || selectedTeacherId;
    if (!tid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await brdSubscriptionService.getTeacherIncomeReport(tid);
      setData(res);
      const months = Object.keys(res.monthlyTotals || {}).sort().reverse();
      if (months.length > 0) {
        setSelectedMonth(months[0]);
      } else {
        const now = new Date();
        setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      }
    } catch (err: any) {
      console.error('Failed to load income report', err);
      setError(err?.response?.data?.message || 'تعذر تحميل تقرير التحصيلات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeachers();
  }, []);

  useEffect(() => {
    if (selectedTeacherId) {
      loadReport(selectedTeacherId);
    }
  }, [selectedTeacherId]);

  const months = Object.keys(data?.monthlyTotals || {}).sort().reverse();
  const currentMonthData = selectedMonth && data?.monthlyTotals[selectedMonth]
    ? data.monthlyTotals[selectedMonth]
    : { total: 0, count: 0, byGrade: {}, byMethod: { CASH: 0, BANK_TRANSFER: 0, WALLET: 0 } };

  const allTimeTotal = Object.values(data?.monthlyTotals || {}).reduce((sum, m) => sum + m.total, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-[#9e1b1b]" />
            {t('تقارير تحصيلات وإيرادات المعلمين (Teacher Revenue Reports)')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('متابعة إيرادات وتحصيلات كل معلم بدقة ومطابقتها مع مقبوضات الفروع')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadReport()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('تحديث')}
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#9e1b1b] rounded-lg hover:bg-[#801515] transition shadow-sm"
          >
            <Printer className="w-4 h-4" />
            {t('طباعة التقرير')}
          </button>
        </div>
      </div>

      {/* Teacher Selector */}
      <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center gap-4">
        <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <User className="w-4 h-4 text-[#9e1b1b]" />
          {t('اختر المعلم المستهدف:')}
        </label>
        <select
          value={selectedTeacherId}
          onChange={(e) => setSelectedTeacherId(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#9e1b1b]"
        >
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.email})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 text-[#9e1b1b] animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 bg-gradient-to-br from-[#9e1b1b] to-red-800 rounded-2xl text-white shadow-md">
              <div className="flex items-center justify-between opacity-90">
                <span className="text-sm font-medium">{t('إجمالي تحصيلات المعلم')}</span>
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="text-3xl font-black mt-2">
                {allTimeTotal.toLocaleString()} <span className="text-base font-normal">{t('ج.م')}</span>
              </div>
              <div className="text-xs opacity-80 mt-1">
                {t('إجمالي الإيصالات الصادرة:')} {data?.totalReceiptsCount || 0}
              </div>
            </div>

            <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span className="text-sm font-medium">{t('تحصيلات الشهر (')}{selectedMonth})</span>
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-gray-900 mt-2">
                {currentMonthData.total.toLocaleString()} <span className="text-base font-normal text-gray-500">{t('ج.م')}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('عدد عمليات السداد:')} {currentMonthData.count}
              </div>
            </div>

            <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span className="text-sm font-medium">{t('اختيار الشهر المالي')}</span>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm"
              >
                {months.length === 0 ? (
                  <option value={selectedMonth}>{selectedMonth}</option>
                ) : (
                  months.map((m) => (
                    <option key={m} value={m}>
                      {t('شهر')} {m}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#9e1b1b]" />
                {t('طرق التحصيل لشهر')} {selectedMonth}
              </h2>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">{t('نقدي (Cash)')}</span>
                  <span className="text-sm font-bold text-gray-900">{(currentMonthData.byMethod?.CASH || 0).toLocaleString()} {t('ج.م')}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">{t('تحويل بنكي (Bank Transfer)')}</span>
                  <span className="text-sm font-bold text-gray-900">{(currentMonthData.byMethod?.BANK_TRANSFER || 0).toLocaleString()} {t('ج.م')}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">{t('محفظة إلكترونية (Wallet)')}</span>
                  <span className="text-sm font-bold text-gray-900">{(currentMonthData.byMethod?.WALLET || 0).toLocaleString()} {t('ج.م')}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#9e1b1b]" />
                {t('تحصيلات الصفوف لشهر')} {selectedMonth}
              </h2>
              {Object.keys(currentMonthData.byGrade || {}).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">{t('لا توجد تحصيلات مسجلة لهذا الشهر')}</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Object.entries(currentMonthData.byGrade).map(([grade, amt]) => (
                    <div key={grade} className="py-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">{grade}</span>
                      <span className="text-sm font-bold text-[#9e1b1b]">{amt.toLocaleString()} {t('ج.م')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

