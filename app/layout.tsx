import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Casevex | Legal research workspace",
  description:
    "A connected Casevex prototype with simulated research and sample matters.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
