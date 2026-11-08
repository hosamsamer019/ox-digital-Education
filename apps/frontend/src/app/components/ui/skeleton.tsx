import { useLanguage, t } from '../../contexts/LanguageContext';
import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './utils';

export interface SkeletonProps extends React.ComponentProps<'div'> {
  className?: string;
}

/**
 * Primitive Skeleton component with accessible aria attributes and reduced-motion support.
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  const { t } = useLanguage();
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        'bg-slate-200/80 dark:bg-slate-800/80 animate-pulse motion-reduce:animate-none rounded-md',
        className
      )}
      {...props}
    />
  );
}

/**
 * Metric/KPI Stat Card Skeleton
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0f131d] space-y-4 shadow-xs',
        className
      )}
      dir="rtl"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3.5 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
        <Skeleton className="w-10 h-10 rounded-xl" />
      </div>
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
        <Skeleton className="h-3 w-32 rounded-full" />
        <Skeleton className="h-3 w-12 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Table Skeleton with configurable rows and columns
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0f131d] overflow-hidden',
        className
      )}
      dir="rtl"
    >
      {/* Table Header */}
      <div className="px-6 py-4 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-6">
        {Array.from({ length: columns }).map((_, idx) => (
          <Skeleton
            key={`th-${idx}`}
            className={cn('h-4 rounded-full', idx === 0 ? 'w-12' : 'flex-1')}
          />
        ))}
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={`tr-${rIdx}`} className="px-6 py-4 flex items-center gap-6">
            {Array.from({ length: columns }).map((_, cIdx) => (
              <Skeleton
                key={`td-${rIdx}-${cIdx}`}
                className={cn(
                  'h-4 rounded-full',
                  cIdx === 0 ? 'w-10' : cIdx === 1 ? 'w-1/3' : 'flex-1'
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * List / Notification / Activity Skeleton
 */
export function SkeletonList({
  items = 4,
  className,
}: {
  items?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0f131d] space-y-4 shadow-xs divide-y divide-slate-100 dark:divide-slate-800/60',
        className
      )}
      dir="rtl"
    >
      {Array.from({ length: items }).map((_, idx) => (
        <div key={idx} className={cn('flex items-center gap-4', idx > 0 && 'pt-4')}>
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
          </div>
          <Skeleton className="h-3 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Course / Video Card Skeleton
 */
export function SkeletonCourseCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0f131d] overflow-hidden shadow-xs space-y-4 p-4',
        className
      )}
      dir="rtl"
    >
      {/* Video Thumbnail Placeholder */}
      <Skeleton className="w-full aspect-video rounded-xl" />

      {/* Course Title and Metadata */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-4/5 rounded-full" />
        <Skeleton className="h-3 w-2/3 rounded-full" />
      </div>

      {/* Progress Bar & Footer */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-2">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-3 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full Dashboard Home Skeleton
 * Preserves the layout structure (Header, 4 KPI cards, 2 primary content sections)
 * to prevent layout shifts (CLS) across all 5 dashboards.
 */
export function DashboardHomeSkeleton({
  kpiCount = 4,
  portalTitle = 'لوحة المؤشرات',
  message,
  className = '',
}: {
  kpiCount?: number;
  portalTitle?: string;
  message?: string;
  className?: string;
}) {
  const displayMessage = message || `جاري تحميل ${portalTitle}...`;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={displayMessage}
      className={cn('p-4 sm:p-6 lg:p-8 min-h-full font-sans select-none', className)}
      dir="rtl"
    >
      {/* Institutional Loading Banner */}
      <div className="flex items-center gap-3 mb-6 p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0f131d] border border-slate-200/90 dark:border-slate-800/90 shadow-xs">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-8 h-8 rounded-full bg-[#9e1b1b]/15 blur-md pointer-events-none" />
          <Loader2 className="w-5 h-5 text-[#9e1b1b] animate-spin motion-reduce:animate-none relative z-10" />
        </div>
        <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
          {displayMessage}
        </p>
      </div>
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-3.5 w-32 rounded-full" />
          </div>
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 rounded-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl shrink-0 self-start sm:self-auto" />
      </div>

      {/* 4 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: kpiCount }).map((_, idx) => (
          <SkeletonCard key={`kpi-${idx}`} />
        ))}
      </div>

      {/* 2 Main Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0f131d] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-[#0f131d] shadow-xs space-y-4">
            <Skeleton className="h-5 w-32 rounded-full" />
            <div className="space-y-3 pt-2">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>

      <span className="sr-only">{t('جاري تحميل البيانات...')}</span>
    </div>
  );
}

export { Skeleton };
