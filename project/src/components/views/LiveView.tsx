import { useEffect, useState, useCallback, useRef } from 'react';
import { Radio, Users, X, ArrowLeft, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LiveStream, Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/shared/Avatar';

type LiveRow = LiveStream & { profiles?: Profile };

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

export default function LiveView({ onBack }: { onBack?: () => void }) {
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [lives, setLives] = useState<LiveRow[]>([]);
  const [active, setActive] = useState<LiveRow | null>(null);
  const [hosting, setHosting] = useState<LiveRow | null>(null);
  const [title, setTitle] = useState('My live');
  const [loading, setLoading] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [camError, setCamError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // --- WebRTC (peer-to-peer live video, signaled over a Supabase Realtime channel) ---
  const myIdRef = useRef<string>('');
  if (!myIdRef.current) myIdRef.current = crypto.randomUUID();
  const rtcChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('live_streams')
      .select('*, profiles!live_streams_host_id_fkey(*)')
      .eq('status', 'live')
      .order('started_at', { ascending: false });
    if (error) console.error(error);
    setLives((data as LiveRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('lives')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamOn(true);
      setMicOn(true);
    } catch (e: any) {
      setCamError(e?.message ?? 'Camera permission denied');
      setCamOn(false);
    }
  };

  useEffect(() => {
    if (hosting) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [hosting?.id]);

  // Real peer-to-peer video: host streams camera tracks directly to each viewer's
  // browser via WebRTC. Supabase Realtime's broadcast channel is only used to pass
  // the connection setup messages (offer/answer/ICE) — no video ever touches our
  // server, so this stays free at any viewer count our own bandwidth can handle.
  useEffect(() => {
    if (!active || !user) return;
    const isHostSide = active.host_id === user.id;
    const myId = myIdRef.current;
    const channel = supabase.channel(`live-webrtc-${active.id}`, {
      config: { broadcast: { self: false } },
    });
    rtcChannelRef.current = channel;

    const closePeer = (id: string) => {
      peersRef.current.get(id)?.close();
      peersRef.current.delete(id);
    };

    if (isHostSide) {
      channel.on('broadcast', { event: 'join' }, async ({ payload }: any) => {
        const viewerId = payload.viewerId as string;
        if (!streamRef.current) return;
        closePeer(viewerId);
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peersRef.current.set(viewerId, pc);
        streamRef.current.getTracks().forEach((t) => pc.addTrack(t, streamRef.current!));
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channel.send({ type: 'broadcast', event: 'ice', payload: { to: viewerId, from: myId, candidate: e.candidate } });
          }
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({ type: 'broadcast', event: 'offer', payload: { to: viewerId, from: myId, sdp: offer } });
      });
      channel.on('broadcast', { event: 'answer' }, async ({ payload }: any) => {
        if (payload.to !== myId) return;
        const pc = peersRef.current.get(payload.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      });
      channel.on('broadcast', { event: 'ice' }, async ({ payload }: any) => {
        if (payload.to !== myId) return;
        const pc = peersRef.current.get(payload.from);
        if (pc && payload.candidate) {
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch {
            // benign — late/duplicate candidate
          }
        }
      });
      channel.on('broadcast', { event: 'leave' }, ({ payload }: any) => closePeer(payload.viewerId));
    } else {
      channel.on('broadcast', { event: 'offer' }, async ({ payload }: any) => {
        if (payload.to !== myId) return;
        closePeer('host');
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peersRef.current.set('host', pc);
        pc.ontrack = (e) => {
          setRemoteStream(e.streams[0]);
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channel.send({ type: 'broadcast', event: 'ice', payload: { to: payload.from, from: myId, candidate: e.candidate } });
          }
        };
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({ type: 'broadcast', event: 'answer', payload: { to: payload.from, from: myId, sdp: answer } });
      });
      channel.on('broadcast', { event: 'ice' }, async ({ payload }: any) => {
        if (payload.to !== myId) return;
        const pc = peersRef.current.get('host');
        if (pc && payload.candidate) {
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch {
            // benign
          }
        }
      });
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && !isHostSide) {
        channel.send({ type: 'broadcast', event: 'join', payload: { viewerId: myId } });
      }
    });

    return () => {
      if (!isHostSide) {
        channel.send({ type: 'broadcast', event: 'leave', payload: { viewerId: myId } });
      }
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      supabase.removeChannel(channel);
      setRemoteStream(null);
    };
  }, [active?.id, active?.host_id, user?.id]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const goLive = async () => {
    if (!user) return;
    setStartError(null);
    const { data, error } = await supabase
      .from('live_streams')
      .insert({ host_id: user.id, title: title.trim() || 'Live', status: 'live' })
      .select('*, profiles!live_streams_host_id_fkey(*)')
      .single();
    if (error) {
      setStartError(error.message + ' — run the moderation/live migration in Supabase if tables are missing.');
      return;
    }
    if (data) {
      setHosting(data as LiveRow);
      setActive(data as LiveRow);
      await load();
    }
  };

  const endLive = async () => {
    if (!hosting) return;
    await supabase
      .from('live_streams')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', hosting.id);
    stopCamera();
    setHosting(null);
    setActive(null);
    await load();
  };

  const toggleCam = () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  };

  const toggleMic = () => {
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  };

  if (active) {
    const isHost = active.host_id === user?.id;
    return (
      <div className="fixed inset-0 z-50 bg-ink-950 flex flex-col">
        <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
          {/* Host local camera */}
          {isHost ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover -scale-x-100 ${camOn ? '' : 'opacity-0'}`}
            />
          ) : remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-violet-950/50 via-ink-950 to-ink-950" />
          )}
          {isHost && !camOn && (
            <div className="absolute inset-0 bg-ink-950 flex items-center justify-center">
              <Avatar url={profile?.avatar_url} name={profile?.full_name} size="2xl" />
            </div>
          )}

          <div className="absolute top-4 left-4 right-4 flex items-center gap-3 z-10">
            {!isHost && (
              <button onClick={() => setActive(null)} className="p-2 rounded-full glass">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
            )}
            <div className="flex items-center gap-2 glass rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-livePulse" />
              <span className="text-xs font-bold text-white tracking-wide">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5 glass rounded-full px-3 py-1.5 text-xs text-neutral-200">
              <Users className="w-3.5 h-3.5" />
              {active.viewer_count + (isHost ? 0 : 1)}
            </div>
            <button
              onClick={() => (isHost ? endLive() : setActive(null))}
              className="ml-auto p-2 rounded-full glass"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {!isHost && !remoteStream && (
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-28 h-28 rounded-full ring-4 ring-red-500/60 shadow-accent animate-livePulse overflow-hidden mb-4">
                <Avatar url={active.profiles?.avatar_url} name={active.profiles?.full_name} size="2xl" />
              </div>
              <p className="text-white font-semibold text-lg">@{active.profiles?.username}</p>
              <p className="text-neutral-400 text-sm mt-1">{active.title}</p>
              <p className="text-xs text-neutral-500 mt-6 flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Connecting…
              </p>
            </div>
          )}
          {!isHost && remoteStream && (
            <div className="absolute top-16 left-4 z-10">
              <p className="text-white font-semibold text-sm drop-shadow">@{active.profiles?.username}</p>
            </div>
          )}

          {isHost && (
            <div className="absolute bottom-24 left-0 right-0 text-center z-10">
              <p className="text-white font-semibold drop-shadow">@{profile?.username}</p>
              <p className="text-sm text-white/80 drop-shadow">{active.title}</p>
              {camError && <p className="text-xs text-red-300 mt-2">{camError}</p>}
            </div>
          )}
        </div>

        {isHost && (
          <div className="relative z-10 p-4 border-t border-white/10 glass flex items-center gap-3">
            <button onClick={toggleCam} className="p-3 rounded-full bg-white/10 hover:bg-white/15">
              {camOn ? <Video className="w-5 h-5 text-white" /> : <VideoOff className="w-5 h-5 text-red-400" />}
            </button>
            <button onClick={toggleMic} className="p-3 rounded-full bg-white/10 hover:bg-white/15">
              {micOn ? <Mic className="w-5 h-5 text-white" /> : <MicOff className="w-5 h-5 text-red-400" />}
            </button>
            <button
              onClick={endLive}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm"
            >
              End live
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen app-glow-bg">
      <header className="sticky top-0 z-10 glass border-b border-white/10 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="p-1.5 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-neutral-300" />
          </button>
        )}
        <Radio className="w-5 h-5 text-red-400" />
        <h1 className="font-semibold text-white">Live</h1>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="glass-strong rounded-2xl p-5">
          <h2 className="text-white font-medium mb-2">Go live</h2>
          <p className="text-xs text-neutral-500 mb-3">
            Starts your camera (permission required) and creates a live room others can join.
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Live title"
            className="w-full px-3.5 py-2.5 rounded-lg glass-input text-sm mb-3"
          />
          <button
            onClick={goLive}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-red-500 to-pink-600 hover:brightness-110 shadow-accent-sm flex items-center justify-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            Start live
          </button>
          {startError && <p className="text-xs text-red-400 mt-2">{startError}</p>}
        </div>

        <div>
          <h3 className="text-sm font-medium text-neutral-400 mb-3">Live now</h3>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-white/15 border-t-white rounded-full animate-spin" />
            </div>
          ) : lives.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">No one is live right now.</p>
          ) : (
            <div className="space-y-2">
              {lives.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActive(l)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl glass hover:bg-white/[0.06] text-left"
                >
                  <div className="relative">
                    <Avatar url={l.profiles?.avatar_url} name={l.profiles?.full_name} size="md" />
                    <span className="absolute -bottom-0.5 -right-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white">
                      LIVE
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">@{l.profiles?.username}</p>
                    <p className="text-xs text-neutral-400 truncate">{l.title}</p>
                  </div>
                  <span className="text-xs text-neutral-500 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {l.viewer_count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
