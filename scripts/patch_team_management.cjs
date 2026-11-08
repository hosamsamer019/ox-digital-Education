const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../apps/frontend/src/app/components/primary-manager/TeamManagementPage.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Replace import of BRANCH_SCOPES
content = content.replace("import { BRANCH_SCOPES } from './mockData';", "// Live branch data loaded dynamically from userService");

// Update interface / state
const stateTarget = "  const [inviteBranchId, setInviteBranchId] = useState('BR-01');";
const stateReplacement = `  interface LiveBranch {
    id: string;
    name: string;
    code: string;
    isOnline?: boolean;
    institutionId?: string;
  }

  const [branches, setBranches] = useState<LiveBranch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [inviteBranchId, setInviteBranchId] = useState<string>('');`;

content = content.replace(stateTarget, stateReplacement);

// Add fetchBranches
const fetchBranchesTarget = `  useEffect(() => {
    fetchTeamRoster();
  }, []);`;

const fetchBranchesReplacement = `  const fetchBranches = async () => {
    setIsLoadingBranches(true);
    setBranchesError(null);
    try {
      const data = await userService.getManagerBranches();
      const list: LiveBranch[] = Array.isArray(data) ? data : (data?.branches || []);
      setBranches(list);
      if (list.length > 0) {
        setInviteBranchId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load branches:', err);
      setBranchesError('تعذر تحميل قائمة الفروع المعتمدة من الخادم');
    } finally {
      setIsLoadingBranches(false);
    }
  };

  useEffect(() => {
    fetchTeamRoster();
    fetchBranches();
  }, []);`;

content = content.replace(fetchBranchesTarget, fetchBranchesReplacement);

// Replace eligibleBranches
const eligibleTarget = `  // Filter branches for physical campus selection
  const eligibleBranches = useMemo(() => {
    return BRANCH_SCOPES.filter(b => b.isPhysical && b.id !== 'INST-CONSOLIDATED');
  }, []);`;

const eligibleReplacement = `  // Live branches from database
  const eligibleBranches = useMemo(() => {
    return branches;
  }, [branches]);`;

content = content.replace(eligibleTarget, eligibleReplacement);

// Update branch filter dropdown in roster
const filterSelectTarget = `            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              data-testid="branch-filter-select"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
            >
              <option value="ALL">كافة الفروع المعتمدة</option>
              <option value="INST-CONSOLIDATED">المركز بالكامل (عرض موحد)</option>
              <option value="BR-01">فرع الدقي (المقر الرئيسي)</option>
              <option value="BR-02">فرع مدينة نصر</option>
              <option value="BR-ONLINE">الفرع الأونلاين (المنصة)</option>
            </select>`;

const filterSelectReplacement = `            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              data-testid="branch-filter-select"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
            >
              <option value="ALL">كافة الفروع المعتمدة</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>`;

content = content.replace(filterSelectTarget, filterSelectReplacement);

// Update modal branch selection block
const modalSelectTarget = `              {/* Branch Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  فرع التعيين الحضوري <span className="text-red-500">*</span>
                </label>
                <select
                  value={inviteBranchId}
                  onChange={e => setInviteBranchId(e.target.value)}
                  data-testid="invite-branch-select"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
                >
                  {eligibleBranches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  يقتصر التعيين على فروع المؤسسة التابعة لصلاحية المدير الأساسي الحالي.
                </span>
              </div>`;

const modalSelectReplacement = `              {/* Branch Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  فرع التعيين الحضوري <span className="text-red-500">*</span>
                </label>
                {isLoadingBranches ? (
                  <div className="flex items-center gap-2 p-2.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-[#9e1b1b]" />
                    <span>جاري تحميل الفروع المعتمدة من الخادم...</span>
                  </div>
                ) : branchesError ? (
                  <div className="p-2.5 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center justify-between">
                    <span>{branchesError}</span>
                    <button type="button" onClick={fetchBranches} className="text-xs font-bold underline">إعادة المحاولة</button>
                  </div>
                ) : branches.length === 0 ? (
                  <div className="p-3 text-xs text-amber-800 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl">
                    لا توجد فروع مسجلة بالمؤسسة. يرجى إنشاء فرع أولاً من صفحة الفروع قبل تعيين محاسب.
                  </div>
                ) : (
                  <select
                    value={inviteBranchId}
                    onChange={e => setInviteBranchId(e.target.value)}
                    data-testid="invite-branch-select"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
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
                  يقتصر التعيين على فروع المؤسسة التابعة لصلاحية المدير الأساسي الحالي.
                </span>
              </div>`;

content = content.replace(modalSelectTarget, modalSelectReplacement);

// Reset branch id to first branch on form reset
content = content.replace("setInviteBranchId('BR-01');", "setInviteBranchId(branches.length > 0 ? branches[0].id : '');");

fs.writeFileSync(targetPath, content, 'utf8');
console.log('[SUCCESS] TeamManagementPage.tsx updated with dynamic branch loading');

