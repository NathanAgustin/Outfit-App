import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Edge middleware must stay fast. Reading the session from cookies avoids a
 * network round-trip to Supabase (which times out when a free project is paused).
 * Server layouts still call getUser() for stronger validation.
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  if ("error" in env) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Local JWT check only — do not call getUser() here (network / pause → 504).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const hasSession = Boolean(session?.user);

  const path = request.nextUrl.pathname;
  const isPublicRoute =
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/api/auth");

  if (!hasSession && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/closet";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
