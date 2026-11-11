import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  ShieldCheck,
  Building2,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Lock,
  ShieldAlert,
  Info,
  Copy,
  Loader2
} from 'lucide-react';
import { userService } from '../../services/user.service';
import { toast } from 'sonner';
// Live branch data loaded dynamically from userService
import { TeamMember, BranchScopeId } from './types';

export default function TeamManagementPage() {
  const { t } = useLanguage();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ACCOUNTANT' | 'PRIMARY_MANAGER'>('ALL');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Form State for Accountant Invitation
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  interface LiveBranch {
    id: string;
    name: string;
    code: string;
    isOnline?: boolean;
    institutionId?: string;
  }

  const [branches, setBranches] = useState<LiveBranch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [inviteBranchId, setInviteBranchId] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; branch?: string }>({});
  const [createdAccountantResult, setCreatedAccountantResult] = useState<{
    id: string;
    name: string;
    email: string;
    branchId: string;
    branchName: string;
    temporaryPassword?: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  const fetchTeamRoster = async () => {
    setIsLoadingRoster(true);
    setRosterError(null);
    try {
      const liveMembers = await userService.getTeamMembers();
      if (Array.isArray(liveMembers)) {
        setTeamMembers(liveMembers);
      } else {
        setTeamMembers([]);
      }
    } catch (err: any) {
      console.error('Failed to load remote team roster:', err);
      setTeamMembers([]);
      setRosterError(t('فشل في تحميل سجل فريق العمل من الخادم. يرجى التحقق من الاتصال والمحاولة مرة أخرى.'));
    } finally {
      setIsLoadingRoster(false);
    }
  };

  const fetchBranches = async () => {
    setIsLoadingBranches(true);
    setBranchesError(null);
    try {
      const data = await userService.getManagerBranches();
      const list: LiveBranch[] = Array.isArray(data) ? data : [];
      setBranches(list);
      if (list.length > 0) {
        setInviteBranchId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load branches:', err);
      setBranchesError(t('تعذر تحميل قائمة الفروع المعتمدة من الخادم'));
    } finally {
      setIsLoadingBranches(false);
    }
  };

  useEffect(() => {
    fetchTeamRoster();
    fetchBranches();
  }, []);

  // Live branches from database
  const eligibleBranches = useMemo(() => {
    return branches;
  }, [branches]);

  // Filtered Team Members
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(member => {
      // Search matching
      const matchesSearch =
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase());

      // Branch matching
      const matchesBranch =
        selectedBranch === 'ALL' ||
        member.branchId === selectedBranch ||
        (selectedBranch === 'INST-CONSOLIDATED' && member.branchId === 'INST-CONSOLIDATED');

      // Role matching
      const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;

      return matchesSearch && matchesBranch && matchesRole;
    });
  }, [teamMembers, searchTerm, selectedBranch, roleFilter]);

  // Validation
  const validateForm = () => {
    const errors: { name?: string; email?: string; branch?: string } = {};

    if (!inviteName.trim()) {
      errors.name = 'يرجى إدخال الاسم الكامل للمحاسب';
    } else if (inviteName.trim().length < 3) {
      errors.name = 'الاسم يجب ألا يقل عن 3 أحرف';
    }

    if (!inviteEmail.trim()) {
      errors.email = 'يرجى إدخال البريد الإلكتروني';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      errors.email = 'صيغة البريد الإلكتروني غير صحيحة';
    }

    if (!inviteBranchId) {
      errors.branch = 'يرجى اختيار الفرع المنسوب إليه المحاسب';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const branchName = eligibleBranches.find(b => b.id === inviteBranchId)?.name || 'فرع معتمد';
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();
    const branchId = inviteBranchId;

    setIsSubmittingInvite(true);
    try {
      const res = await userService.createAccountant({ name, email, branchId });

      const newMember: TeamMember = {
        id: res.user?.id || `tm-${Date.now()}`,
        name: name || res.user?.name,
        email: email,
        role: 'ACCOUNTANT',
        roleLabel: 'محاسب الفرع',
        branchId,
        branchName: res.user?.branch?.name || branchName,
        status: 'PENDING_ACTIVATION',
        statusLabel: 'بانتظار تغيير كلمة المرور',
        invitedAt: new Date().toISOString().split('T')[0]
      };

      // Close invite modal and update state
      setTeamMembers(prev => [newMember, ...prev]);
      setIsInviteModalOpen(false);
      setInviteName('');
      setInviteEmail('');
      setInviteBranchId(branches.length > 0 ? branches[0].id : '');
      setFormErrors({});

      // Present the one-time temporary password confirmation modal with server-generated password
      setCreatedAccountantResult({
        id: newMember.id,
        name: newMember.name,
        email: newMember.email,
        branchId: newMember.branchId,
        branchName: newMember.branchName,
        temporaryPassword: res.temporaryPassword
      });

      toast.success(t('تم إنشاء حساب المحاسب بنجاح'), {
        description: `تم توليد كلمة مرور مؤقتة لـ ${newMember.name}`
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.message || 'فشل إنشاء حساب المحاسب';
      toast.error(msg);
      if (err.response?.status === 400 || err.response?.status === 409) {
        setFormErrors(prev => ({ ...prev, email: msg }));
      }
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
            <span>{t('الرئيسية')}</span>
            <span>/</span>
            <span className="text-[#9e1b1b] font-bold">{t('إدارة فريق العمل والمحاسبين (PM-TEAM-01)')}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-[#9e1b1b]" />
            {t('سجل فريق العمل وحوكمة المحاسبين المعتمدين')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('إدارة وتعيين محاسبي الفروع ومتابعة تفعيل حساباتهم ضمن نطاق المؤسسة التعليمية')}
          </p>
        </div>

        {/* Invite Action Button */}
        <div>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            data-testid="invite-accountant-btn"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#9e1b1b] hover:bg-[#851616] text-white text-sm font-bold shadow-sm transition-all focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b] focus:ring-offset-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('دعوة محاسب جديد')}</span>
          </button>
        </div>
      </div>

      {/* KPI & Governance Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border text-card-foreground shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">{t('إجمالي المحاسبين')}</span>
          <span className="text-xl sm:text-2xl font-black text-foreground mt-1 block">
            {teamMembers.filter(m => m.role === 'ACCOUNTANT').length}
          </span>
          <span className="text-[11px] text-emerald-600 font-bold mt-1 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {t('معتمدون بالفروع')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border text-card-foreground shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">{t('دعوات بانتظار التفعيل')}</span>
          <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
            {teamMembers.filter(m => m.status === 'PENDING_ACTIVATION').length}
          </span>
          <span className="text-[11px] text-amber-600 font-medium mt-1 inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {t('بانتظار إكمال الرابط')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border text-card-foreground shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">{t('الفروع المغطاة')}</span>
          <span className="text-xl sm:text-2xl font-black text-foreground mt-1 block">
            {t('2 من 2')}
          </span>
          <span className="text-[11px] text-slate-500 font-medium mt-1 inline-flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {t('الدقي ومدينة نصر')}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border text-card-foreground shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">{t('صلاحية التعيين')}</span>
          <span className="text-sm font-black text-[#9e1b1b] mt-1 block">
            {t('المدير الأساسي حصراً')}
          </span>
          <span className="text-[11px] text-slate-400 font-medium mt-1 inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            {t('حظر استثناءات الأدمن')}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-card border border-border text-card-foreground shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('البحث بالاسم أو البريد الإلكتروني للمحاسب...')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              data-testid="team-search-input"
              className="w-full pl-3 pr-9 py-2 rounded-xl bg-muted/60 text-muted-foreground border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Branch Filter Select */}
          <div className="sm:w-64">
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              data-testid="branch-filter-select"
              className="w-full px-3 py-2 rounded-xl bg-muted/60 text-muted-foreground border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
            >
              <option value="ALL">{t('كافة الفروع المعتمدة')}</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter Tabs */}
          <div className="flex rounded-xl bg-muted text-muted-foreground p-1 text-xs font-bold">
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === 'ALL'
                  ? 'bg-card text-card-foreground text-[#9e1b1b] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {t('الكل (')}{teamMembers.length})
            </button>
            <button
              onClick={() => setRoleFilter('ACCOUNTANT')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                roleFilter === 'ACCOUNTANT'
                  ? 'bg-card text-card-foreground text-[#9e1b1b] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {t('المحاسبين (')}{teamMembers.filter(m => m.role === 'ACCOUNTANT').length})
            </button>
          </div>
        </div>
      </div>

      {/* Roster Network Error Banner */}
      {rosterError && (
        <div data-testid="roster-error-banner" className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-red-800 dark:text-red-300">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <span>{rosterError}</span>
          </div>
          <button
            onClick={() => fetchTeamRoster()}
            data-testid="roster-retry-btn"
            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
          >
            {t('إعادة المحاولة')}
          </button>
        </div>
      )}

      {/* Team Roster Table */}
      <div className="bg-card text-card-foreground rounded-2xl border border-border shadow-xs overflow-hidden">
        {isLoadingRoster && (
          <div data-testid="roster-loading-state" className="p-8 text-center text-slate-500">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-[#9e1b1b] mb-2" />
            <p className="text-sm">{t('جاري تحميل سجل فريق العمل من الخادم...')}</p>
          </div>
        )}
        {filteredMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-bold border-b border-border">
                <tr>
                  <th className="py-3 px-4">{t('عضو الفريق')}</th>
                  <th className="py-3 px-4">{t('الدور الوظيفي')}</th>
                  <th className="py-3 px-4">{t('الفرع المالي المنسوب')}</th>
                  <th className="py-3 px-4">{t('حالة الحساب')}</th>
                  <th className="py-3 px-4">{t('تاريخ الدعوة / الانضمام')}</th>
                  <th className="py-3 px-4 text-center">{t('الإجراء')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredMembers.map(member => (
                  <tr
                    key={member.id}
                    data-testid={`team-row-${member.id}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#9e1b1b]/10 dark:bg-[#9e1b1b]/20 text-[#9e1b1b] font-black flex items-center justify-center text-xs">
                          {member.name.split(' ')[0]?.[0] || 'م'}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">
                            {member.name}
                          </div>
                          <div className="text-xs text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />
                            {member.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                          member.role === 'PRIMARY_MANAGER'
                            ? 'bg-[#9e1b1b]/10 text-[#9e1b1b] dark:bg-[#9e1b1b]/20 dark:text-red-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        <ShieldCheck className="w-3 h-3" />
                        {member.roleLabel}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-foreground">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{member.branchName}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                          member.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : member.status === 'PENDING_ACTIVATION'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {member.status === 'ACTIVE' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {member.statusLabel}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                      {member.joinedAt ? `انضم: ${member.joinedAt}` : `أُرسلت: ${member.invitedAt}`}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="text-xs font-medium text-slate-400">
                        {member.status === 'ACTIVE' ? 'مصرح ونشط' : 'بانتظار التأكيد'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Empty State */
          <div
            data-testid="team-empty-state"
            className="py-12 px-4 text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-foreground">
              {t('لا توجد نتائج مطابقة لمعايير البحث')}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {t('لم نعثر على أي أعضاء أو محاسبين يطابقون كلمة البحث أو الفرع المحدد.')}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedBranch('ALL');
                setRoleFilter('ALL');
              }}
              className="text-xs font-bold text-[#9e1b1b] hover:underline"
            >
              {t('إعادة ضبط الفلاتر')}
            </button>
          </div>
        )}
      </div>

      {/* Invite Accountant Modal */}
      {isInviteModalOpen && (
        <div
          data-testid="invite-modal"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="w-full max-w-lg bg-card text-card-foreground rounded-3xl border border-border shadow-xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#9e1b1b]/10 text-[#9e1b1b] flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-lg text-foreground">
                    {t('دعوة محاسب مالي جديد')}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {t('إصدار دعوة مشفرة مؤقتة لتعيين محاسب تابع لمؤسستك')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Critical Gate Notice Banner */}
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>{t('حالة مسار الدعوات: بانتظار اعتماد بنية الرموز المشفرة (Staff Invitation Token)')}</span>
                </div>
                <p className="leading-relaxed text-[11px] text-amber-800 dark:text-amber-300">
                  {t('وفقاً لضوابط الحوكمة الصارمة، لن يتم إنشاء حسابات بكلمات مرور مؤقتة عبر لوحة التحكم. يتطلب الإرسال الفعلي لروابط البريد تفعيل نموذج الدعوات في الخادم الخلفي.')}
                </p>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleInviteSubmit} noValidate className="p-5 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {t('الاسم الرباعي للمحاسب')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder={t('مثال: حسام محمد السيد')}
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  data-testid="invite-name-input"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 text-muted-foreground border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
                />
                {formErrors.name && (
                  <span className="text-[11px] font-bold text-red-500 mt-1 block">
                    {formErrors.name}
                  </span>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {t('البريد الإلكتروني المهني')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  placeholder="accountant@cma-academy.edu"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  data-testid="invite-email-input"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 text-muted-foreground border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b] font-mono text-left"
                  dir="ltr"
                />
                {formErrors.email && (
                  <span className="text-[11px] font-bold text-red-500 mt-1 block">
                    {formErrors.email}
                  </span>
                )}
              </div>

              {/* Branch Selection */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {t('فرع التعيين الحضوري')} <span className="text-red-500">*</span>
                </label>
                {isLoadingBranches ? (
                  <div className="flex items-center gap-2 p-2.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-[#9e1b1b]" />
                    <span>{t('جاري تحميل الفروع المعتمدة من الخادم...')}</span>
                  </div>
                ) : branchesError ? (
                  <div className="p-2.5 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center justify-between">
                    <span>{branchesError}</span>
                    <button type="button" onClick={fetchBranches} className="text-xs font-bold underline">{t('إعادة المحاولة')}</button>
                  </div>
                ) : branches.length === 0 ? (
                  <div className="p-3 text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl">
                    {t('لا توجد فروع مسجلة بالمؤسسة. يرجى إنشاء فرع أولاً من صفحة الفروع قبل تعيين محاسب.')}
                  </div>
                ) : (
                  <select
                    value={inviteBranchId}
                    onChange={e => setInviteBranchId(e.target.value)}
                    data-testid="invite-branch-select"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 text-muted-foreground border border-border text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
                  >
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </option>
                    ))}
                  </select>
                )}
                {formErrors.branch && (
                  <span className="text-[11px] font-bold text-red-500 mt-1 block">
                    {formErrors.branch}
                  </span>
                )}
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {t('يقتصر التعيين على فروع المؤسسة التابعة لصلاحية المدير الأساسي الحالي.')}
                </span>
              </div>

              {/* Fixed Role Field (Read-Only / Protected) */}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {t('الدور الوظيفي والصلاحية المالية')}
                </label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted text-muted-foreground/80 border border-border text-foreground text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#9e1b1b]" />
                    <span data-testid="fixed-role-badge">{t('ACCOUNTANT (محاسب معتمد)')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t('مغلق بالحوكمة')}</span>
                  </div>
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {t('الدور مقيد ومحدد تلقائياً ولا يمكن تغييره لمنع أي تصعيد للصلاحيات.')}
                </span>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('إلغاء')}
                </button>
                <button
                  type="submit"
                  data-testid="submit-invite-btn"
                  disabled={isSubmittingInvite}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#9e1b1b] hover:bg-[#851616] text-white text-xs font-bold shadow-sm transition-all focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b] disabled:opacity-50"
                >
                  {isSubmittingInvite ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('جاري إنشاء الحساب...')}</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      <span>{t('تسجيل وإرسال رابط التفعيل')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* One-Time Temporary Password Confirmation Modal */}
      {createdAccountantResult && (
        <div
          data-testid="temporary-password-modal"
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="w-full max-w-lg bg-card text-card-foreground rounded-3xl border border-border shadow-2xl overflow-hidden p-6 text-foreground" dir="rtl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {t('تم إنشاء الحساب بنجاح')}
                </span>
                <h3 className="text-lg font-black text-foreground">
                  {t('كلمة المرور المؤقتة للحساب')}
                </h3>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {t('تم إنشاء حساب المحاسب المعتمد وتعيينه في فرع')} <strong className="text-foreground">{createdAccountantResult.branchName}</strong>{t('. يرجى تزويد المحاسب بكلمة المرور المؤقتة التالية عبر قناة خاصة ومباشرة.')}
            </p>

            {/* Read-Only Monospace Password Box */}
            <div className="mb-4 p-3.5 bg-muted text-muted-foreground/80 border border-border rounded-2xl flex items-center justify-between gap-3">
              <div className="font-mono text-base font-bold text-[#9e1b1b] dark:text-red-400 tracking-wider select-all" dir="ltr" data-testid="temp-password-display">
                {createdAccountantResult.temporaryPassword}
              </div>
              <button
                type="button"
                data-testid="copy-temp-password-btn"
                onClick={() => {
                  if (createdAccountantResult.temporaryPassword) {
                    navigator.clipboard.writeText(createdAccountantResult.temporaryPassword);
                    setIsCopied(true);
                    toast.success(t('تم نسخ كلمة المرور المؤقتة إلى الحافظة'));
                    setTimeout(() => setIsCopied(false), 2500);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-foreground hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              >
                {isCopied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{t('تم النسخ')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t('نسخ')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Security Notice */}
            <div className="mb-6 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px] leading-relaxed">
                <span className="font-bold block">{t('إشعار أمني إلزامي:')}</span>
                <span>
                  {t('لن يتم عرض كلمة المرور المؤقتة هذه مرة أخرى بعد إغلاق هذه النافذة، ولن تُحفظ بنص صريح. سيتعين على المحاسب تغيير كلمة المرور فور أول تسجيل دخول قبل الوصول إلى أي وظائف مالية.')}
                </span>
              </div>
            </div>

            {/* Done Button */}
            <button
              type="button"
              data-testid="close-temp-password-modal-btn"
              onClick={() => {
                setCreatedAccountantResult(null);
                setIsCopied(false);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#9e1b1b] hover:bg-[#851616] text-white text-xs font-bold shadow-sm transition-all focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
            >
              {t('إتمام والعودة إلى قائمة الفريق')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
