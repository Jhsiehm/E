import "./globals.css";
import type { Metadata } from "next";
import AnimatedFavicon from "@/components/AnimatedFavicon";
import { DISPLAY_BOOT_SCRIPT } from "@/lib/account/display";
export const metadata: Metadata = {
  title: "Casevex | Legal research workspace",
  description:
    "A connected Casevex prototype with simulated research and sample matters.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    // The boot script sets data-theme/-text/-contrast/-motion before paint,
    // so React must not warn that <html> attributes differ from the server.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_BOOT_SCRIPT }} />
      </head>
      <body>
        {children}
        <AnimatedFavicon />
      </body>
    </html>
  );
}
