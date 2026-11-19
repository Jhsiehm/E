"use client";
import { useState, useSyncExternalStore } from "react";
import { Card } from "@/components/workspace/ui";
import { useWorkspace } from "@/components/workspace/context";
import {
  applyDisplay,
  decodeDisplay,
  DEFAULT_DISPLAY,
  DISPLAY_CHOICES,
  DISPLAY_COOKIE,
  type DisplayPrefs,
} from "@/lib/account/display";
import { useAccount } from "./AccountProvider";

const ROWS: {
  key: keyof DisplayPrefs;
  title: string;
  help: string;
}[] = [
  {
    key: "theme",
    title: "Appearance",
    help: "Dark is easier on the eyes at night. “Match my computer” switches with your computer’s setting.",
  },
  {
    key: "text",
    title: "Text size",
    help: "Makes every word in Casevex bigger, including answers and quotations.",
  },
  {
    key: "contrast",
    title: "Contrast",
    help: "High contrast uses darker text, firmer lines and underlined links.",
  },
  {
    key: "motion",
    title: "Motion",
    help: "Turns off animations, such as the opening card and the research progress.",
  },
];

const noSubscribe = () => () => {};
const readCookie = () =>
  document.cookie.match(
    new RegExp(`(?:^|; )${DISPLAY_COOKIE}=([a-z.]+)`),
  )?.[1] ?? "";

/**
 * Settings > Display and reading. Every choice applies the moment it is
 * clicked (no Save button to miss) and is saved to the account.
 */
export default function DisplaySettings() {
  const { profile, save } = useAccount();
  const { notify } = useWorkspace();
  // Before anything is saved to the account, show this browser's choice.
  const cookie = useSyncExternalStore(noSubscribe, readCookie, () => "");
  const [chosen, setPrefs] = useState<DisplayPrefs | null>(null);
  const prefs =
    chosen ??
    profile.layout.display ??
    (cookie ? decodeDisplay(cookie) : DEFAULT_DISPLAY);

  async function choose<K extends keyof DisplayPrefs>(
    key: K,
    value: DisplayPrefs[K],
  ) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    applyDisplay(next);
    const err = await save({
      ...profile,
      layout: { ...profile.layout, display: next },
    });
    if (err) notify(`Applied on this computer, but not saved: ${err}`);
  }

  return (
    <Card className="page-body settings-card" title="Display and reading">
      <div className="display-settings scroll">
        <p className="display-intro">
          Changes apply right away and are saved to your account, so they follow
          you to any computer.
        </p>
        {ROWS.map((row) => (
          <fieldset key={row.key} className="display-row">
            <legend>{row.title}</legend>
            <p>{row.help}</p>
            <div className="segmented wrap" role="radiogroup">
              {DISPLAY_CHOICES[row.key].map(([value, text]) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={prefs[row.key] === value}
                  key={value}
                  className={prefs[row.key] === value ? "selected" : ""}
                  onClick={() =>
                    choose(row.key, value as DisplayPrefs[typeof row.key])
                  }
                >
                  {text}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="display-sample" aria-label="Preview">
          <span className="eyebrow">Preview</span>
          <h3>Sample answer</h3>
          <p>
            Under CPLR 3211(a)(7), the court accepts the facts alleged in the
            complaint as true and asks whether they fit any cognizable legal
            theory.{" "}
            <a href="#" onClick={(e) => e.preventDefault()}>
              Open source
            </a>
          </p>
        </div>
      </div>
    </Card>
  );
}
