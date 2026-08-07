-- Guarantees the notifications table + RLS actually exist and are correct.
-- This was already in an earlier migration file, but if that specific
-- migration was never run against your live project (as opposed to
-- MASTER_ALL.sql), follow/like/comment notifications insert silently
-- fail with zero error shown anywhere — which matches "follow notification
-- doesn't even show up." Run this once to be certain either way.
-- Safe to re-run — every statement is idempotent.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  post_id uuid references public.posts(id) on delete cascade,
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notif_read" on public.notifications;
create policy "notif_read" on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notif_update" on public.notifications;
create policy "notif_update" on public.notifications
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "notif_insert" on public.notifications;
create policy "notif_insert" on public.notifications
  for insert to authenticated with check (true);
