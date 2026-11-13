"use client";
import {
  AI_EXPERIENCE,
  PERSONAS,
  type AiExperience,
  type Persona,
} from "@/lib/account/profile";
import { type Edit } from "./shared";

export function AboutFields({ value, onChange }: Edit) {
  const zones = timeZones();
  return (
    <div className="form-grid">
      <label>
        Full name
        <input
          required
          autoComplete="name"
          value={value.fullName}
          onChange={(e) => onChange({ ...value, fullName: e.target.value })}
        />
      </label>
      <label>
        Job title
        <input
          placeholder="Partner, associate, paralegal…"
          value={value.jobTitle}
          onChange={(e) => onChange({ ...value, jobTitle: e.target.value })}
        />
        <small>
          Shown to colleagues. It doesn&apos;t change what you can access.
        </small>
      </label>
      <label>
        Firm name
        <input
          autoComplete="organization"
          value={value.firmName}
          onChange={(e) => onChange({ ...value, firmName: e.target.value })}
        />
      </label>
      <label>
        Time zone
        <select
          value={value.timeZone}
          onChange={(e) => onChange({ ...value, timeZone: e.target.value })}
        >
          {(zones.includes(value.timeZone)
            ? zones
            : [value.timeZone, ...zones]
          ).map((z) => (
            <option key={z}>{z}</option>
          ))}
        </select>
      </label>
      <div className="full">
        <span className="field-label">What best describes you?</span>
        <div
          className="segmented wrap"
          role="radiogroup"
          aria-label="What best describes you"
        >
          {(Object.keys(PERSONAS) as Persona[]).map((k) => (
            <button
              type="button"
              role="radio"
              aria-checked={value.persona === k}
              key={k}
              className={value.persona === k ? "selected" : ""}
              onClick={() => onChange({ ...value, persona: k })}
            >
              {PERSONAS[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="full">
        <span className="field-label">
          How comfortable are you with AI tools?
        </span>
        <div
          className="segmented wrap"
          role="radiogroup"
          aria-label="How comfortable are you with AI tools"
        >
          {(Object.keys(AI_EXPERIENCE) as AiExperience[]).map((k) => (
            <button
              type="button"
              role="radio"
              aria-checked={value.aiExperience === k}
              key={k}
              className={value.aiExperience === k ? "selected" : ""}
              onClick={() => onChange({ ...value, aiExperience: k })}
            >
              {AI_EXPERIENCE[k]}
            </button>
          ))}
        </div>
        <small>
          There&apos;s no wrong answer. Casevex starts simpler if you&apos;re
          new and you can change this any time.
        </small>
      </div>
    </div>
  );
}

function timeZones(): string[] {
  try {
    const all = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (all?.length)
      return all.filter(
        (z) =>
          z.startsWith("America/") ||
          z.startsWith("Europe/") ||
          z.startsWith("Asia/") ||
          z.startsWith("Pacific/") ||
          z === "UTC",
      );
  } catch {}
  return [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "UTC",
  ];
}
