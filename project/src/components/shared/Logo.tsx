import type { LogoVariant } from '@/lib/supabase';

/**
 * Contrest logo — three adjustable variants (Settings → Appearance):
 *  - official: purple 3D C mark matching brand art
 *  - classic: original cyan water-drop C
 *  - white: clean monochrome for light/minimal UI
 */
export default function Logo({
  size = 40,
  animated = true,
  className = '',
  variant = 'official',
}: {
  size?: number;
  animated?: boolean;
  className?: string;
  variant?: LogoVariant;
}) {
  if (variant === 'classic') {
    return <ClassicLogo size={size} animated={animated} className={className} />;
  }
  if (variant === 'white') {
    return <WhiteLogo size={size} className={className} />;
  }
  return <OfficialLogo size={size} className={className} />;
}

function OfficialLogo({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Contrest logo"
    >
      <defs>
        <linearGradient id="offC" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e9d5ff" />
          <stop offset="35%" stopColor="#c084fc" />
          <stop offset="70%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="offPlate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#2e1065" />
        </linearGradient>
        <filter id="offGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="22" fill="url(#offPlate)" />
      <path
        d="M 72 28
           A 28 28 0 1 0 72 72"
        fill="none"
        stroke="url(#offC)"
        strokeWidth="14"
        strokeLinecap="round"
        filter="url(#offGlow)"
        opacity="0.55"
      />
      <path
        d="M 72 28
           A 28 28 0 1 0 72 72"
        fill="none"
        stroke="url(#offC)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M 70 32
           A 24 24 0 0 0 42 28"
        fill="none"
        stroke="white"
        strokeOpacity="0.35"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ClassicLogo({ size, animated, className }: { size: number; animated: boolean; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Contrest logo"
    >
      <defs>
        <linearGradient id="dropGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5ecbf5" />
          <stop offset="100%" stopColor="#1a8fc4" />
        </linearGradient>
        <radialGradient id="cGlow" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#1a1a1c" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="98" height="98" rx="26" fill="url(#cGlow)" fillOpacity="0.9" stroke="white" strokeOpacity="0.08" />
      <path
        d="M 68 30 A 26 26 0 1 0 68 70"
        fill="none"
        stroke="white"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M 68 44
           C 68 44 76 53 76 60
           C 76 65.5 71.9 69 67.5 69
           C 63.1 69 59 65.5 59 60
           C 59 53 68 44 68 44 Z"
        fill="url(#dropGrad)"
        className={animated ? 'animate-drip' : ''}
      />
    </svg>
  );
}

function WhiteLogo({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Contrest logo"
    >
      <rect x="2" y="2" width="96" height="96" rx="22" fill="#0a0a0c" stroke="white" strokeOpacity="0.12" />
      <path
        d="M 72 28 A 28 28 0 1 0 72 72"
        fill="none"
        stroke="white"
        strokeWidth="14"
        strokeLinecap="round"
      />
    </svg>
  );
}
