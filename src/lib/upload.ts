import { supabase } from '@/lib/supabase';
import { checkCooldown, formatRetryAfter } from '@/lib/security';

export type UploadResult = { url: string; path: string };

/** Keep under typical free-tier + phone limits */
export const LIMITS = {
  avatarBytes: 5 * 1024 * 1024, // 5MB before compress
  imageBytes: 12 * 1024 * 1024, // 12MB before compress
  videoBytes: 25 * 1024 * 1024, // 25MB — raise only when you move to R2/Mux
  avatarEdge: 512,
  imageEdge: 1440,
} as const;

// Extension allowlist keyed by MIME type. Deliberately does NOT trust the
// filename a user's browser reports — a file called "avatar.jpg" can still
// carry an arbitrary MIME type, and a crafted filename like "pic.svg" or
// "pic.html" served back from storage as image/svg+xml can execute inline
// script in a browser (stored XSS). Only well-known, script-free image/video
// MIME types get an extension; everything else is rejected outright below.
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

function extFromFile(file: File): string {
  const fromMime = MIME_TO_EXT[file.type.toLowerCase()];
  if (fromMime) return fromMime;
  // Fall back to filename only for a small, safe allowlist — never pass an
  // arbitrary user-controlled extension straight through to storage.
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  const safeFallback = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'mp4', 'webm', 'mov', 'm4v'];
  if (safeFallback.includes(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
  return 'jpg';
}

/** Explicitly-disallowed types that must never reach storage, regardless of
 * size — SVGs and HTML can carry inline <script>, which is a stored-XSS risk
 * if the bucket ever serves them with their original content type. */
const BLOCKED_MIME_PATTERNS = [/svg/i, /html/i, /javascript/i, /x-msdownload/i, /octet-stream/i];

export function isBlockedFileType(file: File): boolean {
  return BLOCKED_MIME_PATTERNS.some((re) => re.test(file.type)) || /\.(svg|html?|js|exe|sh)$/i.test(file.name);
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic)$/i.test(file.name);
}

export function validateMediaFile(file: File, kind: 'media' | 'avatar' = 'media'): string | null {
  if (isBlockedFileType(file)) return 'This file type is not allowed.';
  if (kind === 'avatar') {
    if (!isImageFile(file)) return 'Avatar must be an image';
    if (file.size > LIMITS.avatarBytes) return 'Avatar must be under 5MB';
    return null;
  }
  if (isVideoFile(file)) {
    if (file.size > LIMITS.videoBytes) {
      return 'Video must be under 25MB for now (use shorter clips). Larger video needs external storage later.';
    }
    return null;
  }
  if (isImageFile(file)) {
    if (file.size > LIMITS.imageBytes) return 'Photo must be under 12MB';
    return null;
  }
  return 'Only photos and videos are allowed';
}

/** Compress images client-side to cut storage cost + low-memory crashes */
export async function compressImage(
  file: File,
  opts: { maxEdge?: number; quality?: number } = {}
): Promise<File> {
  if (!isImageFile(file) || file.type === 'image/gif') return file;

  const maxEdge = opts.maxEdge ?? LIMITS.imageEdge;
  const quality = opts.quality ?? 0.82;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  );
  canvas.width = 0;
  canvas.height = 0;

  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export async function uploadMedia(
  userId: string,
  file: File,
  bucket: 'media' | 'avatars' = 'media'
): Promise<UploadResult> {
  const kind = bucket === 'avatars' ? 'avatar' : 'media';
  const validation = validateMediaFile(file, kind);
  if (validation) throw new Error(validation);

  // 1 upload/sec/user — enough for normal use, blocks a scripted upload
  // flood from burning through storage quota (a short client-side guard
  // throttling rapid media uploads).
  const cooldown = checkCooldown(`upload:${userId}`, 1000);
  if (!cooldown.allowed) {
    throw new Error(`Slow down — try again in ${formatRetryAfter(cooldown.retryAfterMs)}.`);
  }

  let toUpload = file;
  if (isImageFile(file)) {
    toUpload = await compressImage(file, {
      maxEdge: bucket === 'avatars' ? LIMITS.avatarEdge : LIMITS.imageEdge,
      quality: bucket === 'avatars' ? 0.8 : 0.82,
    });
  }

  // Path MUST start with auth user id (matches storage RLS)
  const ext = extFromFile(toUpload);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, toUpload, {
    cacheControl: '3600',
    upsert: false,
    contentType: toUpload.type || undefined,
  });

  if (error) {
    const msg = error.message || 'Upload failed';
    if (/row-level security|policy|403|unauthorized/i.test(msg)) {
      throw new Error('Upload blocked by storage policy. Run the storage SQL and stay signed in.');
    }
    if (/payload|size|too large|413/i.test(msg)) {
      throw new Error('File too large for storage limit. Use a smaller photo/video.');
    }
    throw new Error(msg);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

const AUDIO_MIME_TO_EXT: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
};

/** Upload a user's own sound clip to use as post background audio — this is
 * how you attach a song that isn't in the built-in catalog: a third-party
 * music library is mostly other users' uploaded "original sounds", not just
 * licensed tracks, so the same pattern applies here. */
export async function uploadAudio(userId: string, file: File): Promise<UploadResult> {
  if (isBlockedFileType(file)) throw new Error('This file type is not allowed.');
  const ext = AUDIO_MIME_TO_EXT[file.type.toLowerCase()];
  if (!ext) throw new Error('Use an MP3, M4A, WAV, OGG, or AAC audio file.');
  const maxBytes = 8 * 1024 * 1024; // ~a few minutes of compressed audio
  if (file.size > maxBytes) throw new Error('Audio clip must be under 8MB.');

  const cooldown = checkCooldown(`upload:${userId}`, 1000);
  if (!cooldown.allowed) {
    throw new Error(`Slow down — try again in ${formatRetryAfter(cooldown.retryAfterMs)}.`);
  }

  const path = `${userId}/audio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  });
  if (error) {
    const msg = error.message || 'Upload failed';
    if (/row-level security|policy|403|unauthorized/i.test(msg)) {
      throw new Error('Upload blocked by storage policy. Stay signed in and try again.');
    }
    throw new Error(msg);
  }
  const { data } = supabase.storage.from('media').getPublicUrl(path);
  return { url: data.publicUrl, path };
}
