import React, { useState, useEffect } from 'react';
import { CreditCard, Clock, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export const ParentSubscriptionPage: React.FC = () => {
  const { isDark } = useTheme();

  const cardBg = isDark
    ? 'bg-[#0f131d] border-slate-800/90 shadow-lg shadow-black/20'
    : 'bg-white border-slate-200/90 shadow-sm';
  const wellBg = isDark
    ? 'bg-[#161c28]/70 border-slate-800/60'
    : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-sans`}
      dir="rtl"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
            <CreditCard className="w-3.5 h-3.5" />
            إدارة الاشتراكات والخدمات
          </span>
        </div>
        <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary}`}>
          الاشتراكات والباقات التعليمية
        </h1>
        <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>
          متابعة حالة الحساب وباقات الدعم الأكاديمي المخصصة لأولياء الأمور
        </p>
      </div>

      {/* Honest Coming Soon Status Container */}
      <div className={`${cardBg} border rounded-3xl p-6 sm:p-10 max-w-3xl mx-auto text-center my-8`}>
        <div className="w-16 h-16 rounded-2xl bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20 flex items-center justify-center mx-auto mb-5 shadow-sm">
          <Clock className="w-8 h-8" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-3">
          قريباً — قيد التطوير والاعتماد
        </span>

        <h2 className={`text-xl sm:text-2xl font-black ${textPrimary} mb-3`}>
          منظومة الاشتراكات الإلكترونية لأولياء الأمور
        </h2>

        <p className={`text-xs sm:text-sm ${textSecondary} max-w-xl mx-auto leading-relaxed mb-8`}>
          نعمل حالياً على إطلاق بوابة الدفع والاشتراك الآمنة المباشرة لأولياء الأمور، والتي ستتيح تجديد الاشتراكات ومتابعة الفواتير والتقارير المتقدمة للأبناء فور تفعيلها رسمياً.
        </p>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-right mb-8">
          <div className={`p-4 rounded-2xl border ${wellBg}`}>
            <div className="flex items-center gap-2 text-[#9e1b1b] mb-1.5">
              <ShieldCheck className="w-4 h-4" />
              <h3 className={`text-xs sm:text-sm font-bold ${textPrimary}`}>بوابات دفع مؤمنة</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              دعم البطاقات البنكية والمحافظ الإلكترونية المعتمدة
            </p>
          </div>

          <div className={`p-4 rounded-2xl border ${wellBg}`}>
            <div className="flex items-center gap-2 text-emerald-600 mb-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <h3 className={`text-xs sm:text-sm font-bold ${textPrimary}`}>فواتير موحدة</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              إيصالات دفع فورية وسجل مالي شفاف لكافة المعاملات
            </p>
          </div>

          <div className={`p-4 rounded-2xl border ${wellBg}`}>
            <div className="flex items-center gap-2 text-blue-600 mb-1.5">
              <Sparkles className="w-4 h-4" />
              <h3 className={`text-xs sm:text-sm font-bold ${textPrimary}`}>باقات عائلية مرنة</h3>
            </div>
            <p className="text-[11px] text-slate-400">
              خيارات ميسرة لمتابعة أكثر من طالب ضمن نفس الحساب
            </p>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/60 text-xs text-slate-400">
          لأي استفسارات بخصوص الاشتراكات الحالية أو تسجيل الأبناء، يرجى التواصل مباشرة مع إدارة المنظومة أو الدعم الفني.
        </div>
      </div>
    </div>
  );
};

export default ParentSubscriptionPage;
