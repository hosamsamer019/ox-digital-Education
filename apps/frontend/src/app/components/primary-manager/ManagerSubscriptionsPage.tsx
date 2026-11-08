import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  CreditCard, Settings2, Clock, Ban, CheckCircle2, AlertCircle,
  RefreshCw, DollarSign, User, ShieldAlert, History, Save
} from 'lucide-react';
import { brdSubscriptionService } from '../../services/brdSubscription.service';

const GRADES = [
  { value: 'PRIMARY_1', label: 'الصف الأول الابتدائي' },
  { value: 'PRIMARY_2', label: 'الصف الثاني الابتدائي' },
  { value: 'PRIMARY_3', label: 'الصف الثالث الابتدائي' },
  { value: 'PRIMARY_4', label: 'الصف الرابع الابتدائي' },
  { value: 'PRIMARY_5', label: 'الصف الخامس الابتدائي' },
  { value: 'PRIMARY_6', label: 'الصف السادس الابتدائي' },
  { value: 'PREPARATORY_1', label: 'الصف الأول الإعدادي' },
  { value: 'PREPARATORY_2', label: 'الصف الثاني الإعدادي' },
  { value: 'PREPARATORY_3', label: 'الصف الثالث الإعدادي' },
  { value: 'SECONDARY_1', label: 'الصف الأول الثانوي' },
  { value: 'SECONDARY_2', label: 'الصف الثاني الثانوي' },
  { value: 'SECONDARY_3', label: 'الصف الثالث الثانوي' },
];

