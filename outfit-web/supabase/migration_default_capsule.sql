-- Run in Supabase Dashboard → SQL Editor after migration_capsules.sql

alter table public.capsules
  add column if not exists is_default boolean not null default false;

create unique index if not exists capsules_one_default_per_user
  on public.capsules (user_id)
  where (is_default = true);
