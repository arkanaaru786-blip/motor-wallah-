import { Link } from "@tanstack/react-router";

type BrandLogoProps = {
  compact?: boolean;
  homepage?: boolean;
  /** Renders the tagline in a dark colour for light (white) headers. */
  onLight?: boolean;
  onClick?: () => void;
};

export function BrandLogo({
  compact = false,
  homepage = false,
  onLight = false,
  onClick,
}: BrandLogoProps) {
  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label="Motor Wallah home"
      className="flex shrink-0 items-center gap-2"
    >
      <span
        className={`${homepage ? "hidden" : "grid"} h-9 w-8 place-items-center rounded-b-2xl border-2 border-primary font-display text-[0.65rem] font-bold text-primary sm:h-10 sm:w-9`}
      >
        MW
      </span>
      <span className="leading-none">
        <span
          className={`block font-display font-bold uppercase ${homepage ? "home-logo-name" : compact ? "text-base" : "text-lg sm:text-xl"}`}
        >
          Motor <span className="text-primary">Wallah</span>
        </span>
        <span
          className={`mt-1 block text-[0.48rem] uppercase tracking-[0.16em] sm:text-[0.55rem] ${
            onLight ? "text-ink/55" : "text-ink-foreground/60"
          }`}
        >
          Drive Trust. Drive Quality.
        </span>
      </span>
    </Link>
  );
}
