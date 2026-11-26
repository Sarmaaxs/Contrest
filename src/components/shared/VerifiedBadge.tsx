/** Contrest verified badge — cyan/blue circle + white check */

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<Size, string> = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export default function VerifiedBadge({
  size = 'sm',
  className = '',
  title = 'Verified',
}: {
  size?: Size;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full flex-shrink-0 ${SIZES[size]} ${className}`}
      style={{
        background: 'linear-gradient(145deg, #2EE6FF 0%, #20D5EC 45%, #00C2E0 100%)',
        boxShadow: '0 0 0 1.5px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.25)',
      }}
      title={title}
      aria-label={title}
    >
      <svg viewBox="0 0 24 24" className="w-[65%] h-[65%]" fill="none" aria-hidden>
        <path
          d="M6.5 12.2l3.4 3.4 7.6-8"
          stroke="#fff"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
