"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import {
  ACCENTS,
  AI_EXPERIENCE,
  PERSONAS,
  type AiExperience,
  type Persona,
  DASHBOARD_CARDS,
  JURISDICTIONS,
  PRACTICE_AREAS,
  type Accent,
  type DashboardCard,
  type NavKey,
  type PracticeArea,
  type Profile,
} from "@/lib/account/profile";
import { AGENT_STATUS_LABEL, practiceArea } from "@/lib/practice-areas";
import {
  CARD_LABELS,
  NAV_LABELS,
  PRESETS,
  buildLayout,
} from "@/lib/account/layout";

/* Form pieces shared by onboarding and Settings. Each edits a Profile draft. */

type Edit = { value: Profile; onChange: (p: Profile) => void };

function toggle<T>(list: T[], item: T, max = Infinity) {
  if (list.includes(item)) return list.filter((x) => x !== item);
  return list.length >= max ? list : [...list, item];
}

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

export function AreaPicker({ value, onChange }: Edit) {
  const set = (areas: PracticeArea[], primary = value.primaryArea) =>
    onChange({
      ...value,
      practiceAreas: areas,
      primaryArea:
        primary && areas.includes(primary) ? primary : (areas[0] ?? null),
    });
  return (
    <>
      <div className="pick-grid" role="group" aria-label="Practice areas">
        {PRACTICE_AREAS.map((a) => {
          const on = value.practiceAreas.includes(a);
          return (
            <button
              type="button"
              key={a}
              aria-pressed={on}
              className={"pick" + (on ? " on" : "")}
              disabled={!on && value.practiceAreas.length >= 3}
              onClick={() => set(toggle(value.practiceAreas, a, 3))}
            >
              <span>{practiceArea(a).label}</span>
              <small className={"agent-" + practiceArea(a).agentStatus}>
                {AGENT_STATUS_LABEL[practiceArea(a).agentStatus]}
              </small>
            </button>
          );
        })}
      </div>
      <p className="muted pick-note">
        Pick up to three. {value.practiceAreas.length}/3 selected. Every area
        shapes your layout; research agents open area by area as their sources
        are verified.
      </p>
      {value.practiceAreas.length > 1 && (
        <div className="primary-pick">
          <span className="eyebrow">Primary area</span>
          <div className="segmented">
            {value.practiceAreas.map((a) => (
              <button
                type="button"
                key={a}
                className={value.primaryArea === a ? "selected" : ""}
                onClick={() => set(value.practiceAreas, a)}
              >
                {practiceArea(a).label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function NichePicker({ value, onChange }: Edit) {
  const [custom, setCustom] = useState("");
  const suggested: string[] = value.practiceAreas.flatMap((a) => [
    ...practiceArea(a).niches,
  ]);
  const extra = value.niches.filter((n) => !suggested.includes(n));
  const add = () => {
    const n = custom.trim();
    if (n && !value.niches.includes(n) && value.niches.length < 24)
      onChange({ ...value, niches: [...value.niches, n] });
    setCustom("");
  };
  return (
    <>
      {value.practiceAreas.length === 0 && (
        <p className="muted">Pick a practice area first to see suggestions.</p>
      )}
      {value.practiceAreas.map((area) => (
        <div key={area} className="niche-group">
          <p className="eyebrow">{practiceArea(area).label}</p>
          <div className="chip-pick">
            {practiceArea(area).niches.map((n) => (
              <button
                type="button"
                key={n}
                aria-pressed={value.niches.includes(n)}
                className={value.niches.includes(n) ? "on" : ""}
                onClick={() =>
                  onChange({ ...value, niches: toggle(value.niches, n, 24) })
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="niche-group">
        <p className="eyebrow">Your own</p>
        <div className="chip-pick">
          {extra.map((n) => (
            <button
              type="button"
              key={n}
              className="on"
              aria-label={`Remove ${n}`}
              onClick={() =>
                onChange({
                  ...value,
                  niches: value.niches.filter((x) => x !== n),
                })
              }
            >
              {n} <Icon name="close" size={12} />
            </button>
          ))}
        </div>
        <div className="inline-add">
          <input
            placeholder="Add a niche, like “BIPA” or “ADA Title III”"
            value={custom}
            maxLength={60}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button type="button" onClick={add} disabled={!custom.trim()}>
            Add
          </button>
        </div>
      </div>
    </>
  );
}

export function JurisdictionPicker({ value, onChange }: Edit) {
  return (
    <div
      className="chip-pick"
      role="group"
      aria-label="Courts and jurisdictions"
    >
      {JURISDICTIONS.map((j) => (
        <button
          type="button"
          key={j}
          aria-pressed={value.jurisdictions.includes(j)}
          className={value.jurisdictions.includes(j) ? "on" : ""}
          onClick={() =>
            onChange({
              ...value,
              jurisdictions: toggle(value.jurisdictions, j, 24),
            })
          }
        >
          {j}
        </button>
      ))}
    </div>
  );
}

function move<T>(list: T[], i: number, by: number) {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Sidebar order/visibility and dashboard cards, with a live sidebar preview. */
export function LayoutEditor({ value, onChange }: Edit) {
  const layout = buildLayout(value);
  const middle = layout.nav.filter(
    (k) => k !== "dashboard" && k !== "settings",
  );
  const setNav = (navOrder: NavKey[]) =>
    onChange({ ...value, layout: { ...value.layout, navOrder } });
  const setHidden = (hiddenNav: NavKey[]) =>
    onChange({ ...value, layout: { ...value.layout, hiddenNav } });
  const setCards = (dashboardCards: DashboardCard[]) =>
    onChange({ ...value, layout: { ...value.layout, dashboardCards } });
  return (
    <div className="layout-editor">
      <div>
        <div className="editor-head">
          <h3>Sidebar</h3>
          <small>{PRESETS[layout.preset].label} layout</small>
        </div>
        <ol className="order-list">
          {middle.map((k, i) => {
            const hidden = layout.hiddenNav.includes(k);
            return (
              <li key={k} className={hidden ? "is-hidden" : ""}>
                <Icon name={k} size={16} />
                <span className="grow">{NAV_LABELS[k]}</span>
                <button
                  type="button"
                  className="icon-button flat"
                  aria-label={`Move ${NAV_LABELS[k]} up`}
                  disabled={i === 0}
                  onClick={() => setNav(move(middle, i, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-button flat"
                  aria-label={`Move ${NAV_LABELS[k]} down`}
                  disabled={i === middle.length - 1}
                  onClick={() => setNav(move(middle, i, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setHidden(toggle(layout.hiddenNav, k))}
                >
                  {hidden ? "Show" : "Hide"}
                </button>
              </li>
            );
          })}
        </ol>
        <small>Dashboard and Settings always stay in the sidebar.</small>
      </div>
      <div>
        <div className="editor-head">
          <h3>Dashboard cards</h3>
        </div>
        <ol className="order-list">
          {[
            ...layout.cards,
            ...DASHBOARD_CARDS.filter((c) => !layout.cards.includes(c)),
          ].map((c) => {
            const i = layout.cards.indexOf(c);
            const on = i >= 0;
            return (
              <li key={c} className={on ? "" : "is-hidden"}>
                <span className="grow">{CARD_LABELS[c]}</span>
                <button
                  type="button"
                  className="icon-button flat"
                  aria-label={`Move ${CARD_LABELS[c]} up`}
                  disabled={!on || i === 0}
                  onClick={() => setCards(move(layout.cards, i, -1))}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-button flat"
                  aria-label={`Move ${CARD_LABELS[c]} down`}
                  disabled={!on || i === layout.cards.length - 1}
                  onClick={() => setCards(move(layout.cards, i, 1))}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="text-button"
                  disabled={on && layout.cards.length === 1}
                  onClick={() =>
                    setCards(
                      on
                        ? layout.cards.filter((x) => x !== c)
                        : [...layout.cards, c],
                    )
                  }
                >
                  {on ? "Hide" : "Show"}
                </button>
              </li>
            );
          })}
        </ol>
        {(value.layout.navOrder ||
          value.layout.hiddenNav ||
          value.layout.dashboardCards) && (
          <button
            type="button"
            className="text-button"
            onClick={() => onChange({ ...value, layout: {} })}
          >
            Reset to the {PRESETS[layout.preset].label.toLowerCase()} layout
          </button>
        )}
      </div>
    </div>
  );
}

export function SidebarPreview({ value }: { value: Profile }) {
  const layout = buildLayout(value);
  return (
    <div className="sidebar-preview" aria-label="Sidebar preview">
      {layout.nav
        .filter((k) => !layout.hiddenNav.includes(k))
        .map((k, i) => (
          <span key={k} className={i === 0 ? "active" : ""}>
            <Icon name={k} size={15} /> {NAV_LABELS[k]}
          </span>
        ))}
    </div>
  );
}

export function SwatchPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Accent;
  onChange: (a: Accent) => void;
}) {
  return (
    <div className="swatch-row" role="radiogroup" aria-label={label}>
      {(Object.keys(ACCENTS) as Accent[]).map((a) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === a}
          aria-label={a}
          key={a}
          className={"swatch" + (value === a ? " on" : "")}
          style={{ background: ACCENTS[a] }}
          onClick={() => onChange(a)}
        />
      ))}
    </div>
  );
}
