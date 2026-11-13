"use client";
import Icon from "@/components/Icon";
import {
  ACCENTS,
  DASHBOARD_CARDS,
  type Accent,
  type DashboardCard,
  type NavKey,
  type Profile,
} from "@/lib/account/profile";
import {
  CARD_LABELS,
  NAV_LABELS,
  PRESETS,
  buildLayout,
} from "@/lib/account/layout";
import { toggle, move, type Edit } from "./shared";

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
