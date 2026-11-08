import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Landmark,
  Receipt,
  Vault,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Building2,
  User,
  ArrowUpRight,
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { accountingService } from '../../services/accounting.service';

interface FinancialSummaryData {
  currency: string;
  lifetime: {
    totalCollections: number;
    collectionsCount: number;
    totalExpenses: number;
    expensesCount: number;
    netOperatingBalance: number;
  };
  currentMonth: {
    totalCollections: number;
    collectionsCount: number;
    totalExpenses: number;
    expensesCount: number;
    netOperatingBalance: number;
  };
  liquidity: {
    cashInTills: number;
    activeCashboxesCount: number;
  };
  receivables: {
    totalArrears: number;
    overdueObligationsCount: number;
  };
}

export default function ManagerAccountsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'collections' | 'cashboxes' | 'subledgers' | 'expenses' | 'policy'>('overview');

  // Loading & Error States
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data States
  const [summary, setSummary] = useState<FinancialSummaryData | null>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [cashboxes, setCashboxes] = useState<any[]>([]);
  const [subledgers, setSubledgers] = useState<any[]>([]);
  const [arrearsReport, setArrearsReport] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [policy, setPolicy] = useState<any | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [approvingVoucherId, setApprovingVoucherId] = useState<string | null>(null);

  // Load Executive Summary
  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      setErrorBanner(null);
      const res = await accountingService.getFinancialSummary();
      setSummary(res);
    } catch (err: any) {
      console.error('Failed to load financial summary:', err);
      setErrorBanner(t('تعذر تحميل الملخص المالي التنفيذي من الخادم. يرجى التحقق من صلاحيات الحساب.'));
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Load Tab Specific Data
  const fetchTabData = useCallback(async (tab: string) => {
    try {
      setLoadingData(true);
      if (tab === 'overview' || tab === 'collections') {
        const res = await accountingService.getCollections({ limit: 20 });
        setCollections(res?.collections || res?.data || (Array.isArray(res) ? res : []));
      }
      if (tab === 'overview' || tab === 'cashboxes') {
        const res = await accountingService.getCashboxes();
        setCashboxes(res?.cashboxes || res?.data || (Array.isArray(res) ? res : []));
      }
      if (tab === 'subledgers') {
        const [subRes, arrRes] = await Promise.allSettled([
          accountingService.getStudentSubLedgers({ limit: 20 }),
          accountingService.getArrearsReport()
        ]);
        if (subRes.status === 'fulfilled' && subRes.value) {
          setSubledgers(subRes.value?.students || subRes.value?.data || (Array.isArray(subRes.value) ? subRes.value : []));
        }
        if (arrRes.status === 'fulfilled' && arrRes.value) {
          setArrearsReport(arrRes.value?.arrears || arrRes.value?.report || (Array.isArray(arrRes.value) ? arrRes.value : []));
        }
      }
      if (tab === 'expenses') {
        const res = await accountingService.getExpenses({ limit: 20 });
        setExpenses(res?.vouchers || res?.data || (Array.isArray(res) ? res : []));
      }
      if (tab === 'policy') {
        const res = await accountingService.getFinancialAccessPolicy();
        setPolicy(res?.policy || res || null);
      }
    } catch (err: any) {
      console.error(`Failed to load ${tab} data:`, err);
      toast.error(`تعذر تحميل بيانات ${tab}`);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchTabData(activeTab);
  }, [fetchSummary, fetchTabData, activeTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchSummary(), fetchTabData(activeTab)]);
    setIsRefreshing(false);
    toast.success(t('تم تحديث البيانات المالية بنجاح'));
  };

  const handleApproveExpense = async (voucherId: string, decision: 'APPROVE' | 'REJECT') => {
    setApprovingVoucherId(voucherId);
    try {
      await accountingService.approveExpenseVoucher(voucherId, decision, decision === 'APPROVE' ? 'معتمد من المدير التنفيذي' : 'مرفوض من الإدارة');
      toast.success(decision === 'APPROVE' ? 'تم اعتماد سند الصرف بنجاح' : 'تم رفض سند الصرف');
      await fetchTabData('expenses');
      await fetchSummary();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'فشل تحديث حالة السند');
    } finally {
      setApprovingVoucherId(null);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>{t('الرئيسية')}</span>
            <span>/</span>
            <span className="text-[#9e1b1b] font-bold">{t('الحسابات والإدارة المالية (PM-ACC-01)')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2.5">
            <Landmark className="w-6 h-6 text-[#9e1b1b]" />
            {t('المركز المالي وحسابات المؤسسة المركزية')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('رقابة تنفيذية موحدة على الإيرادات، التحصيلات، الخزائن، الذمم المالية، وسندات الصرف')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-border text-card-foreground text-xs font-bold text-foreground hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#9e1b1b]' : ''}`} />
            <span>{t('تحديث البيانات')}</span>
          </button>
          <button
            onClick={() => navigate('/manager/financial-policy')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#9e1b1b] hover:bg-[#851616] text-white text-xs font-bold transition-all shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t('حوكمة الرسوم والمهلة')}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div data-testid="accounts-error-banner" className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-3 text-red-900 dark:text-red-200 text-xs">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block mb-1">{t('خطأ في الاتصال بالخدمة المالية')}</span>
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={fetchSummary}
            className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] hover:bg-red-700 transition-colors"
          >
            {t('إعادة المحاولة')}
          </button>
        </div>
      )}

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Collections */}
        <div className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">{t('إجمالي التحصيلات (الكلية)')}</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {loadingSummary ? '...' : `${Number(summary?.lifetime?.totalCollections || 0).toLocaleString()} ${summary?.currency || 'EGP'}`}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{t('الشهر الحالي:')}</span>
            <span className="font-bold text-emerald-600">
              {loadingSummary ? '...' : `${Number(summary?.currentMonth?.totalCollections || 0).toLocaleString()} ${summary?.currency || 'EGP'}`}
            </span>
          </div>
        </div>

        {/* Card 2: Cashbox Liquidity */}
        <div className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">{t('السيولة النقدية بالخزائن')}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Vault className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {loadingSummary ? '...' : `${Number(summary?.liquidity?.cashInTills || 0).toLocaleString()} ${summary?.currency || 'EGP'}`}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{t('الخزائن النشطة:')}</span>
            <span className="font-bold text-blue-600">
              {loadingSummary ? '...' : `${summary?.liquidity?.activeCashboxesCount || 0} خزائن`}
            </span>
          </div>
        </div>

        {/* Card 3: Arrears & Receivables */}
        <div className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">{t('الذمم والمتأخرات المستحقة')}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {loadingSummary ? '...' : `${Number(summary?.receivables?.totalArrears || 0).toLocaleString()} ${summary?.currency || 'EGP'}`}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{t('التزامات واجبة التحصيل:')}</span>
            <span className="font-bold text-amber-600">
              {loadingSummary ? '...' : `${summary?.receivables?.overdueObligationsCount || 0} ذمة`}
            </span>
          </div>
        </div>

        {/* Card 4: Operating Expenses */}
        <div className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">{t('المصروفات التشغيلية المعتمدة')}</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground">
            {loadingSummary ? '...' : `${Number(summary?.lifetime?.totalExpenses || 0).toLocaleString()} ${summary?.currency || 'EGP'}`}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span>{t('صافي الرصيد التشغيلي:')}</span>
            <span className="font-bold text-purple-600">
              {loadingSummary ? '...' : `${Number(summary?.lifetime?.netOperatingBalance || 0).toLocaleString()} ${summary?.currency || 'EGP'}`}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-border overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('overview')}
          data-testid="tab-overview"
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-[#9e1b1b] text-[#9e1b1b] bg-[#9e1b1b]/5 dark:bg-[#9e1b1b]/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t('نظرة عامة والتحصيلات الأخيرة')}
        </button>
        <button
          onClick={() => setActiveTab('cashboxes')}
          data-testid="tab-cashboxes"
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'cashboxes'
              ? 'border-[#9e1b1b] text-[#9e1b1b] bg-[#9e1b1b]/5 dark:bg-[#9e1b1b]/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t('الخزائن المركزية (')}{cashboxes.length})
        </button>
        <button
          onClick={() => setActiveTab('subledgers')}
          data-testid="tab-subledgers"
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'subledgers'
              ? 'border-[#9e1b1b] text-[#9e1b1b] bg-[#9e1b1b]/5 dark:bg-[#9e1b1b]/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t('سجل ذمم الطلاب والمتأخرات')}
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          data-testid="tab-expenses"
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'expenses'
              ? 'border-[#9e1b1b] text-[#9e1b1b] bg-[#9e1b1b]/5 dark:bg-[#9e1b1b]/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t('سندات الصرف والاعتمادات')}
        </button>
        <button
          onClick={() => setActiveTab('policy')}
          data-testid="tab-policy"
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'policy'
              ? 'border-[#9e1b1b] text-[#9e1b1b] bg-[#9e1b1b]/5 dark:bg-[#9e1b1b]/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {t('سياسة الحوكمة والمهلة')}
        </button>
      </div>

      {/* Tab 1: Overview & Recent Collections */}
      {(activeTab === 'overview' || activeTab === 'collections') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#9e1b1b]" />
              {t('سجل التحصيلات والمقبوضات المعتمدة')}
            </h3>
            <span className="text-xs text-slate-500">
              {t('عرض أحدث')} {collections.length} {t('عمليات مسجلة')}
            </span>
          </div>

          <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">{t('رقم الإيصال')}</th>
                    <th className="py-3 px-4">{t('الطالب / المسدد')}</th>
                    <th className="py-3 px-4">{t('الخزينة المستلمة')}</th>
                    <th className="py-3 px-4">{t('المحصل')}</th>
                    <th className="py-3 px-4">{t('المبلغ')}</th>
                    <th className="py-3 px-4">{t('التاريخ')}</th>
                    <th className="py-3 px-4">{t('الحالة')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingData ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {t('جاري تحميل سجل التحصيلات...')}
                      </td>
                    </tr>
                  ) : collections.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {t('لا توجد تحصيلات مسجلة حتى الآن.')}
                      </td>
                    </tr>
                  ) : (
                    collections.map((c: any) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-[#9e1b1b] dark:text-red-400">
                          {c.receiptNumber || `#${c.id.slice(0, 8)}`}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {c.student?.name || c.payerName || 'طالب مقيد'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {c.cashbox?.name || c.cashbox?.code || 'الخزينة الرئيسية'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {c.cashier?.name || 'محاسب الفرع'}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600 font-mono">
                          +{Number(c.amountCollected || c.amount || 0).toLocaleString()} {c.currency || 'EGP'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {c.collectedAt ? new Date(c.collectedAt).toLocaleDateString('ar-EG') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800/50">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('محصل ومعتمد')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Cashboxes */}
      {activeTab === 'cashboxes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Vault className="w-4 h-4 text-blue-600" />
              {t('سجل الخزائن النقدية وأرصدة الفروع')}
            </h3>
            <span className="text-xs text-slate-500">
              {t('إجمالي')} {cashboxes.length} {t('خزينة مسجلة')}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingData ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                {t('جاري تحميل بيانات الخزائن...')}
              </div>
            ) : cashboxes.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                {t('لا توجد خزائن نقدية مسجلة حالياً.')}
              </div>
            ) : (
              cashboxes.map((cb: any) => (
                <div key={cb.id} className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 block">
                        {cb.code}
                      </span>
                      <h4 className="text-sm font-bold text-foreground mt-0.5">
                        {cb.name}
                      </h4>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                      {t('نشطة ومؤمنة')}
                    </span>
                  </div>

                  <div className="p-3 bg-muted/60 text-muted-foreground rounded-xl flex items-center justify-between">
                    <span className="text-xs text-slate-500">{t('الرصيد الدفتري الحالي:')}</span>
                    <span className="text-base font-black text-foreground font-mono">
                      {Number(cb.currentBalance || 0).toLocaleString()} {cb.currency || 'EGP'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>{t('الفرع المرتبط:')}</span>
                      <span className="font-medium text-foreground">
                        {cb.branch?.name || cb.branch?.code || 'الفرع الرئيسي'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t('أمين العهدة / الكاشير:')}</span>
                      <span className="font-medium text-foreground">
                        {cb.assignedCashier?.name || 'غير مخصص'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Student Sub-Ledgers & Arrears */}
      {activeTab === 'subledgers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              {t('سجل الذمم المالية ومتأخرات الطلاب')}
            </h3>
            <span className="text-xs text-slate-500">
              {t('إجمالي')} {arrearsReport.length} {t('ذمم متأخرة واجبة التحصيل')}
            </span>
          </div>

          <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">{t('الطالب')}</th>
                    <th className="py-3 px-4">{t('رقم الهاتف')}</th>
                    <th className="py-3 px-4">{t('رقم الاتفاقية')}</th>
                    <th className="py-3 px-4">{t('المبلغ المستحق')}</th>
                    <th className="py-3 px-4">{t('المحصل')}</th>
                    <th className="py-3 px-4">{t('المتبقي المتأخر')}</th>
                    <th className="py-3 px-4">{t('تاريخ الاستحقاق')}</th>
                    <th className="py-3 px-4">{t('أيام التأخير')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingData ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {t('جاري تحميل سجل المتأخرات...')}
                      </td>
                    </tr>
                  ) : arrearsReport.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {t('لا توجد متأخرات مالية مستحقة حالياً. جميع الحسابات منتظمة!')}
                      </td>
                    </tr>
                  ) : (
                    arrearsReport.map((arr: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-foreground">
                          {arr.studentName || 'طالب'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500" dir="ltr">
                          {arr.studentPhone || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {arr.agreementNumber || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">
                          {Number(arr.amountDue || 0).toLocaleString()} EGP
                        </td>
                        <td className="py-3 px-4 font-mono text-emerald-600">
                          {Number(arr.amountCollected || 0).toLocaleString()} EGP
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">
                          {Number(arr.outstandingAmount || 0).toLocaleString()} EGP
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {arr.dueDate ? new Date(arr.dueDate).toLocaleDateString('ar-EG') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200 dark:border-amber-900/50">
                            {arr.daysOverdue > 0 ? `${arr.daysOverdue} يوم تأخير` : 'مستحق اليوم'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Expense Vouchers & Approvals */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-purple-600" />
              {t('سندات الصرف واعتمادات المدير التنفيذي')}
            </h3>
            <span className="text-xs text-slate-500">
              {t('إجمالي')} {expenses.length} {t('سند صرف مسجل')}
            </span>
          </div>

          <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-muted/60 text-muted-foreground border-b border-border text-slate-500 font-bold">
                  <tr>
                    <th className="py-3 px-4">{t('رقم السند')}</th>
                    <th className="py-3 px-4">{t('بند المصروف')}</th>
                    <th className="py-3 px-4">{t('المستفيد')}</th>
                    <th className="py-3 px-4">{t('المبلغ')}</th>
                    <th className="py-3 px-4">{t('الحالة')}</th>
                    <th className="py-3 px-4">{t('التاريخ')}</th>
                    <th className="py-3 px-4">{t('إجراء المدير')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loadingData ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {t('جاري تحميل سندات الصرف...')}
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {t('لا توجد سندات صرف مسجلة حالياً.')}
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp: any) => (
                      <tr key={exp.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">
                          {exp.voucherNumber || `#${exp.id.slice(0, 8)}`}
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {exp.category || exp.description || 'مصروف عام'}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {exp.payeeName || '—'}
                        </td>
                        <td className="py-3 px-4 font-bold text-purple-600 font-mono">
                          {Number(exp.amount || 0).toLocaleString()} {exp.currency || 'EGP'}
                        </td>
                        <td className="py-3 px-4">
                          {exp.status === 'APPLIED' || exp.status === 'DISBURSED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('تم الصرف')}
                            </span>
                          ) : exp.status === 'APPROVED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
                              {t('معتمد - بانتظار الصرف')}
                            </span>
                          ) : exp.status === 'REJECTED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 border border-red-200">
                              {t('مرفوض')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
                              {t('بانتظار اعتماد المدير')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {exp.createdAt ? new Date(exp.createdAt).toLocaleDateString('ar-EG') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {exp.status === 'DRAFT' || exp.status === 'PENDING_APPROVAL' ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleApproveExpense(exp.id, 'APPROVE')}
                                disabled={approvingVoucherId === exp.id}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors disabled:opacity-50"
                              >
                                {t('اعتماد')}
                              </button>
                              <button
                                onClick={() => handleApproveExpense(exp.id, 'REJECT')}
                                disabled={approvingVoucherId === exp.id}
                                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] transition-colors disabled:opacity-50"
                              >
                                {t('رفض')}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Financial Policy Governance */}
      {activeTab === 'policy' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#9e1b1b] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {t('حوكمة سياسة الرسوم الشهرية والمهلة')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('التحكم في مهلة السداد وتفعيل الإيقاف التلقائي للوصول الأكاديمي')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/manager/financial-policy')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#9e1b1b] text-white text-xs font-bold hover:bg-[#851616] transition-colors"
              >
                <span>{t('فتح صفحة الإعدادات الكاملة')}</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-muted/60 text-muted-foreground rounded-xl">
                <span className="text-xs text-slate-500 block mb-1">{t('نمط السياسة الحالي:')}</span>
                <span className="text-base font-bold text-foreground">
                  {policy?.policyMode === 'PER_BRANCH' ? 'مخصص لكل فرع (PER_BRANCH)' : 'موحد على المؤسسة (GLOBAL)'}
                </span>
              </div>
              <div className="p-4 bg-muted/60 text-muted-foreground rounded-xl">
                <span className="text-xs text-slate-500 block mb-1">{t('فترة السماح الافتراضية:')}</span>
                <span className="text-base font-bold text-[#9e1b1b]">
                  {policy?.gracePeriodDays ?? 7} {t('أيام بعد الاستحقاق')}
                </span>
              </div>
              <div className="p-4 bg-muted/60 text-muted-foreground rounded-xl">
                <span className="text-xs text-slate-500 block mb-1">{t('حالة نظام الحظر التلقائي:')}</span>
                <span className={`text-base font-bold ${policy?.isEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {policy?.isEnabled ? 'مفعل وقيد التشغيل' : 'معطل مؤقتاً'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">{t('ملاحظة أمنية تنظيمية:')}</span>
                <span>
                  {t('تعديل مهل السداد وسياسات الحجب واستثناءات الفروع محصورة حصراً بالمدير التنفيذي (Primary Manager) ولا يملك المحاسبون (Accountants) أي صلاحية لتغيير هذه السياسات.')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
