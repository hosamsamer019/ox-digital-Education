import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // Show splash screen briefly (600ms) on initial load for smooth asset readiness
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.1 : 0.35, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] bg-white dark:bg-[#090b10] text-slate-900 dark:text-white flex flex-col items-center justify-center pointer-events-none select-none font-sans transition-colors duration-200"
        >
          {/* Subtle Institutional Radial Ambient */}
          <div className="absolute w-72 h-72 sm:w-96 sm:h-96 bg-[#9e1b1b]/15 rounded-full blur-3xl pointer-events-none" />

          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: shouldReduceMotion ? 0.1 : 0.35, ease: 'easeOut' }}
            className="flex flex-col items-center relative z-10 text-center px-4"
          >
            {/* Official Logo Display */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white p-2 border border-slate-200 dark:border-slate-700/80 shadow-2xl mb-4 sm:mb-5 flex items-center justify-center">
              <img
                src="/logo.jpeg"
                alt="OX-DIGITAL Education"
                className="w-full h-full object-contain"
              />
            </div>

            {/* Product Identity (H2 level to avoid duplicate H1 with page contents) */}
            <div
              role="heading"
              aria-level={2}
              className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight mb-1.5"
            >
              OX-DIGITAL Education
            </div>

            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">
              منصة التعليم الذكي المتكاملة
            </p>

            {/* Restrained Institutional Loading Indicator */}
            <div className="w-36 sm:w-44 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.5,
                  ease: 'easeInOut',
                }}
                className="h-full bg-[#9e1b1b] rounded-full"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
