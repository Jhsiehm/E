import { redirect } from "next/navigation";
import type { Metadata } from "next";
import OnboardingFlow from "@/components/account/OnboardingFlow";
import { getAccount } from "@/lib/account/server";

export const metadata: Metadata = { title: "Set up Casevex" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redo?: string }>;
}) {
  const account = await getAccount();
  if (!account.user || !account.profile) redirect("/sign-in");
  if (account.profile.onboardedAt && !(await searchParams).redo) redirect("/");
  return <OnboardingFlow initial={account.profile} />;
}
