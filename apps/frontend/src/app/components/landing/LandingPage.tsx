import { useLanguage } from '../../contexts/LanguageContext';
import InstitutionalNav from './components/InstitutionalNav';
import EditorialHero from './components/EditorialHero';
import RoleEcosystem from './components/RoleEcosystem';
import MathEngineSection from './components/MathEngineSection';
import CurriculumNavigator from './components/CurriculumNavigator';
import SecurityProof from './components/SecurityProof';
import SupportSection from './components/SupportSection';
import InstitutionalFooter from './components/InstitutionalFooter';
import ScrollToTopButton from '../ui/ScrollToTopButton';

export default function LandingPage() {
  const { t, isRtl } = useLanguage();
  return (
    <div
      className="min-h-screen max-w-full overflow-x-hidden bg-[#090b10] text-slate-100 antialiased selection:bg-[#9e1b1b] selection:text-white"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Keyboard Accessibility Skip Link */}
      <a
        href="#main-content"
        className={`sr-only focus:not-sr-only focus:fixed focus:top-4 ${isRtl ? 'focus:right-4' : 'focus:left-4'} focus:z-[9999] focus:px-4 focus:py-2.5 focus:bg-[#9e1b1b] focus:text-white focus:font-bold focus:rounded-lg focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-white`}
      >
        {t('تخطي إلى المحتوى الرئيسي')}
      </a>

      {/* 1. Institutional Navigation */}
      <InstitutionalNav />

      {/* Main Content Area */}
      <main id="main-content" className="max-w-full overflow-x-hidden">
        {/* 2. Asymmetric Editorial Hero & Live Quick Exam Terminal */}
        <EditorialHero />

        {/* 3. Tri-Role Pedagogical Ecosystem (Student, Teacher, Parent) */}
        <RoleEcosystem />

        {/* 4. Real Mathematical Reasoning Engine (KaTeX) */}
        <MathEngineSection />

        {/* 5. Authentic Curriculum & Stages Navigator */}
        <CurriculumNavigator />

        {/* 6. Institutional Security & Integrity Proof */}
        <SecurityProof />

        {/* 7. Curated FAQ & Help Gateway */}
        <SupportSection />
      </main>

      {/* 8. Institutional Footer */}
      <InstitutionalFooter />

      {/* Scroll-to-Top Floating Control */}
      <ScrollToTopButton />
    </div>
  );
}
