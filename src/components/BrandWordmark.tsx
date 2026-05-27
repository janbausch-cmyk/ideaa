type Props = {
  className?: string;
  title?: string;
};

// Peak-Wortmarke (Konzept 3, IDEAA-85/86). currentColor-Fill, damit Theming
// per CSS-Color funktioniert (z.B. dunkelgrün auf hellem BG, weiss auf
// farbigem/dunklem BG). Vektor-Geometrie ist 1:1 aus
// branding/logos/svg/concept-3-peak-wordmark.svg übernommen.
export default function BrandWordmark({ className, title }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 518 160"
      role="img"
      aria-label={title ?? "IDEAA"}
      className={className}
    >
      <title>{title ?? "IDEAA"}</title>
      <g fill="currentColor" fillRule="evenodd">
        <path transform="translate(20 20)" d="M 0 0 H 22 V 120 H 0 Z" />
        <path
          transform="translate(70 20)"
          d="M 0 0 L 46 0 C 71 0 88 27 88 60 C 88 93 71 120 46 120 L 0 120 Z M 22 22 L 46 22 C 58 22 66 40 66 60 C 66 80 58 98 46 98 L 22 98 Z"
        />
        <path
          transform="translate(186 20)"
          d="M 0 0 H 80 V 22 H 22 V 49 H 72 V 71 H 22 V 98 H 80 V 120 H 0 Z"
        />
        <path
          transform="translate(294 20)"
          d="M 0 120 L 30 24 Q 44 -6 58 24 L 88 120 L 66 120 L 44 38 L 22 120 Z"
        />
        <path
          transform="translate(410 20)"
          d="M 0 120 L 30 24 Q 44 -6 58 24 L 88 120 L 66 120 L 44 38 L 22 120 Z"
        />
      </g>
    </svg>
  );
}
