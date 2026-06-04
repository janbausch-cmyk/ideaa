"use client";

import Link from "next/link";

const TARGET = "/?ref=geschaeftsidee-validieren";

function track() {
  try {
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      navigator.sendBeacon("/api/cta/landing-de");
      return;
    }
    fetch("/api/cta/landing-de", { method: "POST", keepalive: true }).catch(
      () => {},
    );
  } catch {
    // best-effort
  }
}

export default function LandingCta({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={TARGET}
      onClick={track}
      data-cta="landing_de"
      className={className}
    >
      {children}
    </Link>
  );
}
