import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import { Vault, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { accountingService } from '../../services/accounting.service';

interface CashboxDisplayItem {
  id: string;
  code: string;
  name: string;
  branch: string;
  balance: number;
  responsible: string;
  status: string;
  statusType: 'OK' | 'WARN';
}

export default function CashboxPage() {
  const { t } = useLanguage();
  const [cashboxes, setCashboxes] = useState<CashboxDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCashboxes = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await accountingService.getCashboxes();
      if (Array.isArray(res)) {
        const mapped = res.map((cb: any) => ({
          id: cb.id,
          code: cb.code || 'CB-01',
          name: cb.name || 'خزينة الفرع',
          branch: cb.branch ? `${cb.branch.name} (${cb.branch.code})` : 'المركز الرئيسي',
          balance: Number(cb.currentBalance || 0),
          responsible: cb.assignedCashier?.name || cb.assignedCashier?.email || 'أمين الخزينة المعين',
          status: cb.status === 'ACTIVE' ? 'نشطة ومؤمنة - جرد متطابق' : 'معلقة / قيد المراجعة',
          statusType: (cb.status === 'ACTIVE' ? 'OK' : 'WARN') as 'OK' | 'WARN'
        }));
        setCashboxes(mapped);
      }
    } catch (err: any) {
      console.error('Failed to load cashboxes:', err);
      setError(t('تعذر تحميل بيانات الخزائن من الخادم'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashboxes();
  }, []);

  const totalBalance = cashboxes.reduce((acc, cur) => acc + cur.balance, 0);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>{t('الرئيسية')}</span>
            <span>/</span>
            <span className="text-[#9e1b1b] font-bold">{t('إدارة الخزائن المركزية (CB-LIST-01)')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {t('سجل الخزائن النقدية والسيولة الدفترية')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('إجمالي السيولة الدفترية المحققة:')} {totalBalance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م موزعة على')} {cashboxes.length} {t('خزينة')}
          </p>
        </div>

        <button
          onClick={fetchCashboxes}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('تحديث الخزائن')}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-[#9e1b1b] animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : cashboxes.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
          <Vault className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('لا توجد خزائن نقدية مسجلة حالياً')}</h3>
          <p className="text-xs text-slate-500">{t('يتم إنشاء الخزائن وتخصيصها للكاشير والمحاسبين من خلال لوحة الحسابات أو إدارة الفروع')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {cashboxes.map(cb => (
            <div
              key={cb.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {cb.code}
                  </span>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                    {cb.name}
                  </h3>
                  <span className="text-xs text-slate-500">{cb.branch}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Vault className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('الرصيد الدفتري الحالي:')}</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {cb.balance.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                </span>
              </div>

              <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                <p>
                  <strong>{t('المسؤول:')}</strong> {cb.responsible}
                </p>
                <p className="flex items-center gap-1.5">
                  <strong>{t('الحالة:')}</strong>
                  {cb.statusType === 'WARN' ? (
                    <span className="text-amber-600 dark:text-amber-400 font-bold inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {cb.status}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {cb.status}
                    </span>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
