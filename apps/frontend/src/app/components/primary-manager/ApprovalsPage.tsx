import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import { ShieldCheck, FileCheck, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ApprovalQueueItem } from './types';
import { accountingService } from '../../services/accounting.service';

export default function ApprovalsPage() {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const res = await accountingService.getExpenses({ status: 'PENDING_APPROVAL' });
      if (res.vouchers && res.vouchers.length > 0) {
        const mapped = res.vouchers.map((v: any) => ({
          id: v.id,
          referenceNumber: v.voucherNumber,
          type: 'EXPENSE_VOUCHER',
          title: `سند صرف: ${v.category} (${v.amount} ج.م)`,
          branchName: v.branch?.name || 'المركز الرئيسي',
          submittedBy: v.preparedBy?.name || v.preparedBy?.email || 'المحاسب',
          submittedAt: new Date(v.createdAt).toLocaleDateString('ar-EG'),
          status: 'SUBMITTED',
          justification: v.description,
          policyReference: 'سياسة الاعتماد المالي الثنائي (Maker-Checker)',
          supportingDocuments: v.receiptAttachmentUrl ? [v.receiptAttachmentUrl] : ['مرفق معتمد']
        }));
        setQueue(mapped);
      } else if (res.vouchers) {
        setQueue([]);
      }
    } catch (err) {
      console.error('Failed to load pending approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const handleApprove = async (item: any) => {
    setProcessingId(item.id);
    try {
      if (item.type === 'EXPENSE_VOUCHER' || item.referenceNumber.startsWith('EXP-')) {
        await accountingService.approveExpenseVoucher(item.id, 'APPROVE');
      }
      setQueue(prev => prev.map(q => (q.id === item.id ? { ...q, status: 'APPROVED' } : q)));
      toast.success(`تم اعتماد وتوقيع الطلب بنجاح: ${item.referenceNumber}`, {
        description: 'أصبح السند معتمداً ومتاحاً لأمين الصندوق لصرف النقدية'
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في اعتماد الطلب');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item: any) => {
    setProcessingId(item.id);
    try {
      if (item.type === 'EXPENSE_VOUCHER' || item.referenceNumber.startsWith('EXP-')) {
        await accountingService.approveExpenseVoucher(item.id, 'REJECT');
      }
      setQueue(prev => prev.map(q => (q.id === item.id ? { ...q, status: 'REJECTED' } : q)));
      toast.error(`تم رفض الطلب وإعادته للمحاسب: ${item.referenceNumber}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'خطأ في رفض الطلب');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans pb-12" dir="rtl">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <span>{t('الرئيسية')}</span>
          <span>/</span>
          <span className="text-[#9e1b1b] font-bold">{t('مركز الموافقات والاعتمادات (PM-APPR-01)')}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          {t('طابور الاعتمادات والموافقات المالية (Maker-Checker)')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t('مراجعة واعتماد سندات الصرف، تسويات فروقات الخزائن (UP-705)، والخصومات الاستثنائية')}
        </p>
      </div>

      <div className="space-y-4 max-w-4xl">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
            <span>{t('جاري مراجعة طابور الاعتمادات...')}</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm">
            {t('لا توجد طلبات معلقة بانتظار الاعتماد حالياً')}
          </div>
        ) : (
          queue.map(item => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {item.referenceNumber}
                  </span>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                    {item.title}
                  </h3>
                  <span className="text-xs text-slate-500 block">
                    {item.branchName} {t('• المُعِد:')} {item.submittedBy} • {item.submittedAt}
                  </span>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    item.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : item.status === 'REJECTED'
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}
                >
                  {item.status === 'APPROVED' ? 'معتمد' : item.status === 'REJECTED' ? 'مرفوض' : 'بانتظار توقيع المدير'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300 space-y-2">
                <p>
                  <strong>{t('البيان والسبب:')}</strong> {item.justification}
                </p>
                {item.policyReference && (
                  <p className="text-[#9e1b1b] dark:text-red-400 font-bold">
                    {t('مرجع الحوكمة:')} {item.policyReference}
                  </p>
                )}
                {item.supportingDocuments && item.supportingDocuments.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-200 dark:border-slate-700/60">
                    <span className="text-slate-400">{t('المرفقات المؤيدة:')}</span>
                    {item.supportingDocuments.map((doc: string, i: number) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                      >
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                        {doc}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {item.status === 'SUBMITTED' && (
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => handleReject(item)}
                    disabled={processingId === item.id}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 transition-colors disabled:opacity-50"
                  >
                    {t('رفض السند')}
                  </button>
                  <button
                    onClick={() => handleApprove(item)}
                    disabled={processingId === item.id}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {processingId === item.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{t('اعتماد وتوقيع السند')}</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
