import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect, useMemo } from 'react';
import {
  Scale,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Building2,
  Save,
  Printer,
  ShieldAlert,
  Info,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { accountingService } from '../../services/accounting.service';

export default function DailyReconciliationPage() {
  const { t } = useLanguage();
  const [cashboxes, setCashboxes] = useState<any[]>([]);
  const [selectedCashboxId, setSelectedCashboxId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>(t('جرد الخزينة اليومي لنهاية الوردية'));

  const [denominations, setDenominations] = useState<Record<number, number>>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0
  });

  useEffect(() => {
    async function loadCashboxes() {
      try {
        setLoading(true);
        const data = await accountingService.getCashboxes();
        if (Array.isArray(data) && data.length > 0) {
          setCashboxes(data);
          setSelectedCashboxId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load cashboxes:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCashboxes();
  }, []);

  const selectedCashbox = useMemo(() => {
    return cashboxes.find(c => c.id === selectedCashboxId) || cashboxes[0] || null;
  }, [cashboxes, selectedCashboxId]);

  const expectedClosing = useMemo(() => {
    return selectedCashbox ? Number(selectedCashbox.currentBalance || 0) : 0;
  }, [selectedCashbox]);

  // Counted Physical Total = Sum of (Denomination * Count)
  const countedPhysicalTotal = useMemo(() => {
    return Object.entries(denominations).reduce((acc, [denom, count]) => {
      return acc + Number(denom) * (Number(count) || 0);
    }, 0);
  }, [denominations]);

  // Discrepancy = Physical Count - Expected Closing
  const discrepancy = useMemo(() => {
    return countedPhysicalTotal - expectedClosing;
  }, [countedPhysicalTotal, expectedClosing]);

  const handleDenominationChange = (denom: number, count: number) => {
    setDenominations(prev => ({
      ...prev,
      [denom]: Math.max(0, count)
    }));
  };

  const handleSaveReconciliation = async () => {
    if (!selectedCashbox) {
      toast.error(t('يرجى اختيار خزينة معتمدة للجرد'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await accountingService.reconcileCashbox(selectedCashbox.id, {
        actualCountedClosingBalance: countedPhysicalTotal,
        notes
      });

      if (!res.hasDiscrepancy) {
        toast.success(t('تم توثيق محضر الجرد اليومي: مطابقة تامة'), {
          description: `رصيد الخزينة مطابق تماماً (${countedPhysicalTotal.toLocaleString('ar-EG')} ج.م)`
        });
      } else {
        toast.warning(`تم تسجيل محضر الجرد بفرق (${res.difference > 0 ? '+' : ''}${res.difference} ج.م)`, {
          description: 'تم تسجيل المحضر وتنبيه إدارة المركز فورياً للتحقيق المحايد'
        });
      }

      // Refresh cashbox balances
      const updated = await accountingService.getCashboxes();
      setCashboxes(updated);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ أثناء توثيق محضر الجرد');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <span>{t('المحاسبة المالية')}</span>
          <span>/</span>
          <span className="text-[#9e1b1b] font-bold">{t('محاضر الجرد والإغلاق اليومي (ACC-07)')}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          {t('محاضر الجرد الفعلي ومطابقة الخزائن (End-of-Day Blind Count)')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t('حصر الفئات النقدية الفعلية ومطابقتها مع الرصيد الدفتري للنظام وفق معادلة الجرد المعتمدة وسياسة UP-705')}
        </p>
      </div>

      {/* UP-705 Policy Alert */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="block font-bold">{t('سياسة الفوارق المحايدة الصارمة (UP-705 Neutral Discrepancy Policy):')}</strong>
          {t('في حال وجود أي عجز أو زيادة بين العد الفعلي والرصيد الدفتري، يُقفل المحضر في وضع "قيد المراجعة الإدارية المحايدة". يُحظر تماماً إجراء تسويات تلقائية، أو تحميل العجز لرواتب الموظفين فورياً، أو امتصاص الفائض دون تحقيق رسمي معتمد من المدير الرئيسي.')}
        </div>
      </div>

      {/* Cashbox Selector */}
      {cashboxes.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {t('اختيار الخزينة المراد جردها وإغلاقها:')}
          </div>
          <select
            value={selectedCashboxId}
            onChange={e => setSelectedCashboxId(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold font-mono"
          >
            {cashboxes.map(cb => (
              <option key={cb.id} value={cb.id}>
                {cb.code} — {cb.name} {t('(الرصيد الدفتري:')} {Number(cb.currentBalance).toLocaleString('ar-EG')} {t('ج.م)')}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* RIGHT COLUMN: BLIND COUNT DENOMINATION INPUT (7 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#9e1b1b]" />
                {t('حصر الفئات النقدية الفعلي (الجرد الأعمى —')} {selectedCashbox?.code || 'CB-01'})
              </h2>
              <span className="text-[11px] text-slate-500">{t('أدخل عدد الأوراق النقدية لكل فئة')}</span>
            </div>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {selectedCashbox?.code || 'CB-01'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {[200, 100, 50, 20, 10, 5].map(denom => {
              const count = denominations[denom] || 0;
              const subtotal = denom * count;
              return (
                <div
                  key={denom}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-16 font-mono text-sm font-black text-slate-900 dark:text-white">
                      {denom} {t('ج.م')}
                    </span>
                    <span className="text-[11px] text-slate-400">{t('ورقة نقدية')}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">{t('العدد:')}</span>
                      <input
                        type="number"
                        min="0"
                        value={count === 0 ? '' : count}
                        placeholder="0"
                        onChange={e => handleDenominationChange(denom, parseInt(e.target.value) || 0)}
                        className="w-20 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-center font-mono font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="w-28 text-left font-mono font-bold text-slate-800 dark:text-slate-200">
                      {subtotal.toLocaleString('ar-EG')} {t('ج.م')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between">
            <span className="text-xs font-bold">{t('إجمالي العد الفعلي (Counted Total):')}</span>
            <span className="font-mono text-xl font-black text-emerald-400">
              {countedPhysicalTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1 text-xs">
              {t('ملاحظات وتوقيع المحضر:')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>
        </div>

        {/* LEFT COLUMN: SYSTEM EXPECTED VS PHYSICAL DIFFERENCE (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#9e1b1b]" />
              {t('مطابقة الرصيد الدفتري مع الجرد الفعلي')}
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{t('الخزينة المحددة:')}</span>
                <span className="font-bold">{selectedCashbox?.name || 'الخزينة 1'} ({selectedCashbox?.code || 'CB-01'})</span>
              </div>
              <div className="flex justify-between py-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {t('الرصيد الدفتري المسجل بنظام الحسابات:')}
                </span>
                <span className="font-black text-slate-900 dark:text-white text-sm">
                  {expectedClosing.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                </span>
              </div>
            </div>

            {/* Reconciliation Difference Result */}
            <div
              className={`p-4 rounded-xl border space-y-1.5 text-center ${
                discrepancy === 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 font-bold">
                {discrepancy === 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{t('مطابقة تامة (BALANCED)')}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{t('يوجد فرق في الجرد (DISCREPANCY)')}</span>
                  </>
                )}
              </div>
              <div className="text-xl font-black">
                {discrepancy === 0
                  ? 'صفر عجز / صفر زيادة'
                  : `${discrepancy > 0 ? '+' : ''}${discrepancy.toLocaleString('ar-EG', {
                      minimumFractionDigits: 2
                    })} ج.م`}
              </div>
              <span className="text-[11px] block">
                {discrepancy === 0
                  ? 'العد الفعلي يتطابق دفترياً بنسبة 100%'
                  : 'قيد التحقيق المحايد عملاً بسياسة UP-705 وإخطار فوري للمدير'}
              </span>
            </div>

            <button
              onClick={handleSaveReconciliation}
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{submitting ? 'جاري توثيق المحضر...' : 'اعتماد محضر الجرد وتثبيته في سجل التدقيق'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
