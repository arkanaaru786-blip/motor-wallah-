import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

export function VehicleGallery({
  images,
  alt,
  overlay,
  className = "",
  allowFullscreen = true,
  showThumbnails = true,
}: {
  images: string[];
  alt: string;
  overlay?: React.ReactNode;
  className?: string;
  allowFullscreen?: boolean;
  showThumbnails?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const total = images.length;

  const go = (dir: number) => setIndex((i) => (i + dir + total) % total);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, total]);

  return (
    <>
      <div className={`relative overflow-hidden bg-secondary ${className}`}>
        <img
          src={images[index]}
          alt={alt}
          loading="lazy"
          width={1024}
          height={640}
          className="aspect-[16/10] w-full select-none object-cover"
          onTouchStart={(e) => setTouchX(e.touches[0]?.clientX ?? null)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        />
        {overlay}
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(-1)}
              className="absolute left-1 top-1/2 hidden -translate-y-1/2 bg-ink/70 p-1.5 text-ink-foreground hover:bg-ink sm:block"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(1)}
              className="absolute right-1 top-1/2 hidden -translate-y-1/2 bg-ink/70 p-1.5 text-ink-foreground hover:bg-ink sm:block"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
        <span className="absolute bottom-2 right-2 bg-ink/80 px-2 py-1 text-[0.6rem] font-bold tracking-wide text-ink-foreground">
          {index + 1} / {total}
        </span>
        {allowFullscreen && (
          <button
            type="button"
            aria-label="View photo fullscreen"
            onClick={() => setFull(true)}
            className="absolute bottom-2 left-2 bg-ink/80 p-1.5 text-ink-foreground hover:bg-ink"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showThumbnails && total > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              aria-label={`Photo ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-16 w-24 shrink-0 border ${i === index ? "border-primary" : "border-border"}`}
            >
              <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {full && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/95 p-4">
          <button
            type="button"
            aria-label="Close fullscreen"
            onClick={() => setFull(false)}
            className="absolute right-4 top-4 text-ink-foreground"
          >
            <X className="h-6 w-6" />
          </button>
          <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className="absolute left-3 text-ink-foreground">
            <ChevronLeft className="h-8 w-8" />
          </button>
          <img src={images[index]} alt={alt} className="max-h-[85vh] w-auto max-w-full object-contain" />
          <button type="button" aria-label="Next photo" onClick={() => go(1)} className="absolute right-3 text-ink-foreground">
            <ChevronRight className="h-8 w-8" />
          </button>
          <span className="absolute bottom-5 text-xs font-bold tracking-wide text-ink-foreground">
            {index + 1} / {total}
          </span>
        </div>
      )}
    </>
  );
}
