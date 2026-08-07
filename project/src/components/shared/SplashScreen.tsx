import { useEffect, useState } from 'react';
import Logo from '@/components/shared/Logo';

/** Logo letters assemble → poof → hand off to app */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'assemble' | 'poof' | 'out'>('in');
  const letters = ['C', 'o', 'n', 't', 'r', 'e', 's', 't'];

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('assemble'), 150);
    const t2 = setTimeout(() => setPhase('poof'), 2000);
    const t3 = setTimeout(() => setPhase('out'), 2600);
    const t4 = setTimeout(onDone, 3100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink-950 transition-opacity duration-500 ${
        phase === 'out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div
        className={`relative mb-8 transition-all duration-500 ${
          phase === 'poof' ? 'scale-150 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        <Logo size={72} variant="official" animated />
        {phase === 'poof' && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[...Array(12)].map((_, i) => (
              <span
                key={i}
                className="absolute w-2 h-2 rounded-full bg-accent"
                style={{
                  transform: `rotate(${i * 30}deg) translateY(-40px)`,
                  animation: 'splash-particle 0.5s ease-out forwards',
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-0.5 overflow-hidden">
        {letters.map((ch, i) => (
          <span
            key={i}
            className="text-2xl font-bold text-white inline-block"
            style={{
              transform:
                phase === 'in'
                  ? `translateY(${(i % 2 === 0 ? -40 : 40)}px) rotate(${(i - 4) * 8}deg)`
                  : 'translateY(0) rotate(0)',
              opacity: phase === 'in' ? 0 : phase === 'poof' ? 0 : 1,
              transition: `all 0.55s cubic-bezier(0.22,1,0.36,1) ${i * 45}ms`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>
      <p
        className={`mt-3 text-xs text-neutral-500 transition-opacity duration-500 ${
          phase === 'assemble' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        social, reimagined
      </p>

      <style>{`
        @keyframes splash-particle {
          to { opacity: 0; transform: rotate(var(--r, 0deg)) translateY(-80px) scale(0); }
        }
      `}</style>
    </div>
  );
}
