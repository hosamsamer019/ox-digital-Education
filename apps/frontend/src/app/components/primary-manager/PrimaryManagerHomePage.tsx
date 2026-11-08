import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useMemo } from 'react';
import {
  Building2,
  RefreshCw,
  FileDown,
  Receipt,
  AlertCircle,
  Vault,
  TrendingUp,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Search,
  Filter,
  Eye,
  Check,
  X,
  ExternalLink,
  Info,
  ChevronDown,
  ArrowUpDown,
  Lock,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BRANCH_SCOPES,
  KPIS_BY_SCOPE,
  BRANCH_PERFORMANCE_LIST,
  INITIAL_APPROVAL_QUEUE,
  AUDITED_MOVEMENTS
} from './mockData';
import { BranchScopeId, ApprovalQueueItem, AuditedFinancialMovement } from './types';

export default function PrimaryManagerHomePage() {
  const { t } = useLanguage();
  const [selectedScope, setSelectedScope] = useState<BranchScopeId>('INST-CONSOLIDATED');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState<'ALL' | 'COLLECTION' | 'TRANSFER' | 'EXPENSE'>('ALL');
  const [approvalQueue, setApprovalQueue] = useState<ApprovalQueueItem[]>(INITIAL_APPROVAL_QUEUE);
  const [selectedMovement, setSelectedMovement] = useState<AuditedFinancialMovement | null>(null);

  // Active KPI values based on selected branch scope
  const kpis = useMemo(() => {
    return KPIS_BY_SCOPE[selectedScope] || KPIS_BY_SCOPE['INST-CONSOLIDATED'];
  }, [selectedScope]);

  // Current scope metadata
  const currentScopeMeta = useMemo(() => {
    return BRANCH_SCOPES.find(s => s.id === selectedScope) || BRANCH_SCOPES[0];
  }, [selectedScope]);

  // Filtered movements based on search, movement type, and branch scope
  const filteredMovements = useMemo(() => {
    return AUDITED_MOVEMENTS.filter(m => {
      // Branch scope filtering
      if (selectedScope !== 'INST-CONSOLIDATED' && m.branchId !== selectedScope) {
        return false;
      }
      // Movement type filter
      if (movementFilter !== 'ALL' && m.movementType !== movementFilter) {
        return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          m.receiptNumber.toLowerCase().includes(q) ||
          m.partyName.toLowerCase().includes(q) ||
          m.cashierName.toLowerCase().includes(q) ||
          m.branchName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedScope, movementFilter, searchQuery]);

  // Refresh trigger handler
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success(t('تم تحديث المؤشرات المالية والتشغيلية بنجاح'), {
        description: 'جميع البيانات المحدثة مطابقة للمحفظة التجريبية المعتمدة (DEMO DATA)'
      });
    }, 600);
  };

  // Export PDF trigger handler
  const handleExportPdf = () => {
    toast.info(t('جاري إعداد التقرير المالي التنفيذي (PDF)...'), {
      description: 'سيتم تصدير ملخص مؤشرات الفروع وقوائم المقبوضات المعتمدة'
    });
    setTimeout(() => {
      toast.success(t('تم تجهيز التقرير التنفيذي بنجاح'), {
        description: 'تقرير الحوكمة المالية لشهر نوفمبر 2026 جاهز للطباعة والتحميل'
      });
    }, 1200);
  };

  // Approval handlers
  const handleApproveItem = (item: ApprovalQueueItem) => {
    setApprovalQueue(prev =>
      prev.map(q => (q.id === item.id ? { ...q, status: 'APPROVED' } : q))
    );
    toast.success(`تم اعتماد الطلب بنجاح: ${item.referenceNumber}`, {
      description: `${item.title} — تم توثيق الاعتماد الرقمي في سجل التدقيق المالي`
    });
  };

  const handleRejectItem = (item: ApprovalQueueItem) => {
    setApprovalQueue(prev =>
      prev.map(q => (q.id === item.id ? { ...q, status: 'REJECTED' } : q))
    );
    toast.error(`تم رفض الطلب وإعادته للمُعِد: ${item.referenceNumber}`, {
      description: 'تم تسجيل قرار الرفض وإشعار المحاسب لمراجعة بنود السند'
    });
  };

  const handleNeutralInvestigation = (item: ApprovalQueueItem) => {
    toast.warning(`تم فتح ملف المراجعة المحايد: ${item.referenceNumber}`, {
      description: 'عملاً بسياسة UP-705، يظل الفرق قيد التحقيق دون تسوية تلقائية أو تحميل للكاشير'
    });
  };

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & BREADCRUMBS WITH BRANCH SCOPE SELECTOR */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
            <span>{t('الرئيسية')}</span>
            <span>/</span>
            <span className="text-[#9e1b1b] dark:text-red-400 font-bold">{t('لوحة القيادة التنفيذية (PM-DASH-01)')}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {t('لوحة الإدارة المركزية والحوكمة المالية')}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300/40">
              {t('بيانات تجريبية استرشادية')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t('متابعة السيولة النقدية، مقبوضات الفروع، واعتمادات الصرف وفق معايير المحاسبة المعتمدة')}
          </p>
        </div>

        {/* Executive Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Scope Dropdown Selector */}
          <div className="relative">
            <label htmlFor="branch-scope-select" className="sr-only">
              {t('نطاق الفرع')}
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-card-foreground shadow-xs">
              <Building2 className="w-4 h-4 text-[#9e1b1b] dark:text-red-400 shrink-0" />
              <select
                id="branch-scope-select"
                value={selectedScope}
                onChange={e => setSelectedScope(e.target.value as BranchScopeId)}
                className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden cursor-pointer"
              >
                {BRANCH_SCOPES.map(scope => (
                  <option key={scope.id} value={scope.id} className="dark:bg-slate-900">
                    {scope.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-foreground bg-card border border-border text-card-foreground hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors shadow-xs disabled:opacity-60"
            title={t('تحديث مؤشرات اللوحة')}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#9e1b1b]' : ''}`} />
            <span>{t('تحديث البيانات')}</span>
          </button>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] dark:bg-[#9e1b1b] dark:hover:bg-[#b01e1e] transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            <span>{t('تصدير ملخص PDF')}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. DEMO DATA WARNING BANNER */}
      {/* ========================================================================= */}
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200">
        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm">
          <span className="font-black">{t('تنبيه نظام المعاينة البصرية:')}</span> {t('جميع الأرقام، فوارق الجرد، وأسماء الطلاب\n          والمعلمين المعروضة في هذه اللوحة هي')}{' '}
          <strong className="underline decoration-amber-500 font-black">{t('بيانات تجريبية استرشادية (DEMO DATA — NOT REAL)')}</strong>{' '}
          {t('لغرض التحقق من ملاءمة الواجهة وتجربة المستخدم. لم يتم الاتصال بقاعدة البيانات الحية أو إنشاء قيود مالية فعلية.')}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION 1: 4 FINANCIAL KPI TILES */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#9e1b1b]" />
            {t('المؤشرات المالية الرئيسية —')} {currentScopeMeta.name}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t('العملة المعتمدة: الجنيه المصري (EGP)')}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Actual Collections */}
          <div className="relative overflow-hidden p-5 rounded-2xl bg-card border border-border text-card-foreground shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('إجمالي التحصيلات الفعلية')}
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/30">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {kpis.actualCollections.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span>{t('المقبوض اليوم:')}</span>
                <span className="font-bold">
                  {kpis.collectionsToday.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                </span>
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{t('نقدية وبطاقات محصلة فعلياً')}</span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                DEMO DATA
              </span>
            </div>
          </div>

          {/* KPI 2: Overdue Receivables */}
          <div className="relative overflow-hidden p-5 rounded-2xl bg-card border border-border text-card-foreground shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('المستحقات المتأخرة والواجبة')}
              </span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/30">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {kpis.overdueReceivables.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                <span>{t('متأخرات حرجة (&gt;30 يوم):')}</span>
                <span className="font-bold">
                  {kpis.criticalOverdue.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                </span>
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{t('حان موعد استحقاقها ولم تسدد')}</span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                DEMO DATA
              </span>
            </div>
          </div>

          {/* KPI 3: Cashbox Liquidity */}
          <div className="relative overflow-hidden p-5 rounded-2xl bg-card border border-border text-card-foreground shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('رصيد السيولة بالخزائن')}
              </span>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/30">
                <Vault className="w-5 h-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {kpis.cashboxLiquidity.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1">
                <span>{t('الخزائن النشطة:')}</span>
                <span className="font-bold">{kpis.activeCashboxesCount} {t('خزائن حضورية')}</span>
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{t('سيولة نقدية دفترية مؤكدة')}</span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                DEMO DATA
              </span>
            </div>
          </div>

          {/* KPI 4: Recognized Revenue */}
          <div className="relative overflow-hidden p-5 rounded-2xl bg-card border border-border text-card-foreground shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {t('الإيراد التعليمي المحقق')}
              </span>
              <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#9e1b1b] dark:text-red-400 border border-red-200/60 dark:border-red-800/30">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                {kpis.recognizedRevenue.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
              </div>
              <p className="text-xs text-[#9e1b1b] dark:text-red-400 font-semibold flex items-center gap-1">
                <span>{t('الحصص المعتمدة:')}</span>
                <span className="font-bold">{kpis.certifiedLessonsCount} {t('حصة منفذة')}</span>
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>{t('وفق إثبات الحضور (OD-722.4)')}</span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px]">
                DEMO DATA
              </span>
            </div>
          </div>
        </div>

        {/* Accounting Separation Defense Notice */}
        <div className="mt-3 p-3 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#9e1b1b] shrink-0" />
            <span>
              <strong>{t('قاعدة الفصل المحاسبي الصارمة:')}</strong> {t('التحصيلات (')}{kpis.actualCollections.toLocaleString('ar-EG')} {t('ج.م) ≠\n              المستحقات (')}{kpis.overdueReceivables.toLocaleString('ar-EG')} {t('ج.م) ≠ رصيد الخزائن (')}
              {kpis.cashboxLiquidity.toLocaleString('ar-EG')} {t('ج.م) ≠ الإيراد المحقق (')}{kpis.recognizedRevenue.toLocaleString('ar-EG')} {t('ج.م).\n              يُمنع دمج هذه الأرقام في إجمالي واحد منعاً للتضليل المحاسبي.')}
            </span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">OD-703 • UP-714</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SECTION 2: OPERATIONAL ALERT & MAKER-CHECKER BAR */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-red-50 via-amber-50 to-orange-50 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900 border border-red-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950 text-[#9e1b1b] dark:text-red-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">
                {t('تنبيهات التدقيق والاعتمادات المعلقة (Maker-Checker Hub)')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {t('يوجد')} <strong className="text-red-700 dark:text-red-400 font-bold">{t('(3) طلبات اعتماد')}</strong> {t('تتطلب توقيع\n                المدير الرئيسي، ومحضر جرد خزينة يتضمن عجزاً قيد المراجعة الإدارية المحايدة تحت سياسة UP-705.')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="#pending-approvals"
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] transition-colors shadow-xs"
            >
              {t('الانتقال لطابور الموافقات (')}{approvalQueue.filter(q => q.status === 'SUBMITTED' || q.status === 'UNDER_INVESTIGATION').length})
            </a>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. SECTION 3: SPLIT OPERATIONAL CANVAS (60% BRANCHES : 40% APPROVALS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WIDGET A: Branch Performance Overview Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#9e1b1b]" />
              {t('أداء الفروع وحالة الخزائن النقدية')}
            </h2>
            <span className="text-xs text-slate-500">{t('2 فروع حضورية نشطة + 1 منصة رقمية مؤجلة')}</span>
          </div>

          <div className="space-y-3">
            {BRANCH_PERFORMANCE_LIST.map(branch => {
              const isSelected = selectedScope === branch.id;
              return (
                <div
                  key={branch.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    branch.status === 'DEFERRED'
                      ? 'bg-muted/40 border-dashed border-border opacity-80'
                      : isSelected
                      ? 'bg-card text-card-foreground border-[#9e1b1b] dark:border-[#9e1b1b] shadow-md ring-1 ring-[#9e1b1b]/20'
                      : 'bg-card border-border text-card-foreground shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2 rounded-xl text-white font-bold text-xs ${
                          branch.status === 'DEFERRED'
                            ? 'bg-slate-400'
                            : branch.isHeadquarters
                            ? 'bg-[#9e1b1b]'
                            : 'bg-slate-700'
                        }`}
                      >
                        {branch.code}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          {branch.name}
                          {branch.isHeadquarters && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-[#9e1b1b] dark:bg-red-950 dark:text-red-300 font-bold">
                              {t('المقر الرئيسي')}
                            </span>
                          )}
                        </h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {branch.statusLabel}
                        </span>
                      </div>
                    </div>

                    {/* Closing Status Badge */}
                    <div className="shrink-0 text-left">
                      {branch.closingStatus === 'BALANCED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('مطابقة تامة')}
                        </span>
                      )}
                      {branch.closingStatus === 'DISCREPANCY_INVESTIGATION' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/60">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {t('عجز -150 ج.م (UP-705)')}
                        </span>
                      )}
                      {branch.closingStatus === 'NOT_APPLICABLE' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {t('غير منطبق')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Branch Metrics Grid */}
                  {branch.status === 'DEFERRED' ? (
                    <div className="p-3 rounded-xl bg-muted text-muted-foreground/60 text-xs text-slate-500 text-center">
                      {t('مؤجل — عمليات المنصة الرقمية وبوابات الدفع الإلكتروني خارج النطاق المالي الحالي (التركيز على الفروع الحضورية أولاً).')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                        <span className="text-slate-500 block text-[11px]">{t('التحصيلات')}</span>
                        <span className="font-bold text-foreground">
                          {branch.collections?.toLocaleString('ar-EG')} {t('ج.م')}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                        <span className="text-slate-500 block text-[11px]">{t('رصيد الخزينة')}</span>
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {branch.cashboxBalance?.toLocaleString('ar-EG')} {t('ج.م')}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                        <span className="text-slate-500 block text-[11px]">{t('الإيراد المحقق')}</span>
                        <span className="font-bold text-red-700 dark:text-red-300">
                          {branch.recognizedRevenue?.toLocaleString('ar-EG')} {t('ج.م')}
                        </span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                        <span className="text-slate-500 block text-[11px]">{t('المتأخرات')}</span>
                        <span className="font-bold text-amber-700 dark:text-amber-300">
                          {branch.overdueReceivables?.toLocaleString('ar-EG')} {t('ج.م')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Quick Filter Trigger */}
                  {branch.status === 'ACTIVE' && (
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        onClick={() => setSelectedScope(branch.id as BranchScopeId)}
                        className={`text-xs font-bold transition-colors ${
                          isSelected ? 'text-[#9e1b1b] underline' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {isSelected ? '← جاري عرض بيانات هذا الفرع' : 'تصفية اللوحة لهذا الفرع ←'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* WIDGET B: Pending Approvals Queue (5 cols) */}
        <div id="pending-approvals" className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#9e1b1b]" />
              {t('قائمة طلبات الاعتماد (Maker-Checker)')}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-[#9e1b1b] dark:bg-red-950 dark:text-red-300">
              {approvalQueue.filter(q => q.status === 'SUBMITTED' || q.status === 'UNDER_INVESTIGATION').length} {t('معلق')}
            </span>
          </div>

          <div className="space-y-3">
            {approvalQueue.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground text-foreground mb-1">
                      {item.referenceNumber}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                      {item.title}
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {item.branchName} • {item.submittedBy}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      item.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : item.status === 'REJECTED'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                        : item.status === 'UNDER_INVESTIGATION'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}
                  >
                    {item.status === 'APPROVED'
                      ? 'تم الاعتماد'
                      : item.status === 'REJECTED'
                      ? 'مرفوض'
                      : item.status === 'UNDER_INVESTIGATION'
                      ? 'قيد التحقيق (UP-705)'
                      : 'بانتظار الاعتماد'}
                  </span>
                </div>

                {/* Justification & Attachments */}
                <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p>{item.justification}</p>
                  {item.policyReference && (
                    <p className="mt-1 font-bold text-[#9e1b1b] dark:text-red-400 text-[11px]">
                      {t('مرجع الحوكمة:')} {item.policyReference}
                    </p>
                  )}
                  {item.supportingDocuments.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-semibold">{t('المرفقات:')}</span>
                      {item.supportingDocuments.map((doc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-700 text-[10px] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          {doc}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {item.status === 'SUBMITTED' && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => handleRejectItem(item)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 transition-colors"
                    >
                      {t('رفض الطلب')}
                    </button>
                    <button
                      onClick={() => handleApproveItem(item)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] transition-colors shadow-xs"
                    >
                      {t('اعتماد الصرف')}
                    </button>
                  </div>
                )}
                {item.status === 'UNDER_INVESTIGATION' && (
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => handleNeutralInvestigation(item)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 transition-colors"
                    >
                      {t('فتح ملف التحقيق المحايد (UP-705)')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. SECTION 4: RECENT AUDITED TRANSACTIONS TABLE */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#9e1b1b]" />
              {t('أحدث حركات المقبوضات والتحويلات المعتمدة (سجل الخزائن الحي)')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('عرض تفصيلي للحركات المالية المنفذة فعلياً بالخزائن عبر كافة الفروع')}
            </p>
          </div>

          {/* Table Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('بحث برقم الإيصال أو الاسم...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pr-9 pl-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-foreground focus:outline-hidden focus:ring-1 focus:ring-[#9e1b1b] w-48 sm:w-60"
              />
            </div>

            {/* Movement Type Filter Tabs */}
            <div className="inline-flex rounded-xl bg-muted text-muted-foreground p-1 text-xs font-semibold">
              <button
                onClick={() => setMovementFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  movementFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-700 text-foreground shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('الكل')}
              </button>
              <button
                onClick={() => setMovementFilter('COLLECTION')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  movementFilter === 'COLLECTION'
                    ? 'bg-white dark:bg-slate-700 text-foreground shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('تحصيلات')}
              </button>
              <button
                onClick={() => setMovementFilter('TRANSFER')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  movementFilter === 'TRANSFER'
                    ? 'bg-white dark:bg-slate-700 text-foreground shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('تحويلات')}
              </button>
              <button
                onClick={() => setMovementFilter('EXPENSE')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  movementFilter === 'EXPENSE'
                    ? 'bg-white dark:bg-slate-700 text-foreground shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {t('مصروفات')}
              </button>
            </div>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-border text-slate-500 dark:text-slate-400 font-bold">
                <th className="py-3 px-3">{t('رقم الإيصال / المرجع')}</th>
                <th className="py-3 px-3">{t('الطرف / الطالب')}</th>
                <th className="py-3 px-3">{t('نوع الحركة')}</th>
                <th className="py-3 px-3">{t('المبلغ')}</th>
                <th className="py-3 px-3">{t('طريقة الدفع')}</th>
                <th className="py-3 px-3">{t('الفرع والخزينة')}</th>
                <th className="py-3 px-3">{t('الكاشير / المنفذ')}</th>
                <th className="py-3 px-3">{t('التوقيت')}</th>
                <th className="py-3 px-3 text-center">{t('الإجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {t('لا توجد حركات مطابقة لمعايير البحث في هذا النطاق')}
                  </td>
                </tr>
              ) : (
                filteredMovements.map(mov => (
                  <tr
                    key={mov.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-foreground">
                      {mov.receiptNumber}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">
                      {mov.partyName}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          mov.movementType === 'COLLECTION'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : mov.movementType === 'TRANSFER'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            : 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                        }`}
                      >
                        {mov.movementTypeLabel}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-foreground">
                      {mov.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {mov.paymentMethodLabel}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold block">{mov.branchName}</span>
                      <span className="text-[10px] font-mono text-slate-400">{mov.cashboxCode}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {mov.cashierName}
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">{mov.timestamp}</td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setSelectedMovement(mov)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#9e1b1b] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title={t('عرض تفاصيل القيد المالي')}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. TRANSACTION DETAIL MODAL */}
      {/* ========================================================================= */}
      {selectedMovement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-card border border-border text-card-foreground shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#9e1b1b]" />
                <h3 className="font-bold text-foreground">
                  {t('تفاصيل الحركة المالية:')} {selectedMovement.receiptNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMovement(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('الطرف / الطالب')}</span>
                  <span className="font-bold text-foreground">
                    {selectedMovement.partyName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('المبلغ المعتمد')}</span>
                  <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                    {selectedMovement.amount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('الفرع التشغيلي')}</span>
                  <span className="font-semibold text-foreground">
                    {selectedMovement.branchName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('الخزينة المستفيدة')}</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedMovement.cashboxCode}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('طريقة الدفع')}</span>
                  <span className="text-foreground">
                    {selectedMovement.paymentMethodLabel}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">{t('الكاشير المسؤول')}</span>
                  <span className="text-foreground">
                    {selectedMovement.cashierName}
                  </span>
                </div>
              </div>

              {selectedMovement.notes && (
                <div className="p-3 rounded-xl border border-border text-slate-600 dark:text-slate-300">
                  <span className="font-bold block mb-1 text-foreground">{t('البيان والملاحظات:')}</span>
                  <p>{selectedMovement.notes}</p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200/80 dark:border-amber-800/40 text-[11px] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <Info className="w-3.5 h-3.5" />
                    {t('توثيق الرقابة والحوكمة المالية (OD-704):')}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100 font-bold font-mono text-[10px]">
                    {t('بيانات تجريبية — DEMO')}
                  </span>
                </div>
                <p className="text-amber-800/90 dark:text-amber-300/90 text-[11px] leading-relaxed">
                  {t('حركة تدريبية مصطنعة لأغراض العرض التوضيحي. يمثل هذا القيد نموذجاً لكيفية تسجيل حدث التدقيق الجنائي (Forensic Audit Event) برقم جلسة مشفر في البيئة التشغيلية دون إجراء كتابة حقيقية لقاعدة البيانات.')}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedMovement(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-muted text-muted-foreground hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {t('إغلاق النافذة')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

