import Link from "next/link";

export default function LegalFooter() {
  return (
    <nav
      aria-label="Rechtliches"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-[color:var(--foreground-muted)]"
    >
      <Link href="/impressum" className="hover:underline">
        Impressum
      </Link>
      <span aria-hidden>·</span>
      <Link href="/datenschutz" className="hover:underline">
        Datenschutz
      </Link>
    </nav>
  );
}
