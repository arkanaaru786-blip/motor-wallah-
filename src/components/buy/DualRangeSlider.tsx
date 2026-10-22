import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  min: number;
  max: number;
  step: number;
  /** Current [low, high] value. */
  value: [number, number];
  onChange: (next: [number, number]) => void;
  format: (value: number) => string;
  /** Accessible name for the pair of handles. */
  label: string;
};

type Thumb = "low" | "high";

/**
 * Two circular draggable handles on a smooth track, plus a compact
 * volume-style meter underneath. Pointer, touch and keyboard accessible.
 */
export function DualRangeSlider({ min, max, step, value, onChange, format, label }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Thumb | null>(null);

  const span = Math.max(1, max - min);
  const pct = useCallback((v: number) => ((v - min) / span) * 100, [min, span]);

  const quantize = useCallback(
    (raw: number) => {
      const snapped = Math.round((raw - min) / step) * step + min;
      return Math.min(max, Math.max(min, snapped));
    },
    [min, max, step],
  );

  const valueFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return min;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return quantize(min + ratio * span);
    },
    [min, span, quantize],
  );

  const clampPair = useCallback(
    (next: number, thumb: Thumb): [number, number] => {
      const [low, high] = value;
      if (thumb === "low") return [Math.min(next, high - step), high];
      return [low, Math.max(next, low + step)];
    },
    [value, step],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      const next = clampPair(valueFromClientX(event.clientX), dragging);
      if (next[0] !== value[0] || next[1] !== value[1]) onChange(next);
    };
    const stop = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [dragging, valueFromClientX, clampPair, onChange, value]);

  const startFromTrack = (event: React.PointerEvent<HTMLDivElement>) => {
    const next = valueFromClientX(event.clientX);
    const thumb: Thumb = Math.abs(next - value[0]) <= Math.abs(next - value[1]) ? "low" : "high";
    setDragging(thumb);
    onChange(clampPair(next, thumb));
  };

  const nudge = (thumb: Thumb, delta: number) => {
    const current = thumb === "low" ? value[0] : value[1];
    onChange(clampPair(quantize(current + delta), thumb));
  };

  const handleKey = (thumb: Thumb) => (event: React.KeyboardEvent) => {
    const big = step * 5;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      nudge(thumb, -step);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      nudge(thumb, step);
    } else if (event.key === "PageDown") {
      event.preventDefault();
      nudge(thumb, -big);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      nudge(thumb, big);
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(clampPair(min, thumb));
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(clampPair(max, thumb));
    }
  };

  const lowPct = pct(value[0]);
  const highPct = pct(value[1]);

  const bars = Array.from({ length: 26 }, (_, i) => 6 + ((i * 7) % 9));

  return (
    <div className="buy-slider">
      <div className="buy-slider-values">
        <div className="buy-slider-pill">
          <span>Min</span>
          <strong>{format(value[0])}</strong>
        </div>
        <div className="buy-slider-pill buy-slider-pill--end">
          <span>Max</span>
          <strong>{format(value[1])}</strong>
        </div>
      </div>

      <div
        ref={trackRef}
        className="buy-slider-track"
        onPointerDown={startFromTrack}
        role="presentation"
      >
        <div
          className="buy-slider-fill"
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />
        <button
          type="button"
          role="slider"
          aria-label={`${label} minimum`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value[0]}
          aria-valuetext={format(value[0])}
          tabIndex={0}
          className="buy-slider-thumb"
          data-dragging={dragging === "low" || undefined}
          style={{ left: `${lowPct}%` }}
          onPointerDown={(event) => {
            event.stopPropagation();
            setDragging("low");
          }}
          onKeyDown={handleKey("low")}
        />
        <button
          type="button"
          role="slider"
          aria-label={`${label} maximum`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value[1]}
          aria-valuetext={format(value[1])}
          tabIndex={0}
          className="buy-slider-thumb"
          data-dragging={dragging === "high" || undefined}
          style={{ left: `${highPct}%` }}
          onPointerDown={(event) => {
            event.stopPropagation();
            setDragging("high");
          }}
          onKeyDown={handleKey("high")}
        />
      </div>

      <div className="buy-slider-meter" aria-hidden="true">
        {bars.map((height, index) => {
          const at = (index / (bars.length - 1)) * 100;
          const active = at >= lowPct - 0.01 && at <= highPct + 0.01;
          return (
            <span
              key={index}
              className="buy-slider-bar"
              data-active={active || undefined}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>

      <p className="buy-slider-scale">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </p>
    </div>
  );
}
