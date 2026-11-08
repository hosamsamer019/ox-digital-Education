import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Users, UserCheck, Shield, Phone, MapPin,
  AlertCircle, RefreshCw, CheckCircle2, Lock, Key, Copy, X
} from 'lucide-react';
import { brdSubscriptionService, BranchItem } from '../../services/brdSubscription.service';

export default function BranchesPage() {
  const { t } = useLanguage();
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
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
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
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
              className={`p-6 rounded-2xl bg-white border transition shadow-sm space-y-5 ${
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
                <h3 className="text-lg font-bold text-gray-900">{b.name}</h3>
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
              <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl text-center text-xs">
                <div>
                  <span className="text-gray-500 block">{t('المعلمون')}</span>
                  <span className="font-bold text-gray-800 text-sm">{b.teacherCount || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">{t('المحاسبون')}</span>
                  <span className="font-bold text-gray-800 text-sm">{b.accountantCount || 0}</span>
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
                  onClick={() => {
                    setSelectedBranchForAccountant(b);
                    setShowAddAccountantModal(true);
                  }}
                  className="flex-1 py-2 px-3 text-xs font-bold text-[#9e1b1b] bg-red-50 hover:bg-red-100 rounded-lg transition flex items-center justify-center gap-1"
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

      {/* MODAL 1: Add Branch */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border-2 border-emerald-500 animate-scaleUp">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="w-7 h-7 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-black text-gray-900">{t('تم إنشاء حساب المحاسب بنجاح!')}</h2>
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
