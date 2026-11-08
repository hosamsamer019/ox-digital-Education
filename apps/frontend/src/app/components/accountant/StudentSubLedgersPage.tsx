import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  FileCheck,
  Calendar,
  Phone,
  ShieldCheck,
  Lock,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { StudentSubLedger } from './types';
import { accountingService } from '../../services/accounting.service';

export default function StudentSubLedgersPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [detailedAccount, setDetailedAccount] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubLedgers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await accountingService.getStudentSubLedgers();
      if (res.subLedgers && res.subLedgers.length > 0) {
        const mapped = res.subLedgers.map((s: any) => ({
          id: s.studentId,
          studentCode: `STU-${s.studentId.slice(0, 6).toUpperCase()}`,
          fullName: s.name,
          grade: 'طالب مسجل',
          branchName: 'المركز الرئيسي',
          parentName: 'ولي الأمر',
          parentPhone: s.phone || '01000000000',
          agreementNumber: `AGR-${s.studentId.slice(0, 4)}`,
          agreementDate: new Date().toLocaleDateString('ar-EG'),
          totalContractValue: s.totalCharged || 3000,
          totalCollected: s.totalCollected || 0,
          remainingPayable: s.balance || 0,
          earnedRevenue: s.totalCollected || 0,
          unearnedDeferredRevenue: Math.max(0, (s.totalCharged || 3000) - (s.totalCollected || 0)),
          schedule: [],
          collections: []
        }));
        setStudents(mapped);
        setSelectedStudentId(mapped[0].id);
      } else if (res.subLedgers) {
        setStudents([]);
        setSelectedStudentId('');
      }
    } catch {
      setError(t('تعذر تحميل سجلات وحسابات الطلاب من الخادم. يرجى التحقق من اتصال الشبكة.'));
      setStudents([]);
      setSelectedStudentId('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubLedgers();
  }, [loadSubLedgers]);

  useEffect(() => {
    if (!selectedStudentId) return;
    async function fetchDetails() {
      try {
        const acc = await accountingService.getStudentFinancialAccount(selectedStudentId);
        setDetailedAccount(acc);
      } catch {
        setDetailedAccount(null);
      }
    }
    fetchDetails();
  }, [selectedStudentId]);

  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      (s.parentPhone && s.parentPhone.includes(q))
    );
  });

  const currentStudent =
    students.find(s => s.id === selectedStudentId) ||
    students[0] ||
    null;

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <span>{t('المحاسبة المالية')}</span>
          <span>/</span>
          <span className="text-[#9e1b1b] font-bold">{t('شؤون الطلاب وحساباتهم الفرعية (ACC-02)')}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          {t('سجلات الطلاب والحسابات المالية الفرعية (Student Sub-Ledgers)')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t('متابعة الاتفاقيات الدراسية، جدول استحقاق الدفعات، المتحصلات، والإيراد المحقق وفق الحوكمة المحاسبية')}
        </p>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Sidebar Column: Student Directory Search (4 Cols) */}
        <div className="lg:col-span-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('ابحث بالاسم أو كود الطالب...')}
              className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-1 focus:ring-[#9e1b1b] focus:outline-hidden"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {loading && students.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                <span>{t('جاري تحميل قائمة الطلاب...')}</span>
              </div>
            ) : error ? (
              <div className="py-6 px-3 text-center space-y-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />
                <p className="text-amber-600 dark:text-amber-400 font-medium">{error}</p>
                <button
                  onClick={loadSubLedgers}
                  className="text-[#9e1b1b] underline font-bold cursor-pointer"
                >
                  {t('إعادة المحاولة')}
                </button>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-medium">{t('لا توجد حسابات مطابقة')}</div>
            ) : (
              filteredStudents.map(student => {
                const isSelected = student.id === currentStudent?.id;
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-rose-50/60 dark:bg-rose-950/30 border-[#9e1b1b] shadow-xs ring-1 ring-[#9e1b1b]/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {student.fullName}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {student.studentCode}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>{student.grade}</span>
                      <span
                        className={`font-semibold ${
                          student.remainingPayable > 0 ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {student.remainingPayable > 0
                          ? `متبقي: ${student.remainingPayable.toLocaleString('ar-EG')} ج.م`
                          : 'مسدد بالكامل'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Sub-Ledger Dossier (8 Cols) */}
        {!currentStudent ? (
          <div className="lg:col-span-8 flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
            {error ? (
              <>
                <AlertTriangle className="w-12 h-12 text-amber-500 mb-1" />
                <h3 className="text-base font-bold text-amber-600 dark:text-amber-400">{t('فشل في تحميل الحسابات الفرعية')}</h3>
                <p className="text-xs text-slate-500 max-w-sm">{error}</p>
                <button
                  onClick={loadSubLedgers}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#9e1b1b] text-white text-xs font-bold shadow-xs hover:bg-[#801616] cursor-pointer"
                >
                  {t('إعادة المحاولة')}
                </button>
              </>
            ) : (
              <>
                <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-1" />
                <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">{t('لا يوجد طالب محدد')}</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  {t('لم يتم العثور على سجلات طلاب أو لم يتم اختيار طالب بعد. عند تسجيل الطلاب ستظهر تفاصيل حساباتهم المالية هنا.')}
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="lg:col-span-8 space-y-5">
            {/* Student Header Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <span className="font-mono text-xs font-bold text-[#9e1b1b] px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40">
                    {currentStudent.studentCode}
                  </span>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {currentStudent.fullName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {currentStudent.grade} • {currentStudent.branchName}
                  </p>
                </div>

                <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{currentStudent.parentPhone}</span>
                  </div>
                </div>
              </div>

              {/* Financial Status KPI Grid - 4 Financial Pillars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-500 block font-bold">{t('1. إجمالي قيمة الاتفاقية')}</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                    {Number(detailedAccount?.summary?.totalCharged ?? currentStudent.totalContractValue ?? 0).toLocaleString('ar-EG')} {t('ج.م')}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 block font-bold">{t('2. الدفعات المستحقة حتى اليوم')}</span>
                  <span className="font-mono font-black text-amber-700 dark:text-amber-400 text-sm">
                    {Number(detailedAccount?.summary?.arrears ?? currentStudent.remainingPayable ?? 0).toLocaleString('ar-EG')} {t('ج.م')}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block font-bold">{t('3. إجمالي المحصل فعلياً')}</span>
                  <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                    {Number(detailedAccount?.summary?.totalCollected ?? currentStudent.totalCollected ?? 0).toLocaleString('ar-EG')} {t('ج.م')}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <span className="text-[10px] text-blue-800 dark:text-blue-300 block font-bold">{t('4. الإيراد التعليمي المحقق')}</span>
                  <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-sm">
                    {Number(detailedAccount?.summary?.earnedRevenue ?? currentStudent.earnedRevenue ?? 0).toLocaleString('ar-EG')} {t('ج.م')}
                  </span>
                </div>
              </div>
            </div>

            {/* Obligations Schedule */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#9e1b1b]" />
                {t('جدول الالتزامات الأكاديمية والرسوم المقررة')}
              </h3>

              <div className="space-y-2 text-xs">
                {detailedAccount?.obligations && detailedAccount.obligations.length > 0 ? (
                  detailedAccount.obligations.map((ob: any) => (
                    <div
                      key={ob.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {t('استحقاق أكاديمي #')}{ob.scheduleItemNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {t('تاريخ الاستحقاق:')} {new Date(ob.dueDate).toISOString().slice(0, 10)}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {Number(ob.amountDue).toLocaleString('ar-EG')} {t('ج.م')}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            ob.status === 'FULFILLED'
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {ob.status === 'FULFILLED'
                            ? 'مسدد بالكامل'
                            : `المحصل: ${Number(ob.amountCollected).toLocaleString('ar-EG')} ج.م`}
                        </span>
                      </div>
                    </div>
                  ))
                ) : currentStudent.schedule && currentStudent.schedule.length > 0 ? (
                  currentStudent.schedule.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {item.milestoneTitle}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {t('تاريخ الاستحقاق:')} {item.dueDate}
                        </span>
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {Number(item.amountDue).toLocaleString('ar-EG')} {t('ج.م')}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            item.status === 'PAID'
                              ? 'text-emerald-600'
                              : item.status === 'OVERDUE'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {item.status === 'PAID'
                            ? 'مسدد بالكامل'
                            : `المحصل: ${Number(item.amountCollected).toLocaleString('ar-EG')} ج.م`}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-slate-400 text-xs">
                    {t('لا توجد التزامات أكاديمية مسجلة بعد لهذا الطالب')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
