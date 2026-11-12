"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { saveProfile } from "@/lib/account/actions";
import { buildLayout, type WorkspaceLayout } from "@/lib/account/layout";
import { ACCENTS, type Profile } from "@/lib/account/profile";
import type { AuthMode } from "@/lib/account/auth-mode";

type AccountValue = {
  mode: AuthMode;
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
  initial,
  children,
}: {
  mode: AuthMode;
  initial: Profile;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState(initial);
  const layout = useMemo(() => buildLayout(profile), [profile]);
  const save = useCallback(async (p: Profile) => {
    const res = await saveProfile(p);
    if (!res.ok) return res.error;
    setProfile(res.profile);
    return null;
  }, []);
  const value = useMemo(
    () => ({ mode, profile, layout, save }),
    [mode, profile, layout, save],
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
