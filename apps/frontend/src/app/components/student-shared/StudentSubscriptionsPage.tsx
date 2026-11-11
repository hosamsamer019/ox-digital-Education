import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  CreditCard, CheckCircle2, Clock, Lock, Receipt, Printer,
  AlertCircle, RefreshCw, User, ShieldAlert, ChevronLeft
} from 'lucide-react';
import { brdSubscriptionService } from '../../services/brdSubscription.service';

export default function StudentSubscriptionsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await brdSubscriptionService.getMySubscriptions();
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر تحميل بيانات الاشتراكات والإيصالات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-[#9e1b1b]" />
            {t('حالة الاشتراكات والإيصالات الرسمية')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('متابعة حالة الوصول لكل معلم بشكل مستقل وسجل الإيصالات الصادرة')}
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-card-foreground bg-card border border-border rounded-lg hover:bg-muted transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('تحديث')}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 text-[#9e1b1b] animate-spin" />
        </div>
      ) : (
        <>
          {/* TEACHER ACCESS STATUS CARDS */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-[#9e1b1b]" />
              {t('حالة الوصول لمحتوى المعلمين')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {data?.subscriptions?.map((sub: any, idx: number) => {
                const status = sub.accessStatus || 'LOCKED';
                const isException = !!sub.exceptionActiveUntil;

                return (
                  <div
                    key={sub.id || idx}
                    className={`p-5 rounded-2xl border transition shadow-sm space-y-4 ${
                      status === 'LOCKED' || status === 'RESTRICTED'
                        ? 'border-red-300 bg-red-50/40'
                        : status === 'GRACE_PERIOD'
                        ? 'border-amber-300 bg-amber-50/40'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-red-100 text-[#9e1b1b] flex items-center justify-center font-bold">
                          {sub.teacher?.name?.[0] || 'T'}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{sub.teacher?.name}</h3>
                          <span className="text-[11px] text-gray-500 font-mono">{sub.teacher?.email}</span>
                        </div>
                      </div>

                      {isException ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('استثناء إداري')}
                        </span>
                      ) : status === 'ACTIVE' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('نشط ومسدد')}
                        </span>
                      ) : status === 'GRACE_PERIOD' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {t('فترة سماح')}
                        </span>
                      ) : status === 'RESTRICTED' ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" />
                          {t('مقيد لعدم سداد المصروفات')}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" />
                          {t('مغلق لعدم السداد')}
                        </span>
                      )}
                    </div>

                    {(status === 'LOCKED' || status === 'RESTRICTED') && (
                      <div className="p-3 bg-red-100/70 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <ShieldAlert className="w-4 h-4" />
                          {status === 'RESTRICTED'
                            ? t('تم تعليق الوصول لعدم سداد الرسوم الشهرية')
                            : t('محتوى هذا المعلم مغلق مؤقتاً')}
                        </div>
                        <p>
                          {status === 'RESTRICTED'
                            ? t('يرجى التوجه إلى مكتب المحاسب بالفرع لسداد الرسوم الشهرية المستحقة واستعادة الوصول فوراً.')
                            : t('يرجى التوجه إلى مكتب المحاسب بالفرع أو السداد لإعادة فتح المحاضرات والاختبارات فوراً.')}
                        </p>
                      </div>
                    )}

                    {status === 'GRACE_PERIOD' && (
                      <div className="p-3 bg-amber-100/70 border border-amber-200 rounded-xl text-xs text-amber-800">
                        {t('أنت الآن في فترة السماح الشهرية. يرجى سداد الاشتراك قبل يوم الإغلاق لتجنب تعليق الوصول.')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RECEIPTS TABLE */}
          <div className="p-6 bg-card text-card-foreground border border-border rounded-2xl shadow-sm space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#9e1b1b]" />
              {t('سجل الإيصالات الرسمية الصادرة')}
            </h2>

            {data?.receipts?.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {t('لا توجد إيصالات سداد مسجلة حتى الآن')}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4 font-semibold">{t('رقم الإيصال')}</th>
                      <th className="py-3 px-4 font-semibold">{t('المعلم')}</th>
                      <th className="py-3 px-4 font-semibold">{t('المبلغ')}</th>
                      <th className="py-3 px-4 font-semibold">{t('طريقة السداد')}</th>
                      <th className="py-3 px-4 font-semibold">{t('الشهور المغطاة')}</th>
                      <th className="py-3 px-4 font-semibold">{t('التاريخ')}</th>
                      <th className="py-3 px-4 font-semibold text-center">{t('طباعة')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data?.receipts?.map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">{r.receiptNumber}</td>
                        <td className="py-3 px-4 text-[#9e1b1b] font-medium">{r.teacher?.name || '-'}</td>
                        <td className="py-3 px-4 text-emerald-700 font-bold">{r.amount.toLocaleString()} {t('ج.م')}</td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {r.receivingMethod === 'CASH'
                            ? 'نقدي'
                            : r.receivingMethod === 'BANK_TRANSFER'
                            ? 'تحويل بنكي'
                            : 'محفظة'}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">{r.monthsCovered}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {new Date(r.createdAt).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="p-1.5 text-gray-600 hover:text-emerald-700 rounded-lg"
                            title={t('طباعة الإيصال')}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

