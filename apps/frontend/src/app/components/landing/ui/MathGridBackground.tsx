import React from 'react';

/**
 * MathGridBackground
 * Architectural coordinate grid backdrop evoking mathematical graphing paper.
 * Subtle, restrained hairlines with zero glowing or neon artifacts.
 */
export default function MathGridBackground({ className = '' }: { className?: string }) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Precision mathematical coordinate grid */}
      <svg
        className="absolute inset-0 w-full h-full stroke-slate-800/40 dark:stroke-slate-800/30"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          {/* Sub-grid pattern (small 16px squares) */}
          <pattern id="math-grid-small" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" strokeWidth="0.5" strokeDasharray="1 3" opacity="0.3" />
          </pattern>
          {/* Major grid pattern (large 100px Cartesian blocks) */}
          <pattern id="math-grid-large" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#math-grid-small)" />
            <path d="M 100 0 L 0 0 0 100" fill="none" strokeWidth="0.75" opacity="0.6" />
            {/* Coordinate intersection markers */}
            <circle cx="0" cy="0" r="1" fill="currentColor" opacity="0.4" />
            <circle cx="100" cy="0" r="1" fill="currentColor" opacity="0.4" />
            <circle cx="0" cy="100" r="1" fill="currentColor" opacity="0.4" />
            <circle cx="100" cy="100" r="1" fill="currentColor" opacity="0.4" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#math-grid-large)" />
      </svg>

      {/* Subtle architectural vignette for focal depth */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-slate-950/80 pointer-events-none" />
    </div>
  );
}
