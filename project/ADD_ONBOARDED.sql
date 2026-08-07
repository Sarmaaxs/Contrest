-- Tracks whether a user has been through the first-run setup wizard.
-- Safe to run even if already applied.
-- Run in Supabase → SQL Editor → New query → Run.

alter table public.profiles
  add column if not exists onboarded boolean not null default false;
