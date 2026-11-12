"use client";
import Link from "next/link";
import { Header } from "@/components/workspace/shared";

/** Unknown route fallback. */
export default function NotFoundPage() {
  return (
    <>
      <Header
        title="Page not found"
        subtitle="This matter or page does not exist in this demo."
      />
      <Link className="button" href="/">
        Return to dashboard
      </Link>
    </>
  );
}
