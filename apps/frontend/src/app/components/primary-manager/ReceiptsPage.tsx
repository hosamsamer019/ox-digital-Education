import { useLanguage, t } from '../../contexts/LanguageContext';
import React from 'react';
import { Receipt, Search, FileDown } from 'lucide-react';
import { AUDITED_MOVEMENTS } from './mockData';

export default function ReceiptsPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>{t('الرئيسية')}</span>
            <span>/</span>
            <span className="text-[#9e1b1b] font-bold">{t('رقابة المقبوضات والإيصالات (PM-REC-01)')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {t('سجل إيصالات التحصيل والمقبوضات المعتمدة')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('متابعة المقبوضات النقدية وماكينات الدفع الإلكتروني POS بفرعي الدقي ومدينة نصر')}
          </p>
        </div>

        <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] transition-colors self-start sm:self-auto">
          <FileDown className="w-4 h-4" />
          <span>{t('تصدير السجل اليومي')}</span>
        </button>
      </div>

      <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-800/30">
              <th className="py-3 px-4">{t('رقم الإيصال')}</th>
              <th className="py-3 px-4">{t('اسم الطالب / المصدر')}</th>
              <th className="py-3 px-4">{t('المبلغ')}</th>
              <th className="py-3 px-4">{t('طريقة السداد')}</th>
              <th className="py-3 px-4">{t('الفرع')}</th>
              <th className="py-3 px-4">{t('الخزينة المستلمة')}</th>
              <th className="py-3 px-4">{t('الكاشير')}</th>
              <th className="py-3 px-4">{t('الحالة')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {AUDITED_MOVEMENTS.map(m => (
              <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                  {m.receiptNumber}
                </td>
                <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                  {m.partyName}
                </td>
                <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                  {m.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{m.paymentMethodLabel}</td>
                <td className="py-3 px-4">{m.branchName}</td>
                <td className="py-3 px-4 font-mono text-slate-500">{m.cashboxCode}</td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{m.cashierName}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {m.statusLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

