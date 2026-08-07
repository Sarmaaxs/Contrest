import { supabase } from '@/lib/supabase';

export type UploadResult = { url: string; path: string };

/** Keep under typical free-tier + phone limits */
export const LIMITS = {
  avatarBytes: 5 * 1024 * 1024, // 5MB before compress
  imageBytes: 12 * 1024 * 1024, // 12MB before compress
  videoBytes: 25 * 1024 * 1024, // 25MB — raise only when you move to R2/Mux
  avatarEdge: 512,
  imageEdge: 1440,
} as const;

function extFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  if (file.type.includes('png')) return 'png';
  if (file.type.includes('webp')) return 'webp';
  if (file.type.includes('gif')) return 'gif';
  if (file.type.includes('webm')) return 'webm';
  if (file.type.includes('quicktime') || file.type.includes('mov')) return 'mov';
  if (file.type.includes('mp4') || file.type.includes('video')) return 'mp4';
  return 'jpg';
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/i.test(file.name);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic)$/i.test(file.name);
}

export function validateMediaFile(file: File, kind: 'media' | 'avatar' = 'media'): string | null {
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
