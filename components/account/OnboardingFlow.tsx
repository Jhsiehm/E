"use client";
import Logo from "@/components/Logo";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { saveProfile, signOut } from "@/lib/account/actions";
import { buildLayout } from "@/lib/account/layout";
import type { Profile } from "@/lib/account/profile";
import {
  AboutFields,
  AreaPicker,
  JurisdictionPicker,
  LayoutEditor,
  NichePicker,
  SidebarPreview,
  SwatchPicker,
} from "./ProfileFields";

const STEPS = [
  ["About you", "So colleagues and your calendar know who you are."],
  ["Practice areas", "Casevex arranges itself around the work you do most."],
  ["Niches", "Pick the specialties you want research and alerts tuned to."],
  ["Courts", "Where you practice sets default jurisdictions for research."],
  ["Your workspace", "Here's the layout we built for you. Adjust anything."],
] as const;

/** Five-step onboarding. Everything here can be changed later in Settings. */
export default function OnboardingFlow({ initial }: { initial: Profile }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const last = step === STEPS.length - 1;
  const canContinue =
    step === 0
      ? draft.fullName.trim().length > 0
      : step === 1
        ? draft.practiceAreas.length > 0
        : true;
  const layout = buildLayout(draft);

  async function finish() {
    setBusy(true);
    setError("");
    const res = await saveProfile(draft, { finishOnboarding: true });
    if (!res.ok) {
      setBusy(false);
      return setError(res.error);
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="onboard">
      <aside className="onboard-rail">
        <Logo className="brand" />
        <ol>
          {STEPS.map(([name], i) => (
            <li
              key={name}
              className={i === step ? "current" : i < step ? "done" : ""}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="step-dot">{i < step ? "✓" : i + 1}</span>
              {i < step ? (
                <button type="button" onClick={() => setStep(i)}>
                  {name}
                </button>
              ) : (
                <span>{name}</span>
              )}
            </li>
          ))}
        </ol>
        <form action={signOut}>
          <button className="text-button rail-signout">Sign out</button>
        </form>
      </aside>
      <main className="onboard-main">
        <div className="onboard-body">
          <p className="eyebrow">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1>{STEPS[step][0]}</h1>
          <p className="subtitle">{STEPS[step][1]}</p>
          <div className="onboard-content">
            {step === 0 && <AboutFields value={draft} onChange={setDraft} />}
            {step === 1 && <AreaPicker value={draft} onChange={setDraft} />}
            {step === 2 && <NichePicker value={draft} onChange={setDraft} />}
            {step === 3 && (
              <JurisdictionPicker value={draft} onChange={setDraft} />
            )}
            {step === 4 && (
              <div className="workspace-step">
                <div className="preview-col">
                  <p className="eyebrow">Sidebar preview</p>
                  <SidebarPreview value={draft} />
                  <div className="prompt-preview">
                    <p className="eyebrow">
                      Suggested questions on your dashboard
                    </p>
                    <ul>
                      {layout.prompts.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="eyebrow">Highlight color</p>
                    <SwatchPicker
                      label="Highlight color"
                      value={draft.accent}
                      onChange={(accent) =>
                        setDraft({ ...draft, accent, avatarColor: accent })
                      }
                    />
                  </div>
                </div>
                <LayoutEditor value={draft} onChange={setDraft} />
              </div>
            )}
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="onboard-foot">
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            disabled={step === 0 || busy}
          >
            Back
          </button>
          <span className="grow" />
          {step > 1 && !last && (
            <button
              type="button"
              className="text-button"
              onClick={() => setStep(step + 1)}
            >
              Skip
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={!canContinue || busy}
            onClick={() => (last ? finish() : setStep(step + 1))}
          >
            {last ? (busy ? "Setting up…" : "Open my workspace") : "Continue"}{" "}
            <Icon name="arrow" size={16} />
          </button>
        </footer>
      </main>
    </div>
  );
}
