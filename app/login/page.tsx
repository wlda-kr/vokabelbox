"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function HeaderDecoration() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-center gap-4 mb-8"
    >
      <svg viewBox="0 0 40 40" className="h-8 w-8">
        <path
          d="M20 4 L24 16 L36 20 L24 24 L20 36 L16 24 L4 20 L16 16 Z"
          fill="#f4c542"
          stroke="#1a2a3a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <svg viewBox="0 0 48 48" className="h-10 w-10 -rotate-12">
        <circle
          cx="24"
          cy="24"
          r="10"
          fill="#e04832"
          stroke="#1a2a3a"
          strokeWidth="2.5"
        />
        <g stroke="#1a2a3a" strokeWidth="2.5" strokeLinecap="round">
          <line x1="24" y1="2" x2="24" y2="8" />
          <line x1="24" y1="40" x2="24" y2="46" />
          <line x1="2" y1="24" x2="8" y2="24" />
          <line x1="40" y1="24" x2="46" y2="24" />
          <line x1="8" y1="8" x2="13" y2="13" />
          <line x1="35" y1="35" x2="40" y2="40" />
          <line x1="40" y1="8" x2="35" y2="13" />
          <line x1="13" y1="35" x2="8" y2="40" />
        </g>
      </svg>
      <svg viewBox="0 0 32 32" className="h-7 w-7 rotate-12">
        <circle
          cx="16"
          cy="16"
          r="11"
          fill="#1e9b8a"
          stroke="#1a2a3a"
          strokeWidth="2.5"
        />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_failed") {
      setError("Anmeldung fehlgeschlagen. Bitte fordere einen neuen Link an.");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-cream">
      <div className="w-full max-w-md">
        <HeaderDecoration />

        <h1 className="font-display text-5xl md:text-6xl font-bold text-center text-navy mb-3 -rotate-2">
          Vokabelbox
        </h1>
        <p className="text-center text-ink-soft mb-8">
          Lerne Spanisch, bevor die Prüfung dich lernt.
        </p>

        {sent ? (
          <div className="card bg-sunshine text-center space-y-2">
            <p className="font-display text-xl font-bold">
              Schau in dein Postfach.
            </p>
            <p className="text-sm">Der Link ist 15 Minuten gültig.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-5" noValidate>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-bold"
              >
                E-Mail-Adresse
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="deine@email.de"
                className="input-bold"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border-2 border-tomato bg-tomato/10 p-3 text-sm font-medium text-tomato-dark"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="btn-primary w-full"
            >
              {loading ? "Wird gesendet…" : "Login-Link senden"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-ink-soft mt-6">
          Keine Registrierung nötig.
        </p>
      </div>
    </main>
  );
}
