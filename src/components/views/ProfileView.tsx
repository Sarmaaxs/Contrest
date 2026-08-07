import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Settings,
  Grid3x3,
  Video,
  Bookmark,
  Heart,
  LogOut,
  Lock,
  UserPlus,
  UserCheck,
  Clock,
  Camera,
  Check,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Post, Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { notify } from '@/lib/notify';
import Avatar from '@/components/shared/Avatar';
import { isVerified } from '@/lib/verified';
import VerifiedBadge from '@/components/shared/VerifiedBadge';
import ReportBlockMenu from '@/components/moderation/ReportBlockMenu';
import { validateMediaFile } from '@/lib/upload';
import { uploadAny } from '@/lib/storageProviders';

type FollowRequestRow = {
  requester_id: string;
  profiles?: Profile;
};

export default function ProfileView({
  onOpenSettings,
  userId,
  onMessage,
  initialPostId,
}: {
  onOpenSettings?: () => void;
  userId?: string;
  onMessage?: (userId: string) => void;
  initialPostId?: string;
}) {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const toast = useToast();
  const isSelf = !userId || userId === user?.id;
  const targetId = isSelf ? user?.id : userId;
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [viewProfile, setViewProfile] = useState<Profile | null>(isSelf ? profile : null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [saved, setSaved] = useState<Post[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [tab, setTab] = useState<'posts' | 'videos' | 'saved'>('posts');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: '', username: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [followState, setFollowState] = useState<'none' | 'following' | 'requested'>('none');
  const [showReport, setShowReport] = useState(false);
  const [canView, setCanView] = useState(true);
  const [followError, setFollowError] = useState<string | null>(null);
  const [incoming, setIncoming] = useState<FollowRequestRow[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [followListMode, setFollowListMode] = useState<'followers' | 'following' | null>(null);
  const [followListRows, setFollowListRows] = useState<Profile[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const loadProfileData = useCallback(async () => {
    if (!targetId) return;

    let p: Profile | null = isSelf ? profile : null;
    if (!isSelf) {
      const { data } = await supabase.from('profiles').select('*').eq('id', targetId).maybeSingle();
      p = (data as Profile) ?? null;
      setViewProfile(p);
    } else {
      setViewProfile(profile);
      p = profile;
    }

    const [postsRes, followersRes, followingRes] = await Promise.all([
      supabase.from('posts').select('*').eq('user_id', targetId).order('created_at', { ascending: false }),
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', targetId),
      supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', targetId),
    ]);
    setPosts((postsRes.data as Post[]) ?? []);
    setFollowers(followersRes.count ?? 0);
    setFollowing(followingRes.count ?? 0);

    if (initialPostId) {
      const target = (postsRes.data as Post[] | null)?.find((p) => p.id === initialPostId);
      if (target) setSelectedPost(target);
    }

    if (isSelf && user) {
      const { data: bms } = await supabase.from('bookmarks').select('post_id, posts(*)').eq('user_id', user.id);
      setSaved((bms ?? []).map((b: any) => b.posts as Post).filter(Boolean));

      const { data: reqs } = await supabase
        .from('follow_requests')
        .select('requester_id, profiles!follow_requests_requester_id_fkey(*)')
        .eq('target_id', user.id)
        .eq('status', 'pending');
      setIncoming((reqs as any[]) ?? []);
    }

    if (!isSelf && user && p) {
      const { data: fl } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', targetId)
        .maybeSingle();
      if (fl) {
        setFollowState('following');
        setCanView(true);
      } else {
        const { data: fr } = await supabase
          .from('follow_requests')
          .select('status')
          .eq('requester_id', user.id)
          .eq('target_id', targetId)
          .eq('status', 'pending')
          .maybeSingle();
        setFollowState(fr ? 'requested' : 'none');
        setCanView(!p.is_private);
      }
    } else {
      setCanView(true);
    }
  }, [targetId, isSelf, profile, user]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const startEdit = () => {
    setEditForm({
      fullName: profile?.full_name ?? '',
      username: profile?.username ?? '',
      bio: profile?.bio ?? '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editForm.fullName,
        username: editForm.username,
        bio: editForm.bio || null,
      })
      .eq('id', user.id);
    setSaving(false);
    if (!error) {
      setEditing(false);
      await refreshProfile();
      setViewProfile((prev) =>
        prev
          ? { ...prev, full_name: editForm.fullName, username: editForm.username, bio: editForm.bio || null }
          : prev
      );
    }
  };

  const onAvatarFile = async (file: File | null | undefined) => {
    if (!user || !file) return;
    const err = validateMediaFile(file, 'avatar');
    if (err) {
      toast(err);
      return;
    }
    setUploadingAvatar(true);
    try {
      const { url } = await uploadAny(user.id, file, 'avatar');
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (error) throw new Error(error.message);
      await refreshProfile();
      setViewProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev));
    } catch (e: any) {
      toast(e?.message ?? 'Avatar upload failed. Run the storage migration in Supabase.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !targetId || isSelf) return;
    setFollowError(null);
    if (followState === 'following') {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId);
      if (error) {
        setFollowError(error.message);
        return;
      }
      setFollowState('none');
      setFollowers((c) => Math.max(0, c - 1));
      if (viewProfile?.is_private) setCanView(false);
      return;
    }
    if (followState === 'requested') {
      await supabase
        .from('follow_requests')
        .delete()
        .eq('requester_id', user.id)
        .eq('target_id', targetId);
      setFollowState('none');
      return;
    }
    if (viewProfile?.is_private) {
      const { error } = await supabase.from('follow_requests').upsert({
        requester_id: user.id,
        target_id: targetId,
        status: 'pending',
      });
      if (error) {
        setFollowError(error.message);
        return;
      }
      setFollowState('requested');
    } else {
      const { error } = await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: targetId,
      });
      if (error) {
        setFollowError(error.message);
        return;
      }
      setFollowState('following');
      setFollowers((c) => c + 1);
      setCanView(true);
      await notify({
        user_id: targetId,
        actor_id: user.id,
        type: 'follow',
        message: 'started following you',
      });
    }
  };

  const acceptRequest = async (requesterId: string) => {
    if (!user) return;
    await supabase.from('follows').insert({ follower_id: requesterId, following_id: user.id });
    await supabase
      .from('follow_requests')
      .update({ status: 'accepted' })
      .eq('requester_id', requesterId)
      .eq('target_id', user.id);
    setIncoming((prev) => prev.filter((r) => r.requester_id !== requesterId));
    setFollowers((c) => c + 1);
    await notify({
      user_id: requesterId,
      actor_id: user.id,
      type: 'follow',
      message: 'accepted your follow request',
    });
  };

  const declineRequest = async (requesterId: string) => {
    if (!user) return;
    await supabase
      .from('follow_requests')
      .update({ status: 'declined' })
      .eq('requester_id', requesterId)
      .eq('target_id', user.id);
    setIncoming((prev) => prev.filter((r) => r.requester_id !== requesterId));
  };

  const deleteOwnPost = async (postId: string) => {
    if (!user) return;
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user.id);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setSelectedPost((sp) => (sp?.id === postId ? null : sp));
    }
  };

  const openFollowList = async (mode: 'followers' | 'following') => {
    if (!targetId) return;
    setFollowListMode(mode);
    setFollowListLoading(true);
    setFollowListRows([]);
    const idsRes =
      mode === 'followers'
        ? await supabase.from('follows').select('follower_id').eq('following_id', targetId)
        : await supabase.from('follows').select('following_id').eq('follower_id', targetId);
    const ids = (idsRes.data ?? []).map((r: any) => (mode === 'followers' ? r.follower_id : r.following_id));
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('*').in('id', ids);
      setFollowListRows((profs as Profile[]) ?? []);
    }
    setFollowListLoading(false);
  };

  const filteredPosts = tab === 'videos' ? posts.filter((p) => p.media_type === 'video') : posts;
  const display = viewProfile;

  return (
    <div className="max-w-3xl mx-auto py-6 md:py-10 px-4">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-10 mb-8">
        <div className="relative w-28 h-28 shrink-0">
          <Avatar
            url={display?.avatar_url}
            name={display?.full_name}
            size="2xl"
            verified={isVerified(display)}
          />
          {isSelf && (
            <>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 z-10 w-9 h-9 rounded-full bg-accent-grad flex items-center justify-center shadow-lg border-2 border-ink-950 hover:brightness-110 disabled:opacity-50"
                title="Change profile photo"
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onAvatarFile(e.target.files?.[0])}
              />
            </>
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-4">
            <h1 className="text-xl font-semibold text-white flex items-center gap-2 justify-center md:justify-start">
              @{display?.username}
              {isVerified(display) && (
                <VerifiedBadge size="md" title="Verified · Contrest official" />
              )}
              {display?.is_private && <Lock className="w-4 h-4 text-neutral-400" />}
            </h1>
            <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
              {isSelf ? (
                <>
                  <button
                    onClick={startEdit}
                    className="px-3.5 py-1.5 rounded-lg text-sm font-medium bg-white/[0.06] text-neutral-100 hover:bg-white/10"
                  >
                    Edit profile
                  </button>
                  <button onClick={signOut} className="p-2 rounded-lg hover:bg-white/[0.06]">
                    <LogOut className="w-4 h-4 text-neutral-300" />
                  </button>
                  <button onClick={onOpenSettings} className="p-2 rounded-lg hover:bg-white/[0.06]">
                    <Settings className="w-4 h-4 text-neutral-300" />
                  </button>
                </>
              ) : (
                <>
                  {followState === 'following' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (!targetId) {
                            toast('No user id on this profile.');
                            return;
                          }
                          if (!onMessage) {
                            toast('Message handler missing — update AppShell.');
                            return;
                          }
                          onMessage(targetId);
                        }}
                        className="px-4 py-1.5 rounded-lg text-sm font-medium bg-accent-grad text-white active:scale-95"
                      >
                        Message
                      </button>
                      <button
                        type="button"
                        onClick={handleFollow}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-white/[0.08] text-neutral-200 hover:bg-white/10"
                      >
                        <UserCheck className="w-4 h-4" /> Unfollow
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleFollow}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                        followState === 'requested'
                          ? 'bg-white/[0.06] text-neutral-400'
                          : 'bg-accent-grad text-white'
                      }`}
                    >
                      {followState === 'requested' ? (
                        <>
                          <Clock className="w-4 h-4" /> Requested
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" /> {display?.is_private ? 'Request' : 'Follow'}
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setShowReport(true)}
                    className="px-3 py-1.5 rounded-lg text-sm bg-white/[0.06] text-neutral-300 hover:bg-white/10"
                  >
                    Report
                  </button>
                </>
              )}
            </div>
          </div>
          {followError && <p className="text-xs text-red-400 mb-2">{followError}</p>}
          {uploadingAvatar && <p className="text-xs text-accent mb-2">Uploading avatar…</p>}
          

          <div className="flex items-center gap-6 justify-center md:justify-start mb-4">
            <Stat label="Posts" value={posts.length} />
            <Stat label="Followers" value={followers} onClick={() => openFollowList('followers')} />
            <Stat label="Following" value={following} onClick={() => openFollowList('following')} />
          </div>

          <div>
            <p className="font-medium text-white text-sm">{display?.full_name}</p>
            {(display as any)?.status_text?.startsWith('listening:') && (
              <p className="text-xs text-accent mt-1">
                🎵 {(display as any).status_text.replace('listening:', '')}
              </p>
            )}
            {display?.bio && <p className="text-sm text-neutral-300 mt-1">{display.bio}</p>}
          </div>
        </div>
      </div>

      {/* Incoming follow requests (private accounts) */}
      {isSelf && incoming.length > 0 && (
        <div className="mb-6 glass rounded-xl p-4">
          <h3 className="text-sm font-medium text-white mb-3">Follow requests</h3>
          <div className="space-y-2">
            {incoming.map((r) => (
              <div key={r.requester_id} className="flex items-center gap-3">
                <Avatar url={r.profiles?.avatar_url} name={r.profiles?.full_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">@{r.profiles?.username}</p>
                </div>
                <button
                  onClick={() => acceptRequest(r.requester_id)}
                  className="p-2 rounded-lg bg-accent-grad text-white"
                  title="Accept"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => declineRequest(r.requester_id)}
                  className="p-2 rounded-lg bg-white/10 text-neutral-300"
                  title="Decline"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!canView ? (
        <div className="text-center py-20 border-t border-white/10">
          <Lock className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-white font-medium">This account is private</p>
          <p className="text-sm text-neutral-500 mt-1">Follow to see their photos and videos.</p>
        </div>
      ) : (
        <>
          <div className="border-t border-white/10 flex justify-center gap-12 mb-4">
            <TabButton icon={<Grid3x3 className="w-4 h-4" />} label="Posts" active={tab === 'posts'} onClick={() => setTab('posts')} />
            <TabButton icon={<Video className="w-4 h-4" />} label="Videos" active={tab === 'videos'} onClick={() => setTab('videos')} />
            {isSelf && (
              <TabButton icon={<Bookmark className="w-4 h-4" />} label="Saved" active={tab === 'saved'} onClick={() => setTab('saved')} />
            )}
          </div>

          {tab === 'saved' ? (
            saved.length === 0 ? (
              <Empty icon={<Bookmark className="w-10 h-10 text-neutral-600" />} text="Saved posts will appear here." />
            ) : (
              <Grid posts={saved} canDelete={false} onOpen={setSelectedPost} />
            )
          ) : filteredPosts.length === 0 ? (
            <Empty icon={<Heart className="w-10 h-10 text-neutral-600" />} text="No posts yet." />
          ) : (
            <Grid posts={filteredPosts} canDelete={isSelf} onDelete={deleteOwnPost} onOpen={setSelectedPost} />
          )}
        </>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-2xl w-full max-w-md overflow-hidden border border-white/10">
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <h2 className="font-semibold text-white">Edit profile</h2>
              <button onClick={() => setEditing(false)} className="text-sm text-neutral-400 hover:text-white">
                Cancel
              </button>
            </header>
            <div className="p-4 space-y-4">
              <p className="text-xs text-neutral-500">
                Tip: tap the camera on your avatar to upload a photo from your device.
              </p>
              <Input label="Full name" value={editForm.fullName} onChange={(v) => setEditForm({ ...editForm, fullName: v })} />
              <Input label="Username" value={editForm.username} onChange={(v) => setEditForm({ ...editForm, username: v })} />
              <label className="block">
                <span className="block text-xs font-medium text-neutral-300 mb-1.5">Bio</span>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm resize-none"
                />
              </label>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="w-full bg-accent-grad text-white py-2.5 rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReport && targetId && (
        <ReportBlockMenu
          targetUserId={targetId}
          targetUsername={display?.username}
          onClose={() => setShowReport(false)}
          onBlocked={() => setShowReport(false)}
        />
      )}

      {followListMode && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center"
          onClick={() => setFollowListMode(null)}
        >
          <div
            className="glass-strong rounded-t-2xl md:rounded-2xl w-full md:w-96 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="font-medium text-white capitalize">{followListMode}</p>
              <button onClick={() => setFollowListMode(null)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-4 h-4 text-neutral-300" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {followListLoading ? (
                <p className="text-center text-sm text-neutral-500 py-6">Loading…</p>
              ) : followListRows.length === 0 ? (
                <p className="text-center text-sm text-neutral-500 py-6">
                  No {followListMode} yet
                </p>
              ) : (
                followListRows.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFollowListMode(null)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.06]"
                  >
                    <Avatar url={p.avatar_url} name={p.username} size="md" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">@{p.username}</p>
                      {p.full_name && <p className="text-xs text-neutral-400">{p.full_name}</p>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedPost && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-2 md:p-6"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="glass-strong rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Avatar url={display?.avatar_url} name={display?.username} size="sm" verified={isVerified(display)} />
                <span className="text-sm font-medium text-white flex items-center gap-1">
                  @{display?.username}
                  {isVerified(display) && <VerifiedBadge size="sm" />}
                </span>
              </div>
              <button onClick={() => setSelectedPost(null)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-4 h-4 text-neutral-300" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center max-h-[60vh] overflow-hidden">
              {selectedPost.media_type === 'video' ? (
                <video src={selectedPost.media_url} controls autoPlay className="max-h-[60vh] w-full object-contain" />
              ) : (
                <img src={selectedPost.media_url} alt={selectedPost.caption ?? ''} className="max-h-[60vh] w-full object-contain" />
              )}
            </div>
            <div className="p-4 overflow-y-auto">
              {selectedPost.caption && <p className="text-sm text-neutral-100 mb-2">{selectedPost.caption}</p>}
              {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                <p className="text-xs text-accent mb-2">{selectedPost.hashtags.map((h) => `#${h}`).join(' ')}</p>
              )}
              <p className="text-xs text-neutral-500">{new Date(selectedPost.created_at).toLocaleString()}</p>
              {isSelf && (
                <button
                  type="button"
                  onClick={() => deleteOwnPost(selectedPost.id)}
                  className="mt-3 text-xs font-medium text-red-400 hover:text-red-300"
                >
                  Delete post
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto mb-3 flex justify-center">{icon}</div>
      <p className="text-neutral-500 text-sm">{text}</p>
    </div>
  );
}

