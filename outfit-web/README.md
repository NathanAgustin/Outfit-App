# Outfit App (Web)

Mobile-first web version of the Outfit App with **user accounts** and **cloud storage** via [Supabase](https://supabase.com).

## Features

- Email/password sign up and sign in
- Closet: upload clothing photos, categorize, edit, delete
- Outfit Manager: pick top/bottom/shoes/accessories, save/load/rename/delete outfits
- Custom outfit preview photos (defaults to top image)
- Data stored per user in Supabase (database + image storage)
- iPhone-friendly layout with bottom tab navigation
- PWA manifest for Add to Home Screen

## Prerequisites

1. [Node.js](https://nodejs.org) 18+
2. A free [Supabase](https://supabase.com) project

## 1. Set up Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Open **SQL Editor** and run the full script in `supabase/schema.sql`
3. Open **Storage** and confirm bucket `clothing-images` exists (public)
4. Open **Authentication → Providers** and ensure **Email** is enabled
5. (Recommended) Under **Authentication → URL Configuration**, set:
   - **Site URL**: `http://localhost:3000` (change to your production URL later)
   - **Redirect URLs**: add `http://localhost:3000/auth/callback`
6. Copy your project URL and anon key from **Project Settings → API**

## 2. Configure environment

```bash
cd outfit-web
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone (same Wi‑Fi) or in Safari.

## 4. Publish online (Vercel)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the repo
3. Set **Root Directory** to `outfit-web`
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy
6. In Supabase **Authentication → URL Configuration**, update:
   - **Site URL**: `https://your-app.vercel.app`
   - **Redirect URLs**: add `https://your-app.vercel.app/auth/callback`

Share the Vercel URL. Users sign up with email/password; their closet and outfits stay tied to their account.

## Add to iPhone Home Screen

1. Open your site in **Safari**
2. Tap **Share → Add to Home Screen**

## Project structure

```
outfit-web/
├── src/app/(main)/closet/     # Closet tab
├── src/app/(main)/outfits/    # Outfit Manager tab
├── src/app/login/             # Sign in / sign up
├── src/components/            # UI components
├── src/lib/supabase/          # Auth + database client
├── src/lib/storage.ts         # Image upload helpers
└── supabase/schema.sql        # Database + storage setup
```

## Notes

- Images are compressed in the browser before upload
- Each user only sees their own data (Row Level Security)
- The original iOS Swift app in `Outfit App/` is unchanged; this web app is a separate codebase in `outfit-web/`
