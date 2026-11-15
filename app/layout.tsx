import "./globals.css";
import type { Metadata } from "next";
import AnimatedFavicon from "@/components/AnimatedFavicon";
export const metadata: Metadata = {
  title: "Casevex | Legal research workspace",
  description:
    "A connected Casevex prototype with simulated research and sample matters.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AnimatedFavicon />
      </body>
    </html>
  );
}
