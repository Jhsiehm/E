/** Navigation, labels and small formatting helpers shared by every screen. */
export const nav = [
  ["", "Dashboard", "dashboard"],
  ["matters", "Matters", "matters"],
  ["agents", "Agents", "agents"],
  ["precedents", "Precedents", "precedents"],
  ["notices", "Notices", "notices"],
  ["calendar", "Calendar", "calendar"],
  ["documents", "Documents", "documents"],
  ["settings/profile", "Settings", "settings"],
];
export const areas = [
  "Civil litigation",
  "Corporate",
  "Trust and estate",
  "Consumer and class action",
  "Employment",
  "Civil rights",
  "Regulatory",
  "International",
  "Contracts",
];
export const date = (s: string) =>
  new Date(s.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const label = (s: string) =>
  s.replaceAll("_", " ").replace(/^./, (x) => x.toUpperCase());
export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
