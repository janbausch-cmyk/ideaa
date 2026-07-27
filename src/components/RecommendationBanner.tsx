import type { RiskAssessmentData } from "@/lib/risk-parser";

type Verdict = "go" | "caution" | "hold";

type VerdictMeta = {
  headline: string;
  helper: string;
  accentVar: string;
};

const VERDICT_META: Record<Verdict, VerdictMeta> = {
  go: {
    headline: "Empfehlung: Los geht's",
    helper:
      "Die Kern-Risiken sind mitigierbar. Fang mit Validierung an und behalte die Kill-Kriterien im Blick.",
    accentVar: "var(--risk-low)",
  },
  caution: {
    headline: "Empfehlung: Mit Vorsicht bauen",
    helper: "",
    accentVar: "var(--risk-medium)",
  },
  hold: {
    headline: "Empfehlung: Erst validieren, dann bauen",
    helper: "",
    accentVar: "var(--risk-high)",
  },
};

function deriveVerdict(data: RiskAssessmentData): {
  verdict: Verdict;
  reason: string;
} {
  const highRisk = data.risks.find((r) => r.severity === "high");
  const topRisk = highRisk ?? data.risks[0] ?? null;

  if (data.overall === "high") {
    const reason = topRisk
      ? `${topRisk.title} ist ein möglicher Deal-Breaker. Adressiere das zuerst, bevor du Zeit in den Bau steckst.`
      : "Mehrere existenzielle Risiken. Adressiere sie zuerst, bevor du Zeit in den Bau steckst.";
    return { verdict: "hold", reason };
  }
  if (data.overall === "medium") {
    const reason = topRisk
      ? `${data.risks.length} reale Risiken, allen voran „${topRisk.title}". Klär das über Interviews oder einen Concierge-Test, bevor du programmierst.`
      : "Mehrere reale Risiken. Klär sie über Interviews oder einen Concierge-Test, bevor du programmierst.";
    return { verdict: "caution", reason };
  }
  return { verdict: "go", reason: VERDICT_META.go.helper };
}

export default function RecommendationBanner({
  data,
}: {
  data: RiskAssessmentData;
}) {
  const { verdict, reason } = deriveVerdict(data);
  const meta = VERDICT_META[verdict];

  return (
    <section
      className="recommendation-banner surface-card"
      style={{ ["--risk-accent" as string]: meta.accentVar }}
      aria-labelledby="recommendation-heading"
    >
      <div className="recommendation-banner__accent" aria-hidden />
      <div className="recommendation-banner__body">
        <span className="eyebrow">Kurzurteil</span>
        <h2
          id="recommendation-heading"
          className="recommendation-banner__headline"
        >
          {meta.headline}
        </h2>
        <p className="recommendation-banner__reason">{reason}</p>
        <p className="recommendation-banner__footnote">
          Basiert auf der Risiko-Analyse (§3). Vollständige Begründung und
          Kill-Kriterien findest du unten.
        </p>
      </div>
    </section>
  );
}
