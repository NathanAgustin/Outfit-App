-- Run this entire script in Supabase Dashboard → SQL Editor → New query → Run
-- (for brand-new projects). Existing projects should run:
--   migration_dress_outerwear_optional_slots.sql
--   migration_capsules.sql

-- ========== TABLES ==========

create table if not exists public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  category text not null check (category in ('tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories')),
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
  name text not null default '',
  top_id uuid references public.clothing_items(id) on delete cascade,
  bottom_id uuid references public.clothing_items(id) on delete cascade,
  dress_id uuid references public.clothing_items(id) on delete cascade,
  outerwear_id uuid references public.clothing_items(id) on delete cascade,
  shoes_id uuid references public.clothing_items(id) on delete cascade,
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

create table if not exists public.capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cover_image_path text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists capsules_user_id_idx on public.capsules (user_id, sort_order);

alter table public.capsules enable row level security;

drop policy if exists "Users manage own capsules" on public.capsules;
create policy "Users manage own capsules"
  on public.capsules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.capsule_outfits (
  capsule_id uuid not null references public.capsules(id) on delete cascade,
  outfit_id uuid not null references public.saved_outfits(id) on delete cascade,
  sort_order int not null default 0,
  primary key (capsule_id, outfit_id)
);

create index if not exists capsule_outfits_outfit_id_idx on public.capsule_outfits (outfit_id);
create index if not exists capsule_outfits_order_idx on public.capsule_outfits (capsule_id, sort_order);

alter table public.capsule_outfits enable row level security;

drop policy if exists "Users manage own capsule outfits" on public.capsule_outfits;
create policy "Users manage own capsule outfits"
  on public.capsule_outfits
  for all
  using (
    exists (
      select 1 from public.capsules c
      where c.id = capsule_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.capsules c
      where c.id = capsule_id and c.user_id = auth.uid()
    )
  );

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
