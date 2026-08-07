import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // This is the exact cause of a blank white screen on first load — happens
  // before React even mounts (can't be caught by an error boundary), most
  // commonly from forgetting to add env vars in Netlify/Vercel/Cloudflare's
  // dashboard on a fresh deploy. Show something instead of nothing.
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;color:#fff;font-family:system-ui,sans-serif;padding:24px;text-align:center;">
      <div style="max-width:380px;">
        <p style="font-size:40px;margin:0 0 12px;">⚙️</p>
        <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;">Missing Supabase configuration</h1>
        <p style="font-size:13px;color:#999;line-height:1.5;margin:0;">
          VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY aren't set. Locally, add them to a <code>.env</code> file and restart the dev server.
          On Netlify/Vercel/Cloudflare, add them in the project's environment variables settings and redeploy.
        </p>
      </div>
    </div>`;
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
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
