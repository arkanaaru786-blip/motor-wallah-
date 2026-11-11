import { Link } from "@tanstack/react-router";

type BrandLogoProps = {
  compact?: boolean;
  homepage?: boolean;
  /** Dark "MOTOR" lettering, for light (white) headers such as the BUY pill bar. */
  onLight?: boolean;
  onClick?: () => void;
};

const ICON_SIZE = {
  compact: "h-7 sm:h-8",
  homepage: "h-9 sm:h-10 lg:h-11",
  standard: "h-8 sm:h-9 lg:h-10",
};

const WORD_SIZE = {
  compact: "text-sm sm:text-base",
  homepage: "text-lg sm:text-xl lg:text-[1.4rem]",
  standard: "text-base sm:text-lg lg:text-xl",
};

export function BrandLogo({
  compact = false,
  homepage = false,
  onLight = false,
  onClick,
}: BrandLogoProps) {
  const iconSize = compact ? ICON_SIZE.compact : homepage ? ICON_SIZE.homepage : ICON_SIZE.standard;
  const wordSize = compact ? WORD_SIZE.compact : homepage ? WORD_SIZE.homepage : WORD_SIZE.standard;

  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label="Motor Wallah home"
      className="flex shrink-0 items-center gap-2 sm:gap-2.5"
    >
      {/* The provided brand file, untouched: fixed height, auto width. */}
      <img
        src="/images/MW-logo.png"
        alt="Motor Wallah"
        width={612}
        height={408}
        decoding="async"
        className={`${iconSize} w-auto shrink-0 select-none`}
      />
      <span
        className={`font-display font-bold uppercase leading-none tracking-tight ${wordSize} ${
          onLight ? "text-ink" : "text-ink-foreground"
        }`}
      >
        Motor <span className="text-primary">Wallah</span>
      </span>
    </Link>
  );
}
