import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ArrowLeft, Send, Search, Clock, Eye, EyeOff, X, Users, Smile, Image as ImageIcon, Mic, Square, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Message } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import Avatar from '@/components/shared/Avatar';
import StoriesBar from '@/components/stories/StoriesBar';
import { uploadAny } from '@/lib/storageProviders';
import { checkCooldown, formatRetryAfter, sanitizeText, INPUT_LIMITS } from '@/lib/security';
import { moderateText } from '@/lib/moderation';

type ConversationSummary = {
  id: string;
  otherUser: Profile;
  lastMessage: Message | null;
  isGroup?: boolean;
  title?: string;
  memberCount?: number;
};

const SCHEDULE_PRESETS = [
  { label: 'In 1 hour', getDate: () => new Date(Date.now() + 60 * 60 * 1000) },
  {
    label: 'This evening (8pm)',
    getDate: () => {
      const d = new Date();
      d.setHours(20, 0, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    label: 'Tomorrow (9am)',
    getDate: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];


/** The inbox preview and notifications need a human label for non-text
 * messages, not the raw stored value — this is the exact bug behind
 * "I can see the gif link when I send": the conversation list was printing
 * `content` verbatim, prefix and all, instead of checking what kind of
 * message it actually is. */
function formatMessagePreview(content: string | null | undefined): string {
  if (!content) return 'No messages yet';
  if (content.startsWith('gif:')) return '🎁 GIF';
  if (content.startsWith('sticker:')) return `${content.slice(8)} Sticker`;
  if (content.startsWith('voice:')) return '🎤 Voice message';
  return content;
}

const REACTION_GIFS = [
  { id: 'thumbs', label: 'thumbs up', url: 'https://media0.giphy.com/media/111ebonMs90YLu/giphy.gif' },
  { id: 'clap', label: 'clap', url: 'https://media0.giphy.com/media/l0MYC0LjbHqH4YtHO/giphy.gif' },
  { id: 'love', label: 'love heart', url: 'https://media0.giphy.com/media/3o7TKnO6Wve6502iJ2/giphy.gif' },
  { id: 'fire', label: 'fire', url: 'https://media0.giphy.com/media/l3q2Sins6zjY5oUfu/giphy.gif' },
  { id: 'lol', label: 'lol laugh', url: 'https://media0.giphy.com/media/ICOgUNjpvO0PC/giphy.gif' },
  { id: 'wow', label: 'wow', url: 'https://media0.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif' },
  { id: 'cry', label: 'cry', url: 'https://media0.giphy.com/media/ROF8OQvDmxhdm/giphy.gif' },
  { id: 'party', label: 'party', url: 'https://media0.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif' },
  { id: 'yes', label: 'yes', url: 'https://media0.giphy.com/media/3oz8xAFtqnLEHGKBdm/giphy.gif' },
  { id: 'no', label: 'no', url: 'https://media0.giphy.com/media/1zSz5MVw4WXz2/giphy.gif' },
  { id: 'dance', label: 'dance meme', url: 'https://media0.giphy.com/media/bC9czlgCMtw4cj8R6b/giphy.gif' },
  { id: 'ok', label: 'ok', url: 'https://media0.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif' },
  { id: 'wave', label: 'wave hi', url: 'https://media0.giphy.com/media/3o6Zt6ML6BklcajjsA/giphy.gif' },
  { id: 'think', label: 'think', url: 'https://media0.giphy.com/media/d3mlE7uhX8KFgEmY/giphy.gif' },
  { id: 'mind', label: 'mind blown', url: 'https://media0.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif' },
  { id: 'shrug', label: 'shrug', url: 'https://media0.giphy.com/media/26tPplGWjN0xLybiU/giphy.gif' },
];

const STICKERS = ['🔥', '💀', '😂', '😭', '👑', '🎉', '💯', '👀', '🤝', '🙏', '💪', '🫡', '🥳', '😎', '🤙', '✨', '🚀', '🎯', '⚡', '💔'];

const EMOJIS = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '✨', '⭐', '🌟', '💯', '🎉', '🎵', '🎶', '🏆', '👑', '👀', '💬', '🫡', '🤝', '😎', '🧠', '💪', '🫶'];

export default function MessagesView({
  onOpenProfile,
  initialConversationId,
  onConversationChange,
}: {
  onOpenProfile?: (userId: string) => void;
  initialConversationId?: string;
  onConversationChange?: (conversationId: string | null) => void;
} = {}) {
  const { user } = useAuth();
  const toast = useToast();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [peerPreview, setPeerPreview] = useState('');
  const [livePreviewOn, setLivePreviewOn] = useState(() => {
    try {
      const v = localStorage.getItem('contrest_typing_preview');
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  });
  const [showSchedule, setShowSchedule] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [groupPick, setGroupPick] = useState<Profile[]>([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupQuery, setGroupQuery] = useState('');
  const [groupResults, setGroupResults] = useState<Profile[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifQ, setGifQ] = useState('meme');
  const [gifs, setGifs] = useState<{ id: string; url: string }[]>([]);
  const [pickerTab, setPickerTab] = useState<'gif' | 'sticker'>('gif');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previewChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const previewClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewThrottle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!memberships || memberships.length === 0) {
      setLoading(false);
      return;
    }

    const convIds = memberships.map((m) => m.conversation_id);

    const [{ data: allMembers }, { data: allMessages }] = await Promise.all([
      supabase.from('conversation_members').select('conversation_id, user_id, profiles!conversation_members_user_id_fkey(*)').in('conversation_id', convIds),
      supabase.from('messages').select('*').in('conversation_id', convIds).order('created_at', { ascending: true }),
    ]);

    const memberMap = new Map<string, Profile[]>();
    (allMembers ?? []).forEach((m: any) => {
      const arr = memberMap.get(m.conversation_id) ?? [];
      arr.push(m.profiles as Profile);
      memberMap.set(m.conversation_id, arr);
    });

    const lastByConv = new Map<string, Message>();
    (allMessages ?? []).forEach((msg) => {
      lastByConv.set(msg.conversation_id, msg as Message);
    });

    const summaries: ConversationSummary[] = convIds.map((cid) => {
      const members = memberMap.get(cid) ?? [];
      const other = members.find((m) => m.id !== user.id) ?? members[0];
      return {
        id: cid,
        otherUser: other,
        lastMessage: lastByConv.get(cid) ?? null,
      };
    });

    summaries.sort((a, b) => {
      const ta = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const tb = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return tb - ta;
    });

    setConversations(summaries);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (initialConversationId && conversations.some((c) => c.id === initialConversationId)) {
      setActiveId(initialConversationId);
    }
  }, [initialConversationId, conversations]);

  useEffect(() => {
    onConversationChange?.(activeId);
  }, [activeId, onConversationChange]);

  useEffect(() => {
    if (!activeId || !user) return;
    setPeerPreview('');
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', activeId)
      .order('created_at', { ascending: true })
      .then(async ({ data }) => {
        const list = (data as Message[]) ?? [];
        setMessages(list);

        // Mark messages from the other person as read (Telegram double-check)
        const unreadIds = list
          .filter((m) => m.sender_id !== user.id && !m.read_at && m.status !== 'scheduled')
          .map((m) => m.id);
        if (unreadIds.length > 0) {
          const now = new Date().toISOString();
          const { error } = await supabase
            .from('messages')
            .update({ read_at: now })
            .in('id', unreadIds)
            .is('read_at', null);
          if (!error) {
            setMessages((prev) =>
              prev.map((m) => (unreadIds.includes(m.id) ? { ...m, read_at: now } : m))
            );
          }
        }
      });

    const channel = supabase
      .channel(`messages-${activeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` }, (payload) => {
        const m = payload.new as Message;
        if (m.status === 'sent' || m.sender_id === user.id) {
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        }
        // If they messaged us while we're in the chat, mark read immediately
        if (m.sender_id !== user.id && m.status !== 'scheduled') {
          const now = new Date().toISOString();
          void supabase
            .from('messages')
            .update({ read_at: now })
            .eq('id', m.id)
            .is('read_at', null)
            .then(({ error }) => {
              if (!error) {
                setMessages((prev) => prev.map((p) => (p.id === m.id ? { ...p, read_at: now } : p)));
              }
            });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => {
          const exists = prev.some((p) => p.id === m.id);
          if (!exists) return m.status === 'sent' ? [...prev, m] : prev;
          return prev.map((p) => (p.id === m.id ? m : p));
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, user]);

  // Live typing preview: broadcast our draft to the peer, and listen for theirs.
  useEffect(() => {
    if (!activeId || !user) return;
    const channel = supabase.channel(`typing-${activeId}`, { config: { broadcast: { self: false } } });
    channel
      .on('broadcast', { event: 'preview' }, (payload) => {
        const { senderId, text } = payload.payload as { senderId: string; text: string };
        if (senderId === user.id) return;
        setPeerPreview(text);
        if (previewClearTimer.current) clearTimeout(previewClearTimer.current);
        if (text) {
          previewClearTimer.current = setTimeout(() => setPeerPreview(''), 6000);
        }
      })
      .subscribe();
    previewChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      previewChannelRef.current = null;
    };
  }, [activeId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerPreview]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      supabase
        .from('profiles')
        .select('*')
        .neq('id', user?.id ?? '')
        .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
        .limit(8)
        .then(({ data }) => setSearchResults((data as Profile[]) ?? []));
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery, user]);

  // Sweep our own scheduled messages and flip them to "sent" once due, while this tab is open.
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const now = new Date().toISOString();
      const { data: due } = await supabase
        .from('messages')
        .select('*')
        .eq('sender_id', user.id)
        .eq('status', 'scheduled')
        .lte('scheduled_for', now);
      for (const m of due ?? []) {
        await supabase.from('messages').update({ status: 'sent' }).eq('id', (m as Message).id);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const broadcastDraft = (text: string) => {
    if (!livePreviewOn) return;
    if (previewThrottle.current) return;
    previewChannelRef.current?.send({ type: 'broadcast', event: 'preview', payload: { senderId: user?.id, text } });
    previewThrottle.current = setTimeout(() => {
      previewThrottle.current = null;
    }, 180);
  };

  const handleDraftChange = (value: string) => {
    setDraft(value);
    broadcastDraft(value);
  };

  const clearPeerTyping = () => {
    previewChannelRef.current?.send({ type: 'broadcast', event: 'preview', payload: { senderId: user?.id, text: '' } });
  };

  const sendMessage = async (scheduledFor?: Date) => {
    if (!user || !activeId || !draft.trim()) return;
    const text = sanitizeText(draft.trim(), INPUT_LIMITS.message);
    // Prevents a scripted flood of DMs to the same thread — same idea as
    // per-user message rate limiting.
    const cooldown = checkCooldown(`message-send:${user.id}`, 400);
    if (!cooldown.allowed) {
      toast(`Sending too fast — wait ${formatRetryAfter(cooldown.retryAfterMs)}.`);
      return;
    }
    const mod = moderateText(text);
    if (!mod.allowed) {
      toast(mod.reason ?? 'That message was blocked by community guidelines.');
      return;
    }
    setDraft('');
    setShowSchedule(false);
    clearPeerTyping();

    const payload: Record<string, unknown> = {
      conversation_id: activeId,
      sender_id: user.id,
      content: text,
      status: scheduledFor ? 'scheduled' : 'sent',
    };
    if (scheduledFor) payload.scheduled_for = scheduledFor.toISOString();

    const { data, error } = await supabase.from('messages').insert(payload).select('*').single();

    if (error) {
      // Retry without status columns if schema is older
      const { data: d2, error: e2 } = await supabase
        .from('messages')
        .insert({ conversation_id: activeId, sender_id: user.id, content: text })
        .select('*')
        .single();
      if (e2) {
        toast('Message not saved: ' + e2.message);
        setDraft(text);
        return;
      }
      if (d2) {
        setMessages((prev) => [...prev, d2 as Message]);
        if (!scheduledFor) {
          try {
            void supabase.functions.invoke('notify-message-email', {
              body: { conversation_id: activeId },
            });
          } catch {}
        }
      }
      return;
    }
    if (data) {
      setMessages((prev) => [...prev, data as Message]);
      if (!scheduledFor) {
        // Email recipient: "Hey — @you sent a message"
        try {
          void supabase.functions.invoke('notify-message-email', {
            body: { conversation_id: activeId },
          });
        } catch {
          /* optional — email may not be configured */
        }
      }
    }
  };

  const startConversation = async (otherUserId: string) => {
    if (!user) return;
    if (otherUserId === user.id) return;

    try {
      // Prefer RPC
      const { data: convId, error } = await supabase.rpc('start_dm', {
        other_user_id: otherUserId,
      });

      if (!error && convId) {
        setSearchQuery('');
        setSearchResults([]);
        await loadConversations();
        setActiveId(convId as string);
        return;
      }

      // start_dm is the single, server-authorized path for creating or
      // finding a DM (it runs as SECURITY DEFINER after validating the
      // caller). There is intentionally no client-side fallback that
      // inserts membership rows directly — that used to bypass RLS
      // authorization checks entirely.
      toast(error?.message || 'Could not start this chat. Please try again.');
    } catch (e: any) {
      toast(e?.message || 'Message failed');
    }
  };



  const [gifError, setGifError] = useState<string | null>(null);
  const [gifLoading, setGifLoading] = useState(false);

  const loadGifs = async (q: string) => {
    setGifLoading(true);
    setGifError(null);
    try {
      const { data, error } = await supabase.functions.invoke('giphy-search', { body: { q } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const results = (data?.gifs ?? []).map((g: { id: string; url: string }) => ({ id: g.id, url: g.url }));
      if (results.length === 0) {
        // Real search returned nothing (or the function isn't deployed yet)
        // — fall back to the small built-in set instead of a dead-empty
        // panel, and say so instead of pretending it's a real result.
        const qq = q.toLowerCase().trim();
        const filtered = qq
          ? REACTION_GIFS.filter((g) => g.label.toLowerCase().includes(qq))
          : REACTION_GIFS;
        setGifs((filtered.length ? filtered : REACTION_GIFS).map((g) => ({ id: g.id, url: g.url })));
      } else {
        setGifs(results);
      }
    } catch {
      setGifError("Live GIF search isn't set up yet — showing a small built-in set instead.");
      const qq = q.toLowerCase().trim();
      const filtered = qq ? REACTION_GIFS.filter((g) => g.label.toLowerCase().includes(qq)) : REACTION_GIFS;
      setGifs((filtered.length ? filtered : REACTION_GIFS).map((g) => ({ id: g.id, url: g.url })));
    } finally {
      setGifLoading(false);
    }
  };

  const sendGif = async (url: string) => {
    if (!user || !activeId) return;
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: activeId,
        sender_id: user.id,
        content: `gif:${url}`,
        status: 'sent',
      })
      .select('*')
      .single();
    if (error) {
      const { data: d2, error: e2 } = await supabase
        .from('messages')
        .insert({ conversation_id: activeId, sender_id: user.id, content: `gif:${url}` })
        .select('*')
        .single();
      if (e2) {
        toast('GIF not saved: ' + e2.message);
        return;
      }
      if (d2) setMessages((prev) => [...prev, d2 as Message]);
    } else if (data) {
      setMessages((prev) => [...prev, data as Message]);
    }
    setShowGif(false);
  };

  const sendSticker = async (emoji: string) => {
    if (!user || !activeId) return;
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: activeId, sender_id: user.id, content: `sticker:${emoji}`, status: 'sent' })
      .select('*')
      .single();
    if (!error && data) setMessages((prev) => [...prev, data as Message]);
    setShowGif(false);
  };

  const startRecording = async () => {
    if (!activeId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordedChunks.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (e: any) {
      toast('Mic access needed for voice notes: ' + (e?.message || 'permission denied'));
    }
  };

  const stopRecordingAndSend = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !user || !activeId) return;
    setIsRecording(false);
    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve();
      };
      recorder.stop();
    });
    const blob = new Blob(recordedChunks.current, { type: recorder.mimeType || 'audio/webm' });
    if (blob.size < 500) return; // too short / accidental tap
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
      const { url } = await uploadAny(user.id, file, 'media');
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: activeId, sender_id: user.id, content: `voice:${url}`, status: 'sent' })
        .select('*')
        .single();
      if (!error && data) setMessages((prev) => [...prev, data as Message]);
    } catch (e: any) {
      toast('Voice note failed: ' + (e?.message || 'upload error'));
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => recorder.stream.getTracks().forEach((t) => t.stop());
      recorder.stop();
    }
    setIsRecording(false);
    recordedChunks.current = [];
  };

  // Profile → Message button
  useEffect(() => {
    if (!user) return;
    let id: string | null = null;
    try {
      id = sessionStorage.getItem('contrest_dm');
      if (id) sessionStorage.removeItem('contrest_dm');
    } catch { /* ignore */ }
    if (id) {
      void startConversation(id);
    }
  }, [user]);

  const createGroup = async () => {
    if (!user || groupPick.length < 1) return;
    // Create a fresh group atomically; start_dm can return an existing DM.
    const { data: convId, error } = await supabase.rpc('create_group_conversation', {
      member_ids: groupPick.map((profile) => profile.id),
    });
    if (error || !convId) {
      toast(error?.message || 'Could not create group');
      return;
    }
    const title = groupTitle.trim() || groupPick.map((p) => p.username).slice(0, 3).join(', ');
    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      content: `Group created: ${title}`,
      status: 'sent',
    });
    setShowGroup(false);
    setGroupPick([]);
    setGroupTitle('');
    await loadConversations();
    setActiveId(convId as string);
  };

    const activeConv = conversations.find((c) => c.id === activeId);
  const visibleMessages = useMemo(() => messages, [messages]);

  return (
    <div className="h-screen flex app-glow-bg text-white">
      {/* Conversation list — platform-style inbox */}
      <div className={`${activeId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-white/10 glass`}>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Inbox</h2>
            <button
              type="button"
              onClick={() => setShowGroup(true)}
              className="text-xs font-medium text-accent flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5"
              title="New group"
            >
              <Users className="w-4 h-4" /> Group
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="New message…"
              className="w-full pl-10 pr-3 py-2 rounded-full glass-input text-sm"
            />
          </div>
        </div>

        <div className="border-b border-white/10">
          <StoriesBar />
        </div>

        {searchQuery.trim() && searchResults.length > 0 ? (
          <div className="flex-1 overflow-y-auto">
            {searchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => startConversation(p.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 text-left active:bg-white/10"
              >
                <Avatar url={p.avatar_url} name={p.full_name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">@{p.username}</p>
                  <p className="text-xs text-neutral-400 truncate">{p.full_name}</p>
                </div>
                <span className="text-xs font-medium text-accent shrink-0">Message</span>
              </button>
            ))}
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white/15 border-t-white rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4 text-center">
            <p className="text-sm text-neutral-500">No conversations yet. Search to start one.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left transition-colors ${
                  activeId === c.id ? 'bg-white/10' : ''
                }`}
              >
                <div
                  className="relative"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (c.otherUser?.id) onOpenProfile?.(c.otherUser.id);
                  }}
                >
                  <Avatar url={c.otherUser?.avatar_url} name={c.otherUser?.full_name} size="md" ring />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{c.otherUser?.full_name}</p>
                  <p className="text-xs text-neutral-400 truncate">
                    {formatMessagePreview(c.lastMessage?.content)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active conversation */}
      <div className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {activeConv ? (
          <>
            <header className="flex items-center gap-3 px-4 py-3 glass border-b border-white/10">
              <button onClick={() => setActiveId(null)} className="md:hidden p-1 hover:bg-white/10 rounded-full">
                <ArrowLeft className="w-5 h-5 text-neutral-300" />
              </button>
              <button
                type="button"
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                onClick={() => activeConv.otherUser?.id && onOpenProfile?.(activeConv.otherUser.id)}
              >
                <Avatar url={activeConv.otherUser?.avatar_url} name={activeConv.otherUser?.full_name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{activeConv.otherUser?.full_name}</p>
                  <p className="text-xs text-neutral-500 truncate">@{activeConv.otherUser?.username} · tap for profile</p>
                </div>
              </button>
              <button
                onClick={() =>
                  setLivePreviewOn((v) => {
                    const next = !v;
                    try {
                      localStorage.setItem('contrest_typing_preview', next ? '1' : '0');
                    } catch {}
                    return next;
                  })
                }
                title={livePreviewOn ? 'Live typing preview is on' : 'Live typing preview is off'}
                className={`p-2 rounded-full hover:bg-white/10 ${livePreviewOn ? 'text-drop-400' : 'text-neutral-500'}`}
              >
                {livePreviewOn ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {visibleMessages.map((m) => {
                const mine = m.sender_id === user?.id;
                const scheduled = m.status === 'scheduled';
                const seen = !!m.read_at;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
                        mine
                          ? `bg-gradient-to-br from-drop-500 to-drop-600 text-white rounded-br-sm ${scheduled ? 'opacity-60' : ''}`
                          : 'glass text-neutral-100 rounded-bl-sm'
                      }`}
                    >
                      {m.content?.startsWith('gif:') ? (
                        <img src={m.content.slice(4)} alt="gif" className="max-w-[200px] rounded-lg" />
                      ) : m.content?.startsWith('sticker:') ? (
                        <span className="text-5xl leading-none block">{m.content.slice(8)}</span>
                      ) : m.content?.startsWith('voice:') ? (
                        <audio controls src={m.content.slice(6)} className="max-w-[220px] h-9" />
                      ) : (
                        m.content
                      )}
                      {scheduled ? (
                        <span className="flex items-center gap-1 text-[10px] text-white/80 mt-1">
                          <Clock className="w-3 h-3" />
                          Sending {new Date(m.scheduled_for!).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : mine ? (
                        /* Read-state ticks: one = sent, two = seen */
                        <span
                          className="flex items-center justify-end gap-0.5 mt-1 select-none"
                          title={seen ? 'Seen' : 'Sent'}
                          aria-label={seen ? 'Seen' : 'Sent'}
                        >
                          <Check
                            className={`w-3.5 h-3.5 ${seen ? 'text-sky-300' : 'text-white/70'}`}
                            strokeWidth={2.5}
                          />
                          {seen && (
                            <Check
                              className="w-3.5 h-3.5 text-sky-300 -ml-2"
                              strokeWidth={2.5}
                            />
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {/* Live typing preview bubble — shows the peer's message as they type it, before they send */}
              {peerPreview && (
                <div className="flex justify-start">
                  <div className="max-w-[75%] px-3.5 py-2 rounded-2xl rounded-bl-sm text-sm glass text-neutral-300 italic flex items-center gap-2">
                    {peerPreview}
                    <span className="inline-flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-drop-400 animate-pulseDot" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full bg-drop-400 animate-pulseDot" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full bg-drop-400 animate-pulseDot" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-3 py-2.5 glass border-t border-white/10 relative">
              {showEmoji && (
                <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 glass-strong rounded-2xl p-2 shadow-2xl max-h-44 overflow-y-auto animate-sheet z-20">
                  <div className="flex flex-wrap gap-0.5">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="text-xl p-1.5 rounded-lg hover:bg-white/10 active:scale-90"
                        onClick={() => setDraft((d) => d + e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {showGif && (
                <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 glass-strong rounded-2xl p-3 shadow-2xl max-h-60 overflow-y-auto animate-sheet z-20">
                  <div className="flex gap-1 mb-2">
                    <button
                      type="button"
                      onClick={() => setPickerTab('gif')}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-full ${pickerTab === 'gif' ? 'bg-accent-grad text-white' : 'text-neutral-400 hover:bg-white/10'}`}
                    >
                      GIFs
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickerTab('sticker')}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-full ${pickerTab === 'sticker' ? 'bg-accent-grad text-white' : 'text-neutral-400 hover:bg-white/10'}`}
                    >
                      Stickers
                    </button>
                  </div>
                  {pickerTab === 'gif' ? (
                    <>
                      <input
                        value={gifQ}
                        onChange={(e) => {
                          setGifQ(e.target.value);
                          loadGifs(e.target.value);
                        }}
                        placeholder="Search GIFs / memes…"
                        className="w-full mb-2 px-3 py-2 rounded-full glass-input text-sm"
                        autoFocus
                      />
                      {gifError && <p className="text-[11px] text-amber-400/80 mb-1.5">{gifError}</p>}
                      {gifLoading && <p className="text-[11px] text-neutral-500 mb-1.5">Searching…</p>}
                      <div className="grid grid-cols-4 gap-1.5">
                        {(gifs.length ? gifs : REACTION_GIFS.map((g) => ({ id: g.id, url: g.url }))).map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => sendGif(g.url)}
                            className="aspect-square overflow-hidden rounded-xl bg-white/5 hover:ring-1 hover:ring-accent"
                          >
                            <img src={g.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-5 gap-1.5">
                      {STICKERS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => sendSticker(s)}
                          className="aspect-square flex items-center justify-center text-3xl rounded-xl bg-white/5 hover:bg-white/10 active:scale-90"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {showSchedule && (
                <div className="absolute bottom-full mb-1 left-3 right-3 md:left-auto md:right-3 md:w-64 glass-strong rounded-xl p-2 shadow-2xl z-20">
                  <div className="flex items-center justify-between px-2 py-1 mb-1">
                    <span className="text-xs font-medium text-neutral-300">Send later</span>
                    <button onClick={() => setShowSchedule(false)} className="text-neutral-500 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {SCHEDULE_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      disabled={!draft.trim()}
                      onClick={() => sendMessage(p.getDate())}
                      className="w-full text-left text-sm px-2.5 py-2 rounded-lg hover:bg-white/10 text-neutral-200 disabled:opacity-40"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmoji((v) => !v);
                    setShowGif(false);
                    setShowSchedule(false);
                  }}
                  className={`p-2 rounded-full hover:bg-white/10 ${showEmoji ? 'text-accent bg-white/10' : 'text-neutral-400'}`}
                  title="Emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowGif((v) => !v);
                    setShowEmoji(false);
                    setShowSchedule(false);
                    loadGifs(gifQ || '');
                  }}
                  className={`p-2 rounded-full hover:bg-white/10 ${showGif ? 'text-accent bg-white/10' : 'text-neutral-400'}`}
                  title="GIF / meme"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                {isRecording ? (
                  <div className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-full glass-input text-sm text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Recording…
                  </div>
                ) : (
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => handleDraftChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    onBlur={clearPeerTyping}
                    placeholder="Message…"
                    maxLength={INPUT_LIMITS.message}
                    className="flex-1 px-4 py-2.5 rounded-full glass-input text-sm"
                  />
                )}
                <button
                  onClick={() => setShowSchedule((v) => !v)}
                  title="Send later"
                  className={`p-2 rounded-full hover:bg-white/10 ${showSchedule ? 'text-accent bg-white/10' : 'text-neutral-400'}`}
                >
                  <Clock className="w-4 h-4" />
                </button>
                {draft.trim() ? (
                  <button
                    onClick={() => sendMessage()}
                    className="p-2.5 bg-accent-grad rounded-full hover:brightness-110 shadow-accent-sm active:scale-95"
                  >
                    <Send className="w-4 h-4 text-white" />
                  </button>
                ) : isRecording ? (
                  <>
                    <button
                      onClick={cancelRecording}
                      title="Cancel"
                      className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95"
                    >
                      <X className="w-4 h-4 text-neutral-300" />
                    </button>
                    <button
                      onClick={stopRecordingAndSend}
                      title="Send voice note"
                      className="p-2.5 bg-accent-grad rounded-full hover:brightness-110 shadow-accent-sm active:scale-95"
                    >
                      <Square className="w-4 h-4 text-white" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startRecording}
                    title="Record voice note"
                    className="p-2.5 bg-accent-grad rounded-full hover:brightness-110 shadow-accent-sm active:scale-95"
                  >
                    <Mic className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <div>
              <p className="text-neutral-400 text-lg">Your messages</p>
              <p className="text-neutral-500 text-sm mt-1">Select a conversation or start a new one.</p>
            </div>
          </div>
        )}
      </div>

      {showGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-strong rounded-2xl overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <button onClick={() => setShowGroup(false)} className="text-sm text-neutral-400">Cancel</button>
              <h2 className="font-semibold text-white text-sm">New group</h2>
              <button
                onClick={createGroup}
                disabled={groupPick.length < 1}
                className="text-sm font-medium text-accent disabled:opacity-40"
              >
                Create
              </button>
            </header>
            <div className="p-4 space-y-3">
              <input
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                placeholder="Group name (optional)"
                className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
              />
              <input
                value={groupQuery}
                onChange={(e) => {
                  setGroupQuery(e.target.value);
                  if (!e.target.value.trim()) {
                    setGroupResults([]);
                    return;
                  }
                  supabase
                    .from('profiles')
                    .select('*')
                    .neq('id', user?.id ?? '')
                    .or(`username.ilike.%${e.target.value}%,full_name.ilike.%${e.target.value}%`)
                    .limit(8)
                    .then(({ data }) => setGroupResults((data as Profile[]) ?? []));
                }}
                placeholder="Add people…"
                className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
              />
              {groupPick.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {groupPick.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setGroupPick((prev) => prev.filter((x) => x.id !== p.id))}
                      className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent"
                    >
                      @{p.username} ×
                    </button>
                  ))}
                </div>
              )}
              <div className="max-h-48 overflow-y-auto space-y-1">
                {groupResults.map((p) => {
                  const picked = groupPick.some((x) => x.id === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setGroupPick((prev) =>
                          picked ? prev.filter((x) => x.id !== p.id) : [...prev, p]
                        )
                      }
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left ${
                        picked ? 'bg-accent/15' : 'hover:bg-white/5'
                      }`}
                    >
                      <Avatar url={p.avatar_url} name={p.full_name} size="sm" />
                      <span className="text-sm text-white">@{p.username}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
