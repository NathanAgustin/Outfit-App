-- Run this entire script in Supabase Dashboard → SQL Editor → New query → Run

-- ========== TABLES ==========

create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  category text not null check (category in ('tops', 'bottoms', 'shoes', 'accessories')),
  image_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists clothing_items_user_id_idx on public.clothing_items (user_id);
create index if not exists clothing_items_category_idx on public.clothing_items (user_id, category);

alter table public.clothing_items enable row level security;

drop policy if exists "Users manage own clothing" on public.clothing_items;
create policy "Users manage own clothing"
  on public.clothing_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.saved_outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  top_id uuid not null references public.clothing_items(id) on delete cascade,
  bottom_id uuid not null references public.clothing_items(id) on delete cascade,
  shoes_id uuid not null references public.clothing_items(id) on delete cascade,
  accessory_ids uuid[] not null default '{}',
  preview_image_path text,
  date_modified timestamptz not null default now()
);

create index if not exists saved_outfits_user_id_idx on public.saved_outfits (user_id);

alter table public.saved_outfits enable row level security;

drop policy if exists "Users manage own outfits" on public.saved_outfits;
create policy "Users manage own outfits"
  on public.saved_outfits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ========== STORAGE ==========

insert into storage.buckets (id, name, public)
values ('clothing-images', 'clothing-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read clothing images" on storage.objects;
create policy "Public read clothing images"
  on storage.objects for select
  using (bucket_id = 'clothing-images');

drop policy if exists "Users upload own images" on storage.objects;
create policy "Users upload own images"
  on storage.objects for insert
  with check (
    bucket_id = 'clothing-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users update own images" on storage.objects;
create policy "Users update own images"
  on storage.objects for update
  using (
    bucket_id = 'clothing-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users delete own images" on storage.objects;
create policy "Users delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'clothing-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
