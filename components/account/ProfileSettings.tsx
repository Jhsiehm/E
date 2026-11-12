"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import Icon from "@/components/Icon";
import { Card } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";
import { signOut } from "@/lib/account/actions";
import { initials, type Profile } from "@/lib/account/profile";
import { PRESETS, presetFor } from "@/lib/account/layout";
import { useAccount } from "./AccountProvider";
import {
  AboutFields,
  AreaPicker,
  JurisdictionPicker,
  LayoutEditor,
  NichePicker,
  SwatchPicker,
} from "./ProfileFields";

/** Settings → Profile, Practice and Layout, all editing the same profile. */
export default function ProfileSettings({
  section,
}: {
  section: "profile" | "practice" | "layout";
}) {
  const { profile, save, mode } = useAccount();
  const { notify, open } = useWorkspace();
  const [draft, setDraft] = useState<Profile>(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const presetChanged =
    presetFor(draft.primaryArea) !== presetFor(profile.primaryArea);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.fullName.trim()) return setError("Add your name.");
    if (!draft.practiceAreas.length)
      return setError("Pick at least one practice area.");
    setBusy(true);
    setError("");
    const err = await save(draft);
    setBusy(false);
    if (err) setError(err);
    else notify("Profile saved.");
  }

  return (
    <Card
      className="page-body settings-card"
      title={
        section === "profile"
          ? "Profile"
          : section === "practice"
            ? "Practice focus"
            : "Layout"
      }
      action={
        section === "profile" ? (
          <form action={signOut}>
            <button>Sign out</button>
          </form>
        ) : undefined
      }
    >
      <form className="profile-form scroll" onSubmit={submit}>
        {section === "profile" && (
          <>
            <div className="profile-avatar">
              <span className="avatar large">
                {initials(draft.fullName, draft.email)}
              </span>
              <span className="grow">
                <b>{draft.fullName || "Your account"}</b>
                <small>
                  {draft.email}
                  {mode === "demo" && " · Demo account, saved in this browser"}
                </small>
              </span>
            </div>
            <AboutFields value={draft} onChange={setDraft} />
            <div className="form-grid">
              <div>
                <span className="field-label">Avatar and highlight color</span>
                <SwatchPicker
                  label="Avatar and highlight color"
                  value={draft.accent}
                  onChange={(accent) =>
                    setDraft({ ...draft, accent, avatarColor: accent })
                  }
                />
              </div>
              <div>
                <span className="field-label">Density</span>
                <div className="segmented">
                  {(["comfortable", "compact"] as const).map((d) => (
                    <button
                      type="button"
                      key={d}
                      className={draft.density === d ? "selected" : ""}
                      onClick={() => setDraft({ ...draft, density: d })}
                    >
                      {d === "comfortable" ? "Comfortable" : "Compact"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="motion-preview-link">
              <button
                type="button"
                className="text-button"
                onClick={() => open("motion")}
              >
                Preview research animation <Icon name="arrow" size={16} />
              </button>
              <small>
                Email changes go through a confirmation link.{" "}
                <Link href="/onboarding?redo=1">Run setup again</Link>
              </small>
            </div>
          </>
        )}
        {section === "practice" && (
          <>
            <h3>Practice areas</h3>
            <AreaPicker value={draft} onChange={setDraft} />
            <h3>Niches</h3>
            <NichePicker value={draft} onChange={setDraft} />
            <h3>Courts and jurisdictions</h3>
            <JurisdictionPicker value={draft} onChange={setDraft} />
            {presetChanged && (
              <div className="notice-inline" role="status">
                Your primary area now suggests the{" "}
                {PRESETS[presetFor(draft.primaryArea)].label.toLowerCase()}{" "}
                layout.
                {draft.layout.navOrder || draft.layout.dashboardCards ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setDraft({ ...draft, layout: {} })}
                  >
                    Use it
                  </button>
                ) : (
                  " It will apply when you save."
                )}
              </div>
            )}
          </>
        )}
        {section === "layout" && (
          <LayoutEditor value={draft} onChange={setDraft} />
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={() => setDraft(profile)}
          >
            Cancel
          </button>
          <button className="primary" disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Card>
  );
}
