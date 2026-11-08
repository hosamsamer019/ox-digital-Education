import { useState, useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut, Bell, Sun, Moon, ChevronLeft, ChevronRight,
  Search, Settings, Menu, X
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { notificationService } from '../../services/notification.service';
import NotificationsPanel from './NotificationsPanel';
import ScrollToTopButton from '../ui/ScrollToTopButton';

export interface MenuItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  labelKey?: string;
  badge?: number;
}

interface SharedLayoutProps {
  children: ReactNode;
  menuItems: MenuItem[];
  title: string;
  subtitle: string;
  accentColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  logoutPath?: string;
}

export default function SharedLayout({
  children,
  menuItems,
  title,
  subtitle,
  logoutPath = '/login',
}: SharedLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleTheme, isDark } = useTheme();
  const { user, logout } = useAuth();
  const { t, language, isRtl } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await notificationService.getUnreadCount();
      setUnreadCount(typeof res.data?.unreadCount === 'number' ? res.data.unreadCount : 0);
    } catch {
      // Graceful fallback on network/auth errors
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate(logoutPath);
  };

  const navigateToSettings = () => {
    if (location.pathname.startsWith('/admin')) navigate('/admin/settings');
    else if (location.pathname.startsWith('/manager')) navigate('/manager/settings');
    else if (location.pathname.startsWith('/accountant')) navigate('/accountant/settings');
    else if (location.pathname.startsWith('/teacher')) navigate('/teacher/settings');
    else if (location.pathname.startsWith('/student/online')) navigate('/student/online/settings');
    else if (location.pathname.startsWith('/student/center')) navigate('/student/center/settings');
    else if (location.pathname.startsWith('/parent')) navigate('/parent/settings');
    else navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const userInitial = user?.name ? user.name.trim().charAt(0).toUpperCase() : 'U';

  const sidebarContent = (
    <div className={`flex flex-col h-full transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo / Header */}
      <div className="p-4 bg-sidebar-primary text-sidebar-primary-foreground flex items-center gap-3 transition-colors shadow-xs">
        <img src="/logo.jpeg" alt="OX-DIGITAL Education" className="w-10 h-10 bg-white rounded-xl object-contain flex-shrink-0 p-0.5 shadow-xs" />
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sidebar-primary-foreground text-sm font-bold leading-tight">{title}</h1>
            <p className="text-sidebar-primary-foreground/80 text-xs truncate">{subtitle}</p>
          </div>
        )}
      </div>

      {/* User Card */}
      {!collapsed && (
        <div className="mx-3 mt-4 p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border text-sidebar-foreground transition-colors">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              {user?.profilePictureUrl ? (
                <>
                  <img
                    src={user.profilePictureUrl}
                    alt={user?.name || 'User Avatar'}
                    className="w-9 h-9 rounded-full object-cover shadow-xs ring-1 ring-border/50"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling;
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                  <div className="w-9 h-9 rounded-full bg-sidebar-primary text-sidebar-primary-foreground hidden items-center justify-center font-bold text-sm shadow-xs">
                    {userInitial}
                  </div>
                </>
              ) : (
                <div className="w-9 h-9 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs">
                  {userInitial}
                </div>
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate text-sidebar-foreground">
                {user?.name || (language === 'ar' ? 'المستخدم' : 'User')}
              </p>
              <p className="text-xs truncate text-muted-foreground">
                {user?.grade || user?.branch?.name || user?.institution || (language === 'ar' ? 'منصة التعلم' : 'Learning Platform')}
              </p>
            </div>
          </div>
          {user?.subscriptionPlan && (
            <div className="mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-sidebar-accent border border-sidebar-border text-sidebar-foreground">
                {user.subscriptionPlan === 'enterprise'
                  ? (language === 'ar' ? '⭐ مؤسسي' : '⭐ Enterprise')
                  : user.subscriptionPlan === 'pro'
                  ? (language === 'ar' ? '🚀 احترافي' : '🚀 Pro')
                  : (language === 'ar' ? '🔹 أساسي' : '🔹 Basic')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const active = isActive(item.path);
          const displayLabel = language === 'ar'
            ? item.label
            : (item.labelKey ? t(item.labelKey, t(item.label)) : t(item.label));
          return (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              title={displayLabel}
              aria-label={displayLabel}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-xs font-semibold'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              } ${collapsed ? 'justify-center' : ''}`}
            >
              {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" />}
              {!collapsed && (
                <span className="truncate flex-1 text-start">
                  {displayLabel}
                </span>
              )}
              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="bg-destructive text-destructive-foreground text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={navigateToSettings}
          title={t('settings', 'الإعدادات والمظهر')}
          aria-label={t('settings', 'الإعدادات والمظهر')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer ${collapsed ? 'justify-center' : ''}`}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{t('settings', 'الإعدادات والمظهر')}</span>}
        </button>
        <button
          onClick={handleLogout}
          title={t('logout', 'تسجيل الخروج')}
          aria-label={t('logout', 'تسجيل الخروج')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-destructive hover:bg-destructive/10 cursor-pointer ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{t('logout', 'تسجيل الخروج')}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex overflow-hidden bg-background text-foreground">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Desktop */}
      <aside
        className={`hidden lg:flex flex-col h-screen bg-sidebar text-sidebar-foreground border-sidebar-border border-e shadow-md transition-all duration-300 z-30 flex-shrink-0 relative ${collapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? (isRtl ? 'توسيع القائمة الجانبية' : 'Expand Sidebar') : (isRtl ? 'طي القائمة الجانبية' : 'Collapse Sidebar')}
          title={collapsed ? (isRtl ? 'توسيع القائمة الجانبية' : 'Expand Sidebar') : (isRtl ? 'طي القائمة الجانبية' : 'Collapse Sidebar')}
          className="absolute -left-3 -end-3 top-8 w-6 h-6 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform cursor-pointer z-40 border border-sidebar-border"
        >
          {collapsed ? (
            isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            isRtl ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="h-full flex flex-col justify-between overflow-y-auto">
          {sidebarContent}
        </div>
      </aside>

      {/* Sidebar - Mobile */}
      <aside
        className={`fixed top-0 start-0 h-full w-72 bg-sidebar text-sidebar-foreground shadow-2xl z-50 lg:hidden transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 end-4 p-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent cursor-pointer"
          aria-label={isRtl ? 'إغلاق القائمة الجانبية' : 'Close sidebar'}
        >
          <X className="w-5 h-5" />
        </button>
        <div className="w-72 h-full overflow-y-auto">
          {sidebarContent}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-background text-foreground">
        {/* Top Bar */}
        <header className="sticky top-0 z-50 flex-shrink-0 bg-card text-card-foreground border-b border-border shadow-xs px-4 lg:px-6 py-3 flex items-center gap-4 transition-colors">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden p-2 rounded-lg transition-colors cursor-pointer text-foreground/80 hover:bg-muted"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md relative hidden md:block">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder', 'ابحث في المنصة...')}
              className="w-full ps-10 pe-4 py-2 rounded-xl text-sm bg-muted text-foreground placeholder:text-muted-foreground border border-border focus:outline-hidden focus:ring-2 focus:ring-primary transition-all"
            />
          </div>

          <div className="flex items-center gap-2 ms-auto">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl transition-colors text-foreground/80 hover:text-foreground hover:bg-muted cursor-pointer"
              title={isDark ? t('switchThemeDefault', 'التبديل إلى المظهر الافتراضي') : t('switchThemeDark', 'التبديل إلى المظهر الداكن')}
              aria-label={isDark ? t('switchThemeDefault', 'التبديل إلى المظهر الافتراضي') : t('switchThemeDark', 'التبديل إلى المظهر الداكن')}
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-xl relative transition-colors text-foreground/80 hover:text-foreground hover:bg-muted cursor-pointer"
                aria-label={t('notificationsTitle', 'الإشعارات')}
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -end-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-xs">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifications && (
                <NotificationsPanel
                  onClose={() => setShowNotifications(false)}
                  isDark={isDark}
                  onUnreadCountChange={fetchUnreadCount}
                />
              )}
            </div>

            {/* User Avatar & Name */}
            <div
              onClick={navigateToSettings}
              title={t('userSettingsTitle', 'عرض إعدادات الحساب والمظهر')}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-muted transition-colors cursor-pointer"
            >
              <div className="relative flex-shrink-0">
                {user?.profilePictureUrl ? (
                  <>
                    <img
                      src={user.profilePictureUrl}
                      alt={user?.name || 'User Avatar'}
                      className="w-8 h-8 rounded-full object-cover shadow-xs ring-1 ring-border/50"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling;
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }}
                    />
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground hidden items-center justify-center font-bold text-sm shadow-xs">
                      {userInitial}
                    </div>
                  </>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs">
                    {userInitial}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium hidden md:block text-foreground">
                {user?.name?.split(' ')[0] || (language === 'ar' ? 'المستخدم' : 'User')}
              </span>
            </div>
          </div>
        </header>

        {/* Primary Scrollable Page Content */}
        <main
          id="main-content"
          tabIndex={-1}
          role="main"
          className="flex-1 overflow-y-auto outline-hidden relative bg-background text-foreground"
        >
          {children}
          <ScrollToTopButton />
        </main>
      </div>
    </div>
  );
}
