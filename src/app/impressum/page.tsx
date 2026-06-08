import type { Metadata } from "next";
import Link from "next/link";

import LegalFooter from "@/components/LegalFooter";

export const metadata: Metadata = {
  title: "Impressum | IDEAA",
  description: "Anbieterkennzeichnung gemäß § 5 DDG.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/impressum" },
};

export default function ImpressumPage() {
  return (
    <main className="app-backdrop flex min-h-screen flex-col items-center px-6 py-16">
      <article className="flex w-full max-w-2xl flex-col gap-8">
        <Link
          href="/"
          className="self-start text-sm text-[color:var(--foreground-muted)] hover:text-[color:var(--foreground)] hover:underline"
        >
          ← Zurück zur Startseite
        </Link>
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
            Impressum
          </h1>
          <p className="mt-2 text-sm text-[color:var(--foreground-muted)]">
            Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz).
          </p>
        </header>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            Anbieter
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Jan-Niklas Bausch
            <br />
            Otto-Hahn-Straße 34
            <br />
            40721 Hilden
            <br />
            Deutschland
          </p>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            E-Mail:{" "}
            <a
              href="mailto:jan.bausch@googlemail.com"
              className="text-[color:var(--brand-ink)] hover:underline"
            >
              jan.bausch@googlemail.com
            </a>
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            Verantwortlich für den Inhalt
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Jan-Niklas Bausch (Kontakt wie oben)
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            EU-Streitschlichtung
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung (OS) bereit:{" "}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--brand-ink)] hover:underline"
            >
              https://ec.europa.eu/consumers/odr/
            </a>
            . Wir sind nicht bereit oder verpflichtet, an
            Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            Haftung für Inhalte
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Die Inhalte dieses Dienstes wurden mit Sorgfalt erstellt. Für
            Richtigkeit, Vollständigkeit und Aktualität wird jedoch keine
            Gewähr übernommen. Validierungs-Berichte werden KI-gestützt
            erzeugt und stellen keine Rechts-, Steuer- oder
            Anlageberatung dar.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            Haftung für Links
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Dieser Dienst enthält Links zu externen Websites Dritter, auf
            deren Inhalte wir keinen Einfluss haben. Für diese fremden
            Inhalte ist stets der jeweilige Anbieter verantwortlich.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            Urheberrecht
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Die durch den Anbieter erstellten Inhalte und Werke
            unterliegen dem deutschen Urheberrecht. Beiträge Dritter sind
            als solche gekennzeichnet.
          </p>
        </section>

        <LegalFooter />
      </article>
    </main>
  );
}
