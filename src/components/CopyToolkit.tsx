"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Section = {
  title: string;
  body: string;
};

// Split a markdown blob on top-level `## ` headings. Everything before the
// first heading is ignored (there should be no preamble; if there is, we
// prefer dropping it over rendering it above the toolkit cards). Case- and
// language-agnostic: any `## <text>` on its own line starts a new section.
function splitSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    const headingMatch = /^##\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { title: headingMatch[1].trim(), body: "" };
      continue;
    }
    if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) sections.push(current);
  return sections
    .map((s) => ({ title: s.title, body: s.body.trim() }))
    .filter((s) => s.body.length > 0);
}

export default function CopyToolkit({ report }: { report: string }) {
  const sections = useMemo(() => splitSections(report), [report]);
  if (sections.length === 0) return null;

  return (
    <section className="copy-toolkit surface-card" aria-labelledby="copy-toolkit-heading">
      <header className="copy-toolkit__header">
        <h2 id="copy-toolkit-heading" className="eyebrow">
          Copy-Baukasten
        </h2>
        <p className="copy-toolkit__intro">
          Fertig formulierte Bausteine für die ersten 30 Tage. Klick auf{" "}
          <em>Kopieren</em>, paste in dein Tool, schick raus.
        </p>
      </header>
      <div className="copy-toolkit__list">
        {sections.map((s, idx) => (
          <CopyCard key={idx} title={s.title} body={s.body} />
        ))}
      </div>
    </section>
  );
}

function CopyCard({ title, body }: { title: string; body: string }) {
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body);
      setState("ok");
      setTimeout(() => setState("idle"), 1800);
    } catch {
      setState("err");
      setTimeout(() => setState("idle"), 2400);
    }
  }

  return (
    <article className="copy-card">
      <div className="copy-card__head">
        <h3 className="copy-card__title">{title}</h3>
        <button
          type="button"
          onClick={handleCopy}
          className="copy-card__button no-print"
          aria-label={`Text aus "${title}" in die Zwischenablage kopieren`}
        >
          {state === "ok"
            ? "Kopiert"
            : state === "err"
              ? "Nicht kopiert"
              : "Kopieren"}
        </button>
      </div>
      <div className="copy-card__body analysis-report">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </article>
  );
}
