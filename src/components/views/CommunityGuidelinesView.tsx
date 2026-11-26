import { ArrowLeft, Check, X } from 'lucide-react';
import Logo from '@/components/shared/Logo';

const EFFECTIVE_DATE = 'September 2026';

export default function CommunityGuidelinesView({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen app-glow-bg">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-neutral-300" />
        </button>
        <Logo size={24} animated={false} />
        <h1 className="font-semibold text-white">Community Guidelines</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8 text-neutral-300 text-sm leading-relaxed space-y-8">
        <div>
          <p className="text-neutral-500">Last updated {EFFECTIVE_DATE}</p>
          <p className="mt-3">
            The Terms of Service are the legal contract. This page is the plain-language version:
            what we actually want Contrest to feel like, and what gets your content or account
            actioned. If a post is automatically flagged or removed, it's checked against the rules
            below.
          </p>
        </div>

        <Rule
          title="Real interaction, not manipulation"
          allow={['Genuine likes, comments, and shares', 'Building a following through content people actually want']}
          disallow={[
            'Bot accounts, fake engagement, or engagement-for-engagement rings',
            'Spam comments, mass-tagging, or repeated unsolicited DMs',
          ]}
        />

        <Rule
          title="Harassment & hate"
          allow={['Disagreement, criticism, and debate, even heated']}
          disallow={[
            'Targeted harassment, threats, or pile-ons against a specific person',
            'Hate speech or slurs directed at someone for who they are',
            'Doxxing — sharing someone\'s private address, phone number, or ID documents',
          ]}
        />

        <Rule
          title="Safety"
          allow={['Discussing difficult topics, including mental health, in good faith']}
          disallow={[
            'Content that promotes self-harm, suicide, or eating disorders',
            'Sexual content involving minors — reported to authorities, zero exceptions',
            'Credible threats of violence against a person or place',
          ]}
        />

        <Rule
          title="Authenticity"
          allow={['Parody and satire, clearly labeled as such', 'Using a stage name or handle instead of your legal name']}
          disallow={[
            'Impersonating a real person or organization to deceive',
            'Coordinated misinformation campaigns',
          ]}
        />

        <div>
          <h2 className="text-white font-medium mb-1.5">What happens if you break a rule</h2>
          <p>
            Most first-time issues get a warning and content removal. Repeated or severe violations
            (targeted harassment, csae, credible threats) lead to a suspension or permanent ban —
            reviewed by a human, not just the automated filter. You can always appeal from{' '}
            <span className="text-neutral-200">Settings → Help</span>.
          </p>
        </div>

        <div>
          <h2 className="text-white font-medium mb-1.5">Reporting</h2>
          <p>
            Use the <span className="text-neutral-200">"…" menu → Report</span> on any post, comment,
            or profile. Reports are confidential — the person you report is never told who reported
            them.
          </p>
        </div>
      </div>
    </div>
  );
}

function Rule({ title, allow, disallow }: { title: string; allow: string[]; disallow: string[] }) {
  return (
    <div>
      <h2 className="text-white font-medium mb-2">{title}</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 mb-1.5">
            <Check className="w-3.5 h-3.5" /> Fine
          </p>
          <ul className="space-y-1 text-xs text-neutral-300 list-disc pl-4">
            {allow.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs font-semibold text-red-400 flex items-center gap-1.5 mb-1.5">
            <X className="w-3.5 h-3.5" /> Not fine
          </p>
          <ul className="space-y-1 text-xs text-neutral-300 list-disc pl-4">
            {disallow.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
