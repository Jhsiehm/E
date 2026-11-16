import Logo from "@/components/Logo";
import AuthPanelArt from "@/components/account/AuthPanelArt";
import type { ReactNode } from "react";
import { allowPrototype } from "@/lib/runtime/prototype";

/** Split layout for sign-in screens: form on paper, navy brand panel. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <main className="auth-main">
        <Logo tone="paper" className="auth-brand" />
        <div className="auth-card">{children}</div>
        {allowPrototype() && (
          <p className="auth-foot">
            {/* Full navigation is required: /demo sets cookies and resets the workspace. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/demo">Explore the demo</a> — a sample workspace, no
            account needed.
          </p>
        )}
        <p className="auth-foot">
          Research aid for attorney review. Your matters stay private to your
          firm.
        </p>
      </main>
      <aside className="auth-panel" aria-hidden="true">
        <AuthPanelArt />
        <span className="auth-panel-rule" />
        <p className="eyebrow">Legal research workspace</p>
        <h2>Every matter, its authorities and deadlines, in one place.</h2>
      </aside>
    </div>
  );
}
