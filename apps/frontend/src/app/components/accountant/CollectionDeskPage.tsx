import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  CreditCard, Printer, CheckCircle2, AlertCircle, Receipt,
  User, Building2, RefreshCw, X, DollarSign, Wallet
} from 'lucide-react';
import { brdSubscriptionService } from '../../services/brdSubscription.service';

interface ScopedStudent {
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRole: string;
  gradeLevel: string;
  parent?: { id: string; name: string; phone?: string | null } | null;
  teacherId: string;
  teacherName: string;
  accessStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED';
  recentSubscriptions?: any[];
}

export default function CollectionDeskPage() {
  const { t } = useLanguage();
  const [students, setStudents] = useState<ScopedStudent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [monthsCount, setMonthsCount] = useState<number>(1);
  const [receivingMethod, setReceivingMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'WALLET'>('CASH');
  const [notes, setNotes] = useState<string>('');

  // Default grade price assumption (350 EGP standard or from pricing)
  const [unitPrice, setUnitPrice] = useState<number>(350);

  // Issued receipt presentation modal
  const [issuedReceipt, setIssuedReceipt] = useState<any | null>(null);

  const loadStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await brdSubscriptionService.getAccountantStudents();
      if (res.data) {
        setStudents(res.data);
        if (res.data.length > 0) {
          setSelectedStudentId(res.data[0].studentId);
        }
      }
    } catch (err: any) {
      console.error('Failed to load accountant students', err);
      setError(err?.response?.data?.message || 'تعذر تحميل قائمة الطلاب المصرح بها لمحاسب هذا الفرع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const selectedStudent = students.find((s) => s.studentId === selectedStudentId);

  // Calculate billing months starting from current month
  const calculateMonths = (count: number) => {
    const list: Array<{ year: number; month: number }> = [];
    const now = new Date();
    let currentY = now.getFullYear();
    let currentM = now.getMonth() + 1; // 1-12

    for (let i = 0; i < count; i++) {
      list.push({ year: currentY, month: currentM });
      currentM++;
      if (currentM > 12) {
        currentM = 1;
        currentY++;
      }
    }
    return list;
  };

  const totalAmount = unitPrice * monthsCount;

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    setSubmitting(true);
    setError(null);
    try {
      const months = calculateMonths(monthsCount);
      const res = await brdSubscriptionService.recordPayment({
        studentId: selectedStudent.studentId,
        teacherId: selectedStudent.teacherId,
        months,
        amount: totalAmount,
        receivingMethod,
        notes: notes || undefined,
      });

      setIssuedReceipt({
        receipt: res.receipt,
        studentName: selectedStudent.studentName,
        teacherName: selectedStudent.teacherName,
        gradeLevel: selectedStudent.gradeLevel,
        monthsCovered: res.receipt.monthsCovered,
        amount: res.receipt.amount,
        receivingMethod: res.receipt.receivingMethod,
      });

      // Reload students to reflect updated access status
      await loadStudents();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر تسجيل عملية السداد');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-[#9e1b1b]" />
            {t('مكتب تحصيل وسداد الاشتراكات (Collection Desk)')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('تسجيل المدفوعات اليدوية، إصدار الإيصالات المتسلسلة فوراً، وفتح الحسابات المقفلة')}
          </p>
        </div>

        <button
          onClick={loadStudents}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('تحديث القائمة')}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Payment Form */}
          <div className="lg:col-span-2 p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-5">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#9e1b1b]" />
              {t('تسجيل تحصيل اشتراك جديد')}
            </h2>

            <form onSubmit={handleSubmitPayment} className="space-y-4">
              {/* Select Student */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {t('اختر الطالب (مقيد بمعلمي هذا الفرع فقط) *')}
                </label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#9e1b1b]"
                >
                  {students.length === 0 ? (
                    <option value="">{t('لا يوجد طلاب مرتبطين بمعلمي هذا الفرع')}</option>
                  ) : (
                    students.map((s) => (
                      <option key={`${s.studentId}-${s.teacherId}`} value={s.studentId}>
                        {s.studentName} {t('— مع المعلم:')} {s.teacherName} ({s.gradeLevel}) [
                        {s.accessStatus === 'ACTIVE' ? 'نشط' : s.accessStatus === 'GRACE_PERIOD' ? 'سماح' : 'مقفل'}]
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Number of months & Unit Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {t('عدد الشهور المراد سدادها *')}
                  </label>
                  <select
                    value={monthsCount}
                    onChange={(e) => setMonthsCount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#9e1b1b]"
                  >
                    <option value={1}>{t('شهر واحد (الشهر الحالي)')}</option>
                    <option value={2}>{t('شهران مقدماً (2 شهور)')}</option>
                    <option value={3}>{t('ثلاثة أشهر (ربع سنوي - 3 شهور)')}</option>
                    <option value={6}>{t('ستة أشهر (نصف سنوي - 6 شهور)')}</option>
                    <option value={9}>{t('عام دراسي كامل (9 شهور)')}</option>
                  </select>
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    {t('يمنع السداد الجزئي للشهور منعاً باتاً وفق المادة 7.2')}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    {t('سعر الشهر المقرر (ج.م) *')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm font-bold text-emerald-700 focus:ring-2 focus:ring-[#9e1b1b]"
                  />
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    {t('يحدده المدير التنفيذي حصراً لكل صف')}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">{t('طريقة التحصيل *')}</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setReceivingMethod('CASH')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                      receivingMethod === 'CASH'
                        ? 'border-[#9e1b1b] bg-red-50/50 text-[#9e1b1b] font-bold shadow-xs'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <DollarSign className="w-5 h-5" />
                    <span className="text-xs">{t('نقدي (Cash)')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceivingMethod('BANK_TRANSFER')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                      receivingMethod === 'BANK_TRANSFER'
                        ? 'border-[#9e1b1b] bg-red-50/50 text-[#9e1b1b] font-bold shadow-xs'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="text-xs">{t('تحويل بنكي')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceivingMethod('WALLET')}
                    className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                      receivingMethod === 'WALLET'
                        ? 'border-[#9e1b1b] bg-red-50/50 text-[#9e1b1b] font-bold shadow-xs'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Wallet className="w-5 h-5" />
                    <span className="text-xs">{t('محفظة إلكترونية')}</span>
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('ملاحظات إضافية')}</label>
                <input
                  type="text"
                  placeholder={t('سداد يدوي في السنتر...')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Summary & Submit */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">{t('المبلغ الإجمالي المطلوب تحصيله:')}</span>
                  <span className="text-2xl font-black text-emerald-700">
                    {totalAmount.toLocaleString()} <span className="text-sm font-normal">{t('ج.م')}</span>
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !selectedStudent}
                  className="px-6 py-3 bg-[#9e1b1b] hover:bg-[#801515] text-white text-sm font-bold rounded-xl transition shadow-sm flex items-center gap-2"
                >
                  <Receipt className="w-4 h-4" />
                  {submitting ? 'جاري التحصيل...' : 'تأكيد السداد وإصدار الإيصال'}
                </button>
              </div>
            </form>
          </div>

          {/* Column 3: Student Details Card */}
          <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 border-b pb-3">
              <User className="w-4 h-4 text-[#9e1b1b]" />
              {t('بيانات الطالب المحدد')}
            </h3>

            {selectedStudent ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                  <span className="text-gray-500 block">{t('الاسم:')}</span>
                  <span className="font-bold text-gray-900 text-sm block">{selectedStudent.studentName}</span>
                  <span className="text-gray-400 font-mono text-[11px] block">{selectedStudent.studentEmail}</span>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                  <span className="text-gray-500 block">{t('المعلم المسؤول:')}</span>
                  <span className="font-bold text-[#9e1b1b] block">{selectedStudent.teacherName}</span>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                  <span className="text-gray-500 block">{t('الصف الدراسي:')}</span>
                  <span className="font-semibold text-gray-800 block">{selectedStudent.gradeLevel}</span>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                  <span className="text-gray-500 block">{t('حالة الوصول الحالية:')}</span>
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full font-bold text-xs ${
                      selectedStudent.accessStatus === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedStudent.accessStatus === 'GRACE_PERIOD'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedStudent.accessStatus === 'ACTIVE'
                      ? 'نشط (مسدد)'
                      : selectedStudent.accessStatus === 'GRACE_PERIOD'
                      ? 'فترة سماح'
                      : 'مقفل (غير مسدد)'}
                  </span>
                </div>

                {selectedStudent.parent && (
                  <div className="p-3 bg-gray-50 rounded-xl space-y-1">
                    <span className="text-gray-500 block">{t('ولي الأمر:')}</span>
                    <span className="font-semibold text-gray-800 block">{selectedStudent.parent.name}</span>
                    <span className="text-gray-400 block">{selectedStudent.parent.phone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400 text-xs">
                {t('يرجى اختيار طالب لعرض تفاصيله')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ISSUED RECEIPT MODAL */}
      {issuedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border-2 border-emerald-500 animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-6 h-6" />
                <h2 className="text-lg font-black text-gray-900">{t('إيصال تحصيل رسمي مؤكد')}</h2>
              </div>
              <button onClick={() => setIssuedReceipt(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5 text-xs font-sans">
              <div className="flex justify-between items-center py-1 border-b border-gray-200">
                <span className="text-gray-500">{t('رقم الإيصال المتسلسل:')}</span>
                <span className="font-mono font-black text-base text-gray-900">
                  {issuedReceipt.receipt?.receiptNumber}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-gray-200">
                <span className="text-gray-500">{t('اسم الطالب:')}</span>
                <span className="font-bold text-gray-900">{issuedReceipt.studentName}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-gray-200">
                <span className="text-gray-500">{t('المعلم المسؤول:')}</span>
                <span className="font-bold text-[#9e1b1b]">{issuedReceipt.teacherName}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-gray-200">
                <span className="text-gray-500">{t('الشهور المغطاة:')}</span>
                <span className="font-bold text-gray-800">{issuedReceipt.monthsCovered}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-gray-200">
                <span className="text-gray-500">{t('طريقة التحصيل:')}</span>
                <span className="font-bold text-gray-800">
                  {issuedReceipt.receivingMethod === 'CASH'
                    ? 'نقدي'
                    : issuedReceipt.receivingMethod === 'BANK_TRANSFER'
                    ? 'تحويل بنكي'
                    : 'محفظة إلكترونية'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 bg-emerald-50 p-2.5 rounded-lg text-emerald-900">
                <span className="font-bold">{t('المبلغ المسدد:')}</span>
                <span className="text-lg font-black">
                  {issuedReceipt.amount?.toLocaleString()} {t('ج.م')}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                {t('طباعة الإيصال')}
              </button>

              <button
                type="button"
                onClick={() => setIssuedReceipt(null)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-lg"
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
