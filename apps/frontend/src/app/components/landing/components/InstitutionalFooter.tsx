import { Link } from 'react-router-dom';
import { ShieldCheck, Lock } from 'lucide-react';

export default function InstitutionalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#07090e] text-slate-400 border-t border-slate-800/80 pt-16 pb-12" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-slate-800/80">
          {/* Brand Presentation (5 cols) */}
          <div className="md:col-span-5 text-right">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white p-1 border border-slate-700/80 flex items-center justify-center overflow-hidden">
                <img
                  src="/logo.jpeg"
                  alt="OX-DIGITAL Education"
                  className="w-full h-full object-contain"
                  width={40}
                  height={40}
                />
              </div>
              <div>
                <span className="font-bold text-white text-base block font-sans">
                  OX-DIGITAL Education
                </span>
                <span className="text-xs text-slate-500 font-medium block">
                  منصة التعليم الذكي المتكاملة
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm mb-6">
              منصة التعليم الذكي المتكاملة لإدارة التعلم والتقييم الأكاديمي، تجمع بين الشروحات المنهجية، تتبع المشاهدة، وبنوك الاختبارات الإلكترونية المؤمنة.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>نظام حماية النزاهة ورصد محاولات الغش</span>
            </div>
          </div>

          {/* Quick Platform Navigation (3 cols) */}
          <div className="md:col-span-3 text-right">
            <h4 className="text-white text-sm font-bold mb-4 font-sans">
              أقسام المنصة
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <a href="#ecosystem" className="hover:text-white transition-colors">
                  المنظومة التعليمية
                </a>
              </li>
              <li>
                <a href="#math-engine" className="hover:text-white transition-colors">
                  المحرك الرياضي (KaTeX)
                </a>
              </li>
              <li>
                <a href="#curriculum" className="hover:text-white transition-colors">
                  المراحل والمناهج الدراسية
                </a>
              </li>
              <li>
                <a href="#security" className="hover:text-white transition-colors">
                  الأمان والنزاهة الأكاديمية
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  الأسئلة الشائعة والمساعدة
                </a>
              </li>
            </ul>
          </div>

          {/* Official Portals & Gateways (4 cols) */}
          <div className="md:col-span-4 text-right">
            <h4 className="text-white text-sm font-bold mb-4 font-sans">
              البوابات والخدمات المباشرة
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link to="/external-exam" className="text-amber-400 hover:text-amber-300 transition-colors font-medium">
                  دخول امتحان بكود للاختبارات الخارجية ←
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  تسجيل دخول الطلاب المشتركين
                </Link>
              </li>
              <li>
                <Link to="/admin/login" className="hover:text-white transition-colors">
                  بوابة دخول المعلمين وإدارة المراكز
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Security Note */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center sm:text-right">
          <div>
            <p>
              &copy; {currentYear} جميع الحقوق محفوظة — منصة أو إكس الرقمية التعليمية (OX-DIGITAL Education)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-slate-400 text-[11px]">اتصال آمن ومشفر بنسبة 100%</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
