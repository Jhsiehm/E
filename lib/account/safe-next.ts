/**
 * Where to go after sign-in, limited to this site. Resolves the value against
 * our origin first (the URL parser strips tabs/newlines and treats `\` as `/`,
 * so string prefix checks are bypassable) and keeps it only if the origin is
 * unchanged. Anything else falls back to `fallback`.
 */
export function safeNext(
  value: string | null | undefined,
  origin: string,
  fallback = "/",
): string {
  if (!value) return fallback;
  try {
    const u = new URL(value, origin);
    if (u.origin !== new URL(origin).origin) return fallback;
    // "/.//evil.com" resolves to pathname "//evil.com": protocol-relative.
    if (u.pathname.startsWith("//")) return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}
