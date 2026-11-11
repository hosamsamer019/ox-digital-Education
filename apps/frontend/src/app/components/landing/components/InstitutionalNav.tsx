import { useLanguage } from '../../../contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Key, User, ShieldCheck, Menu, X, ArrowLeft, ArrowRight, GraduationCap, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../../contexts/ThemeContext';
import LanguageToggle from '../../ui/LanguageToggle';

export default function InstitutionalNav() {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const { toggleTheme, isDark } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer on Escape key or resize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMobileMenuOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: t('المنظومة التعليمية'), href: '#ecosystem' },
    { label: t('المحرك الرياضي'), href: '#math-engine' },
    { label: t('المناهج والمراحل'), href: '#curriculum' },
    { label: t('الأمان والنزاهة'), href: '#security' },
    { label: t('الأسئلة الشائعة'), href: '#faq' },
  ];

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-200 border-b ${
          isScrolled
            ? 'bg-white/95 dark:bg-[#090b10]/95 backdrop-blur-md border-slate-200/90 dark:border-slate-800/80 shadow-md shadow-slate-900/5 dark:shadow-black/20'
            : 'bg-white/90 dark:bg-[#090b10] border-slate-200/70 dark:border-slate-800/50'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          {/* Brand Identity */}
          <Link
            to="/"
            className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] rounded-lg p-1"
            aria-label={t('منصة أو إكس الرقمية التعليمية - الصفحة الرئيسية')}
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white p-1 border border-slate-300 dark:border-slate-700/60 shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:border-[#9e1b1b] transition-colors">
              <img
                src="/logo.jpeg"
                alt="OX-DIGITAL Logo"
                className="w-full h-full object-contain"
                width={44}
                height={44}
              />
            </div>
            <div className={isRtl ? 'text-right' : 'text-left'}>
              <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-lg tracking-tight block leading-tight font-sans whitespace-nowrap">
                OX-DIGITAL Education
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium block leading-normal whitespace-nowrap">
                {t('منصة التعليم الذكي المتكاملة')}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            className="hidden lg:flex items-center gap-7"
            aria-label={t('التنقل الرئيسي للمنصة')}
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.href);
                }}
                className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors py-1 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] rounded"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action Gateways (Desktop & Tablet) */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Language Switcher */}
            <LanguageToggle id="language-toggle-nav" />

            {/* Interactive Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] cursor-pointer flex-shrink-0"
              aria-label={isDark ? t('التبديل إلى الوضع الفاتح') : t('التبديل إلى الوضع الداكن')}
              title={isDark ? t('التبديل إلى الوضع الفاتح') : t('التبديل إلى الوضع الداكن')}
              id="theme-toggle-nav"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>

            {/* Direct Quick Exam Button */}
            <button
              onClick={() => navigate('/external-exam')}
              className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 sm:px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-300 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 dark:text-amber-300 dark:border-amber-500/30 transition-all hover:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer shadow-sm"
              title={t('دخول امتحان مباشر باستخدام كود الاختبار')}
            >
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>{t('دخول امتحان بكود')}</span>
            </button>

            {/* Teacher / Admin Portal Gateway */}
            <button
              onClick={() => navigate('/admin/login')}
              className="hidden md:inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium px-3.5 py-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/60 dark:border-slate-700/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span>{t('بوابة المعلم')}</span>
            </button>

            {/* Primary Student Login Button */}
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3 sm:px-5 py-2 rounded-xl bg-[#9e1b1b] hover:bg-[#b91c1c] text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] cursor-pointer whitespace-nowrap"
            >
              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>{t('تسجيل الدخول')}</span>
            </button>

            {/* Mobile & Tablet Drawer Trigger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 dark:border-slate-700/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] cursor-pointer flex-shrink-0"
              aria-label={mobileMenuOpen ? t('إغلاق القائمة') : t('فتح القائمة الرئيسية')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('قائمة التنقل')}>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div
            className={`fixed inset-y-0 ${isRtl ? 'right-0 border-l' : 'left-0 border-r'} w-full max-w-xs bg-white dark:bg-[#090b10] border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-2xl transition-transform`}
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div>
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-white p-1 border border-slate-300 dark:border-slate-700 flex items-center justify-center">
                    <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <div className={isRtl ? 'text-right' : 'text-left'}>
                    <span className="font-bold text-slate-900 dark:text-white text-sm block">OX-DIGITAL</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{t('منصة التعليم الذكي المتكاملة')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <LanguageToggle id="language-toggle-drawer" />
                  <button
                    onClick={toggleTheme}
                    className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label={isDark ? t('التبديل إلى الوضع الفاتح') : t('التبديل إلى الوضع الداكن')}
                  >
                    {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
                  </button>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label={t('إغلاق القائمة')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="mt-6 flex flex-col space-y-2" aria-label={t('التنقل الرئيسي للمنصة')}>
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(link.href);
                    }}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <span>{link.label}</span>
                    <ArrowIcon className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </a>
                ))}
              </nav>

              {/* Quick Actions in Drawer */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/external-exam');
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 px-4 rounded-xl bg-amber-50 dark:bg-slate-800 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40"
                >
                  <Key className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{t('دخول امتحان بكود')}</span>
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/admin/login');
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium py-3 px-4 rounded-xl text-slate-800 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80"
                >
                  <GraduationCap className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  <span>{t('بوابة المعلم')}</span>
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm font-bold py-3 px-4 rounded-xl bg-[#9e1b1b] text-white shadow-md hover:bg-[#b91c1c] transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>{t('تسجيل الدخول')}</span>
                </button>
              </div>
            </div>

            {/* Drawer Footer Status */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
              <span>{t('اتصال آمن ومشفر بنسبة 100%')}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
