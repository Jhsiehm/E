/**
 * The Casevex logo: the 4x4 mark beside the wordmark. One component for
 * every screen so the mark always behaves the same way: it ripples like
 * the opening card when the pointer rests on it, and continuously while
 * the workspace is loading (styles in app/globals.css, "The Casevex mark").
 *
 * `tone` picks the ripple colours for the surface: "dark" on the navy
 * sidebar and onboarding rail, "paper" on light pages.
 */
export function LogoMark({ loading = false }: { loading?: boolean }) {
  return (
    <span
      className={loading ? "logo-grid is-loading" : "logo-grid"}
      aria-hidden="true"
    >
      {Array.from({ length: 16 }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

export default function Logo({
  tone = "dark",
  className = "",
}: {
  tone?: "dark" | "paper";
  className?: string;
}) {
  return (
    <span className={`logo logo-${tone} ${className}`.trim()}>
      <LogoMark />
      Casevex
    </span>
  );
}
