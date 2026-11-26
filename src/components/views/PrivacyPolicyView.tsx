import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/shared/Logo';

const EFFECTIVE_DATE = 'September 2026';

export default function PrivacyPolicyView({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen app-glow-bg">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-neutral-300" />
        </button>
        <Logo size={24} animated={false} />
        <h1 className="font-semibold text-white">Privacy Policy</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8 text-neutral-300 text-sm leading-relaxed space-y-6">
        <p className="text-neutral-500">Effective date: {EFFECTIVE_DATE}</p>

        <Section title="What we collect">
          Your email, username, display name, and anything you choose to add to your profile
          (avatar, bio). Content you create — posts, captions, comments, messages, likes, and
          follows. Basic device/browser info (for security, like detecting suspicious sign-ins).
        </Section>

        <Section title="Where it's stored">
          Everything above is stored in our database and file storage, provided by Supabase.
          Messages and posts are stored in plain form in that database (not end-to-end
          encrypted) — restricted to you and, where relevant, the people you're messaging or
          the audience you chose for a post, enforced by database-level access rules.
        </Section>

        <Section title="Third parties we use">
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <span className="text-neutral-200">Audius</span> — powers background-music search;
              your search terms are sent to their public API.
            </li>
            <li>
              <span className="text-neutral-200">Groq</span> — powers the optional AI help
              assistant in Settings; messages you type to it are sent to Groq to generate a reply.
            </li>
            <li>
              <span className="text-neutral-200">Vercel Analytics</span> — anonymous usage
              statistics (which pages get used, not who you are). Only runs if you accept it in
              the cookie banner; declining disables it entirely.
            </li>
          </ul>
        </Section>

        <Section title="Cookies & local storage">
          We use your browser's storage to keep you signed in — this is required for the app to
          work and isn't optional. See the cookie banner for the one thing that is optional
          (analytics).
        </Section>

        <Section title="Your controls">
          Block or restrict anyone from their profile. Set your account to private. Two-factor
          authentication and password changes are in{' '}
          <span className="text-neutral-200">Settings → Account</span>. Full self-serve data
          export and account deletion aren't built yet — email support (linked in Settings) and
          we'll handle it manually in the meantime.
        </Section>

        <Section title="Children">
          Contrest is not directed at anyone under 13, and we don't knowingly collect data from
          children under 13.
        </Section>

        <Section title="Changes">
          If this policy changes in a way that matters, we'll say so here and update the
          effective date above.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-white font-medium mb-1.5">{title}</h2>
      {children}
    </div>
  );
}
