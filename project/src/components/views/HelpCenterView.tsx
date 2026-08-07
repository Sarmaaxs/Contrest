import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Search, Send, ChevronDown, MessageCircleQuestion } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I follow someone / see who follows me?',
    a: 'Open their profile and tap Follow (or Request if they\u2019re private). To see your own followers or following, go to your Profile and tap the "Followers" or "Following" numbers.',
  },
  {
    q: 'Why can\u2019t I see a post I made?',
    a: 'Go to your Profile \u2192 Posts tab and tap any thumbnail to open it. If it\u2019s missing entirely, check you didn\u2019t set visibility to Close Friends/Followers-only and are viewing while logged into a different account.',
  },
  {
    q: 'How do stories work?',
    a: 'Stories from people you follow appear at the top of your Following feed and in your Inbox. Tap a ring to view; it disappears after 24 hours.',
  },
  {
    q: 'How do I record a voice note?',
    a: 'In a chat, tap the mic icon (it appears when the message box is empty). Tap the square to send, or the X to cancel.',
  },
  {
    q: 'How do I reset my password?',
    a: 'On the sign-in screen, tap "Forgot password?", enter your email, and follow the reset link we send you.',
  },
  {
    q: 'How do I report or block someone?',
    a: 'Open their profile or a post of theirs, tap the ⋯ menu, and choose Report or Block.',
  },
  {
    q: 'Is my account private?',
    a: 'By default, no \u2014 anyone can see your posts. Turn on "Private account" in Settings \u2192 Privacy & safety to require follow approval.',
  },
];

export default function HelpCenterView({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);

  const filtered = FAQS.filter(
    (f) => !query.trim() || f.q.toLowerCase().includes(query.toLowerCase()) || f.a.toLowerCase().includes(query.toLowerCase())
  );

  if (showChat) {
    return <NuvessiaChat onBack={() => setShowChat(false)} />;
  }

  return (
    <div className="min-h-screen app-glow-bg text-white">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-neutral-300" />
        </button>
        <h1 className="font-semibold text-white">Help center</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles…"
            className="w-full pl-10 pr-3 py-2.5 rounded-full glass-input text-sm"
          />
        </div>

        <button
          onClick={() => setShowChat(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-accent-grad text-white mb-6 hover:brightness-110"
        >
          <MessageCircleQuestion className="w-5 h-5" />
          <div className="text-left">
            <p className="text-sm font-medium">Ask Nuvessia</p>
            <p className="text-xs text-white/80">Get an instant answer about using Contrest</p>
          </div>
        </button>

        <div className="space-y-2">
          {filtered.map((f, i) => (
            <div key={f.q} className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-medium text-neutral-100">{f.q}</span>
                <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform shrink-0 ml-2 ${openIdx === i ? 'rotate-180' : ''}`} />
              </button>
              {openIdx === i && <p className="px-4 pb-3.5 text-sm text-neutral-400">{f.a}</p>}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-neutral-500 py-8">No results \u2014 try asking Nuvessia above.</p>
          )}
        </div>

        <a
          href="mailto:supportsarmaxstream@gmail.com"
          className="mt-6 w-full flex items-center gap-3 px-4 py-3 rounded-xl glass hover:bg-white/[0.08] text-left text-neutral-200"
        >
          <span className="text-neutral-400 text-sm">✉</span>
          <span className="text-sm font-medium flex-1">Still stuck? Email support</span>
        </a>
      </div>
    </div>
  );
}

type ChatMsg = { role: 'user' | 'assistant'; content: string };

function NuvessiaChat({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: "Hi, I'm Nuvessia — Contrest's help assistant. Ask me anything about using the app." },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('nuvessia-chat', {
        body: { messages: next },
      });
      if (error) throw error;
      setMessages((m) => [...m, { role: 'assistant', content: data.reply as string }]);
    } catch {
      setUnavailable(true);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            "I'm not able to connect right now — this needs the nuvessia-chat function deployed on the Supabase project. In the meantime, check the FAQ list or email support@contrest.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen app-glow-bg text-white flex flex-col h-screen">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-neutral-300" />
        </button>
        <h1 className="font-semibold text-white">Nuvessia</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-lg w-full mx-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${
                m.role === 'user' ? 'bg-accent-grad text-white' : 'glass text-neutral-100'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && <p className="text-xs text-neutral-500">Nuvessia is typing…</p>}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-white/10 max-w-lg w-full mx-auto flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          disabled={unavailable}
          placeholder={unavailable ? 'Chat unavailable — see FAQ' : 'Ask about Contrest…'}
          className="flex-1 px-4 py-2.5 rounded-full glass-input text-sm disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={unavailable || sending}
          className="p-2.5 bg-accent-grad rounded-full hover:brightness-110 disabled:opacity-50"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
