import type { Metadata } from "next";

import LegalFooter from "@/components/LegalFooter";

export const metadata: Metadata = {
  title: "Datenschutzerklärung | IDEAA",
  description:
    "Wie IDEAA mit personenbezogenen Daten umgeht: Server-Logs, Idee-Eingaben, KI-Verarbeitung, Klick-Tracking, Spam-Schutz, Bot-Statistik.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/datenschutz" },
};

export default function DatenschutzPage() {
  return (
    <main className="app-backdrop flex min-h-screen flex-col items-center px-6 py-16">
      <article className="flex w-full max-w-2xl flex-col gap-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
            Datenschutzerklärung
          </h1>
          <p className="mt-2 text-sm text-[color:var(--foreground-muted)]">
            Informationen nach Art. 13 DSGVO. Stand: Juni 2026.
          </p>
        </header>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            1. Verantwortlicher
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Verantwortlicher im Sinne der DSGVO ist Jan-Niklas Bausch,
            E-Mail{" "}
            <a
              href="mailto:jan.bausch@googlemail.com"
              className="text-[color:var(--brand-ink)] hover:underline"
            >
              jan.bausch@googlemail.com
            </a>
            . Weitere Angaben im{" "}
            <a
              href="/impressum"
              className="text-[color:var(--brand-ink)] hover:underline"
            >
              Impressum
            </a>
            .
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            2. Aufrufen der Seite (Server-Logs)
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Beim Aufruf werden technische Daten an unseren Hosting-Anbieter
            Vercel Inc. übermittelt und in Server-Logs verarbeitet:
            IP-Adresse, Datum/Uhrzeit, aufgerufene URL, Referrer,
            User-Agent. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse an einem stabilen Betrieb).
            Speicherdauer: bis zu 30 Tage.
          </p>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Auftragsverarbeiter:{" "}
            <a
              href="https://vercel.com/legal/dpa"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--brand-ink)] hover:underline"
            >
              Vercel Inc.
            </a>
            . Datenübermittlung in die USA auf Basis der EU-Standardvertragsklauseln.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            3. Ideen-Eingabe und Speicherung
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Wenn du eine Idee einreichst, speichern wir den von dir
            eingegebenen Text in einer Postgres-Datenbank, betrieben durch
            Neon, Inc. Eine Anmeldung ist nicht erforderlich; wir
            verknüpfen die Eingabe nicht mit einer Person. Jeder Eingabe
            wird eine zufällige ID zugewiesen, die Bestandteil der
            geteilten Ergebnis-URL ist.
          </p>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Durchführung der
            Anfrage). Speicherdauer: unbegrenzt, solange die Idee über
            ihre URL erreichbar sein soll. Auf Anfrage per E-Mail löschen
            wir konkrete Einträge.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            4. KI-gestützte Analyse
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Zur Erstellung der Validierungs-Berichte übermitteln wir den
            Inhalt der Idee an die API von{" "}
            <a
              href="https://www.anthropic.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--brand-ink)] hover:underline"
            >
              Anthropic PBC
            </a>{" "}
            (Anbieter des Claude-Modells, USA). Anthropic verarbeitet die
            Eingabe ausschließlich zur Beantwortung und verwendet sie
            nicht zum Modell-Training (API-Standard).
          </p>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Bitte gib in deiner Idee keine personenbezogenen Daten Dritter
            ein. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Übermittlung
            in die USA auf Basis der EU-Standardvertragsklauseln.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            5. Klick-Statistik (CTA-Events)
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Klickt jemand auf den Aufruf zur Validierung auf einer
            Landing-Page, speichern wir ein Ereignis mit User-Agent und
            Referrer (ohne IP, ohne Cookie, ohne Geräte-ID). Wir nutzen
            das nur, um die Wirksamkeit unserer Landing-Pages aggregiert
            zu messen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse an Reichweitenmessung). Speicherdauer:
            12 Monate.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            6. Spam-Schutz beim Einreichen (IP-Hash)
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Damit niemand automatisiert beliebig viele Ideen einreichen
            kann, gilt ein Tageslimit pro IP-Adresse. Beim Absenden bilden
            wir aus deiner IP-Adresse einen SHA-256-Hashwert und speichern
            nur diesen zusammen mit einem Zeitstempel in der Tabelle{" "}
            <code className="rounded bg-[color:var(--surface-muted)] px-1 py-0.5 text-xs">
              submit_throttle
            </code>
            . Die Klartext-IP wird nicht gespeichert.
          </p>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
            Interesse an Schutz vor missbräuchlicher Nutzung und
            Kostenkontrolle). Speicherdauer: maximal 7 Tage, dann werden
            die Einträge automatisch gelöscht.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            7. Bot-Statistik (Crawler-Tracking)
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Wenn Suchmaschinen-Crawler oder KI-Bots (z.B. Googlebot,
            Bingbot, GPTBot, ClaudeBot, PerplexityBot) die Seite besuchen,
            erkennen wir das am User-Agent und speichern Bot-Name, voller
            User-Agent-String und aufgerufener Pfad in der Tabelle{" "}
            <code className="rounded bg-[color:var(--surface-muted)] px-1 py-0.5 text-xs">
              bot_visits
            </code>
            . Aufrufe von echten Browsern werden nicht erfasst.
          </p>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
            Interesse an SEO-Diagnose und Sichtbarkeitsanalyse).
            Speicherdauer: bis auf Widerruf, in der Regel unter 12 Monaten.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            8. Was wir nicht tun
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--foreground-muted)]">
            <li>Keine Cookies (außer technisch notwendigen, falls vom Framework gesetzt)</li>
            <li>Kein Google Analytics, kein Meta-Pixel, kein Werbe-Tracking</li>
            <li>Kein Profil-Building, keine Weitergabe an Dritte zu Marketing-Zwecken</li>
            <li>Kein Verkauf von Daten</li>
          </ul>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            9. Deine Rechte
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Du hast nach DSGVO ein Recht auf Auskunft (Art. 15),
            Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der
            Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20),
            Widerspruch (Art. 21) sowie ein Beschwerderecht bei einer
            Datenschutz-Aufsichtsbehörde (Art. 77). Wende dich dafür
            formlos an die im Impressum genannte E-Mail-Adresse.
          </p>
        </section>

        <section className="surface-card flex flex-col gap-2 p-5">
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            10. Änderungen
          </h2>
          <p className="text-sm text-[color:var(--foreground-muted)]">
            Wir passen diese Datenschutzerklärung an, wenn sich
            Verarbeitungen ändern. Es gilt jeweils die hier veröffentlichte
            Version.
          </p>
        </section>

        <LegalFooter />
      </article>
    </main>
  );
}
