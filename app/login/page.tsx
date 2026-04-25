"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Phase = "request_code" | "verify_code";

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
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("request_code");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resentNotice, setResentNotice] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_failed") {
      setError("Anmeldung fehlgeschlagen. Fordere einen neuen Code an.");
    }
  }, []);

  useEffect(() => {
    if (phase !== "verify_code") return;
    const raf = requestAnimationFrame(() => codeInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  async function requestCode(targetEmail: string): Promise<string | null> {
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: undefined,
      },
    });
    return signInError?.message ?? null;
  }

  async function handleRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResentNotice(false);

    const message = await requestCode(email);
    setLoading(false);

    if (message) {
      setError(message);
      return;
    }

    setCode("");
    setPhase("verify_code");
  }

  async function handleVerifySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 8) return;

    setLoading(true);
    setError(null);
    setResentNotice(false);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    setLoading(false);

    if (verifyError) {
      setError("Code falsch oder abgelaufen.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function handleResend() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResentNotice(false);

    const message = await requestCode(email);
    setLoading(false);

    if (message) {
      setError(message);
      return;
    }
    setResentNotice(true);
  }

  function handleChangeEmail() {
    setPhase("request_code");
    setCode("");
    setError(null);
    setResentNotice(false);
  }

  function handleCodeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const cleaned = event.target.value.replace(/\D/g, "").slice(0, 8);
    setCode(cleaned);
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

        {phase === "request_code" ? (
          <form
            onSubmit={handleRequestSubmit}
            className="card space-y-5"
            noValidate
          >
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-bold">
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
              {loading ? "Wird gesendet…" : "Code anfordern"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleVerifySubmit}
            className="card space-y-5"
            noValidate
          >
            <div className="space-y-2">
              <p className="text-sm">
                Wir haben dir einen 8-stelligen Code an{" "}
                <span className="font-bold break-all">{email}</span>{" "}
                geschickt.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="code" className="block text-sm font-bold">
                Code
              </label>
              <input
                ref={codeInputRef}
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                autoComplete="one-time-code"
                autoCorrect="off"
                spellCheck={false}
                value={code}
                onChange={handleCodeChange}
                placeholder="12345678"
                className="input-bold text-center text-2xl font-bold tracking-[0.3em] tabular-nums sm:text-3xl"
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
            </div>

            {resentNotice && !error && (
              <div
                role="status"
                className="rounded-lg border-2 border-teal bg-teal/15 p-3 text-sm font-medium text-teal-dark"
              >
                Neuen Code geschickt. Schau noch mal ins Postfach.
              </div>
            )}

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
              disabled={loading || code.length !== 8}
              className="btn-primary w-full"
            >
              {loading ? "Prüfe…" : "Anmelden"}
            </button>

            <div className="flex flex-col items-center gap-2 pt-2 text-sm">
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="font-medium text-teal-dark underline-offset-2 hover:underline disabled:opacity-50"
              >
                Code erneut senden
              </button>
              <button
                type="button"
                onClick={handleChangeEmail}
                disabled={loading}
                className="font-medium text-ink-soft underline-offset-2 hover:underline disabled:opacity-50"
              >
                Andere E-Mail verwenden
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-ink-soft mt-6">
          Keine Registrierung nötig.
        </p>
      </div>
    </main>
  );
}
