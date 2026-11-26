import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // This screen is public-facing — any visitor to a misconfigured deploy
  // sees it, not just you. It used to name the exact env var names and
  // hosting providers, which hands a random visitor free info about your
  // stack for no benefit to them. The actionable detail now only goes to
  // the browser console, where a developer (you) would actually look.
  console.error(
    'Contrest: missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. ' +
      'Set them in .env locally, or in your host\'s environment variables settings, then redeploy.'
  );
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;color:#fff;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
      <div style="max-width:380px;">
        <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;">Contrest is temporarily unavailable</h1>
        <p style="font-size:13px;color:#999;line-height:1.5;margin:0;">
          We're working on it — please check back shortly.
        </p>
      </div>
    </div>`;
  throw new Error('Missing app configuration');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type LogoVariant = 'classic' | 'official' | 'white';
export type ThemeAccent = 'purple' | 'cyan' | 'white';

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  is_private?: boolean;
  logo_variant?: LogoVariant;
  theme_accent?: ThemeAccent;
  interests?: string[];
  status_text?: string | null;
  status_emoji?: string | null;
  gender?: string | null;
  avatar_preset?: string | null;
  onboarded?: boolean;
  is_verified?: boolean;
};

export type Post = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  content_origin?: 'ai' | 'human';
  caption: string | null;
  created_at: string;
  is_flagged?: boolean;
  visibility?: 'public' | 'followers' | 'close_friends';
  hashtags?: string[];
  like_count?: number;
  comment_count?: number;
  music_track_id?: string | null;
  music_title?: string | null;
  music_artist?: string | null;
  music_stream_url?: string | null;
  music_artwork_url?: string | null;
  music_start_seconds?: number | null;
  music_source?: 'audius' | 'custom' | null;
  profiles?: Profile;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
};

export type Conversation = {
  id: string;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  status?: 'sent' | 'scheduled';
  scheduled_for?: string | null;
  /** null = not seen (1 tick), set = seen (2 ticks) */
  read_at?: string | null;
};

export type ConversationWithMembers = Conversation & {
  members?: Profile[];
  last_message?: Message | null;
};

export type Story = {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption: string | null;
  created_at: string;
  expires_at: string;
  profiles?: Profile;
};

export type LiveStream = {
  id: string;
  host_id: string;
  title: string;
  status: 'live' | 'ended';
  viewer_count: number;
  started_at: string;
  ended_at?: string | null;
  profiles?: Profile;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_user_id?: string | null;
  post_id?: string | null;
  reason: string;
  details?: string | null;
  status: string;
  created_at: string;
};
