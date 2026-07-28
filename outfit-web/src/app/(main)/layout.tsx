import { BottomNav } from "@/components/BottomNav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Fail fast if Supabase is paused / unreachable instead of hanging the page.
  const authResult = await Promise.race([
    supabase.auth.getUser(),
    new Promise<{ data: { user: null }; error: { message: string } }>((resolve) =>
      setTimeout(
        () => resolve({ data: { user: null }, error: { message: "Auth timed out" } }),
        8000
      )
    ),
  ]);

  const user = authResult.data.user;

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">My Wardrobe</p>
            <p className="text-sm font-medium text-zinc-800 truncate max-w-[220px]">
              {user.email}
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1 px-4 pb-32 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
