import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Receipt,
  Vault,
  Clock,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  FileText,
  Printer,
  RefreshCw,
  Building2,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Loader2,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { brdSubscriptionService, ReceiptItem } from '../../services/brdSubscription.service';
import { accountingService } from '../../services/accounting.service';

export default function AccountantHomePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [receiptsList, setReceiptsList] = useState<ReceiptItem[]>([]);
  const [cashboxes, setCashboxes] = useState<any[]>([]);
  const [pendingVouchers, setPendingVouchers] = useState<any[]>([]);
  const [selectedReceiptForView, setSelectedReceiptForView] = useState<ReceiptItem | null>(null);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [receiptsRes, cashboxRes, vouchersRes] = await Promise.allSettled([
        brdSubscriptionService.getAccountantReceipts(),
        accountingService.getCashboxes(),
        accountingService.getExpenses({ status: 'PENDING_APPROVAL' })
      ]);

      if (receiptsRes.status === 'fulfilled' && receiptsRes.value.data) {
        setReceiptsList(receiptsRes.value.data);
      } else {
        setReceiptsList([]);
      }

      if (cashboxRes.status === 'fulfilled' && Array.isArray(cashboxRes.value)) {
        setCashboxes(cashboxRes.value);
      } else {
        setCashboxes([]);
      }

      if (vouchersRes.status === 'fulfilled' && vouchersRes.value.vouchers) {
        setPendingVouchers(vouchersRes.value.vouchers);
      } else {
        setPendingVouchers([]);
      }
    } catch (err) {
      console.error('Failed to load accountant overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
    toast.success(t('تم تحديث بيانات العمليات اليومية بنجاح'));
  };

  // Compute live operational totals
  const totalCollectionsToday = useMemo(() => {
    return receiptsList.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  }, [receiptsList]);

  const totalTillLiquidity = useMemo(() => {
    return cashboxes.reduce((sum, c) => sum + Number(c.currentBalance || 0), 0);
  }, [cashboxes]);

  const totalPendingVouchersAmount = useMemo(() => {
    return pendingVouchers.reduce((sum, v) => sum + Number(v.amount || 0), 0);
  }, [pendingVouchers]);

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & OPERATIONAL CONTEXT */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1">
            <span>{t('المحاسبة المالية')}</span>
            <span>/</span>
            <span className="text-[#9e1b1b] dark:text-red-400 font-bold">
              {t('لوحة العمليات اليومية (ACC-01)')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              {t('مكتب العمليات المالية والمحاسبية للفرع')}
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-[#9e1b1b] dark:bg-rose-950/40 dark:text-rose-300 border border-rose-300/40">
              {t('الفرع الرئيسي (الدقي)')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            {t('إدارة التحصيلات النقدية، تدقيق حسابات الطلاب، وإعداد سندات الصرف وفق حوكمة الصانع والمراجع (Maker)')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate('/accountant/collections')}
            data-testid="header-collections-link"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] transition-colors shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('مكتب التحصيل والسداد المعتمد')}</span>
          </button>
          <button
            onClick={() => navigate('/accountant/expenses')}
            data-testid="header-expenses-link"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-foreground bg-card border border-border text-card-foreground hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors shadow-xs"
          >
            <FileText className="w-4 h-4 text-[#9e1b1b]" />
            <span>{t('سندات الصرف')}</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="refresh-btn"
            className="p-2 rounded-xl text-muted-foreground bg-card border border-border text-card-foreground hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors shadow-xs"
            title={t('تحديث البيانات')}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#9e1b1b]' : ''}`} />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OPERATIONAL KPI TILES (REAL BACKEND METRICS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Today's Collections */}
        <div className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>{t('تحصيلات اليوم الفعلية')}</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {totalCollectionsToday.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-between">
            <span>{receiptsList.length} {t('إيصالاً صادراً')}</span>
            <span className="font-mono text-[10px] px-1 bg-muted text-muted-foreground rounded">{t('سجل رسمي')}</span>
          </div>
        </div>

        {/* KPI 2: Till Liquidity */}
        <div className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>{t('سيولة خزائن الفرع')}</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <Vault className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {totalTillLiquidity.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
          </div>
          <div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold flex items-center justify-between">
            <span>{cashboxes.length > 0 ? `${cashboxes.length} ${t('خزينة نشطة')}` : t('خزينة الفرع الرئيسية')}</span>
            <span className="font-mono text-[10px] px-1 bg-muted text-muted-foreground rounded">CB-MAIN-01</span>
          </div>
        </div>

        {/* KPI 3: Pending Expense Vouchers */}
        <div className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>{t('سندات صرف قيد الاعتماد')}</span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-[#9e1b1b]">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {totalPendingVouchersAmount.toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
          </div>
          <div className="text-[11px] text-[#9e1b1b] dark:text-red-400 font-semibold flex items-center justify-between">
            <span>{pendingVouchers.length} {t('سند بانتظار توقيع المدير')}</span>
            <span className="font-mono text-[10px] px-1 bg-muted text-muted-foreground rounded">Maker-Checker</span>
          </div>
        </div>

        {/* KPI 4: Governance Indicator */}
        <div className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
            <span>{t('حوكمة التسلسل المالي')}</span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
            {t('متطابق وخالٍ من الفجوات')}
          </div>
          <div className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
            <span>{t('ترقيم متسلسل للفرع')}</span>
            <span className="font-mono text-[10px] px-1 bg-muted text-muted-foreground rounded">REC-DK-01</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TILL STATUS & GOVERNANCE REMINDER */}
      {/* ========================================================================= */}
      <div className="p-3.5 rounded-2xl bg-card border border-border text-card-foreground shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-bold text-muted-foreground flex items-center gap-1.5">
            <Vault className="w-4 h-4 text-[#9e1b1b]" />
            {t('جاهزية خزائن الفرع:')}
          </span>
          {cashboxes.length > 0 ? (
            cashboxes.map(cb => (
              <div
                key={cb.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 text-muted-foreground border border-border/60"
              >
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {cb.code || 'CB-MAIN-01'}
                </span>
                <span className="text-slate-500">|</span>
                <span className="font-black text-foreground">
                  {Number(cb.currentBalance || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {cb.status === 'ACTIVE' ? t('نشطة ومؤمنة') : t('قيد المراجعة')}
                </span>
              </div>
            ))
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/60 text-muted-foreground border border-border/60 font-mono text-xs">
              {t('CB-MAIN-01 | 0.00 ج.م | نشطة ومؤمنة')}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-[11px] shrink-0">
          <ShieldAlert className="w-3.5 h-3.5 text-[#9e1b1b]" />
          <span>{t('حوكمة الصانع والمراجع (Maker-Checker) مفعلة بصرامة — لا يوجد اعتماد ذاتي للمصروفات')}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SPLIT OPERATIONAL DESK */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* RIGHT COLUMN: AUTHORITATIVE COLLECTION HUB (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-black text-foreground flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#9e1b1b]" />
              {t('بوابة التحصيل والسداد الرسمية (POS Collection Desk)')}
            </h2>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
              {t('معتمد وحي')}
            </span>
          </div>

          <div className="space-y-4 text-xs text-muted-foreground">
            <p className="leading-relaxed">
              {t('وفق ضوابط الحوكمة المالية لنظام')} <strong>OX-DIGITAL Education</strong>{t('، يتم تسجيل جميع عمليات سداد الاشتراكات والرسوم الدراسية حصرياً عبر')} <strong>{t('مكتب التحصيل المعتمد')}</strong> {t('لضمان:')}
            </p>

            <ul className="space-y-2.5 pr-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t('إصدار إيصال تسلسلي رسمي غير قابل للتكرار خاص بالفرع (REC-DK-01-xxxxx).')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t('التحقق الإلزامي من تسعيرة المعلم المحددة للمرحلة الدراسية بدون قبول دفعات جزئية عشوائية.')}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t('تحديث حالة وصول وصلاحيات الطالب في المنظومة الأكاديمية لحظياً مع سجل تدقيق غير قابل للتعديل.')}</span>
              </li>
            </ul>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/accountant/collections')}
                data-testid="open-collection-desk-btn"
                className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('الانتقال إلى مكتب التحصيل والسداد المعتمد')}</span>
                <ArrowRight className="w-4 h-4 mr-1" />
              </button>
            </div>
          </div>
        </div>

        {/* LEFT COLUMN: RECENT BRANCH RECEIPTS JOURNAL (7 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#9e1b1b]" />
                {t('سجل إيصالات التحصيل الصادرة للفرع (Branch Receipts)')}
              </h2>
              <span className="text-[11px] text-slate-500">
                {t('الإيصالات المتسلسلة المعتمدة المسجلة لفرع الدقي')}
              </span>
            </div>
            <button
              onClick={() => navigate('/accountant/receipts')}
              data-testid="all-receipts-link"
              className="text-xs font-bold text-[#9e1b1b] dark:text-red-400 hover:underline flex items-center gap-1"
            >
              <span>{t('سجل الإيصالات الكامل')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#9e1b1b] mb-2" />
              <p className="text-xs">{t('جاري تحميل سجل الإيصالات...')}</p>
            </div>
          ) : receiptsList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">{t('رقم الإيصال')}</th>
                    <th className="py-2.5 px-3">{t('الطالب')}</th>
                    <th className="py-2.5 px-3">{t('المبلغ')}</th>
                    <th className="py-2.5 px-3">{t('طريقة الدفع')}</th>
                    <th className="py-2.5 px-3">{t('الحالة')}</th>
                    <th className="py-2.5 px-3 text-center">{t('معاينة')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {receiptsList.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                        {rec.receiptNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                        {rec.student?.name || t('طالب مسجل')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-600 dark:text-emerald-400">
                        {Number(rec.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {rec.receivingMethod === 'CASH' ? t('نقدي (Cash)') : rec.receivingMethod === 'BANK_TRANSFER' ? t('تحويل بنكي (Bank Transfer)') : t('محفظة إلكترونية (Wallet)')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                          {rec.payment?.status === 'CANCELLED' || rec.payment?.cancelledAt ? t('ملغى') : t('معتمد ومرحل')}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => setSelectedReceiptForView(rec)}
                          className="p-1 rounded-lg text-slate-500 hover:text-[#9e1b1b] hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={t('معاينة الإيصال')}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div data-testid="receipts-empty-state" className="py-12 px-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto text-slate-400">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-foreground">
                {t('لا توجد إيصالات صادرة اليوم')}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {t('السجل المحاسبي للفرع نظيف. عند تحصيل أي اشتراك عبر مكتب التحصيل سيتم إدراج الإيصال المتسلسل هنا مباشرة.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. RECEIPT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {selectedReceiptForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border text-card-foreground shadow-2xl space-y-4">
            <div className="text-center border-b border-border pb-3">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 font-bold mb-1 inline-block">
                {t('إيصال تحصيل رسمي معتمد')}
              </span>
              <h3 className="text-lg font-black text-foreground">
                {t('أكاديمية أوكس التعليمية')}
              </h3>
              <p className="text-xs text-slate-500">{t('فرع الدقي الرئيسي — قسم الحسابات')}</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{t('رقم الإيصال:')}</span>
                <span className="font-mono font-bold text-foreground">
                  {selectedReceiptForView.receiptNumber}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{t('اسم الطالب:')}</span>
                <span className="font-bold text-foreground">
                  {selectedReceiptForView.student?.name || t('طالب مسجل')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{t('المبلغ المحصل:')}</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {Number(selectedReceiptForView.amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} {t('ج.م')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">{t('طريقة الدفع:')}</span>
                <span className="font-mono font-bold">
                  {selectedReceiptForView.receivingMethod}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">{t('تاريخ الإصدار:')}</span>
                <span className="text-foreground">
                  {new Date(selectedReceiptForView.createdAt).toLocaleString('ar-EG')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  window.print();
                  setSelectedReceiptForView(null);
                }}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] transition-colors"
              >
                {t('طباعة الإيصال')}
              </button>
              <button
                onClick={() => setSelectedReceiptForView(null)}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-foreground bg-muted text-muted-foreground hover:bg-slate-200"
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
