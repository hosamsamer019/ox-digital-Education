import { useLanguage, t } from '../../../contexts/LanguageContext';
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Sparkles, CheckCircle2 } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import QuickExamTerminal from './QuickExamTerminal';
import MathGridBackground from '../ui/MathGridBackground';

export default function EditorialHero() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const textContentRef = useRef<HTMLDivElement>(null);
  const terminalWrapperRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Respect user's motion preferences
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        tl.from(textContentRef.current?.querySelectorAll('.hero-fade-up') || [], {
          opacity: 0,
          y: 24,
          duration: 0.6,
          stagger: 0.12,
        }).from(
          terminalWrapperRef.current,
          {
            opacity: 0,
            y: 20,
            scale: 0.98,
            duration: 0.6,
          },
          '-=0.3'
        );
      });
    },
    { scope: heroRef }
  );

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#090b10] dark:text-white pt-10 sm:pt-16 pb-16 sm:pb-24 lg:pb-32 border-b border-slate-200 dark:border-slate-800/80 transition-colors duration-200"
    >
      {/* Precision Mathematical Grid Pattern */}
      <MathGridBackground />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Editorial Content (RTL Right Column - 7 Cols on Desktop) */}
          <div
            ref={textContentRef}
            className="lg:col-span-7 text-right flex flex-col items-start lg:items-start"
            dir="rtl"
          >
            {/* Academic Credential Badge */}
            <div className="hero-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-medium mb-5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#9e1b1b]" />
              <span>{t('المنظومة الأكاديمية الذكية للتعليم وإدارة التقييمات')}</span>
            </div>

            {/* Display Primary Heading (Sole H1 on Page) */}
            <h1 className="hero-fade-up text-3xl sm:text-5xl lg:text-[3.25rem] font-bold text-slate-900 dark:text-white leading-[1.25] sm:leading-[1.2] mb-5 font-sans tracking-tight">
              {t('التعليم الأكاديمي والذكي بمعايير رصينة،')}
              <span className="block text-slate-700 dark:text-slate-300 font-semibold text-2xl sm:text-4xl lg:text-[2.5rem] mt-1 sm:mt-2">
                {t('وتقنيات تقييم متقدمة لا تقبل المساومة.')}
              </span>
            </h1>

            {/* Subtitle Statement */}
            <p className="hero-fade-up text-slate-600 dark:text-slate-300 text-sm sm:text-base lg:text-lg leading-relaxed max-w-2xl mb-8 font-normal font-sans">
              {t('منصة التعليم الذكي المتكاملة، تجمع بين الشرح المنهجي لمختلف المواد والمراحل، محركات الصياغة العلمية والرياضية الدقيقة، تتبع المشاهدة، وإدارة بنوك التقييم الإلكتروني المؤمنة.')}
            </p>

            {/* Primary Action Gateways */}
            <div className="hero-fade-up flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto mb-10">
              <button
                onClick={() => navigate('/login')}
                className="flex items-center justify-center gap-2.5 px-6 sm:px-7 py-3.5 rounded-xl bg-[#9e1b1b] hover:bg-[#b91c1c] text-white font-bold text-sm sm:text-base shadow-lg shadow-red-950/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <span>{t('ابدأ كطالب في المنصة')}</span>
                <ArrowLeft className="w-4 h-4 flex-shrink-0" />
              </button>

              <button
                onClick={() => navigate('/admin/login')}
                className="flex items-center justify-center gap-2 px-6 sm:px-7 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 hover:text-slate-900 border border-slate-300 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 dark:hover:text-white dark:border-slate-700/80 font-semibold text-sm sm:text-base transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <GraduationCap className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                <span>{t('دخول المعلمين والمراكز')}</span>
              </button>
            </div>

            {/* Concrete Proof Pillars */}
            <div className="hero-fade-up w-full grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-slate-800/80">
              <div className="text-right">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{t('تتبع المحاضرات')}</span>
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">{t('100% ثانية بثانية')}</span>
              </div>
              <div className="text-right">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{t('نظام النزاهة')}</span>
                <span className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono">{t('رصد محاولات الغش')}</span>
              </div>
              <div className="col-span-2 sm:col-span-1 text-right">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5">{t('صياغة المعادلات')}</span>
                <span className="text-sm sm:text-base font-bold text-amber-600 dark:text-amber-400 font-mono">{t('محرك KaTeX الرياضي')}</span>
              </div>
            </div>
          </div>

          {/* Quick Exam Terminal (RTL Left Column - 5 Cols on Desktop) */}
          <div ref={terminalWrapperRef} className="lg:col-span-5 w-full">
            <QuickExamTerminal />
          </div>
        </div>
      </div>
    </section>
  );
}
