import type { Metadata } from "next";

import BrandWordmark from "@/components/BrandWordmark";
import LegalFooter from "@/components/LegalFooter";

import LandingCta from "./LandingCta";

const PAGE_PATH = "/geschaeftsidee-validieren";
const TITLE = "Geschäftsidee validieren: Marktcheck und Plan in 2 Minuten | IDEAA";
const DESCRIPTION =
  "Geschäftsidee mit KI validieren: Marktanalyse, Konkurrenzcheck und erster Umsetzungsplan in einem strukturierten Bericht. Kostenlos, ohne Anmeldung.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_PATH,
    siteName: "IDEAA",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Wie validiere ich eine Geschäftsidee?",
    a: "Du prüfst systematisch vier Dinge: Gibt es einen echten Markt und eine zahlende Zielgruppe? Wer ist die Konkurrenz, und wo ist die Lücke? Welche Annahmen müssen stimmen? Und was würde die Idee scheitern lassen? Genau diese Schritte nimmt IDEAA dir ab und fasst sie in 60 bis 90 Sekunden in einem Bericht zusammen.",
  },
  {
    q: "Geschäftsidee prüfen, testen oder validieren: Wo ist der Unterschied?",
    a: "In der Praxis meint das dasselbe: herausfinden, ob deine Idee einen echten Markt, zahlende Kunden und eine realistische Umsetzung hat, bevor du Zeit und Geld investierst. IDEAA übernimmt diesen Schritt und liefert das Ergebnis als Bericht mit Markteinschätzung, Wettbewerb, Risiken und erstem Umsetzungsplan.",
  },
  {
    q: "Woran erkenne ich, ob meine Geschäftsidee Potenzial hat?",
    a: "Gute Indikatoren sind ein klar benennbares Problem, eine Zielgruppe mit erkennbarer Zahlungsbereitschaft und ein Markt, der groß genug, aber nicht hoffnungslos überfüllt ist. IDEAA bewertet diese Faktoren und macht die größten Risiken sichtbar, bevor du Zeit oder Geld investierst.",
  },
  {
    q: "Reicht eine KI-Validierung, oder muss ich mit echten Kunden sprechen?",
    a: "Beides gehört zusammen. IDEAA gibt dir in Minuten eine fundierte erste Einschätzung zu Markt, Wettbewerb und Risiken, damit du nicht bei null anfängst. Den finalen Beweis liefern aber immer echte Kundengespräche und ein Vorverkauf. Der Bericht sagt dir, was du als Erstes mit Kunden testen solltest.",
  },
  {
    q: "Was kostet die Validierung?",
    a: "Aktuell nichts. IDEAA ist in der frühen Produktphase, deshalb erhältst du den vollständigen Bericht ohne Anmeldung oder Bezahlung.",
  },
  {
    q: "Wie lange dauert eine Validierung?",
    a: "Eine einzelne Idee braucht in der Regel 60 bis 90 Sekunden. Du kannst auch mehrere Ideen parallel einreichen.",
  },
  {
    q: "Was bekomme ich am Ende?",
    a: "Einen Bericht mit Markteinschätzung, Wettbewerbsumfeld, Zielgruppen-Hypothesen, Risiken und einem ersten Umsetzungsplan.",
  },
  {
    q: "Werden meine Ideen geteilt?",
    a: "Nein. Jede Idee bekommt eine eigene URL, die nur du kennst. Es gibt keine öffentliche Galerie und keine Weitergabe an Dritte.",
  },
];

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "IDEAA",
    inLanguage: "de",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: DESCRIPTION,
    url: PAGE_PATH,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
    audience: {
      "@type": "Audience",
      audienceType: "Gründer, Entrepreneure, Produktmanager",
    },
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <main className="app-backdrop flex min-h-screen flex-col items-center px-6 py-12 sm:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <div className="flex w-full max-w-3xl flex-col gap-16">
        <section className="flex flex-col gap-10">
          <header className="flex flex-col items-center gap-5 text-center">
            <BrandWordmark
              className="brand-peak h-10 w-auto sm:h-12"
              title="IDEAA"
            />
            <span className="eyebrow">Für Gründer und Produktteams</span>
            <h1 className="text-3xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-5xl">
              Geschäftsidee validieren, bevor du Monate baust
            </h1>
            <p className="max-w-2xl text-base text-[color:var(--foreground-muted)] sm:text-lg">
              Füg deine Idee ein. Du bekommst einen strukturierten Bericht:
              Marktgröße, Wettbewerber, Zielgruppe, Risiken und einen ersten
              Umsetzungsplan. Kostenlos, ohne Anmeldung, in unter zwei Minuten.
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "1. Idee einfügen",
                body:
                  "Ein Satz reicht, ein Absatz ist besser. Markdown, Skizze oder lose Notizen sind alle okay.",
              },
              {
                title: "2. KI analysiert",
                body:
                  "Wir prüfen Markt, Wettbewerb, Zielgruppe und typische Stolperfallen und recherchieren dazu Quellen.",
              },
              {
                title: "3. Bericht erhalten",
                body:
                  "Du bekommst eine Einschätzung, eine Risikoliste und einen ersten Umsetzungsplan.",
              },
            ].map((step) => (
              <div key={step.title} className="surface-card p-5">
                <div className="text-sm font-semibold text-[color:var(--brand-ink)]">
                  {step.title}
                </div>
                <p className="mt-2 text-sm text-[color:var(--foreground-muted)]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>

          <div className="surface-card flex flex-col items-center gap-4 p-6 text-center sm:p-8">
            <h2 className="text-xl font-semibold text-[color:var(--foreground)] sm:text-2xl">
              Deine Idee jetzt validieren
            </h2>
            <p className="max-w-md text-sm text-[color:var(--foreground-muted)]">
              Kostenlos und ohne Anmeldung. Jeder Bericht bekommt eine eigene
              URL, zu der du jederzeit zurückkehren kannst.
            </p>
            <LandingCta className="brand-button inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:text-base">
              Idee einfügen und validieren
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M13 5l7 7-7 7" />
              </svg>
            </LandingCta>
            <p className="text-xs text-[color:var(--foreground-muted)]">
              Kein Account, keine Kreditkarte. Dauert 60 bis 90 Sekunden.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
            Warum die meisten Geschäftsideen zu spät validiert werden
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="surface-card p-5">
              <h3 className="text-base font-semibold text-[color:var(--foreground)]">
                Das Problem
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[color:var(--foreground-muted)]">
                <li>
                  Recherche kostet Tage: Markt, Wettbewerber, Zielgruppe, Preis
                  und Risiken, jeder Punkt einzeln.
                </li>
                <li>
                  Am Ende entscheidet das Bauchgefühl, weil die strukturierte
                  Analyse zu viel Aufwand kostet.
                </li>
                <li>
                  Viele Ideen werden erst nach Monaten Aufbau verworfen, da ist
                  die Zeit dann schon investiert.
                </li>
              </ul>
            </div>
            <div className="surface-card p-5">
              <h3 className="text-base font-semibold text-[color:var(--foreground)]">
                Was IDEAA anders macht
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-[color:var(--foreground-muted)]">
                <li>
                  Strukturierter Bericht statt loser ChatGPT-Antworten:
                  gleicher Rahmen für jede Idee.
                </li>
                <li>
                  Quellen-Recherche zu Markt und Wettbewerb fließt direkt in
                  die Einschätzung ein.
                </li>
                <li>
                  Am Ende stehen konkrete nächste Schritte, kein
                  Buzzword-Plan.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
            Was im Validierungsbericht steht
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Markteinschätzung",
                body:
                  "Wie groß ist der adressierbare Markt? Wer kauft das, wer nicht, und warum?",
              },
              {
                title: "Wettbewerbsumfeld",
                body:
                  "Wer ist schon im Markt? Wo ist die Lücke, und wo wäre ein direkter Angriff aussichtslos?",
              },
              {
                title: "Zielgruppen-Hypothesen",
                body:
                  "Drei bis fünf konkrete Personas mit Bedürfnis, Auslöser und Zahlungsbereitschaft.",
              },
              {
                title: "Risiken & Annahmen",
                body:
                  "Welche Annahmen müssen stimmen, damit die Idee trägt? Was würde sie zum Scheitern bringen?",
              },
              {
                title: "Erster Umsetzungsplan",
                body:
                  "Konkrete nächste Schritte: Was zuerst testen, wie schnell, mit welchem Mindesteinsatz?",
              },
              {
                title: "Eigene URL",
                body:
                  "Jeder Bericht bekommt eine eigene URL, die du mit Mitgründer:innen teilen oder für dich behalten kannst.",
              },
            ].map((item) => (
              <div key={item.title} className="surface-card p-5">
                <h3 className="text-base font-semibold text-[color:var(--foreground)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-[color:var(--foreground-muted)]">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          <h2 className="text-2xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-3xl">
            Häufige Fragen
          </h2>
          <div className="flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="surface-card group p-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-semibold text-[color:var(--foreground)]">
                  {item.q}
                  <span
                    aria-hidden
                    className="text-[color:var(--foreground-muted)] transition group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-[color:var(--foreground-muted)]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="surface-card flex flex-col items-center gap-4 p-6 text-center sm:p-8">
          <h2 className="text-xl font-semibold text-[color:var(--foreground)] sm:text-2xl">
            Bereit, deine Geschäftsidee zu prüfen?
          </h2>
          <p className="max-w-md text-sm text-[color:var(--foreground-muted)]">
            Kein Setup, kein Account nötig. Idee einfügen, und du bekommst
            deinen Bericht.
          </p>
          <LandingCta className="brand-button inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold sm:text-base">
            Jetzt Geschäftsidee validieren
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </LandingCta>
        </section>

        <footer className="flex flex-col items-center gap-3 pb-6 text-center text-xs text-[color:var(--foreground-muted)]">
          <p>IDEAA: Idee einfügen, Validierungsbericht bekommen.</p>
          <LegalFooter />
        </footer>
      </div>
    </main>
  );
}
