/** Photo avatar, or simple initials — no Bitmoji/cartoon */

export default function Avatar({
  url,
  name,
  size = 'md',
  ring = false,
  verified = false,
}: {
  url: string | null | undefined;
  name: string | undefined;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  ring?: boolean;
  verified?: boolean;
  /** ignored — kept so old call sites don't break */
  gender?: string | null;
  preset?: string | null;
}) {
  const sizes: Record<string, string> = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
    '2xl': 'w-28 h-28 text-2xl',
  };
  const badge: Record<string, string> = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
    xl: 'w-5 h-5',
    '2xl': 'w-6 h-6',
  };

  const initials = (name ?? '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`relative inline-flex ${sizes[size].split(' ').slice(0, 2).join(' ')} shrink-0`}>
      <div
        className={`${sizes[size]} rounded-full overflow-hidden flex items-center justify-center font-semibold text-white ${
          ring ? 'ring-2 ring-white/70' : ''
        } ${url ? '' : 'bg-gradient-to-br from-neutral-700 to-neutral-900'}`}
      >
        {url ? (
          <img src={url} alt={name ?? 'avatar'} className="w-full h-full object-cover" />
        ) : (
          <span className="select-none">{initials}</span>
        )}
      </div>
      {verified && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 z-[2] ${badge[size]} rounded-full bg-[#20D5EC] flex items-center justify-center ring-2 ring-ink-950`}
          title="Verified"
        >
          {/* TikTok-style blue check */}
          <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" fill="none">
            <path
              d="M9 12.5l2 2 4.5-5"
              stroke="#000"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </div>
  );
}

/** Stub so signup code that imported these still typechecks */
export type Gender = 'girl' | 'boy' | 'prefer_not';
export const AVATAR_PRESETS_BY_GENDER: Record<Gender, string[]> = {
  girl: [],
  boy: [],
  prefer_not: [],
};
