"use client";
import Link from "next/link";
import { label } from "@/components/workspace/format";
import { Chip, Card } from "@/components/workspace/ui";
import { Header } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";
import { useAccount } from "@/components/account/AccountProvider";
import ProfileSettings from "@/components/account/ProfileSettings";

/** Settings sections. */
export default function SettingsPage() {
  const { parts, setProfile, notify, mutate } = useWorkspace();
  const account = useAccount();
  const section = parts[1] || "profile";
  return (
    <>
      <Header
        title="Settings"
        subtitle="Manage your account, workspace, and preferences."
      />
      <div className="tabs">
        {[
          "profile",
          "practice",
          "layout",
          "workspace",
          "notifications",
          "integrations",
          "security",
        ].map((t) => (
          <Link
            key={t}
            href={"/settings/" + t}
            className={section === t ? "active" : ""}
          >
            {label(t)}
          </Link>
        ))}
      </div>
      {["profile", "practice", "layout"].includes(section) ? (
        <ProfileSettings
          section={section as "profile" | "practice" | "layout"}
        />
      ) : (
        <Card className="page-body" title={label(section)}>
          <h2>
            {section === "workspace"
              ? account.profile.firmName || "Your firm"
              : section === "security"
                ? "Access and security"
                : section === "integrations"
                  ? "Connected services"
                  : "Notification preferences"}
          </h2>
          <p>
            {section === "workspace"
              ? "A sample workspace for litigation research."
              : section === "security"
                ? "Authentication, matter permissions, and audit logging are planned for the backend."
                : section === "integrations"
                  ? "Court feeds, document storage, and calendar connections are not connected in this prototype."
                  : "Email, in-app alerts, and digest delivery will be configurable in the production app."}
          </p>
          <Chip>Planned for backend</Chip>
          <p>
            See the backend plan in the repository for scope, data contracts,
            and implementation phases.
          </p>
          {section === "workspace" && (
            <button
              onClick={async () => {
                if (await mutate("reset", {})) {
                  setProfile(null);
                  notify("Demo workspace reset.");
                }
              }}
            >
              Reset demo data
            </button>
          )}
        </Card>
      )}
    </>
  );
}
