"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: { ok?: boolean; error?: string } = {};
      try {
        data = await response.json();
      } catch {
        setMessage(
          response.ok
            ? "Unexpected server response. Try again."
            : "The app server returned an error. If this is your Vercel site, check Environment Variables and Root Directory (outfit-web), then redeploy."
        );
        return;
      }

      if (!response.ok) {
        setMessage(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (mode === "signup") {
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        router.push("/closet");
        router.refresh();
      }
    } catch {
      const isLocal = window.location.hostname === "localhost";
      setMessage(
        isLocal
          ? "Could not reach the server. Run npm run dev in outfit-web, then open http://localhost:3000 in Safari or Chrome."
          : "Could not reach the server. Check your internet connection and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Outfit App</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Manage your closet and outfits online. Sign in to keep your data synced.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-lg py-2 text-sm font-medium ${
            mode === "signin" ? "bg-white shadow-sm" : "text-zinc-600"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-lg py-2 text-sm font-medium ${
            mode === "signup" ? "bg-white shadow-sm" : "text-zinc-600"
          }`}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-zinc-400"
            autoComplete="email"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-700">Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-base outline-none focus:border-zinc-400"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>

        {message && (
          <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{message}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
