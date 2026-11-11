import { Link } from "@tanstack/react-router";
import logoOnDark from "@/assets/brand/motor-wallah-logo-on-dark.svg";
import logoOnLight from "@/assets/brand/motor-wallah-logo-on-light.svg";

type BrandLogoProps = {
  compact?: boolean;
  homepage?: boolean;
  /** Uses the dark-text lockup, for light (white) headers such as the BUY pill bar. */
  onLight?: boolean;
  onClick?: () => void;
};

const SIZE = {
  compact: "h-6 sm:h-7",
  homepage: "h-8 sm:h-9 lg:h-10",
  standard: "h-7 sm:h-8 lg:h-9",
};

export function BrandLogo({
  compact = false,
  homepage = false,
  onLight = false,
  onClick,
}: BrandLogoProps) {
  const heightClass = compact ? SIZE.compact : homepage ? SIZE.homepage : SIZE.standard;

  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label="Motor Wallah home"
      className="flex shrink-0 items-center"
    >
      {/* Fixed height + auto width keeps the artwork's aspect ratio: never stretched. */}
      <img
        src={onLight ? logoOnLight : logoOnDark}
        alt="Motor Wallah — Drive trust. Drive quality."
        width={1330}
        height={276}
        decoding="async"
        className={`${heightClass} w-auto max-w-none select-none`}
      />
    </Link>
  );
}
