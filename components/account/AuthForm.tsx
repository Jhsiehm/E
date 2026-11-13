"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { replayIntroNextLoad } from "@/components/IntroSplash";
import Icon from "@/components/Icon";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { demoSignIn } from "@/lib/account/actions";
import { safeNext } from "@/lib/account/safe-next";
import type { AuthMode } from "@/lib/account/auth-mode";

type Kind = "sign-in" | "sign-up";

const LINK_ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Request a new one.",
};

export default function AuthForm({
  kind,
  mode,
  openSignup = true,
}: {
  kind: Kind;
  mode: AuthMode;
  openSignup?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const fallback = kind === "sign-up" ? "/onboarding" : "/";
  const next =
    typeof window === "undefined"
      ? fallback
      : safeNext(params.get("next"), window.location.origin, fallback);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(
    LINK_ERRORS[params.get("error") ?? ""] ?? "",
  );
  const [sent, setSent] = useState("");
  // Whatever way they sign in from here, the workspace opens with the intro.
  useEffect(replayIntroNextLoad, []);
  const google = process.env.NEXT_PUBLIC_SUPABASE_GOOGLE === "on";

  const callback = (to: string) =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(to)}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = supabaseBrowser();
      if (kind === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error)
          throw new Error("That email and password don't match an account.");
        router.replace(next);
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: callback("/onboarding"),
          },
        });
        if (error) throw new Error(error.message);
        if (data.session) {
          router.replace("/onboarding");
          router.refresh();
        } else
          setSent(
            `We sent a confirmation link to ${email}. Open it to finish creating your account.`,
          );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email) return setError("Enter your email first.");
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback(next), shouldCreateUser: false },
    });
    setBusy(false);
    if (error)
      setError(
        "We couldn't send a link to that address. Check it and try again.",
      );
    else setSent(`Check ${email} for a sign-in link.`);
  }

  async function withGoogle() {
    await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback(next) },
    });
  }

  const title = kind === "sign-in" ? "Sign in" : "Create your account";

  if (mode === "unconfigured")
    return (
      <>
        <h1>{title}</h1>
        <p className="muted">
          Sign-in isn&apos;t set up for this deployment yet. An administrator
          needs to connect Supabase.
        </p>
      </>
    );

  if (mode === "demo")
    return (
      <>
        <p className="eyebrow">Demo workspace</p>
        <h1>{title}</h1>
        <p className="muted">
          This preview uses sample matters. Continue with the demo account to
          walk through onboarding; nothing you enter leaves this browser.
        </p>
        <form action={demoSignIn}>
          <button className="primary wide">
            Continue with the demo account <Icon name="arrow" size={16} />
          </button>
        </form>
      </>
    );

  if (sent)
    return (
      <>
        <h1>Check your email</h1>
        <p className="muted" role="status">
          {sent}
        </p>
        <button className="text-button" onClick={() => setSent("")}>
          Use a different email
        </button>
      </>
    );

  return (
    <>
      <h1>{title}</h1>
      <p className="muted">
        {kind === "sign-in"
          ? "Welcome back. Sign in to your firm's workspace."
          : "Set up Casevex around your practice in about two minutes."}
      </p>
      {google && (
        <>
          <button type="button" className="wide" onClick={withGoogle}>
            Continue with Google
          </button>
          <div className="auth-or">
            <span>or</span>
          </div>
        </>
      )}
      <form className="auth-form" onSubmit={submit}>
        {kind === "sign-up" && (
          <label>
            Full name
            <input
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          Work email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={kind === "sign-up" ? 10 : undefined}
            autoComplete={
              kind === "sign-in" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {kind === "sign-up" && <small>At least 10 characters.</small>}
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary wide" disabled={busy}>
          {busy ? "One moment…" : title}
        </button>
      </form>
      {kind === "sign-in" ? (
        <div className="auth-links">
          <button
            type="button"
            className="text-button"
            onClick={magicLink}
            disabled={busy}
          >
            Email me a sign-in link instead
          </button>
          {openSignup ? (
            <span>
              New to Casevex? <Link href="/sign-up">Create an account</Link>
            </span>
          ) : (
            <span>
              New to Casevex? Ask your firm administrator for an invite.
            </span>
          )}
        </div>
      ) : (
        <div className="auth-links">
          <span>
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </span>
        </div>
      )}
    </>
  );
}
