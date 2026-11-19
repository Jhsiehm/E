"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { saveProfile } from "@/lib/account/actions";
import { buildLayout, type WorkspaceLayout } from "@/lib/account/layout";
import { ACCENTS, type Profile } from "@/lib/account/profile";
import { applyDisplay } from "@/lib/account/display";
import type { AuthMode } from "@/lib/account/auth-mode";

type AccountValue = {
  mode: AuthMode;
  prototype: boolean;
  profile: Profile;
  layout: WorkspaceLayout;
  /** Saves on the server, then updates the sidebar and dashboard in place. */
  save: (p: Profile) => Promise<string | null>;
};

const AccountContext = createContext<AccountValue | null>(null);

/**
 * Holds the signed-in profile for the workspace. The server layout passes the
 * profile in, so the shell renders immediately with no extra client fetch.
 */
export function AccountProvider({
  mode,
  prototype = false,
  initial,
  children,
}: {
  mode: AuthMode;
  prototype?: boolean;
  initial: Profile;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState(initial);
  const layout = useMemo(() => buildLayout(profile), [profile]);
  // Display settings saved to the account win over this browser's cookie,
  // so a new computer picks them up on the first signed-in page.
  const display = profile.layout.display;
  useEffect(() => {
    if (display) applyDisplay(display);
  }, [display]);
  const save = useCallback(async (p: Profile) => {
    const res = await saveProfile(p);
    if (!res.ok) return res.error;
    setProfile(res.profile);
    return null;
  }, []);
  const value = useMemo(
    () => ({ mode, prototype, profile, layout, save }),
    [mode, prototype, profile, layout, save],
  );
  return (
    <AccountContext.Provider value={value}>
      <div
        className={"account-root density-" + profile.density}
        style={
          {
            "--accent": ACCENTS[profile.accent],
            "--avatar": ACCENTS[profile.avatarColor],
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountValue {
  const v = useContext(AccountContext);
  if (!v) throw new Error("useAccount must be used inside <AccountProvider>");
  return v;
}
