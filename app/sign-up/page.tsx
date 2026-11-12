import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AuthShell from "@/components/account/AuthShell";
import AuthForm from "@/components/account/AuthForm";
import { getAccount } from "@/lib/account/server";
import { allowOpenSignup } from "@/lib/account/auth-mode";
import Link from "next/link";

export const metadata: Metadata = { title: "Create account | Casevex" };

export default async function Page() {
  const account = await getAccount();
  if (account.user)
    redirect(account.profile?.onboardedAt ? "/" : "/onboarding");
  if (!allowOpenSignup())
    return (
      <AuthShell>
        <h1>Casevex is invite-only</h1>
        <p className="muted">
          Ask your firm&apos;s Casevex administrator to invite you, then open
          the link in that email.
        </p>
        <Link href="/sign-in">Back to sign in</Link>
      </AuthShell>
    );
  return (
    <AuthShell>
      <Suspense>
        <AuthForm kind="sign-up" mode={account.mode} />
      </Suspense>
    </AuthShell>
  );
}
