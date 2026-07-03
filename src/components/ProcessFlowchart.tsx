"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  definition: string;
  ideaId: string;
};

// Client-side Mermaid renderer. Dynamically imports mermaid on mount so it
// never lands in the initial bundle. Falls back to a plain <pre> if render
// throws (bad definition, unsupported browser).
export default function ProcessFlowchart({ definition, ideaId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
          themeVariables: {
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
            fontSize: "14px",
            clusterBkg: "#faf9ff",
            clusterBorder: "#d8d3f0",
            lineColor: "#8b5cf6",
            edgeLabelBackground: "#ffffff",
            primaryTextColor: "#1e1b4b",
          },
          flowchart: {
            htmlLabels: true,
            curve: "basis",
            padding: 18,
            nodeSpacing: 40,
            rankSpacing: 60,
            useMaxWidth: true,
          },
        });
        const id = `flowchart-${ideaId.replace(/[^a-zA-Z0-9]/g, "")}`;
        const result = await mermaid.render(id, definition);
        if (cancelled) return;
        setSvg(result.svg);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [definition, ideaId]);

  if (error) {
    return (
      <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-200">
        Diagramm konnte nicht gerendert werden. Der Plan bleibt oben lesbar.
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        ref={containerRef}
        className="process-flowchart w-full overflow-x-auto"
      >
        <div className="text-xs text-[color:var(--foreground-muted)]">
          Diagramm wird geladen…
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="process-flowchart w-full overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
