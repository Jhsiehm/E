"use client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { areas, label } from "@/components/workspace/format";
import { Chip, Card } from "@/components/workspace/ui";
import { Header } from "@/components/workspace/shared";
import { useWorkspace } from "@/components/workspace/context";

/** Settings sections. */
export default function SettingsPage() {
  const { parts, data, busy, profile, setProfile, notify, mutate, open } =
    useWorkspace();
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
      {section === "profile" && profile ? (
        <Card className="page-body settings-card" title="Profile">
          <form
            className="profile-form scroll"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await mutate("me", profile, "PATCH"))
                notify("Profile saved.");
            }}
          >
            <div className="motion-preview-link">
              <button
                type="button"
                className="text-button"
                onClick={() => open("motion")}
              >
                Preview research animation <Icon name="arrow" size={16} />
              </button>
              <small>Adapted from your phone prototype</small>
            </div>
            <div className="profile-avatar">
              <span className="avatar large">
                {profile.name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span>
                <b>Your account</b>
                <small>
                  Demo profile · Changes last for this server session
                </small>
              </span>
            </div>
            <div className="form-grid">
              <label>
                Full name
                <input
                  required
                  value={profile.name}
                  onChange={(e) =>
                    setProfile({ ...profile, name: e.target.value })
                  }
                />
              </label>
              <label>
                Role
                <select
                  value={profile.role}
                  onChange={(e) =>
                    setProfile({ ...profile, role: e.target.value })
                  }
                >
                  {["Partner", "Associate", "Paralegal", "Admin"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="full">
                Email
                <input
                  type="email"
                  required
                  value={profile.email}
                  onChange={(e) =>
                    setProfile({ ...profile, email: e.target.value })
                  }
                />
              </label>
              <div className="full">
                <label>Display</label>
                <div className="segmented">
                  {["light", "dark"].map((t) => (
                    <button
                      type="button"
                      key={t}
                      className={profile.theme === t ? "selected" : ""}
                      onClick={() => {
                        setProfile({ ...profile, theme: t });
                        if (t === "dark")
                          notify(
                            "Dark preference saved on submit. Dark styling is planned.",
                          );
                      }}
                    >
                      {label(t)}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                Default practice area
                <select
                  value={profile.defaultPracticeArea}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      defaultPracticeArea: e.target.value,
                    })
                  }
                >
                  {areas.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Time zone
                <select
                  value={profile.timeZone}
                  onChange={(e) =>
                    setProfile({ ...profile, timeZone: e.target.value })
                  }
                >
                  {[
                    "America/New_York",
                    "America/Chicago",
                    "America/Denver",
                    "America/Los_Angeles",
                    "Europe/London",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-footer">
              <button type="button" onClick={() => setProfile(data.me)}>
                Cancel
              </button>
              <button
                className="primary"
                disabled={
                  busy || JSON.stringify(profile) === JSON.stringify(data.me)
                }
              >
                Save changes
              </button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className="page-body" title={label(section)}>
          <h2>
            {section === "workspace"
              ? "Wells & Associates"
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