function Grid({
  posts,
  canDelete,
  onDelete,
  onOpen,
}: {
  posts: Post[];
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  onOpen?: (post: Post) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {posts.map((p) => (
        <button
          type="button"
          key={p.id}
          onClick={() => onOpen?.(p)}
          className="aspect-square bg-white/[0.06] overflow-hidden relative group text-left"
        >
          {p.media_type === 'video' ? (
            <video src={p.media_url} className="w-full h-full object-cover" />
          ) : (
            <img src={p.media_url} alt={p.caption ?? ''} className="w-full h-full object-cover" />
          )}
          {canDelete && onDelete && (
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this post?')) onDelete(p.id);
              }}
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 md:opacity-100 p-1.5 rounded-full bg-black/70 text-red-300 text-[10px] font-medium"
            >
              Delete
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, onClick }: { label: string; value: number; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="text-center md:text-left disabled:cursor-default">
      <span className="font-semibold text-white">{value}</span>{' '}
      <span className="text-neutral-400 text-sm">{label}</span>
    </button>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 py-3 text-xs font-medium uppercase tracking-wide border-t-2 -mt-px ${
        active ? 'border-accent text-white' : 'border-transparent text-neutral-500'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-neutral-300 mb-1.5">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm"
      />
    </label>
  );
}
