import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  Vault,
  Building2,
  DollarSign,
  ShieldCheck,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { accountingService } from '../../services/accounting.service';

interface CashboxItem {
  id: string;
  code: string;
  name: string;
  branch?: { name: string; code: string };
  currentBalance: number;
  assignedCashier?: { name?: string; email?: string };
  status: string;
}

export default function CashboxOperationsPage() {
  const { t } = useLanguage();
  const [cashboxes, setCashboxes] = useState<CashboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCashboxData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await accountingService.getCashboxes();
      if (Array.isArray(res)) {
        setCashboxes(res);
      } else {
        setCashboxes([]);
      }
    } catch {
      setError(t('تعذر تحميل بيانات الخزائن من الخادم'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashboxData();
  }, []);

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>{t('المحاسبة المالية')}</span>
            <span>/</span>
            <span className="text-[#9e1b1b] font-bold">{t('الخزائن المركزية للفرع (ACC-06)')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {t('إدارة الخزائن النقدية وأرصدة الفرع')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('متابعة أرصدة الخزائن الحضور الدفترية والرقابة على حركة السيولة المعتمدة')}
          </p>
        </div>

        {/* Unavailable action clearly disabled per governance policy */}
        <div className="flex items-center gap-2">
          <div
            data-testid="transfer-disabled-badge"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 cursor-not-allowed select-none"
            title={t('وظيفة التحويل النقدي معلقة إدارياً لحين اعتماد اللائحة التنفيذية')}
          >
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('طلبات التحويل البيني معلقة إدارياً')}</span>
          </div>

          <button
            onClick={fetchCashboxData}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
            title={t('تحديث أرصدة الخزائن')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#9e1b1b]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Governance & Policy Advisory Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
        <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="block font-bold">{t('تنبيه حوكمة التحويلات النقدية (Cashbox Governance Policy):')}</strong>
          <p className="leading-relaxed">
            {t('وفق الضوابط المحاسبية الصارمة، تم تعليق وظيفة التحويلات النقدية الذاتية بين الخزائن لعدم اكتمال الدورة الخماسية المعتمدة (Maker-Checker In-Transit Lifecycle). تقتصر صلاحية أمين الخزينة على المعاينة الرقابية للأرصدة الدفترية المثبتة بالإيصالات وسندات الصرف المعتمدة فقط.')}
          </p>
        </div>
      </div>

      {/* Till Balances Cards (Real Backend Data) */}
      {loading ? (
        <div className="py-12 text-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#9e1b1b] mb-2" />
          <p className="text-xs">{t('جاري تحميل بيانات الخزائن من الخادم...')}</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl text-red-800 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      ) : cashboxes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cashboxes.map(till => (
            <div
              key={till.id}
              data-testid={`cashbox-card-${till.code || 'till'}`}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#9e1b1b]/10 text-[#9e1b1b]">
                    <Vault className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {till.name || 'خزينة الفرع'}
                    </h3>
                    <span className="font-mono text-xs text-slate-400">{till.code || 'CB-01'}</span>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    till.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {till.status === 'ACTIVE' ? 'نشطة ومؤمنة' : 'قيد المراجعة'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('الرصيد الدفتري الحالي:')}</span>
                  <span className="font-black text-slate-900 dark:text-white text-sm">
                    {Number(till.currentBalance || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('الفرع المالي:')}</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {till.branch?.name || 'الفرع الرئيسي (الدقي)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('أمين الخزينة المعين:')}</span>
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    {till.assignedCashier?.name || till.assignedCashier?.email || 'المحاسب المعتمد'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div data-testid="cashbox-empty-state" className="py-12 text-center text-slate-500 space-y-2">
          <Vault className="w-8 h-8 mx-auto text-slate-400" />
          <p className="text-sm font-bold">{t('لا توجد خزائن معينة لهذا الفرع حالياً')}</p>
        </div>
      )}
    </div>
  );
}
