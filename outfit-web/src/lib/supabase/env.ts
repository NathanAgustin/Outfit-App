export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return {
      error: "Missing Supabase env vars in .env.local. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart npm run dev.",
    };
  }

  if (url.includes("your-project") || url.includes("YOUR_PROJECT")) {
    return {
      error:
        "Supabase URL is still the placeholder. Paste your Project URL from Supabase → Settings → API into .env.local, then restart npm run dev (Ctrl+C, then npm run dev).",
    };
  }

  return { url, key };
}
