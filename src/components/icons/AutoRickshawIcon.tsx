/**
 * Auto-rickshaw (tuk-tuk / e-rickshaw) icon drawn in Lucide's geometry so it can
 * sit in a Lucide icon map and accept the same props. Lucide has no rickshaw
 * glyph, and a Bike or Car could not stand in for a 3-wheeler.
 */
import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

export const AutoRickshawIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 2, absoluteStrokeWidth, ...props }, ref) => {
    const width =
      absoluteStrokeWidth && Number(size) > 0
        ? (Number(strokeWidth) * 24) / Number(size)
        : strokeWidth;

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {/* Domed passenger canopy, near-vertical windshield and the low front
            cowl of a three-wheeler. */}
        <path d="M2.7 14.6V8.8A5.5 5.5 0 0 1 8.2 3.3h4.7a2.2 2.2 0 0 1 1.8 1.1L19.6 14.6z" />
        {/* Large rear wheel, smaller front wheel. */}
        <circle cx="7.4" cy="16.6" r="2.7" />
        <circle cx="17.9" cy="17.4" r="1.9" />
      </svg>
    );
  },
);

AutoRickshawIcon.displayName = "AutoRickshawIcon";
