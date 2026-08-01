-- Run in Supabase Dashboard → SQL Editor (existing projects)

-- Unnamed outfits in Closet (name kept for compatibility, defaults empty)
alter table public.saved_outfits
  alter column name set default '';

update public.saved_outfits set name = '' where name is null;

-- Capsules (photo-album style collections of outfits)
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
