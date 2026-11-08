import React, { useState, useEffect } from 'react';
import {
  Receipt, Search, Filter, Printer, CheckCircle2, AlertCircle,
  RefreshCw, X, DollarSign, User, Building2, Ban
} from 'lucide-react';
import { brdSubscriptionService, ReceiptItem } from '../../services/brdSubscription.service';
import { useLanguage } from '../../contexts/LanguageContext';

export default function ReceiptsManagementPage() {
  const { t, isRtl } = useLanguage();
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');

  // Preview / Print modal
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null);

  const loadReceipts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await brdSubscriptionService.getAccountantReceipts();
      if (res.data) {
        setReceipts(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load branch receipts', err);
      setError(err?.response?.data?.message || 'تعذر تحميل إيصالات الفرع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, []);

  const filteredReceipts = receipts.filter((r) => {
    if (methodFilter !== 'ALL' && r.receivingMethod !== methodFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const numMatch = r.receiptNumber.toLowerCase().includes(q);
      const studentMatch = r.student?.name?.toLowerCase().includes(q);
      const teacherMatch = r.teacher?.name?.toLowerCase().includes(q);
      return numMatch || studentMatch || teacherMatch;
    }
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-[#9e1b1b]" />
            {t('سجل الإيصالات المتسلسلة للفرع (Branch Receipts)')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('سجل إيصالات التحصيل الصادرة متسلسلة لكل فرع بدون فجوات وفق متطلبات BRD')}
          </p>
        </div>

        <button
          onClick={loadReceipts}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('تحديث السجل')}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder={t('searchReceiptsPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#9e1b1b]"
          />
        </div>

        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
        >
          <option value="ALL">{t('جميع طرق السداد')}</option>
          <option value="CASH">{t('نقدي (Cash)')}</option>
          <option value="BANK_TRANSFER">{t('تحويل بنكي (Bank Transfer)')}</option>
          <option value="WALLET">{t('محفظة إلكترونية (Wallet)')}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 text-[#9e1b1b] animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className={`py-3.5 px-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{t('receiptNumber')}</th>
                  <th className={`py-3.5 px-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{t('student')}</th>
                  <th className={`py-3.5 px-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{t('responsibleTeacher')}</th>
                  <th className={`py-3.5 px-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{t('amountPaid')}</th>
                  <th className={`py-3.5 px-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{t('paymentMethod')}</th>
                  <th className={`py-3.5 px-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{t('coveredMonths')}</th>
                  <th className={`py-3.5 px-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{t('issueDate')}</th>
                  <th className={`py-3.5 px-4 font-semibold ${isRtl ? "text-right" : "text-left"}`}>{t('status')}</th>
                  <th className="py-3.5 px-4 font-semibold text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      {t('لا توجد إيصالات مسجلة حتى الآن')}
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((r) => {
                    const isCancelled = r.payment?.status === 'CANCELLED';
                    return (
                      <tr key={r.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                          {r.receiptNumber}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-gray-900">
                          {r.student?.name || 'غير معروف'}
                          {r.student?.gradeLevel && (
                            <span className="text-xs text-gray-500 block">{r.student.gradeLevel}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#9e1b1b] font-semibold">
                          {r.teacher?.name || '-'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-700">
                          {r.amount.toLocaleString()} {t('ج.م')}
                        </td>
                        <td className="py-3.5 px-4 text-gray-700 text-xs">
                          {r.receivingMethod === 'CASH'
                            ? 'نقدي'
                            : r.receivingMethod === 'BANK_TRANSFER'
                            ? 'تحويل بنكي'
                            : 'محفظة إلكترونية'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 text-xs">
                          {r.monthsCovered}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 text-xs">
                          {new Date(r.createdAt).toLocaleDateString('ar-EG', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          {isCancelled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              <Ban className="w-3 h-3" />
                              {t('ملغي من الإدارة')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('معتمد')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(r)}
                            className="p-1.5 text-gray-600 hover:text-emerald-700 hover:bg-gray-100 rounded-lg transition"
                            title={t('عرض وطباعة الإيصال')}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-200 animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-6 h-6 text-[#9e1b1b]" />
                <h2 className="text-lg font-black text-gray-900">{t('إيصال تحصيل رسمي')}</h2>
              </div>
              <button onClick={() => setSelectedReceipt(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl space-y-3 text-xs">
              <div className="text-center pb-2 border-b border-gray-200">
                <div className="font-black text-base text-gray-900">{t('منظومة OX-DIGITAL التعليمية')}</div>
                <div className="text-gray-500 text-[11px]">{t('المركز التعليمي لإدارة الاشتراكات والمجموعات')}</div>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">{t('رقم الإيصال:')}</span>
                <span className="font-mono font-bold text-gray-900 text-sm">{selectedReceipt.receiptNumber}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">{t('اسم الطالب:')}</span>
                <span className="font-bold text-gray-900">{selectedReceipt.student?.name}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">{t('المعلم المسؤول:')}</span>
                <span className="font-bold text-[#9e1b1b]">{selectedReceipt.teacher?.name}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">{t('الشهور المغطاة:')}</span>
                <span className="font-medium text-gray-800">{selectedReceipt.monthsCovered}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">{t('طريقة الدفع:')}</span>
                <span className="font-medium text-gray-800">
                  {selectedReceipt.receivingMethod === 'CASH'
                    ? 'نقدي'
                    : selectedReceipt.receivingMethod === 'BANK_TRANSFER'
                    ? 'تحويل بنكي'
                    : 'محفظة إلكترونية'}
                </span>
              </div>

              <div className="flex justify-between py-2 bg-emerald-50 p-2.5 rounded-lg text-emerald-900 font-bold">
                <span>{t('المبلغ المحصل:')}</span>
                <span className="text-base font-black">{selectedReceipt.amount.toLocaleString()} {t('ج.م')}</span>
              </div>

              <div className="text-[11px] text-gray-400 text-center pt-2">
                {t('صدر بتاريخ:')} {new Date(selectedReceipt.createdAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                {t('طباعة')}
              </button>

              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg"
              >
                {t('إغلاق')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
