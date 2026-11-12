import { Suspense, type ReactNode } from "react";
import { redirect } from "next/navigation";
import Workspace from "@/components/Workspace";
import { AccountProvider } from "@/components/account/AccountProvider";
import { getAccount } from "@/lib/account/server";

/**
 * The workspace lives in a layout so it stays mounted across client
 * navigations. Rendered from the catch-all page, it remounted on every route
 * change, refetched all state and flashed the boot screen between tabs.
 *
 * The profile is read here on the server and handed to the client, so the
 * personalized sidebar and dashboard need no extra request after first load,
 * and switching tabs never shows a loading screen.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const account = await getAccount();
  if (!account.user || !account.profile) redirect("/sign-in");
  if (!account.profile.onboardedAt) redirect("/onboarding");
  return (
    <AccountProvider mode={account.mode} initial={account.profile}>
      <Suspense fallback={<div className="boot">Opening Casevex…</div>}>
        <Workspace />
      </Suspense>
      {children}
    </AccountProvider>
  );
}
