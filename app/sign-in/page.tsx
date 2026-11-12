import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import AuthShell from "@/components/account/AuthShell";
import AuthForm from "@/components/account/AuthForm";
import { getAccount } from "@/lib/account/server";
import { allowOpenSignup } from "@/lib/account/auth-mode";

export const metadata: Metadata = { title: "Sign in | Casevex" };

export default async function Page() {
  const account = await getAccount();
  if (account.user)
    redirect(account.profile?.onboardedAt ? "/" : "/onboarding");
  return (
    <AuthShell>
      <Suspense>
        <AuthForm
          kind="sign-in"
          mode={account.mode}
          openSignup={allowOpenSignup()}
        />
      </Suspense>
    </AuthShell>
  );
}
