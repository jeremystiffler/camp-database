/**
 * Simple Schedule Pro — brand logo mark.
 * A rounded square with indigo→sky gradient containing three
 * schedule rows (dot + pill bar), evoking a timetable at a glance.
 */
export function SSPLogo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Simple Schedule Pro"
    >
      {/* Gradient background tile */}
      <rect width="32" height="32" rx="8" fill="url(#ssp-g)" />

      {/* Row 1 — full-width, brightest */}
      <circle cx="7.5" cy="11" r="1.8" fill="white" fillOpacity="0.95" />
      <rect x="12" y="9.2" width="13.5" height="3.6" rx="1.8" fill="white" fillOpacity="0.95" />

      {/* Row 2 — shorter bar */}
      <circle cx="7.5" cy="17" r="1.8" fill="white" fillOpacity="0.7" />
      <rect x="12" y="15.2" width="9" height="3.6" rx="1.8" fill="white" fillOpacity="0.7" />

      {/* Row 3 — medium bar, softest */}
      <circle cx="7.5" cy="23" r="1.8" fill="white" fillOpacity="0.45" />
      <rect x="12" y="21.2" width="11.5" height="3.6" rx="1.8" fill="white" fillOpacity="0.45" />

      <defs>
        <linearGradient id="ssp-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
    </svg>
  );
}
