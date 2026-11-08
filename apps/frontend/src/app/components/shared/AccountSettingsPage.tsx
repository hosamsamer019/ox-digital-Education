import React, { useState, useEffect, useRef } from 'react';
import {
  User, Globe, Palette, Shield, Camera, Trash2, Check,
  AlertCircle, Save, CheckCircle2, Lock, Eye, EyeOff,
  Copy, Link as LinkIcon, Unlink, Search, ExternalLink,
  Building2, Briefcase, GraduationCap, Users
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, Theme, resolveThemeAlias } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { brdSubscriptionService } from '../../services/brdSubscription.service';
import { userService } from '../../services/user.service';

export default function AccountSettingsPage() {
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t, isRtl } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'preferences' | 'profile' | 'linking' | 'security'>('preferences');

  // Profile Picture state
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(
    user?.profilePictureUrl || null
  );
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Identifier Copy state
  const [copiedId, setCopiedId] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Account Linking state
  const [relationshipData, setRelationshipData] = useState<any>(null);
  const [loadingRelationships, setLoadingRelationships] = useState(false);
  const [searchIdentifier, setSearchIdentifier] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [linkingActionLoading, setLinkingActionLoading] = useState(false);
  const [unlinkConfirmTarget, setUnlinkConfirmTarget] = useState<any>(null);

  // Status indicators
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const THEMES: { id: Theme; nameKey: string; preview: string; textKey: string }[] = [
    { id: 'default', nameKey: 'defaultThemeName', preview: 'bg-[#b62626]', textKey: 'defaultThemeDesc' },
    { id: 'light', nameKey: 'lightThemeName', preview: 'bg-white border border-gray-300', textKey: 'lightThemeDesc' },
    { id: 'dark', nameKey: 'darkThemeName', preview: 'bg-slate-900 border border-slate-700', textKey: 'darkThemeDesc' },
    { id: 'blue', nameKey: 'blueThemeName', preview: 'bg-[#2563eb]', textKey: 'blueThemeDesc' },
    { id: 'green', nameKey: 'greenThemeName', preview: 'bg-[#059669]', textKey: 'greenThemeDesc' },
    { id: 'purple', nameKey: 'purpleThemeName', preview: 'bg-[#7c3aed]', textKey: 'purpleThemeDesc' },
    { id: 'warm-orange', nameKey: 'warmOrangeThemeName', preview: 'bg-[#d97706]', textKey: 'warmOrangeThemeDesc' },
  ];

  // Load initial settings and relationships from server
  useEffect(() => {
    brdSubscriptionService.getAccountSettings()
      .then((res) => {
        const userObj = res.data || res.user;
        if (userObj) {
          if (userObj.profilePictureUrl) {
            setProfilePictureUrl(userObj.profilePictureUrl);
            updateUser({ profilePictureUrl: userObj.profilePictureUrl });
          }
          if (userObj.language && userObj.language !== language) {
            setLanguage(userObj.language as any);
          }
          const serverTheme = resolveThemeAlias(userObj.theme);
          const localTheme = resolveThemeAlias(localStorage.getItem('preferred_theme') || localStorage.getItem('edu-theme'));
          if (serverTheme && !localTheme) {
            setTheme(serverTheme);
          }
        }
      })
      .catch((err) => {
        console.warn('Could not fetch server settings, using local:', err);
      });

    loadRelationships();
  }, [setTheme, updateUser]);

  const loadRelationships = () => {
    setLoadingRelationships(true);
    userService.getLinkedRelationships()
      .then((res) => {
        if (res.success && res.data) {
          setRelationshipData(res.data);
        }
      })
      .catch((err) => {
        console.warn('Could not load relationships:', err);
      })
      .finally(() => {
        setLoadingRelationships(false);
      });
  };

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showErrorMessage = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const handleLanguageChange = async (targetLang: 'ar' | 'en') => {
    setLanguage(targetLang);
    try {
      await brdSubscriptionService.updateAccountSettings({ language: targetLang });
      updateUser({ language: targetLang });
      showNotification(t('languageUpdatedSuccess', 'تم تحديث لغة الواجهة بنجاح'));
    } catch {
      // Local state is updated
    }
  };

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      await brdSubscriptionService.updateAccountSettings({ theme: newTheme });
      updateUser({ theme: newTheme });
      showNotification(t('themeSavedSuccess', 'تم حفظ المظهر المختار بنجاح'));
    } catch (err: any) {
      console.warn('Could not persist theme to server:', err);
      showErrorMessage(t('themeLocalOnlyError', 'تم تطبيق المظهر محلياً ولكن تعذر مزامنته مع الخادم'));
    }
  };

  const handleCopyIdentifier = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showErrorMessage(t('imageSizeError', 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت'));
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showErrorMessage(t('imageTypeError', 'يسمح فقط بالصور من نوع JPG و PNG و WebP'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreviewImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfilePicture = async () => {
    if (!previewImage) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const mimeType = previewImage.split(';')[0].split(':')[1] || 'image/jpeg';
      const base64Data = previewImage.split(',')[1];
      const res = await brdSubscriptionService.uploadProfilePicture(base64Data, mimeType);
      const url = res.profilePictureUrl || res.url;
      setProfilePictureUrl(url);
      setPreviewImage(null);
      updateUser({ profilePictureUrl: url });
      showNotification(t('imageSavedSuccess', 'تم تحديث الصورة الشخصية بنجاح'));
    } catch (err: any) {
      showErrorMessage(err?.response?.data?.message || err?.message || t('imageUploadFailed', 'تعذر رفع الصورة الشخصية'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfilePicture = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await brdSubscriptionService.deleteProfilePicture();
      setProfilePictureUrl(null);
      setPreviewImage(null);
      updateUser({ profilePictureUrl: null });
      showNotification(t('imageRemovedSuccess', 'تمت إزالة الصورة الشخصية بنجاح'));
    } catch (err: any) {
      showErrorMessage(err?.response?.data?.message || err?.message || 'تعذر حذف الصورة');
    } finally {
      setSaving(false);
    }
  };

  const handleLookupAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchIdentifier.trim()) return;

    setLookingUp(true);
    setLookupResult(null);
    setErrorMsg(null);

    const isStudent = user?.role === 'ONLINE_STUDENT' || user?.role === 'CENTER_STUDENT';
    const isParent = user?.role === 'PARENT';
    const expectedRole = isStudent ? 'PARENT' : isParent ? undefined : undefined;

    try {
      const res = await userService.lookupUser(searchIdentifier.trim(), expectedRole);
      if (res.success && res.account) {
        setLookupResult(res.account);
      } else {
        showErrorMessage(t('accountNotFoundMsg', 'لم يتم العثور على حساب مطابق'));
      }
    } catch (err: any) {
      showErrorMessage(err?.response?.data?.message || t('accountNotFoundMsg', 'لم يتم العثور على حساب مطابق'));
    } finally {
      setLookingUp(false);
    }
  };

  const handleConfirmLink = async () => {
    if (!lookupResult) return;
    setLinkingActionLoading(true);

    const isStudent = user?.role === 'ONLINE_STUDENT' || user?.role === 'CENTER_STUDENT';
    const isParent = user?.role === 'PARENT';

    try {
      if (isStudent) {
        await userService.linkParentStudent({ parentId: lookupResult.id });
      } else if (isParent) {
        await userService.linkParentStudent({ studentId: lookupResult.id });
      } else {
        await userService.linkParentStudent({ studentId: lookupResult.id, parentId: user?.id });
      }

      showNotification(t('linkingSuccessMsg', 'تم ربط الحساب بنجاح'));
      setLookupResult(null);
      setSearchIdentifier('');
      loadRelationships();
    } catch (err: any) {
      showErrorMessage(err?.response?.data?.message || 'تعذر إتمام عملية الربط');
    } finally {
      setLinkingActionLoading(false);
    }
  };

  const handleUnlinkTarget = async (studentId?: string) => {
    setLinkingActionLoading(true);
    try {
      await userService.unlinkParentStudent(studentId);
      showNotification(t('unlinkingSuccessMsg', 'تم إلغاء ربط الحساب بنجاح'));
      setUnlinkConfirmTarget(null);
      loadRelationships();
    } catch (err: any) {
      showErrorMessage(err?.response?.data?.message || 'تعذر إلغاء الربط');
    } finally {
      setLinkingActionLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showErrorMessage(t('passwordLengthError', 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل'));
      return;
    }
    if (newPassword !== confirmPassword) {
      showErrorMessage(t('passwordMismatchError', 'كلمتا المرور غير متطابقتين'));
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await userService.changePassword(currentPassword, newPassword);
      showNotification(t('passwordUpdatedSuccess', 'تم تحديث كلمة المرور بنجاح'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showErrorMessage(err?.response?.data?.message || err?.message || 'تعذر تغيير كلمة المرور');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const calculatePasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const strength = calculatePasswordStrength(newPassword);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 text-foreground font-sans">
      {/* Page Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <User className="w-7 h-7 text-primary" />
          {t('accountSettingsTitle', 'إعدادات الحساب والمظهر (Account Settings)')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('accountSettingsSubtitle', 'تخصيص لغة النظام، المظهر، الصورة الشخصية، معرف الحساب، والربط الأكاديمي')}
        </p>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto space-x-2 space-x-reverse scrollbar-none">
        <button
          onClick={() => setActiveTab('preferences')}
          className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'preferences'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Palette className="w-4 h-4" />
          {t('preferencesTab', 'اللغة والمظهر (Appearance)')}
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'profile'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="w-4 h-4" />
          {t('profileTab', 'الملف الشخصي والصورة')}
        </button>

        <button
          onClick={() => setActiveTab('linking')}
          className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'linking'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          {t('linkingTab', 'الربط الأكاديمي ومعرف الحساب')}
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition flex items-center gap-2 cursor-pointer ${
            activeTab === 'security'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="w-4 h-4" />
          {t('securityTab', 'الأمان وكلمة المرور')}
        </button>
      </div>

      {/* TAB 1: Preferences (Language & Theme) */}
      {activeTab === 'preferences' && (
        <div className="space-y-8">
          {/* Language Selection */}
          <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-4 text-card-foreground">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-card-foreground">
                {t('displayLanguageTitle', 'لغة واجهة المنصة (Language)')}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('displayLanguageDesc', 'اختر اللغة المفضلة للنظام. يتم تطبيق اتجاه الصفحة (RTL/LTR) فوراً مع حفظ اختيارك.')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <button
                type="button"
                onClick={() => handleLanguageChange('ar')}
                className={`p-4 border-2 rounded-xl text-start flex items-center justify-between transition cursor-pointer ${
                  language === 'ar'
                    ? 'border-primary bg-primary/10 text-card-foreground shadow-xs ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/50 text-card-foreground bg-card'
                }`}
              >
                <div>
                  <div className="font-bold text-base">{t('arabicOptionTitle', 'العربية (Arabic)')}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('arabicOptionDesc', 'واجهة كاملة باللغة العربية مع اتجاه من اليمين إلى اليسار (RTL)')}
                  </div>
                </div>
                {language === 'ar' && <Check className="w-5 h-5 text-primary" />}
              </button>

              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`p-4 border-2 rounded-xl text-start flex items-center justify-between transition cursor-pointer ${
                  language === 'en'
                    ? 'border-primary bg-primary/10 text-card-foreground shadow-xs ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/50 text-card-foreground bg-card'
                }`}
              >
                <div>
                  <div className="font-bold text-base">{t('englishOptionTitle', 'English (إنجليزية)')}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {t('englishOptionDesc', 'Full English interface with Left-to-Right layout (LTR)')}
                  </div>
                </div>
                {language === 'en' && <Check className="w-5 h-5 text-primary" />}
              </button>
            </div>
          </div>

          {/* Theme Selection - 7 Themes */}
          <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-4 text-card-foreground">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-card-foreground">
                {t('themesTitle', 'المظهر والألوان (Themes)')}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('themesDesc', 'اختر من بين 7 أنماط بصرية معتمدة لمنظومة OX-DIGITAL التعليمية:')}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleThemeChange(item.id)}
                  className={`p-4 border-2 rounded-xl text-start transition flex flex-col justify-between h-36 cursor-pointer ${
                    theme === item.id
                      ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20 text-card-foreground'
                      : 'border-border hover:border-primary/50 bg-card text-card-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-full shadow-inner ${item.preview}`} />
                      <span className="font-bold text-sm text-card-foreground">{t(item.nameKey)}</span>
                    </div>
                    {theme === item.id && (
                      <span className="p-1 bg-primary text-primary-foreground rounded-full shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-3">{t(item.textKey)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Profile Picture & Info */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-6 text-card-foreground">
            <h2 className="text-base font-bold text-card-foreground flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              {t('profilePictureTitle', 'الصورة الشخصية (Profile Picture)')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('profilePictureDesc', 'تظهر صورتك في الشريط العلوي، سجلات النشاط، والمحادثات. الحجم الأقصى 2 ميجابايت (JPG, PNG, WebP).')}
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
              {/* Picture Display / Fallback initials */}
              <div className="relative group flex-shrink-0">
                {previewImage || profilePictureUrl ? (
                  <img
                    src={previewImage || profilePictureUrl!}
                    alt={user?.name || 'User Avatar'}
                    className="w-28 h-28 rounded-2xl object-cover border-4 border-card shadow-lg ring-2 ring-border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className={`w-28 h-28 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-3xl font-black shadow-lg ${
                    previewImage || profilePictureUrl ? 'hidden' : 'flex'
                  }`}
                >
                  {initials}
                </div>
              </div>

              <div className="space-y-3 text-center sm:text-start flex-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-border"
                  >
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    {t('chooseNewImage', 'اختيار صورة جديدة')}
                  </button>

                  {previewImage && (
                    <button
                      type="button"
                      onClick={handleSaveProfilePicture}
                      disabled={saving}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? t('savingImage', 'جاري الحفظ...') : t('saveImage', 'حفظ الصورة')}
                    </button>
                  )}

                  {(profilePictureUrl || previewImage) && (
                    <button
                      type="button"
                      onClick={handleDeleteProfilePicture}
                      disabled={saving}
                      className="px-3 py-2 text-destructive hover:bg-destructive/10 text-sm font-medium rounded-xl transition flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('removeImage', 'إزالة الصورة')}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('initialsFallbackNotice', 'إذا لم ترفع صورة، ستظهر الحروف الأولى من اسمك بخلفية دورك الأكاديمي.')}
                </p>
              </div>
            </div>
          </div>

          {/* User Details Read-only summary */}
          <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-4 text-card-foreground">
            <h2 className="text-base font-bold text-card-foreground">
              {t('basicUserInfoTitle', 'بيانات الحساب الأساسية')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-muted/50 rounded-xl border border-border">
                <span className="text-xs text-muted-foreground block">{t('fullNameLabel', 'الاسم بالكامل')}</span>
                <span className="font-semibold text-foreground">{user?.name || '-'}</span>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl border border-border">
                <span className="text-xs text-muted-foreground block">{t('emailLabel', 'البريد الإلكتروني')}</span>
                <span className="font-semibold text-foreground">{user?.email || '-'}</span>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl border border-border">
                <span className="text-xs text-muted-foreground block">{t('roleLabel', 'الدور الحالي (Role)')}</span>
                <span className="font-semibold text-primary">{user?.role || '-'}</span>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl border border-border">
                <span className="text-xs text-muted-foreground block">{t('branchLabel', 'الفرع (Branch)')}</span>
                <span className="font-semibold text-foreground">
                  {user?.branch?.name || (user as any)?.branchId || t('defaultMainBranch', 'المركز الرئيسي / عام')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Academic Linking & Account Identifier (Phase D & E) */}
      {activeTab === 'linking' && (
        <div className="space-y-6">
          {/* Account Identifier Card (Phase D) */}
          <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-4 text-card-foreground">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-card-foreground">
                {t('accountIdentifierTitle', 'معرف الحساب المعتمد (Account Identifier)')}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('accountIdentifierDesc', 'هذا المعرف الفريد يخص حسابك فقط، ويستخدمه الطلاب والمعلمون وأولياء الأمور لربط الحسابات معاً بأمان.')}
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <div className="flex-1 p-3 bg-muted/80 rounded-xl border border-border flex items-center justify-between font-mono text-sm text-foreground select-all">
                <span className="font-bold">{user?.id}</span>
                <span className="text-xs font-sans px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold">
                  {user?.role}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyIdentifier}
                className="px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                {copiedId ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copiedId ? t('copiedId', 'تم النسخ بنجاح!') : t('copyId', 'نسخ المعرف')}
              </button>
            </div>
          </div>

          {/* Role-Specific Relationship Details & Linking Form (Phase E) */}
          <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-6 text-card-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-card-foreground">
                  {t('linkingTab', 'الارتباطات الأكاديمية النشطة')}
                </h2>
              </div>
              <button
                type="button"
                onClick={loadRelationships}
                className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                {t('refresh', 'تحديث')}
              </button>
            </div>

            {/* FOR STUDENTS: Linked Parent Card */}
            {(user?.role === 'ONLINE_STUDENT' || user?.role === 'CENTER_STUDENT') && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground">
                  {t('linkedParentTitle', 'ولي الأمر المرتبط بالحساب')}
                </h3>

                {relationshipData?.parent ? (
                  <div className="p-4 bg-muted/50 rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="font-bold text-base text-foreground flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        {relationshipData.parent.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {relationshipData.parent.email} {relationshipData.parent.phone && `• ${relationshipData.parent.phone}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUnlinkConfirmTarget({ type: 'parent', id: relationshipData.parent.id })}
                      className="px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg transition border border-destructive/20 flex items-center gap-1 cursor-pointer"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      {t('unlinkAccountAction', 'إلغاء الربط')}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-muted/30 rounded-xl border border-dashed border-border text-center space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {t('noLinkedParent', 'لا يوجد ولي أمر مرتبط بهذا الحساب حالياً')}
                    </p>
                  </div>
                )}

                {/* Link Parent Form (if no parent linked) */}
                {!relationshipData?.parent && (
                  <form onSubmit={handleLookupAccount} className="pt-2 space-y-3">
                    <label className="block text-xs font-semibold text-foreground">
                      {t('linkAccountAction', 'ربط ولي الأمر بالمعرف أو البريد الإلكتروني')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={searchIdentifier}
                        onChange={(e) => setSearchIdentifier(e.target.value)}
                        placeholder={t('searchByIdentifierPlaceholder', 'أدخل معرف حساب ولي الأمر أو بريده الإلكتروني...')}
                        className="flex-1 px-3 py-2 bg-muted text-foreground border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
                      />
                      <button
                        type="submit"
                        disabled={lookingUp || !searchIdentifier.trim()}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Search className="w-4 h-4" />
                        {lookingUp ? t('lookingUp', 'جاري التحقق...') : t('lookupBtn', 'تحقق')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* FOR PARENTS: Linked Children List */}
            {user?.role === 'PARENT' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground">
                  {t('linkedStudentsTitle', 'الأبناء المرتبطون بالحساب')}
                </h3>

                {relationshipData?.children && relationshipData.children.length > 0 ? (
                  <div className="space-y-2">
                    {relationshipData.children.map((child: any) => (
                      <div key={child.id} className="p-4 bg-muted/50 rounded-xl border border-border flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-foreground flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-primary" />
                            {child.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {child.email} {child.gradeLevel && `• ${child.gradeLevel}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUnlinkConfirmTarget({ type: 'student', id: child.id, name: child.name })}
                          className="px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg transition border border-destructive/20 flex items-center gap-1 cursor-pointer"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          {t('unlinkAccountAction', 'إلغاء الربط')}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-muted/30 rounded-xl border border-dashed border-border text-center">
                    <p className="text-xs text-muted-foreground">
                      {t('noLinkedStudents', 'لا يوجد أبناء مرتبطون بهذا الحساب حالياً')}
                    </p>
                  </div>
                )}

                {/* Link Student Form */}
                <form onSubmit={handleLookupAccount} className="pt-2 space-y-3">
                  <label className="block text-xs font-semibold text-foreground">
                    {t('linkAccountAction', 'ربط طالب جديد (أدخل معرف الطالب أو بريده الإلكتروني)')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchIdentifier}
                      onChange={(e) => setSearchIdentifier(e.target.value)}
                      placeholder={t('searchByIdentifierPlaceholder', 'أدخل معرف حساب الطالب أو بريده الإلكتروني...')}
                      className="flex-1 px-3 py-2 bg-muted text-foreground border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      disabled={lookingUp || !searchIdentifier.trim()}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Search className="w-4 h-4" />
                      {lookingUp ? t('lookingUp', 'جاري التحقق...') : t('lookupBtn', 'تحقق')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Candidate Lookup Preview Card */}
            {lookupResult && (
              <div className="p-4 bg-primary/10 border border-primary/30 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary uppercase">
                    {t('accountFoundConfirm', 'تم التحقق من الحساب بنجاح')}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">
                    {lookupResult.role}
                  </span>
                </div>
                <div className="text-sm font-bold text-foreground">{lookupResult.name}</div>
                <div className="text-xs text-muted-foreground">
                  {lookupResult.emailMasked} {lookupResult.phoneMasked && `• ${lookupResult.phoneMasked}`}
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmLink}
                    disabled={linkingActionLoading}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
                  >
                    {linkingActionLoading ? 'جاري الربط...' : t('confirm', 'تأكيد الربط')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLookupResult(null)}
                    className="px-3 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg transition cursor-pointer"
                  >
                    {t('cancel', 'إلغاء')}
                  </button>
                </div>
              </div>
            )}

            {/* TEACHER & ACCOUNTANT: Branch and Organizational Linking Summary */}
            {(user?.role === 'TEACHER' || user?.role === 'ACCOUNTANT') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-muted/50 rounded-xl border border-border space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                    <Building2 className="w-4 h-4 text-primary" />
                    {t('assignedBranchTitle', 'الفرع أو المركز المنسوب إليه')}
                  </div>
                  <div className="text-sm font-semibold text-primary">
                    {relationshipData?.branch?.name || user?.branch?.name || t('defaultMainBranch', 'المركز الرئيسي / عام')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {relationshipData?.branch?.code ? `كود الفرع: ${relationshipData.branch.code}` : 'فرع مركزي'}
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-xl border border-border space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                    <Briefcase className="w-4 h-4 text-primary" />
                    {t('responsibleAccountantTitle', 'المحاسب المسؤول عن الفرع')}
                  </div>
                  {relationshipData?.branchAccountants && relationshipData.branchAccountants.length > 0 ? (
                    <div className="text-sm font-semibold text-foreground">
                      {relationshipData.branchAccountants.map((a: any) => a.name).join(', ')}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      {t('المحاسبة المركزية الموحدة للمؤسسة')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Unlink Confirmation Dialog */}
          {unlinkConfirmTarget && (
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-xl space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-destructive font-bold text-sm">
                <AlertCircle className="w-4 h-4" />
                {t('unlinkingConfirm', 'تأكيد إلغاء الربط')}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('unlinkConfirmDialog', 'هل أنت متأكد من رغبتك في إلغاء الربط بين الحسابين؟ لن يؤثر هذا على بيانات الحساب أو سجله التاريخي.')}
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleUnlinkTarget(unlinkConfirmTarget.type === 'student' ? unlinkConfirmTarget.id : undefined)}
                  disabled={linkingActionLoading}
                  className="px-4 py-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  {linkingActionLoading ? 'جاري المعالجة...' : t('confirm', 'تأكيد')}
                </button>
                <button
                  type="button"
                  onClick={() => setUnlinkConfirmTarget(null)}
                  className="px-3 py-1.5 bg-muted text-foreground text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  {t('cancel', 'إلغاء')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Security & Password */}
      {activeTab === 'security' && (
        <div className="p-6 bg-card border border-border rounded-2xl shadow-xs space-y-6 text-card-foreground">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-card-foreground">
              {t('securityTitle', 'تغيير كلمة المرور والأمان (Security)')}
            </h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('currentPasswordLabel', 'كلمة المرور الحالية')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-muted text-foreground border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute start-auto end-3 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('newPasswordLabel', 'كلمة المرور الجديدة')}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-muted text-foreground border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
              {/* Strength bar */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        strength <= 25 ? 'bg-destructive w-1/4' :
                        strength <= 50 ? 'bg-amber-500 w-2/4' :
                        strength <= 75 ? 'bg-primary w-3/4' : 'bg-emerald-500 w-full'
                      }`}
                    />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {strength <= 25 ? t('passwordStrengthVeryWeak', 'ضعيفة جداً') :
                     strength <= 50 ? t('passwordStrengthMedium', 'متوسطة') :
                     strength <= 75 ? t('passwordStrengthGood', 'جيدة') : t('passwordStrengthStrong', 'قوية ومحمية')}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('confirmPasswordLabel', 'تأكيد كلمة المرور الجديدة')}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-muted text-foreground border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-2 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm rounded-xl transition shadow-xs cursor-pointer"
            >
              {saving ? t('updatingPassword', 'جاري التحديث...') : t('updatePasswordBtn', 'تحديث كلمة المرور')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
