import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Clock, CheckCircle2, AlertCircle, RefreshCw, User, ChevronLeft, ShieldCheck, Receipt } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { userService } from '../../services/user.service';
import { accountingService } from '../../services/accounting.service';

export const ParentSubscriptionPage: React.FC = () => {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [children, setChildren] = useState<any[]>([]);
  const [childrenAccounts, setChildrenAccounts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark
    ? 'bg-[#0f131d] border-slate-800/90 shadow-lg shadow-black/20'
    : 'bg-white border-slate-200/90 shadow-sm';
  const wellBg = isDark
    ? 'bg-[#161c28]/70 border-slate-800/60'
    : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  const loadFamilyFinancialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userService.getChildren();
      const kids = Array.isArray(res) ? res : [];
      setChildren(kids);

      // Load financial account for each child
      const accountsMap: Record<string, any> = {};
      await Promise.all(
        kids.map(async (k: any) => {
          try {
            const acc = await accountingService.getStudentFinancialAccount(k.id);
            accountsMap[k.id] = acc;
          } catch (e) {
            accountsMap[k.id] = null;
          }
        })
      );
      setChildrenAccounts(accountsMap);
    } catch (err: any) {
      setError(t('تعذر تحميل بيانات الأبناء والحسابات المالية.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFamilyFinancialData();
  }, []);

  // Compute family aggregate metrics
  let familyTotalCharged = 0;
  let familyTotalCollected = 0;
  let familyTotalBalance = 0;
  let hasAnyArrears = false;

  Object.values(childrenAccounts).forEach((acc) => {
    if (acc?.summary) {
      familyTotalCharged += Number(acc.summary.totalCharged || 0);
      familyTotalCollected += Number(acc.summary.totalCollected || 0);
      familyTotalBalance += Number(acc.summary.netBalance || 0);
      if (acc.summary.hasArrears) hasAnyArrears = true;
    }
  });

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-sans`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {t('قريباً — قيد التطوير والاعتماد')}
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              {t('منظومة الاشتراكات الإلكترونية لأولياء الأمور')}
            </span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
            {t('كشف الحساب المالي للأبناء')}
          </h1>
          <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
            {t('متابعة الرسوم الدراسية، المستحقات المتبقية، وسجل إيصالات السداد المعتمدة لكافة الأبناء')}
          </p>
        </div>

        <button
          onClick={loadFamilyFinancialData}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-colors cursor-pointer self-start sm:self-auto ${
            isDark
              ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 border-slate-700'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-xs'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#9e1b1b]' : 'text-slate-400'}`} />
          <span>{t('تحديث')}</span>
        </button>
      </div>

      {loading ? (
        <div className={`${cardBg} border rounded-2xl p-12 text-center my-8`}>
          <RefreshCw className="w-8 h-8 text-[#9e1b1b] animate-spin mx-auto mb-3" />
          <p className={`text-sm font-semibold ${textPrimary}`}>{t('جاري جلب السجلات المالية للأبناء...')}</p>
        </div>
      ) : error ? (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={loadFamilyFinancialData}
              className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400"
            >
              {t('إعادة المحاولة')}
            </button>
          </div>
        </div>
      ) : children.length === 0 ? (
        <div className={`${cardBg} border rounded-2xl p-8 text-center my-8`}>
          <User className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className={`text-lg font-bold ${textPrimary} mb-1`}>{t('لا يوجد أبناء مرتبطين بحسابك')}</h2>
          <p className={`text-xs ${textSecondary}`}>{t('يرجى التواصل مع إدارة المؤسسة لربط حسابات أبنائك.')}</p>
        </div>
      ) : (
        <>
          {/* Family Aggregated Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className={`${cardBg} border rounded-2xl p-5`}>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('إجمالي الرسوم المقررة للأسرة')}</p>
              <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${textPrimary}`}>
                {familyTotalCharged.toLocaleString('ar-EG')} <span className="text-xs font-normal">{t('ج.م')}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-2">{t('إجمالي الالتزامات لجميع الأبناء')}</p>
            </div>

            <div className={`${cardBg} border rounded-2xl p-5`}>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('إجمالي المسدد')}</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold mt-1.5 text-emerald-600 dark:text-emerald-400">
                {familyTotalCollected.toLocaleString('ar-EG')} <span className="text-xs font-normal">{t('ج.م')}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-2">{t('المبالغ المسددة بإيصالات رسمية')}</p>
            </div>

            <div className={`${cardBg} border rounded-2xl p-5`}>
              <p className={`text-xs font-semibold ${textSecondary}`}>{t('إجمالي المتبقي المستحق')}</p>
              <h3 className={`text-2xl sm:text-3xl font-extrabold mt-1.5 ${familyTotalBalance > 0 ? 'text-[#9e1b1b]' : 'text-emerald-600'}`}>
                {familyTotalBalance.toLocaleString('ar-EG')} <span className="text-xs font-normal">{t('ج.م')}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-2">
                {hasAnyArrears ? 'توجد مستحقات مطلوب سدادها' : 'كافة الحسابات مسددة بالكامل'}
              </p>
            </div>
          </div>

          {/* Individual Children Financial Cards */}
          <div className="space-y-4 mb-8">
            <h2 className={`font-bold text-base sm:text-lg ${textPrimary} mb-3`}>
              {t('تفاصيل الحساب المالي لكل طالب')}
            </h2>

            {children.map((child) => {
              const acc = childrenAccounts[child.id];
              const summary = acc?.summary;
              const hasArrears = summary?.hasArrears;

              return (
                <div key={child.id} className={`${cardBg} border rounded-2xl p-5 sm:p-6 transition-all`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/50 dark:border-slate-800/50">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-[#9e1b1b]/10 text-[#9e1b1b] flex items-center justify-center font-bold text-sm shrink-0">
                        {child.name.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm sm:text-base ${textPrimary}`}>{child.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {child.gradeLevel || child.educationLevel || 'طالب مسجل'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {summary ? (
                        hasArrears ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-xs font-bold border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5" /> {t('مستحقات (')}{Number(summary.arrears || 0).toLocaleString('ar-EG')} {t('ج.م)')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('مسدد بالكامل')}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">{t('لا توجد بيانات مالية')}</span>
                      )}

                      <button
                        onClick={() => navigate('/parent/children')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        <span>{t('الكشف التفصيلي')}</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {summary && (
                    <div className="grid grid-cols-3 gap-3 pt-4 text-center">
                      <div className={`p-3 rounded-xl border ${wellBg}`}>
                        <p className="text-[11px] text-slate-400">{t('المقرر')}</p>
                        <p className={`font-bold text-sm sm:text-base mt-0.5 ${textPrimary}`}>
                          {Number(summary.totalCharged || 0).toLocaleString('ar-EG')} {t('ج.م')}
                        </p>
                      </div>
                      <div className={`p-3 rounded-xl border ${wellBg}`}>
                        <p className="text-[11px] text-slate-400">{t('المسدد')}</p>
                        <p className="font-bold text-sm sm:text-base mt-0.5 text-emerald-600 dark:text-emerald-400">
                          {Number(summary.totalCollected || 0).toLocaleString('ar-EG')} {t('ج.م')}
                        </p>
                      </div>
                      <div className={`p-3 rounded-xl border ${wellBg}`}>
                        <p className="text-[11px] text-slate-400">{t('المتبقي')}</p>
                        <p className={`font-bold text-sm sm:text-base mt-0.5 ${summary.netBalance > 0 ? 'text-[#9e1b1b]' : 'text-slate-400'}`}>
                          {Number(summary.netBalance || 0).toLocaleString('ar-EG')} {t('ج.م')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Operational Policy Notice (Preserving cashbox/desk collection rules) */}
          <div className={`${cardBg} border rounded-2xl p-5 flex items-start gap-3 text-xs text-slate-500`}>
            <ShieldCheck className="w-5 h-5 text-[#9e1b1b] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>{t('ملاحظة تنظيمية:')}</strong> {t('يتم سداد الرسوم الدراسية وأقساط الدورات التعليمية حصرياً عبر مكتب التحصيل المعتمد لدى محاسب الفرع في مقر المؤسسة، حيث يصدر النظام فوراً إيصال سداد رقمي مشفر ومختوم يظهر مباشرة في كشف حساب الطالب.')}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default ParentSubscriptionPage;
