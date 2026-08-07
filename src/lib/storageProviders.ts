/**
 * Media upload — Supabase Storage only.
 *
 * NOTE: Appwrite/UploadThing branches were removed. They required
 * shipping a server-side API key in client JS (VITE_APPWRITE_API_KEY),
 * which is readable by anyone in the built bundle. Don't put admin/server
 * keys behind a VITE_ prefix — only Supabase's anon key + RLS is safe
 * to ship to the browser. If you outgrow Supabase Storage's free tier,
 * add a real backend endpoint that holds the Appwrite key server-side.
 */
import { uploadMedia as supabaseUpload, validateMediaFile } from '@/lib/upload';
import type { UploadResult } from '@/lib/upload';

export async function uploadAny(
  userId: string,
  file: File,
  kind: 'media' | 'avatar' = 'media'
): Promise<UploadResult> {
  const err = validateMediaFile(file, kind);
  if (err) throw new Error(err);
  return supabaseUpload(userId, file, kind === 'avatar' ? 'avatars' : 'media');
}

export function storageBackendLabel(): string {
  return 'Supabase Storage';
}
