-- Adds the AI-generated vs human-edited label to posts.
-- Safe to run even if it's already applied (IF NOT EXISTS).
-- Run this in Supabase → SQL Editor → New query → Run.

alter table public.posts
  add column if not exists content_origin text not null default 'human'
  check (content_origin in ('ai', 'human'));

create index if not exists posts_content_origin_idx on public.posts (content_origin);
