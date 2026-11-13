"use client";
import { useState } from "react";
import Icon from "@/components/Icon";
import {
  JURISDICTIONS,
  PRACTICE_AREAS,
  type PracticeArea,
} from "@/lib/account/profile";
import { AGENT_STATUS_LABEL, practiceArea } from "@/lib/practice-areas";
import { toggle, type Edit } from "./shared";

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
