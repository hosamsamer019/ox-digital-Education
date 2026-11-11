import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Users, UserCheck, Shield, Phone, MapPin,
  AlertCircle, RefreshCw, CheckCircle2, Lock, Key, Copy, X
} from 'lucide-react';
import { brdSubscriptionService, BranchItem } from '../../services/brdSubscription.service';
import { userService } from '../../services/user.service';

export default function BranchesPage() {
  const { t } = useLanguage();
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [showAssignTeacherModal, setShowAssignTeacherModal] = useState(false);
  const [selectedBranchForTeacher, setSelectedBranchForTeacher] = useState<BranchItem | null>(null);
  const [targetBranchId, setTargetBranchId] = useState<string>('');
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [assigningTeacher, setAssigningTeacher] = useState(false);
  const [teacherSuccessMsg, setTeacherSuccessMsg] = useState<string | null>(null);
  const [showAddAccountantModal, setShowAddAccountantModal] = useState(false);
  const [selectedBranchForAccountant, setSelectedBranchForAccountant] = useState<BranchItem | null>(null);

  // Add Branch Form
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    isOnline: false,
  });

  // Provision Accountant Form
  const [accountantForm, setAccountantForm] = useState({
    name: '',
    email: '',
  });

  // Provisioned credentials modal
  const [provisionedCredentials, setProvisionedCredentials] = useState<{
    name: string;
    email: string;
    temporaryPassword: string;
    branchName: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadBranches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await brdSubscriptionService.getBranches();
      if (res.branches) {
        setBranches(res.branches);
      }
    } catch (err: any) {
      console.error('Failed to load branches', err);
      setError(err?.response?.data?.message || 'تعذر تحميل قائمة الفروع');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await brdSubscriptionService.createBranch(branchForm);
      setShowAddBranchModal(false);
      setBranchForm({ name: '', code: '', address: '', phone: '', isOnline: false });
      await loadBranches();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر إنشاء الفرع');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateBranch = async (branchId: string, branchName: string) => {
    if (!window.confirm(`هل أنت متأكد من تعطيل فرع "${branchName}"؟ لن يتم حذف أي بيانات تاريخية أو مالية.`)) {
      return;
    }
    try {
      await brdSubscriptionService.deactivateBranch(branchId);
      await loadBranches();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر تعطيل الفرع');
    }
  };


  const handleOpenAssignTeacher = async (branch: BranchItem) => {
    setSelectedBranchForTeacher(branch);
    setTargetBranchId(branch.id);
    setShowAssignTeacherModal(true);
    setTeacherSuccessMsg(null);
    setSelectedTeacherId('');
    try {
      const res = await userService.getUsers({ role: 'TEACHER', limit: 100 });
      const teachers = res?.data || [];
      setAvailableTeachers(teachers);
      if (teachers.length > 0) {
        setSelectedTeacherId(teachers[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load teachers for assignment', err);
    }
  };

  const handleAssignTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveBranchId = targetBranchId || selectedBranchForTeacher?.id;
    if (!effectiveBranchId || !selectedTeacherId) return;
    setAssigningTeacher(true);
    setError(null);
    try {
      await brdSubscriptionService.assignTeacherBranch(selectedTeacherId, effectiveBranchId);
      setTeacherSuccessMsg(t('تم ربط المعلم بالفرع بنجاح'));
      await loadBranches();
      const res = await userService.getUsers({ role: 'TEACHER', limit: 100 });
      setAvailableTeachers(res?.data || []);
      setTimeout(() => {
        setShowAssignTeacherModal(false);
        setTeacherSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر ربط المعلم بالفرع');
    } finally {
      setAssigningTeacher(false);
    }
  };

  const handleUnassignTeacher = async () => {
    if (!selectedTeacherId) return;
    setAssigningTeacher(true);
    setError(null);
    try {
      await brdSubscriptionService.assignTeacherBranch(selectedTeacherId, 'NONE');
      setTeacherSuccessMsg(t('تم إلغاء تعيين المعلم من الفرع بنجاح'));
      await loadBranches();
      const res = await userService.getUsers({ role: 'TEACHER', limit: 100 });
      setAvailableTeachers(res?.data || []);
      setTimeout(() => {
        setShowAssignTeacherModal(false);
        setTeacherSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر إلغاء تعيين المعلم');
    } finally {
      setAssigningTeacher(false);
    }
  };

  const handleProvisionAccountant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchForAccountant) return;
    setSaving(true);
    setError(null);
    try {
      const res = await brdSubscriptionService.createBranchAccountant(
        selectedBranchForAccountant.id,
        accountantForm
      );
      setShowAddAccountantModal(false);
      setProvisionedCredentials({
        name: res.accountant.name,
        email: res.accountant.email,
        temporaryPassword: res.temporaryPassword,
        branchName: selectedBranchForAccountant.name,
      });
      setAccountantForm({ name: '', email: '' });
      await loadBranches();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'تعذر إنشاء حساب المحاسب');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!provisionedCredentials) return;
    const text = `بيانات دخول المحاسب:\nالاسم: ${provisionedCredentials.name}\nالبريد: ${provisionedCredentials.email}\nكلمة المرور المؤقتة: ${provisionedCredentials.temporaryPassword}\nالفرع: ${provisionedCredentials.branchName}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-7 h-7 text-[#9e1b1b]" />
            {t('إدارة الفروع والمحاسبين (Branches & Accountants)')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('إدارة فروع السنتر، ربط المعلمين، وتعيين المحاسبين بنطاق فرعي مقيد وفق وثيقة BRD')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadBranches}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-card-foreground bg-card border border-border rounded-lg hover:bg-muted transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('تحديث')}
          </button>
          <button
            onClick={() => setShowAddBranchModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#9e1b1b] rounded-lg hover:bg-[#801515] transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('إضافة فرع جديد')}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Branches List */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 text-[#9e1b1b] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`p-6 rounded-2xl bg-card text-card-foreground border transition shadow-sm space-y-5 ${
                b.status === 'ACTIVE' ? 'border-gray-200 hover:border-gray-300' : 'border-gray-200 bg-gray-50/70 opacity-75'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800">
                  {b.code}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    b.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {b.status === 'ACTIVE' ? 'نشط' : 'معطل'}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-foreground">{b.name}</h3>
                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                  {b.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <span>{b.address}</span>
                    </div>
                  )}
                  {b.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span dir="ltr">{b.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Counts */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-xl text-center text-xs">
                <div>
                  <span className="text-gray-500 block">{t('المعلمون')}</span>
                  <span className="font-bold text-foreground text-sm">{b.teacherCount || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('المحاسبون')}</span>
                  <span className="font-bold text-foreground text-sm">{b.accountantCount || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('الطلاب النشطون')}</span>
                  <span className="font-bold text-emerald-700 text-sm">{b.activeStudents || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('المقيدون / مقفل')}</span>
                  <span className="font-bold text-red-600 text-sm">{b.lockedStudents || 0}</span>
                </div>
              </div>

              {/* Collections */}
              <div className="p-3 bg-red-50/40 border border-red-100 rounded-xl flex items-center justify-between text-xs">
                <span className="text-gray-600 font-medium">{t('تحصيلات الشهر:')}</span>
                <span className="font-bold text-[#9e1b1b] text-sm">
                  {(b.totalCollectedThisMonth || 0).toLocaleString()} {t('ج.م')}
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenAssignTeacher(b)}
                  className="flex-1 py-2 px-3 text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100 rounded-lg transition flex items-center justify-center gap-1"
                  title={t('ربط معلم بهذا الفرع ليتمكن محاسب الفرع من تحصيل اشتراكاته')}
                >
                  <Users className="w-3.5 h-3.5" />
                  {t('ربط معلم بالفرع')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBranchForAccountant(b);
                    setShowAddAccountantModal(true);
                  }}
                  className="flex-1 py-2 px-3 text-xs font-bold text-[#9e1b1b] bg-red-50 dark:bg-red-950/40 dark:text-rose-300 hover:bg-red-100 rounded-lg transition flex items-center justify-center gap-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {t('تعيين محاسب للفرع')}
                </button>

                {b.status === 'ACTIVE' && !b.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleDeactivateBranch(b.id, b.name)}
                    className="py-2 px-3 text-xs text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg transition"
                  >
                    {t('تعطيل')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}


      {/* MODAL 4: Assign Teacher to Branch */}
      {showAssignTeacherModal && selectedBranchForTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card text-card-foreground rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-border animate-scaleUp">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-[#9e1b1b]" />
                {t('ربط معلم بفرع:')} {selectedBranchForTeacher.name}
              </h2>
              <button onClick={() => setShowAssignTeacherModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('اختر معلماً لربطه بهذا الفرع. يتيح ذلك لمحاسب الفرع رؤية طلاب هذا المعلم وتسجيل إيصالات التحصيل لهم.')}
            </p>

            {teacherSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{teacherSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleAssignTeacherSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">{t('اختر المعلم المراد ربطه *')}</label>
                {availableTeachers.length === 0 ? (
                  <p className="text-xs text-amber-600 p-2 border border-amber-200 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    {t('لا يوجد معلمون مسجلون في المنصة حالياً.')}
                  </p>
                ) : (
                  <>
                    <select
                      required
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full px-3 py-2 border border-border bg-input text-foreground rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                    >
                      {availableTeachers.map((tch) => (
                        <option key={tch.id} value={tch.id}>
                          {tch.name} ({tch.email}) {tch.branch ? `— حالياً: ${tch.branch.name}` : `— ${t('غير مسند لفرع حالياً')}`}
                        </option>
                      ))}
                    </select>

                    {(() => {
                      const selTeacher = availableTeachers.find(t => t.id === selectedTeacherId);
                      if (!selTeacher) return null;
                      return (
                        <div className="mt-3 p-3 bg-muted/60 rounded-xl border border-border text-xs space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">{t('الفرع الحالي:')}</span>
                            <span className="font-bold text-foreground">
                              {selTeacher.branch ? `${selTeacher.branch.name} (${selTeacher.branch.code || ''})` : t('غير مسند لفرع حالياً')}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1">{t('اختر الفرع المطلوب تعيين المعلم به:')}</label>
                            <select
                              value={targetBranchId || selectedBranchForTeacher.id}
                              onChange={(e) => setTargetBranchId(e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-border bg-input text-foreground rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#9e1b1b]"
                            >
                              {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name} ({b.code})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              <div className="flex justify-between items-center gap-2 pt-3 border-t border-border">
                {(() => {
                  const selTeacher = availableTeachers.find(t => t.id === selectedTeacherId);
                  if (selTeacher?.branch) {
                    return (
                      <button
                        type="button"
                        onClick={handleUnassignTeacher}
                        disabled={assigningTeacher}
                        className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg border border-red-200 transition"
                      >
                        {t('إلغاء التعيين')}
                      </button>
                    );
                  }
                  return <div />;
                })()}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAssignTeacherModal(false)}
                    className="px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg"
                  >
                    {t('إلغاء')}
                  </button>
                  <button
                    type="submit"
                    disabled={assigningTeacher || availableTeachers.length === 0}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#801515] rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {assigningTeacher ? t('جاري الربط...') : t('تأكيد ربط المعلم بالفرع')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: Add Branch */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card text-card-foreground rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-border animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#9e1b1b]" />
                {t('إضافة فرع جديد للمؤسسة')}
              </h2>
              <button onClick={() => setShowAddBranchModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('اسم الفرع *')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('مثال: سنتر النصر - مدينة نصر')}
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('كود الفرع (Code) *')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('مثال: NASR-01')}
                  value={branchForm.code}
                  onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('العنوان')}</label>
                <input
                  type="text"
                  placeholder={t('عنوان السنتر بالتفصيل')}
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('رقم الهاتف')}</label>
                <input
                  type="text"
                  placeholder="010..."
                  value={branchForm.phone}
                  onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isOnline"
                  checked={branchForm.isOnline}
                  onChange={(e) => setBranchForm({ ...branchForm, isOnline: e.target.checked })}
                  className="rounded text-[#9e1b1b] focus:ring-[#9e1b1b]"
                />
                <label htmlFor="isOnline" className="text-xs text-gray-700 font-medium">
                  {t('فرع رقمي / أونلاين (Online Branch)')}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#801515] rounded-lg shadow-sm"
                >
                  {saving ? 'جاري الإنشاء...' : 'إنشاء الفرع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Provision Branch Accountant */}
      {showAddAccountantModal && selectedBranchForAccountant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card text-card-foreground rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-border animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#9e1b1b]" />
                {t('تعيين محاسب لفرع:')} {selectedBranchForAccountant.name}
              </h2>
              <button onClick={() => setShowAddAccountantModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600">
              {t('يقوم النظام بتوليد كلمة مرور مؤقتة عالية الأمان (CSPRNG) ويتم تقييد المحاسب بطلاب ومعلمي هذا الفرع فقط.')}
            </p>

            <form onSubmit={handleProvisionAccountant} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('اسم المحاسب *')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('أ/ أحمد إبراهيم')}
                  value={accountantForm.name}
                  onChange={(e) => setAccountantForm({ ...accountantForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('البريد الإلكتروني الفريد *')}</label>
                <input
                  type="email"
                  required
                  placeholder="accountant.nasr@edu.com"
                  value={accountantForm.email}
                  onChange={(e) => setAccountantForm({ ...accountantForm, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddAccountantModal(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#801515] rounded-lg shadow-sm"
                >
                  {saving ? 'جاري التعيين...' : 'توليد الحساب وكلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: One-time Credentials Presentation Card */}
      {provisionedCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card text-card-foreground rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border-2 border-emerald-500 animate-scaleUp">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="w-7 h-7 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-black text-foreground">{t('تم إنشاء حساب المحاسب بنجاح!')}</h2>
                <p className="text-xs text-gray-600">
                  {t('يرجى نسخ بيانات الدخول التالية وتسليمها للمحاسب الآن (تظهر لمرة واحدة فقط)')}
                </p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 font-mono text-sm">
              <div className="flex justify-between items-center py-1 border-b border-gray-200">
                <span className="text-gray-500 font-sans text-xs">{t('اسم المحاسب:')}</span>
                <span className="font-bold text-gray-900 font-sans">{provisionedCredentials.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200">
                <span className="text-gray-500 font-sans text-xs">{t('البريد الإلكتروني:')}</span>
                <span className="font-bold text-blue-700">{provisionedCredentials.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-200 bg-amber-50 p-2 rounded-lg">
                <span className="text-amber-800 font-sans text-xs font-bold">{t('كلمة المرور المؤقتة:')}</span>
                <span className="font-black text-red-600 text-base">{provisionedCredentials.temporaryPassword}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500 font-sans text-xs">{t('الفرع المخصص:')}</span>
                <span className="font-bold text-gray-900 font-sans">{provisionedCredentials.branchName}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-2 shadow-sm"
              >
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'تم النسخ للحافظة!' : 'نسخ البيانات'}
              </button>

              <button
                type="button"
                onClick={() => setProvisionedCredentials(null)}
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
