import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Settings2,
  Building2,
  Calendar,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  History,
  Users,
  Search,
  Save,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { accountingService } from '../../services/accounting.service';

interface BranchPolicy {
  branchId: string;
  branchName: string;
  branchCode: string;
  gracePeriodDays: number;
  isEnabled: boolean;
}

export default function FinancialPolicyPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // Policy Form State
  const [policyMode, setPolicyMode] = useState<'GLOBAL' | 'PER_BRANCH'>('GLOBAL');
  const [globalGraceDays, setGlobalGraceDays] = useState<number>(5);
  const [isGlobalEnabled, setIsGlobalEnabled] = useState<boolean>(true);
  const [reason, setReason] = useState<string>('');
  const [branchPolicies, setBranchPolicies] = useState<BranchPolicy[]>([]);

  // Restricted Students & Audit State
  const [restrictedStudents, setRestrictedStudents] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [searchStudent, setSearchStudent] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [policyRes, restrictionsRes] = await Promise.all([
        accountingService.getFinancialAccessPolicy(),
        accountingService.getFinancialRestrictions()
      ]);

      if (policyRes) {
        setPolicyMode(policyRes.policyMode || 'GLOBAL');
        setGlobalGraceDays(policyRes.gracePeriodDays ?? 5);
        setIsGlobalEnabled(policyRes.isEnabled ?? true);
        if (Array.isArray(policyRes.branches)) {
          setBranchPolicies(
            policyRes.branches.map((b: any) => ({
              branchId: b.id,
              branchName: b.name,
              branchCode: b.code,
              gracePeriodDays: b.gracePeriodDays ?? 5,
              isEnabled: b.isEnabled ?? true
            }))
          );
        }
      }

      if (restrictionsRes) {
        setRestrictedStudents(restrictionsRes.restrictedStudents || []);
        setAuditLog(restrictionsRes.recentHistory || []);
      }
    } catch (err: any) {
      console.error('Failed to load financial policy data:', err);
      toast.error(t('تعذر تحميل إعدادات الحوكمة وسياسات الرسوم'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error(t('يرجى كتابة سبب التعديل لتوثيقه في سجل التدقيق المالي الإلزامي'));
      return;
    }

    try {
      setSaving(true);
      await accountingService.updateFinancialAccessPolicy({
        policyMode,
        gracePeriodDays: globalGraceDays,
        isEnabled: isGlobalEnabled,
        reason: reason.trim(),
        branchOverrides:
          policyMode === 'PER_BRANCH'
            ? branchPolicies.map(b => ({
                branchId: b.branchId,
                gracePeriodDays: b.gracePeriodDays,
                isEnabled: b.isEnabled
              }))
            : []
      });
      toast.success(t('تم حفظ وتوثيق سياسة الرسوم والمهلة بنجاح'));
      setReason('');
      await loadData();
    } catch (err: any) {
      console.error('Error saving policy:', err);
      toast.error(err.response?.data?.message || 'فشل حفظ السياسة');
    } finally {
      setSaving(false);
    }
  };

  const handleRunEvaluation = async () => {
    try {
      setEvaluating(true);
      const res = await accountingService.triggerFinancialEvaluation(false);
      toast.success(
        `اكتمل التدقيق المالي: تم فحص ${res.evaluatedStudentsCount || 0} طالب، تقييد ${res.restrictedCount || 0} طالب، وإعادة تفعيل ${res.reactivatedCount || 0} طالب.`
      );
      await loadData();
    } catch (err: any) {
      console.error('Error running evaluation:', err);
      toast.error(t('فشل تنفيذ الفحص المالي المباشر'));
    } finally {
      setEvaluating(false);
    }
  };

  const filteredRestricted = restrictedStudents.filter(
    s =>
      s.name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchStudent.toLowerCase()) ||
      s.branch?.name?.toLowerCase().includes(searchStudent.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-[#9e1b1b]" />
        <span className="mr-3 font-semibold">{t('جاري تحميل سياسات الحوكمة المالية...')}</span>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-[#9e1b1b]" />
            {t('سياسة حوكمة استحقاق الرسوم الشهرية والمهلة')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('إدارة فترات السماح للرسوم الشهرية، التحكم التلقائي في الوصول التعليمي، وسجل التدقيق والتقييد')}
          </p>
        </div>

        <button
          onClick={handleRunEvaluation}
          disabled={evaluating}
          className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-emerald-500" />}
          <span>{evaluating ? 'جاري الفحص المالي...' : 'تشغيل الفحص والتقييم الآني الآن'}</span>
        </button>
      </div>

      {/* Main Grid: Policy Configuration Form + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Policy Form (7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#121827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
          <form onSubmit={handleSavePolicy} className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#9e1b1b]" />
                {t('نمط إدارة المهلة (Mode Selection)')}
              </h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800">
                {t('صلاحية المدير العام حصراً')}
              </span>
            </div>

            {/* Mode A vs Mode B Radios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  policyMode === 'GLOBAL'
                    ? 'border-[#9e1b1b] bg-[#9e1b1b]/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    name="policyMode"
                    value="GLOBAL"
                    checked={policyMode === 'GLOBAL'}
                    onChange={() => setPolicyMode('GLOBAL')}
                    className="accent-[#9e1b1b]"
                  />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{t('النمط أ: مركزي موحد (Mode A)')}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t('تطبيق مهلة سماح موحدة على مستوى جميع فروع المؤسسة دون أي استثناءات.')}
                </p>
              </label>

              <label
                className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                  policyMode === 'PER_BRANCH'
                    ? 'border-[#9e1b1b] bg-[#9e1b1b]/5'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="radio"
                    name="policyMode"
                    value="PER_BRANCH"
                    checked={policyMode === 'PER_BRANCH'}
                    onChange={() => setPolicyMode('PER_BRANCH')}
                    className="accent-[#9e1b1b]"
                  />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{t('النمط ب: مخصص لكل فرع (Mode B)')}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {t('تحديد مهلة خاصة ومستقلة لكل فرع حسب طبيعته الجغرافية والإدارية.')}
                </p>
              </label>
            </div>

            {/* Global Grace Days Input */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {policyMode === 'GLOBAL' ? 'مهلة السماح الموحدة (بالأيام بعد نهاية الشهر)' : 'المهلة الافتراضية للفروع'}
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={globalGraceDays}
                  onChange={e => setGlobalGraceDays(Math.max(0, Math.min(60, Number(e.target.value))))}
                  className="w-28 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-base text-slate-900 dark:text-white text-center"
                />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {t('أيام (يبدأ التقييد التلقائي بعد نهاية الشهر + هذه المهلة عند منتصف الليل)')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {t('* ملاحظة: 0 تعني التقييد الفوري مع نهاية اليوم الأخير من الشهر (مع مراعاة الأشهر الكبيسة وشهر فبراير بدقة).')}
              </p>
            </div>

            {/* Per-Branch Table if Mode B */}
            {policyMode === 'PER_BRANCH' && (
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#9e1b1b]" />
                  {t('تخصيص المهلة لكل فرع:')}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
                        <th className="py-2 px-3">{t('الفرع')}</th>
                        <th className="py-2 px-3">{t('مهلة السماح (أيام)')}</th>
                        <th className="py-2 px-3">{t('الحالة')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {branchPolicies.map((b, idx) => (
                        <tr key={b.branchId}>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                            {b.branchName} ({b.branchCode})
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0"
                              max="60"
                              value={b.gracePeriodDays}
                              onChange={e => {
                                const val = Math.max(0, Math.min(60, Number(e.target.value)));
                                const updated = [...branchPolicies];
                                updated[idx].gracePeriodDays = val;
                                setBranchPolicies(updated);
                              }}
                              className="w-20 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-center font-bold"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={b.isEnabled}
                                onChange={e => {
                                  const updated = [...branchPolicies];
                                  updated[idx].isEnabled = e.target.checked;
                                  setBranchPolicies(updated);
                                }}
                                className="accent-[#9e1b1b]"
                              />
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                {b.isEnabled ? 'مفعل' : 'معطل'}
                              </span>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reason input for audit trail */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                {t('مبرر التعديل / القرار الإداري (إلزامي لسجل التدقيق المالي):')}
              </label>
              <textarea
                required
                rows={2}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={t('مثال: اعتماد مهلة 5 أيام للفصل الدراسي الجديد بناءً على موافقة مجلس الإدارة...')}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#851616] transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'جاري توثيق السياسة...' : 'اعتماد وحفظ السياسة وتوثيقها في سجل التدقيق'}</span>
            </button>
          </form>
        </div>

        {/* Status Summary & Restricted Counter (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-[#121827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              {t('مؤشرات الحظر والتقييد المالي الحالي')}
            </h3>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 block">
                  {t('الطلاب المقيدون حالياً بسبب رسوم شهرية')}
                </span>
                <span className="text-2xl font-black text-amber-800 dark:text-amber-200 mt-1 block">
                  {restrictedStudents.length} {t('طالب')}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>

            <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
              <p>
                &bull; <strong>{t('قاعدة عدم التسامح مع الغرامات:')}</strong> {t('النظام لا يفرض أي فوائد أو غرامات مالية على التأخير وفق الشريعة.')}
              </p>
              <p>
                &bull; <strong>{t('إعادة التفعيل الفورية:')}</strong> {t('بمجرد سداد الرسوم الشهرية كاملة وإصدار الإيصال الرسمي بالخزينة، يتم رفع التقييد تلقائياً.')}
              </p>
              <p>
                &bull; <strong>{t('سرية المعلم:')}</strong> {t('المعلم لا يرى شارات الديون المالية حفاظاً على كرامة الطالب التعليمية.')}
              </p>
            </div>
          </div>

          {/* Audit History Snapshot */}
          <div className="bg-white dark:bg-[#121827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-500" />
              {t('آخر أحداث التقييد والتفعيل المالي')}
            </h3>
            {auditLog.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto text-xs">
                {auditLog.slice(0, 6).map((log: any) => (
                  <div
                    key={log.id}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {log.student?.name || 'طالب'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {log.reason || 'إجراء نظامي'} &bull; {new Date(log.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        log.action === 'RESTRICTED'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                          : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}
                    >
                      {log.action === 'RESTRICTED' ? 'تقييد' : 'إعادة تفعيل'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 text-center py-3">{t('لا توجد عمليات تقييد مسجلة حتى الآن')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Restricted Students Table */}
      <div className="bg-white dark:bg-[#121827] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-[#9e1b1b]" />
            {t('جدول الطلاب المعلق وصولهم مالياً بسبب رسوم شهرية')}
          </h3>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder={t('بحث بالاسم أو البريد أو الفرع...')}
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              className="w-full pl-3 pr-8 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
          </div>
        </div>

        {filteredRestricted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">{t('اسم الطالب')}</th>
                  <th className="py-2.5 px-3">{t('الفرع التعليمي')}</th>
                  <th className="py-2.5 px-3">{t('الأشهر المتأخرة')}</th>
                  <th className="py-2.5 px-3">{t('إجمالي الرسوم المتأخرة')}</th>
                  <th className="py-2.5 px-3">{t('تاريخ آخر إجراء')}</th>
                  <th className="py-2.5 px-3">{t('حالة الحساب')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRestricted.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{s.name}</div>
                      <div className="text-[10px] text-slate-400">{s.email || s.phone}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                      {s.branch?.name || 'الفرع الرئيسي'}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-mono">
                      {s.overdueMonthlyObligations?.map((o: any) => o.billingMonth).join(', ') || 'رسوم شهرية'}
                    </td>
                    <td className="py-3 px-3 font-bold text-rose-600">
                      {(s.totalOutstandingMonthlyBalance || 0).toLocaleString()} {t('ج.م')}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {s.latestRestrictionEvent?.createdAt
                        ? new Date(s.latestRestrictionEvent.createdAt).toLocaleDateString('ar-EG')
                        : 'غير مسجل'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        {t('معلق مالياً')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
            <p>{t('لا يوجد أي طلاب مقيدين مالياً حالياً. كافة الطلاب ملتزمون بسداد الرسوم الشهرية.')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

