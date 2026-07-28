-- Run this in Supabase Dashboard → SQL Editor (for existing projects)

-- Allow new clothing categories
alter table public.clothing_items drop constraint if exists clothing_items_category_check;
alter table public.clothing_items
  add constraint clothing_items_category_check
  check (category in ('tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories'));

-- Make outfit slots optional + add dress / outerwear
alter table public.saved_outfits
  alter column top_id drop not null,
  alter column bottom_id drop not null,
  alter column shoes_id drop not null;

alter table public.saved_outfits
  add column if not exists dress_id uuid references public.clothing_items(id) on delete cascade,
  add column if not exists outerwear_id uuid references public.clothing_items(id) on delete cascade;
