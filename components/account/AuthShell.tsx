import type { ReactNode } from "react";

/** Split layout for sign-in screens: form on paper, navy brand panel. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <main className="auth-main">
        <div className="auth-brand">
          <span className="logo-grid">
            {Array.from({ length: 16 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          Casevex
        </div>
        <div className="auth-card">{children}</div>
        <p className="auth-foot">
          Research aid for attorney review. Your matters stay private to your
          firm.
        </p>
      </main>
      <aside className="auth-panel" aria-hidden="true">
        <div className="auth-grid">
          {Array.from({ length: 64 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        <p className="eyebrow">Legal research workspace</p>
        <h2>Every matter, its authorities and deadlines, in one place.</h2>
      </aside>
    </div>
  );
}
