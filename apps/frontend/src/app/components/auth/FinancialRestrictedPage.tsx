import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  Receipt,
  Building2,
  Calendar,
  CreditCard,
  RefreshCw,
  LogOut,
  CheckCircle2,
  ShieldAlert,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, getDefaultRouteForRole } from '../../contexts/AuthContext';
import { userApi } from '../../services/api';

interface OverdueObligation {
  id: string;
  billingMonth: string | null;
  amountDue: number;
  amountCollected: number;
  unpaidBalance: number;
  dueDate: string;
}

interface FinancialStatusResponse {
  isRestricted: boolean;
  financialAccessStatus: 'ACTIVE' | 'RESTRICTED';
  studentName: string;
  branchName: string;
  totalOutstanding: number;
  overdueMonthlyObligations: OverdueObligation[];
  paymentInstructions: {
    title: string;
    details: string;
    cashboxLocation: string;
  };
}

export default function FinancialRestrictedPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<FinancialStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await userApi.get('/financial-access-status');
      setStatusData(res.data);
      if (res.data.financialAccessStatus === 'ACTIVE') {
        toast.success(t('تم تسوية الرسوم واستعادة الوصول بنجاح! جاري التوجيه...'));
        // Update local user in storage if needed
        const saved = localStorage.getItem('edu-user');
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.financialAccessStatus = 'ACTIVE';
          localStorage.setItem('edu-user', JSON.stringify(parsed));
        }
        setTimeout(() => {
          navigate(getDefaultRouteForRole(user?.role || 'CENTER_STUDENT'), { replace: true });
        }, 1200);
      }
    } catch (err: any) {
      console.error('Error fetching financial status:', err);
      setError(t('تعذر تحميل بيانات الاستحقاق المالي. يرجى المحاولة مرة أخرى.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchStatus();
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If user is already active, navigate to dashboard
  if (user.financialAccessStatus === 'ACTIVE' && statusData?.financialAccessStatus === 'ACTIVE') {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans"
    >
      {/* Top Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t('منظومة أوكس التعليمية')}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('بوابة المتابعة المالية والأكاديمية')}</p>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <LogOut className="w-4 h-4 text-slate-500" />
          <span>{t('تسجيل الخروج')}</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto my-8 space-y-6">
        {/* Warning Banner Card */}
        <div className="bg-white dark:bg-[#121827] border-2 border-amber-500/40 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-xl">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {t('تم تعليق الوصول التعليمي مؤقتاً')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                  {t('نظراً لانقضاء مهلة سداد الرسوم الشهرية المقررة، تم تعليق صلاحية دخول الدروس والاختبارات التفاعلية.')}
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 text-center">
              <span className="text-xs text-amber-700 dark:text-amber-300 font-medium block">{t('الحالة الحالية')}</span>
              <span className="text-sm font-bold text-amber-800 dark:text-amber-200">{t('معلق مالياً')}</span>
            </div>
          </div>

          {/* Academic Preservation Notice */}
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong>{t('حسابك وسجلاتك محفوظة بالكامل:')}</strong> {t('لم يتم حذف أي دروس مسجلة، نتائج واجبات، أو محاولات امتحانات سابقة. حسابك وتقدمك الدراسي في أمان كامل، وسيتم استئناف كافة الصلاحيات فور تسوية الرسوم.')}
            </p>
          </div>
        </div>

        {/* Student & Branch Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-[#121827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('اسم الطالب')}</div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {statusData?.studentName || user.name}
            </div>
          </div>
          <div className="bg-white dark:bg-[#121827] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" /> {t('الفرع التعليمي')}
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {statusData?.branchName || 'الفرع الرئيسي'}
            </div>
          </div>
          <div className="bg-white dark:bg-[#121827] border border-red-200 dark:border-red-950/50 rounded-xl p-4 bg-red-50/20 dark:bg-red-950/10">
            <div className="text-xs text-red-600 dark:text-red-400 font-medium">{t('إجمالي الرسوم الشهرية المستحقة')}</div>
            <div className="text-xl font-black text-red-600 dark:text-red-400 mt-1">
              {(statusData?.totalOutstanding ?? 0).toLocaleString()} {t('ج.م')}
            </div>
          </div>
        </div>

        {/* Overdue Obligations Table */}
        <div className="bg-white dark:bg-[#121827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('تفاصيل الرسوم الشهرية المتأخرة')}</h3>
          </div>

          {statusData?.overdueMonthlyObligations && statusData.overdueMonthlyObligations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="py-2 px-3">{t('الشهر الدراسي')}</th>
                    <th className="py-2 px-3">{t('قيمة الرسوم')}</th>
                    <th className="py-2 px-3">{t('المسدد سابقاً')}</th>
                    <th className="py-2 px-3">{t('المتبقي المستحق')}</th>
                    <th className="py-2 px-3">{t('تاريخ الاستحقاق')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {statusData.overdueMonthlyObligations.map((ob) => (
                    <tr key={ob.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        {ob.billingMonth || 'رسوم شهرية'}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {ob.amountDue.toLocaleString()} {t('ج.م')}
                      </td>
                      <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400">
                        {ob.amountCollected.toLocaleString()} {t('ج.م')}
                      </td>
                      <td className="py-3 px-3 font-bold text-red-600 dark:text-red-400">
                        {ob.unpaidBalance.toLocaleString()} {t('ج.م')}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(ob.dueDate).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">
              {t('لا توجد التزامات شهرية متأخرة مسجلة، اضغط على زر التحقق أدناه لتحديث حالتك.')}
            </p>
          )}
        </div>

        {/* Payment Instructions Card */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h4 className="text-base font-bold text-blue-950 dark:text-blue-200">
                {statusData?.paymentInstructions?.title || 'طريقة السداد واستعادة الخدمة'}
              </h4>
              <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                {statusData?.paymentInstructions?.details ||
                  'يرجى مراجعة قسم الحسابات والخزينة في فرعك التعليمي لسداد الرسوم المقررة (نقداً أو عبر بطاقات الدفع الإلكتروني). فور إتمام السداد وإصدار الإيصال الرسمي، يتم رفع التقييد واستعادة الوصول تلقائياً وبشكل فوري.'}
              </p>
              <div className="flex items-center gap-2 pt-2 text-xs font-semibold text-blue-900 dark:text-blue-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{t('إعادة التفعيل فورية وتلقائية بمجرد قيد السداد في النظام')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Refresh & Verify Action */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#9e1b1b] hover:bg-[#851616] text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#9e1b1b]/20 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'جاري التحقق...' : 'التحقق من حالة السداد وتحديث الحساب'}</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center pt-6 text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800">
        {t('منظومة OX-DIGITAL التعليمية المتكاملة &bull; جميع الحقوق محفوظة &copy;')} {new Date().getFullYear()}
      </footer>
    </div>
  );
}

