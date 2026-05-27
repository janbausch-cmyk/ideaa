type Props = {
  className?: string;
  title?: string;
};

// Peak-Bildmarke (Doppel-A). currentColor-Fill für Theming via CSS.
// Geometrie aus branding/logos/svg/concept-3-peak-mark.svg.
export default function BrandMark({ className, title }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      role="img"
      aria-label={title ?? "IDEAA"}
      className={className}
    >
      <title>{title ?? "IDEAA"}</title>
      <g transform="translate(14 53)" fill="currentColor">
        <path d="M 0 150 L 37.4 30 Q 55 -8 72.6 30 L 110 150 L 85.8 150 L 55 44 L 24.2 150 Z" />
        <g transform="translate(118 0)">
          <path d="M 0 150 L 37.4 30 Q 55 -8 72.6 30 L 110 150 L 85.8 150 L 55 44 L 24.2 150 Z" />
        </g>
      </g>
    </svg>
  );
}
