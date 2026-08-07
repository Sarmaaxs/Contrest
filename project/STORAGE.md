# Contrest storage guide

## Is Supabase Storage enough?

**Yes for MVP / friends / portfolio** (photos + short videos).

Free tier roughly:
- ~1 GB storage
- bandwidth limits
- fine for dozens of users, not TikTok-scale video

## Use Supabase for
- Avatars
- Photos
- Short videos under ~25MB

## Move off Supabase when
- Long videos / lots of traffic
- You need transcoding (360p/720p)
- Bandwidth bills climb

### Good next options
| Need | Service |
|------|---------|
| Cheap files (images + raw video) | **Cloudflare R2** (S3-compatible, no egress fees) |
| Social video (transcode, HLS) | **Mux** or **Cloudflare Stream** |
| Simple uploads UI | **Uploadcare** / **Cloudinary** |
| Keep DB on Supabase | Always fine — only media moves |

## Harden storage (run in SQL Editor)

```sql
UPDATE storage.buckets
SET public = true,
    file_size_limit = 26214400, -- 25MB
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/webm','video/quicktime'
    ]
WHERE id = 'media';

UPDATE storage.buckets
SET public = true,
    file_size_limit = 5242880, -- 5MB
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif']
WHERE id = 'avatars';
```

If buckets don't exist yet, create `media` and `avatars` as **public** in Dashboard → Storage, then run policies from earlier migrations.
