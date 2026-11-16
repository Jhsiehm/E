import { redirect } from "next/navigation";
import type { Metadata } from "next";
import OnboardingFlow from "@/components/account/OnboardingFlow";
import { getAccount } from "@/lib/account/server";
import { allowOpenSignup } from "@/lib/account/auth-mode";

export const metadata: Metadata = { title: "Set up Casevex" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redo?: string; workspace?: string }>;
}) {
  const account = await getAccount();
  if (!account.user || !account.profile) redirect("/sign-in");
  const params = await searchParams;
  const needsWorkspace = params.workspace === "1" && allowOpenSignup();
  if (account.profile.onboardedAt && !params.redo && !needsWorkspace)
    redirect("/");
  return (
    <OnboardingFlow initial={account.profile} needsWorkspace={needsWorkspace} />
  );
}
