import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/shared/Logo';

const EFFECTIVE_DATE = 'July 28, 2026';

export default function TermsView({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen app-glow-bg">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-neutral-300" />
        </button>
        <Logo size={24} animated={false} />
        <h1 className="font-semibold text-white">Terms of Service</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-8 text-neutral-300 text-sm leading-relaxed space-y-6">
        <p className="text-neutral-500">Effective date: {EFFECTIVE_DATE}</p>

        <Section title="1. Acceptance of terms">
          By creating an account or otherwise using Contrest ("the Service"), you agree to be bound by these Terms
          of Service ("Terms"). If you do not agree, do not use the Service. We may update these Terms from time to
          time; continued use after changes take effect means you accept the revised Terms.
        </Section>

        <Section title="2. Eligibility">
          You must be at least 13 years old to use Contrest. By using the Service you represent that you meet this
          requirement and that any information you provide during registration is accurate and current.
        </Section>

        <Section title="3. Your account">
          You are responsible for safeguarding your password and for any activity that occurs under your account.
          Notify us promptly if you suspect unauthorized access. We may suspend or terminate accounts that violate
          these Terms, are inactive for an extended period, or are used to violate the law or another person's
          rights.
        </Section>

        <Section title="4. User content">
          You retain ownership of the posts, messages, images, and other content you submit ("User Content"). By
          posting User Content, you grant Contrest a worldwide, non-exclusive, royalty-free license to host, store,
          reproduce, and display that content solely for the purpose of operating and improving the Service. You are
          solely responsible for your User Content and confirm you have the rights necessary to share it.
        </Section>

        <Section title="5. Acceptable use">
          You agree not to: (a) post content that is illegal, hateful, harassing, or infringes another person's
          rights; (b) impersonate any person or entity; (c) upload malware or attempt to disrupt the Service; (d)
          scrape or harvest data from the Service without permission; or (e) use the Service to send unsolicited
          bulk messages. We may remove content or restrict accounts that violate this section.
        </Section>

        <Section title="6. Direct messages and real-time features">
          Contrest's messaging tools, including live typing previews and scheduled sends, transmit data between
          participants in a conversation in real time. Messages you send are visible to the recipients you choose;
          treat direct messages as private communications, not public statements, and do not share information you
          would not want stored or later disclosed if legally required.
        </Section>

        <Section title="7. Privacy">
          Our handling of your personal data is described in our Privacy Policy. By using the Service, you consent
          to the collection and use of information as described there.
        </Section>

        <Section title="8. Termination">
          You may stop using the Service and delete your account at any time. We may suspend or terminate your
          access if you violate these Terms, create risk or legal exposure for us, or if required by law.
        </Section>

        <Section title="9. Disclaimers">
          The Service is provided "as is" and "as available" without warranties of any kind, express or implied,
          including merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee
          the Service will be uninterrupted, secure, or error-free.
        </Section>

        <Section title="10. Limitation of liability">
          To the maximum extent permitted by law, Contrest and its developer will not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or any loss of data, profits, or goodwill
          arising from your use of the Service.
        </Section>

        <Section title="11. Changes to the Service">
          We may modify, suspend, or discontinue any part of the Service at any time, with or without notice.
        </Section>

        <Section title="12. Governing law">
          These Terms are governed by the laws of the jurisdiction in which the Service operator resides, without
          regard to conflict-of-law principles, unless local law requires otherwise.
        </Section>

        <Section title="13. Contact">
          Questions about these Terms can be directed to the developer via the contact details listed in Settings.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-white font-medium mb-1.5">{title}</h2>
      <p>{children}</p>
    </div>
  );
}
