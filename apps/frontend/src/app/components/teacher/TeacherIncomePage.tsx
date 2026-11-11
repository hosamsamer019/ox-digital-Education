import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  DollarSign, TrendingUp, Calendar, CreditCard, Wallet,
  Receipt, ArrowUpRight, Printer, AlertCircle, RefreshCw, FileText, Building2
} from 'lucide-react';
import { brdSubscriptionService } from '../../services/brdSubscription.service';

export default function TeacherIncomePage() {
  const { t } = useLanguage();
  const { user } = useAuth();
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

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await brdSubscriptionService.getTeacherIncomeReport();
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
      setError(err?.response?.data?.message || 'تعذر تحميل تقرير التحصيلات والدخل');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const months = Object.keys(data?.monthlyTotals || {}).sort().reverse();
  const currentMonthData = selectedMonth && data?.monthlyTotals[selectedMonth]
    ? data.monthlyTotals[selectedMonth]
    : { total: 0, count: 0, byGrade: {}, byMethod: { CASH: 0, BANK_TRANSFER: 0, WALLET: 0 } };

  // Calculate overall total
  const allTimeTotal = Object.values(data?.monthlyTotals || {}).reduce((sum, m) => sum + m.total, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-emerald-600" />
              {t('تقرير الدخل والتحصيلات الشهرية')}
            </h1>
            {user?.branch?.name ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" data-testid="income-branch-badge">
                <Building2 className="w-3.5 h-3.5" />
                <span>{t('branchColon', 'الفرع:')} {user.branch.name}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" data-testid="income-unassigned-badge">
                <Building2 className="w-3.5 h-3.5" />
                <span>{t('unassignedBranch', 'غير مسند لفرع حالياً')}</span>
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('سجل التحصيلات الفعلية المستلمة للطلاب وتوزيعها حسب الصف وطريقة السداد')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadReport}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-card-foreground bg-card border border-border rounded-lg hover:bg-muted transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('تحديث')}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition shadow-sm"
          >
            <Printer className="w-4 h-4" />
            {t('طباعة / تصدير التقرير')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-md">
              <div className="flex items-center justify-between opacity-90">
                <span className="text-sm font-medium">{t('إجمالي التحصيلات (كل الفترات)')}</span>
                <DollarSign className="w-5 h-5" />
              </div>
              <div className="text-3xl font-black mt-2">
                {allTimeTotal.toLocaleString()} <span className="text-base font-normal">{t('ج.م')}</span>
              </div>
              <div className="text-xs opacity-80 mt-1">
                {t('إجمالي الإيصالات الصادرة:')} {data?.totalReceiptsCount || 0}
              </div>
            </div>

            <div className="p-5 bg-card text-card-foreground border border-border rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span className="text-sm font-medium">{t('تحصيلات الشهر المحدد (')}{selectedMonth})</span>
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-gray-900 mt-2">
                {currentMonthData.total.toLocaleString()} <span className="text-base font-normal text-gray-500">{t('ج.م')}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {t('عدد الطلاب المسددين:')} {currentMonthData.count} {t('عملية سداد')}
              </div>
            </div>

            <div className="p-5 bg-card text-card-foreground border border-border rounded-2xl shadow-sm">
              <div className="flex items-center justify-between text-gray-600">
                <span className="text-sm font-medium">{t('اختيار الشهر المالي')}</span>
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:ring-2 focus:ring-emerald-500"
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
              <div className="text-xs text-gray-500 mt-2">
                {t('عرض تقرير تفصيلي للشهر المحدد')}
              </div>
            </div>
          </div>

          {/* Breakdown: By Method & By Grade */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Payment Method */}
            <div className="p-6 bg-card text-card-foreground border border-border rounded-2xl shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                {t('توزيع طرق السداد لشهر')} {selectedMonth}
              </h2>
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-700">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium">{t('نقدي (Cash)')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">
                      {(currentMonthData.byMethod?.CASH || 0).toLocaleString()} {t('ج.م')}
                    </span>
                    <span className="text-xs text-gray-500 block">
                      {currentMonthData.total > 0
                        ? Math.round(((currentMonthData.byMethod?.CASH || 0) / currentMonthData.total) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-700">
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium">{t('تحويل بنكي (Bank Transfer)')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">
                      {(currentMonthData.byMethod?.BANK_TRANSFER || 0).toLocaleString()} {t('ج.م')}
                    </span>
                    <span className="text-xs text-gray-500 block">
                      {currentMonthData.total > 0
                        ? Math.round(((currentMonthData.byMethod?.BANK_TRANSFER || 0) / currentMonthData.total) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Wallet className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium">{t('محفظة إلكترونية (Wallet)')}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-gray-900">
                      {(currentMonthData.byMethod?.WALLET || 0).toLocaleString()} {t('ج.م')}
                    </span>
                    <span className="text-xs text-gray-500 block">
                      {currentMonthData.total > 0
                        ? Math.round(((currentMonthData.byMethod?.WALLET || 0) / currentMonthData.total) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* By Grade */}
            <div className="p-6 bg-card text-card-foreground border border-border rounded-2xl shadow-sm space-y-4">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                {t('تحصيلات الصفوف الدراسية لشهر')} {selectedMonth}
              </h2>
              {Object.keys(currentMonthData.byGrade || {}).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {t('لا توجد تحصيلات مسجلة لهذا الشهر حتى الآن')}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Object.entries(currentMonthData.byGrade).map(([grade, amt]) => (
                    <div key={grade} className="py-3 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">
                        {grade === 'PRIMARY_1' ? 'الصف الأول الابتدائي' :
                         grade === 'SECONDARY_1' ? 'الصف الأول الثانوي' :
                         grade === 'SECONDARY_2' ? 'الصف الثاني الثانوي' :
                         grade === 'SECONDARY_3' ? 'الصف الثالث الثانوي' : grade}
                      </span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-700">
                          {amt.toLocaleString()} {t('ج.م')}
                        </span>
                        <span className="text-xs text-gray-500 block">
                          {currentMonthData.total > 0
                            ? Math.round((amt / currentMonthData.total) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Month-over-Month Comparison */}
          {months.length > 1 && (
            <div className="p-6 bg-card text-card-foreground border border-border rounded-2xl shadow-sm space-y-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-blue-600" />
                {t('مقارنة التحصيلات عبر الأشهر السابقة')}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">{t('الشهر')}</th>
                      <th className="py-3 px-4 font-semibold">{t('عدد الإيصالات')}</th>
                      <th className="py-3 px-4 font-semibold">{t('نقدي')}</th>
                      <th className="py-3 px-4 font-semibold">{t('تحويل بنكي')}</th>
                      <th className="py-3 px-4 font-semibold">{t('محفظة')}</th>
                      <th className="py-3 px-4 font-semibold">{t('إجمالي الشهر')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {months.map((m) => {
                      const item = data?.monthlyTotals[m];
                      if (!item) return null;
                      return (
                        <tr key={m} className={m === selectedMonth ? 'bg-emerald-50/50 font-medium' : 'hover:bg-gray-50'}>
                          <td className="py-3 px-4 text-gray-900">{m}</td>
                          <td className="py-3 px-4 text-gray-600">{item.count}</td>
                          <td className="py-3 px-4 text-gray-600">{(item.byMethod?.CASH || 0).toLocaleString()} {t('ج.م')}</td>
                          <td className="py-3 px-4 text-gray-600">{(item.byMethod?.BANK_TRANSFER || 0).toLocaleString()} {t('ج.م')}</td>
                          <td className="py-3 px-4 text-gray-600">{(item.byMethod?.WALLET || 0).toLocaleString()} {t('ج.م')}</td>
                          <td className="py-3 px-4 text-emerald-700 font-bold">{item.total.toLocaleString()} {t('ج.م')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Receipts Table */}
          {data?.receipts && data.receipts.length > 0 && (
            <div className="p-6 bg-card text-card-foreground border border-border rounded-2xl shadow-sm space-y-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                {t('سجل أحدث الإيصالات الصادرة')}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">{t('رقم الإيصال')}</th>
                      <th className="py-3 px-4 font-semibold">{t('اسم الطالب')}</th>
                      <th className="py-3 px-4 font-semibold">{t('الصف')}</th>
                      <th className="py-3 px-4 font-semibold">{t('المبلغ')}</th>
                      <th className="py-3 px-4 font-semibold">{t('طريقة الدفع')}</th>
                      <th className="py-3 px-4 font-semibold">{t('الشهور المغطاة')}</th>
                      <th className="py-3 px-4 font-semibold">{t('التاريخ')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.receipts.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono font-bold text-gray-800">{r.receiptNumber}</td>
                        <td className="py-3 px-4 font-medium text-gray-900">{r.studentName}</td>
                        <td className="py-3 px-4 text-gray-600">{r.gradeLevel}</td>
                        <td className="py-3 px-4 text-emerald-700 font-bold">{r.amount.toLocaleString()} {t('ج.م')}</td>
                        <td className="py-3 px-4 text-gray-600">
                          {r.receivingMethod === 'CASH' ? 'نقدي' :
                           r.receivingMethod === 'BANK_TRANSFER' ? 'تحويل بنكي' : 'محفظة'}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{r.monthsCovered}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {new Date(r.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

