import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { CreditCard, Clock, Lock, Shield, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { brdSubscriptionService } from '../../services/brdSubscription.service';

const gradeLabels: Record<string, string> = {
  PREP_1: 'الصف الأول الإعدادي',
  PREP_2: 'الصف الثاني الإعدادي',
  PREP_3: 'الصف الثالث الإعدادي',
  SECONDARY_1: 'الصف الأول الثانوي',
  SECONDARY_2: 'الصف الثاني الثانوي',
  SECONDARY_3: 'الصف الثالث الثانوي',
};

export default function TeacherPricingPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await brdSubscriptionService.getTeacherPricing();
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في تحميل الأسعار والإعدادات');
    } finally {
      setLoading(false);
    }
  };

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24" dir="rtl">
        <Loader2 className="size-8 text-[#9e1b1b] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-rose-500" dir="rtl">
        <AlertCircle className="size-8 mx-auto mb-2" />
        <p>{error}</p>
      </div>
    );
  }

  const settings = data?.settings || {};
  const pricings = data?.pricings || [];

  return (
    <div className="space-y-6 p-4 sm:p-6" dir="rtl">
      <div>
        <h1 className={`text-2xl font-bold ${textPrimary}`}>{t('الاشتراكات وقواعد الحوكمة الأكاديمية')}</h1>
        <p className={`text-sm ${textSecondary} mt-1`}>
          {t('استعراض أسعار الاشتراكات الشهرية الرسمية المعتمدة لصفوفك وقواعد مهلة السداد وإيقاف الوصول (للقراءة فقط)')}
        </p>
      </div>

      {/* Grace & Lock Day Governance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${textSecondary}`}>{t('آخر يوم للمهلة الشهرية')}</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <p className={`text-2xl font-bold mt-2 ${textPrimary}`}>{t('يوم')} {settings.lastGraceDay ?? 5} {t('من الشهر')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('يتاح للطالب الوصول لكافة المحتوى خلال المهلة')}</p>
        </div>

        <div className={`p-4 rounded-xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${textSecondary}`}>{t('يوم إيقاف الوصول التلقائي')}</span>
            <Lock className="size-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-rose-600">{t('يوم')} {settings.lockDay ?? 6} {t('من الشهر')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('عند 00:00 بتوقيت القاهرة لمن لم يسدد')}</p>
        </div>

        <div className={`p-4 rounded-xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${textSecondary}`}>{t('سلطة التسعير والإعفاء')}</span>
            <Shield className="size-4 text-blue-500" />
          </div>
          <p className={`text-base font-bold mt-2 ${textPrimary}`}>{t('إدارة المؤسسة المركزية')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('يتم اعتماد وتعديل الأسعار حصرياً من المدير العام')}</p>
        </div>
      </div>

      {/* Lock Message Notice */}
      <div className={`p-4 rounded-xl border ${cardBg} border-r-4 border-r-[#9e1b1b]`}>
        <h3 className={`text-sm font-bold ${textPrimary} mb-1`}>{t('رسالة الإيقاف التلقائي المعتمدة للطلاب')}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          "{settings.lockMessageAr || 'تم إيقاف الوصول مؤقتاً لعدم سداد الاشتراك الشهري. يرجى مراجعة إدارة الفرع.'}"
        </p>
      </div>

      {/* Official Prices Table */}
      <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className={`text-base font-bold ${textPrimary}`}>{t('جدول أسعار الاشتراكات الشهرية المعتمدة (بالجنيه المصري)')}</h3>
        </div>
        {pricings.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            {t('لم يتم تسجيل تسعير رسمي معتمد حتى الآن. يرجى مراجعة إدارة الفرع لتحديد أسعار الصفوف.')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="py-3 px-4">{t('الصف الدراسي')}</th>
                  <th className="py-3 px-4">{t('الاشتراك الشهري الرسمي')}</th>
                  <th className="py-3 px-4">{t('الشهر الساري منه')}</th>
                  <th className="py-3 px-4">{t('تاريخ التحديث')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pricings.map((p: any) => (
                  <tr key={p.id}>
                    <td className={`py-3 px-4 font-semibold ${textPrimary}`}>
                      {gradeLabels[p.grade] || p.grade}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#9e1b1b] text-base">{p.price}</span>
                      <span className="text-xs text-slate-500 mr-1">{t('ج.م / شهرياً')}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {p.effectiveMonth}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {new Date(p.updatedAt).toLocaleDateString('ar-EG')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

