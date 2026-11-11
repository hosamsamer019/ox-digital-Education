import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ShieldAlert,
  Paperclip,
  Building2,
  DollarSign,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { ExpenseVoucher } from './types';
import { accountingService } from '../../services/accounting.service';

export function isPendingDisbursementVoucher(v: any): boolean {
  return Boolean(v && v.status === 'APPROVED' && !v.disbursedAt && !v.disbursedById);
}

export default function ExpensesPage() {
  const { t } = useLanguage();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [disbursingId, setDisbursingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [costCenter, setCostCenter] = useState('OFFICE_SUPPLIES');
  const [amount, setAmount] = useState<number>(1500);
  const [justification, setJustification] = useState('');

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const res = await accountingService.getExpenses({ limit: 50 });
      if (res.vouchers && res.vouchers.length > 0) {
        const formatted = res.vouchers.map((v: any) => {
          const pendingDisbursement = isPendingDisbursementVoucher(v);
          const alreadyDisbursed =
            v.status === 'APPLIED' || (v.status === 'APPROVED' && (Boolean(v.disbursedAt) || Boolean(v.disbursedById)));
          return {
            id: v.id,
            voucherNumber: v.voucherNumber,
            title: v.description,
            costCenter: v.category,
            amount: Number(v.amount),
            justification: v.description,
            supportingDocs: v.receiptAttachmentUrl ? [v.receiptAttachmentUrl] : ['مرفق معتمد'],
            preparedBy: v.preparedBy?.name || v.preparedBy?.email || 'المحاسب',
            submittedAt: new Date(v.createdAt).toLocaleDateString('ar-EG'),
            status: v.status,
            disbursedAt: v.disbursedAt ?? null,
            disbursedById: v.disbursedById ?? null,
            isPendingDisbursement: pendingDisbursement,
            isDisbursed: alreadyDisbursed,
            statusLabel: pendingDisbursement
              ? 'معتمد - جاهز للصرف'
              : alreadyDisbursed
              ? 'تم الصرف بنجاح'
              : v.status === 'REJECTED'
              ? 'مرفوض'
              : 'بانتظار توقيع المدير الرئيسي'
          };
        });
        setVouchers(formatted);
      } else if (res.vouchers) {
        setVouchers([]);
      }
    } catch (err) {
      console.error('Failed to load expense vouchers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, []);

  const handleSubmitVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) {
      toast.error(t('يرجى استكمال عنوان السند ومبلغ الصرف'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await accountingService.createExpenseVoucher({
        category: costCenter,
        payeeName: title.trim(),
        amount,
        description: justification.trim() || title.trim(),
        paymentSource: 'CASHBOX'
      });

      toast.success(`تم إعداد سند الصرف وإرساله للمدير: ${res.voucher.voucherNumber}`, {
        description: 'عملاً بالحوكمة (Maker-Checker)، لا يتم الصرف الفعلي إلا بعد توقيع المدير الرئيسي'
      });

      setTitle('');
      setJustification('');
      fetchVouchers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في إنشاء سند الصرف');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisburse = async (voucherId: string, voucherNumber: string) => {
    setDisbursingId(voucherId);
    try {
      await accountingService.disburseExpenseVoucher(voucherId);
      window.dispatchEvent(new Event('ox:counters-refresh'));
      toast.success(`تم صرف سند المصروفات بنجاح: ${voucherNumber}`, {
        description: 'تم خصم المبلغ من رصيد الخزينة المعتمدة وقيد حركة نقدية صادرة'
      });
      fetchVouchers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في صرف السند');
    } finally {
      setDisbursingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <span>{t('المحاسبة المالية')}</span>
          <span>/</span>
          <span className="text-[#9e1b1b] font-bold">{t('إعداد ومتابعة سندات الصرف (ACC-05)')}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          {t('سندات المصروفات التشغيلية والنثريات')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t('إعداد سندات الصرف وربطها بالفواتير المعززة وفق مبدأ الفصل بين الاختصاصات (Maker-Checker)')}
        </p>
      </div>

      {/* Maker-Checker Alert */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="block font-bold">{t('محدد الحوكمة المالية — حظر الاعتماد الذاتي (Maker-Checker Governance):')}</strong>
          {t('ينحصر دور المحاسب في إعداد مسودة السند والتحقق من الفواتير المعززة. يُمنع المحاسب برمجياً من اعتماد السند لنفسه أو صرف النقدية قبل توثيق توقيع المدير الرئيسي في سجل الموافقات.')}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORM (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <PlusCircle className="w-4 h-4 text-[#9e1b1b]" />
            {t('إعداد سند صرف جديد (Voucher Drafting)')}
          </h2>

          <form onSubmit={handleSubmitVoucher} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {t('اسم المستفيد / بيان الصرف:')}
              </label>
              <input
                type="text"
                placeholder={t('مثال: شركة النيل للتوريدات المكتبية')}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t('مركز التكلفة / البند:')}
                </label>
                <select
                  value={costCenter}
                  onChange={e => setCostCenter(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                >
                  <option value="OFFICE_SUPPLIES">{t('الأدوات والتوريدات المكتبية')}</option>
                  <option value="MAINTENANCE">{t('الصيانة والتشغيل')}</option>
                  <option value="UTILITIES">{t('المرافق والخدمات (كهرباء / مياه / إنترنت)')}</option>
                  <option value="CURRICULUM">{t('طباعة وتصوير المذكرات')}</option>
                  <option value="EMERGENCY">{t('نثريات وطوارئ تشغيلية')}</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t('المبلغ المطلوب (ج.م):')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="50"
                    value={amount}
                    onChange={e => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-black"
                    required
                  />
                  <span className="absolute left-2.5 top-2.5 text-[11px] font-bold text-slate-400">{t('ج.م')}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {t('المبررات والملاحظات التفصيلية:')}
              </label>
              <textarea
                rows={3}
                placeholder={t('شرح سبب الصرف ومطابقة أسعار السوق...')}
                value={justification}
                onChange={e => setJustification(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              <span>{submitting ? 'جاري الإرسال...' : 'رفع السند للاعتماد من المدير الرئيسي'}</span>
            </button>
          </form>
        </div>

        {/* LIST / STATUS (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Clock className="w-4 h-4 text-slate-500" />
              {t('سجل سندات الصرف وحالة الاعتماد')}
            </h2>

            {loading && vouchers.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                <span>{t('جاري تحميل السندات...')}</span>
              </div>
            ) : vouchers.length === 0 ? (
              <div className="py-8 text-center text-slate-400">{t('لا توجد سندات صرف حالياً')}</div>
            ) : (
              <div className="space-y-3 text-xs">
                {vouchers.map(v => (
                  <div
                    key={v.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {v.voucherNumber}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                            {v.costCenter}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                          {v.title}
                        </h4>
                      </div>
                      <div className="text-left">
                        <span className="font-black text-slate-900 dark:text-white block text-sm">
                          {v.amount.toLocaleString('ar-EG')} {t('ج.م')}
                        </span>
                        <span
                          className={`text-[10px] font-bold inline-block px-2 py-0.5 rounded-full mt-1 ${
                            v.isDisbursed
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : v.isPendingDisbursement
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : v.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {v.statusLabel}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {v.justification}
                    </p>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{t('المُعِد:')} {v.preparedBy} • {v.submittedAt}</span>
                      {v.isPendingDisbursement && (
                        <button
                          onClick={() => handleDisburse(v.id, v.voucherNumber)}
                          disabled={disbursingId === v.id}
                          className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-60 flex items-center gap-1"
                        >
                          {disbursingId === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                          <span>{t('صرف النقدية الآن')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