export default function ManagerSubscriptionsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'pricing' | 'settings' | 'cancellation'>('pricing');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tab 1: Pricing Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('SECONDARY_1');
  const [priceAmount, setPriceAmount] = useState<number>(350);
  const [effectiveMonth, setEffectiveMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [pricingReason, setPricingReason] = useState('');

  // Tab 2: Settings Form State
  const [settingsTeacherId, setSettingsTeacherId] = useState('');
  const [lastGraceDay, setLastGraceDay] = useState<number>(5);
  const [lockDay, setLockDay] = useState<number>(6);
  const [lockMessageAr, setLockMessageAr] = useState('');
  const [lockMessageEn, setLockMessageEn] = useState('');

  // Tab 3: Cancel Payment State
  const [paymentIdToCancel, setPaymentIdToCancel] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await brdSubscriptionService.getBranches();
      // Extract teachers across branches
      const allTeachers: any[] = [];
      res.branches?.forEach((b: any) => {
        b.teachers?.forEach((t: any) => {
          allTeachers.push({ ...t, branchName: b.name });
        });
      });
      // Fallback: fetch manager students to extract teachers
      if (allTeachers.length === 0) {
        const stdRes = await brdSubscriptionService.getManagerStudents();
        const map = new Map();
        stdRes.students?.forEach((s: any) => {
          if (s.responsibleTeacher) map.set(s.responsibleTeacher.id, s.responsibleTeacher);
        });
        setTeachers(Array.from(map.values()));
        if (map.size > 0) {
          const firstId = map.keys().next().value;
          setSelectedTeacherId(firstId);
          setSettingsTeacherId(firstId);
        }
      } else {
        setTeachers(allTeachers);
        if (allTeachers.length > 0) {
          setSelectedTeacherId(allTeachers[0].id);
          setSettingsTeacherId(allTeachers[0].id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load teachers for subscriptions', err);
      setError(err?.response?.data?.message || 'تعذر تحميل بيانات المعلمين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Submit Pricing Change
  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) {
      alert(t('يرجى اختيار المعلم'));
      return;
    }
    setSaving(true);
    try {
      await brdSubscriptionService.setPricing({
        teacherId: selectedTeacherId,
        grade: selectedGrade,
        price: Number(priceAmount),
        effectiveMonth,
        reason: pricingReason || undefined,
      });
      showNotification(`تم تحديث سعر اشتراك الصف (${selectedGrade}) بنجاح بقيمة ${priceAmount} ج.م`);
      setPricingReason('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر حفظ السعر');
    } finally {
      setSaving(false);
    }
  };

  // Submit Settings Change
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsTeacherId) {
      alert(t('يرجى اختيار المعلم'));
      return;
    }
    setSaving(true);
    try {
      await brdSubscriptionService.setTeacherSettings({
        teacherId: settingsTeacherId,
        lastGraceDay: Number(lastGraceDay),
        lockDay: Number(lockDay),
        lockMessageAr: lockMessageAr || undefined,
        lockMessageEn: lockMessageEn || undefined,
      });
      showNotification(`تم حفظ إعدادات مهلة السداد وتاريخ الإغلاق للمعلم بنجاح`);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  // Submit Payment Cancellation
  const handleCancelPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentIdToCancel.trim() || !cancellationReason.trim()) {
      alert(t('يرجى إدخال معرف العملية وسبب الإلغاء الإلزامي'));
      return;
    }
    if (!window.confirm(t('هل أنت متأكد من إلغاء هذه العملية؟ سيتم تسجيل قيد عكسي تدقيقي غير قابل للتعديل وإعادة تقييم وصول الطالب فوراً.'))) {
      return;
    }
    setSaving(true);
    try {
      const res = await brdSubscriptionService.cancelPayment(paymentIdToCancel, cancellationReason);
      showNotification(`تم إلغاء العملية بنجاح. القيد العكسي: ${res.auditLog?.id || 'مسجل'}`);
      setPaymentIdToCancel('');
      setCancellationReason('');
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر إلغاء العملية');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-[#9e1b1b]" />
            {t('حوكمة الاشتراكات والأسعار (Subscription Governance)')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('تحديد أسعار الاشتراكات لكل معلم وصف، إعدادات مهلة السداد والإغلاق، والإلغاءات الرقابية')}
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('تحديث')}
        </button>
      </div>

      {toast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">{toast}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 space-x-2 space-x-reverse">
        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'pricing'
              ? 'border-[#9e1b1b] text-[#9e1b1b] font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          {t('تسعير اشتراكات المعلم والصفوف')}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'settings'
              ? 'border-[#9e1b1b] text-[#9e1b1b] font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          {t('مهلة السداد ويوم الإغلاق')}
        </button>

        <button
          onClick={() => setActiveTab('cancellation')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
            activeTab === 'cancellation'
              ? 'border-[#9e1b1b] text-[#9e1b1b] font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Ban className="w-4 h-4" />
          {t('إلغاء المدفوعات والقيود العكسية')}
        </button>
      </div>

      {/* TAB 1: PRICING */}
      {activeTab === 'pricing' && (
        <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#9e1b1b]" />
            <h2 className="text-base font-bold text-gray-900">{t('تحديد وتعديل أسعار الصفوف للمعلم')}</h2>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            {t('وفق وثيقة BRD: المدير وحده من يملك صلاحية تحديد أو تعديل أسعار الاشتراكات. لا يحق للمحاسب أو المعلم تعديل السعر. يتم تسجيل كل تعديل في سجل التدقيق السعري (PriceAuditHistory).')}
          </p>

          <form onSubmit={handleSavePricing} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">{t('اختر المعلم *')}</label>
              <select
                required
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
              >
                <option value="">{t('اختر المعلم من القائمة')}</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('الصف الدراسي *')}</label>
                <select
                  required
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                >
                  {GRADES.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('سعر الاشتراك الشهري (ج.م) *')}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={priceAmount}
                  onChange={(e) => setPriceAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">{t('الشهر الميلادي الفعال (Effective Month) *')}</label>
              <input
                type="month"
                required
                value={effectiveMonth}
                onChange={(e) => setEffectiveMonth(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#9e1b1b]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">{t('سبب التعديل لتوثيق سجل التدقيق')}</label>
              <textarea
                rows={2}
                placeholder={t('مثال: مراجعة خطة التسعير السنوية 2026...')}
                value={pricingReason}
                onChange={(e) => setPricingReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#9e1b1b] hover:bg-[#801515] text-white text-sm font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {saving ? 'جاري الحفظ...' : 'حفظ السعر الجديد'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: SETTINGS (GRACE & LOCK DAYS) */}
      {activeTab === 'settings' && (
        <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#9e1b1b]" />
            <h2 className="text-base font-bold text-gray-900">{t('إعدادات مهلة السداد والإغلاق التلقائي للمعلم')}</h2>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            {t('القيم الافتراضية للمنظومة: تنتهي فترة السماح يوم 5 من كل شهر ميلادي، ويتم الإغلاق التلقائي لحسابات الطلاب غير المسددين في تمام الساعة 00:00 بتوقيت القاهرة يوم 6.')}
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">{t('اختر المعلم *')}</label>
              <select
                required
                value={settingsTeacherId}
                onChange={(e) => setSettingsTeacherId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
              >
                <option value="">{t('اختر المعلم')}</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('آخر يوم في فترة السماح (Grace Day)')}</label>
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={lastGraceDay}
                  onChange={(e) => setLastGraceDay(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-gray-800"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">{t('افتراضي: 5 من الشهر')}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('يوم تنفيذ الإغلاق (Lock Day)')}</label>
                <input
                  type="number"
                  min="2"
                  max="28"
                  value={lockDay}
                  onChange={(e) => setLockDay(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-bold text-red-600"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">{t('افتراضي: 6 من الشهر (00:00 بتوقيت القاهرة)')}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">{t('رسالة الإغلاق المخصصة للطلاب (عربي)')}</label>
              <input
                type="text"
                placeholder={t('نأسف، تم تعليق الوصول لعدم سداد اشتراك الشهر الحالي...')}
                value={lockMessageAr}
                onChange={(e) => setLockMessageAr(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">{t('رسالة الإغلاق المخصصة للطلاب (إنجليزي)')}</label>
              <input
                type="text"
                placeholder="Your access has been suspended due to overdue subscription..."
                value={lockMessageEn}
                onChange={(e) => setLockMessageEn(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm font-sans"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#9e1b1b] hover:bg-[#801515] text-white text-sm font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {saving ? 'جاري الحفظ...' : 'حفظ إعدادات المعلم'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: PAYMENT CANCELLATION */}
      {activeTab === 'cancellation' && (
        <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-gray-900">{t('إلغاء المدفوعات والقيود العكسية (Manager Reversals)')}</h2>
          </div>
          <p className="text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-200 leading-relaxed">
            {t('وفق المادة 7.5 من وثيقة BRD: لا يملك المحاسب صلاحية تعديل أو حذف أي دفعة بعد تسجيلها. المدير التنفيذي فقط هو المخول بإلغاء المدفوعات المسجلة بالخطأ مع تدوين سبب إلزامي يوثق في سجل التدقيق المالي، ويعاد احتساب حالة وصول الطالب فوراً.')}
          </p>

          <form onSubmit={handleCancelPayment} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">{t('معرف عملية الدفع (Payment ID) *')}</label>
              <input
                type="text"
                required
                placeholder={t('مثال: cm... أو كود المعاملة')}
                value={paymentIdToCancel}
                onChange={(e) => setPaymentIdToCancel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-red-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">{t('سبب الإلغاء الإلزامي (Mandatory Reason) *')}</label>
              <textarea
                required
                rows={3}
                placeholder={t('مثال: تسجيل خاطئ من المحاسب لنفس الطالب مرتين، أو استرداد نقدي فوري...')}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-600"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition shadow-sm flex items-center gap-1.5"
            >
              <Ban className="w-4 h-4" />
              {saving ? 'جاري التنفيذ...' : 'تأكيد إلغاء الدفعة وقيد السجل العكسي'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

