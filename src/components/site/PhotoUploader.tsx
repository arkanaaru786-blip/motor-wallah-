import { useRef, useState } from "react";
import { Camera, FileText, ImagePlus, RefreshCw, Trash2, X } from "lucide-react";
import {
  EXTERIOR_SLOTS,
  PHOTO_SLOTS,
  formatSize,
  isImage,
  toUploadedFile,
  type UploadedFile,
} from "@/lib/uploads";

const OTHER = "Other Photo";

export function PhotoUploader({
  photos,
  onChange,
}: {
  photos: UploadedFile[];
  onChange: (next: UploadedFile[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<UploadedFile | null>(null);
  const [slot, setSlot] = useState<string>(OTHER);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<string | null>(null);

  const exteriorCount = photos.filter((p) => EXTERIOR_SLOTS.includes(p.label)).length;

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const added: UploadedFile[] = [];
    for (const file of Array.from(files).slice(0, 20)) {
      if (!file.type.startsWith("image/")) {
        setError("Only image files can be uploaded as car photos.");
        continue;
      }
      try {
        added.push(await toUploadedFile(file, slot));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    }
    if (added.length) onChange([...photos, ...added]);
  };

  const replace = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !replacing) return;
    try {
      const current = photos.find((p) => p.id === replacing);
      const next = await toUploadedFile(file, current?.label ?? OTHER);
      onChange(photos.map((p) => (p.id === replacing ? next : p)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setReplacing(null);
    }
  };

  return (
    <div className="border border-border bg-card p-5 sm:p-7">
      <h3 className="font-display text-lg font-bold uppercase">
        Upload Your <span className="text-primary">Car Photos</span>
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Clear photos help our team understand your vehicle condition and provide a better preliminary
        valuation.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="block min-w-0 border border-border bg-background px-3 py-2">
          <span className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
            Photo Angle
          </span>
          <select
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            className="w-full bg-transparent text-sm font-semibold text-foreground outline-none"
          >
            {PHOTO_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={OTHER}>{OTHER}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground"
        >
          <ImagePlus className="h-4 w-4" /> Gallery
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 border border-border px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] hover:border-primary hover:text-primary"
        >
          <Camera className="h-4 w-4" /> Camera
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={replaceRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void replace(e.target.files);
          e.target.value = "";
        }}
      />

      <p className="mt-3 text-[0.7rem] text-muted-foreground">
        Recommended: {PHOTO_SLOTS.join(" · ")}. Minimum 4 clear exterior photos required — more angles
        give a better estimate.
      </p>

      <p className="mt-2 text-xs font-bold uppercase tracking-wide">
        <span className={exteriorCount >= 4 ? "text-primary" : "text-muted-foreground"}>
          Exterior photos: {exteriorCount}/4
        </span>
        <span className="text-muted-foreground"> · Total uploaded: {photos.length}</span>
      </p>
      {error && <p className="mt-2 text-xs font-semibold text-primary">{error}</p>}

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <figure key={p.id} className="border border-border">
              <button type="button" onClick={() => setPreview(p)} className="block w-full">
                <img src={p.dataUrl} alt={p.label} className="aspect-[4/3] w-full object-cover" />
              </button>
              <figcaption className="flex items-center justify-between gap-1 border-t border-border px-2 py-1.5">
                <span className="truncate text-[0.65rem] font-semibold uppercase tracking-wide">
                  {p.label}
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={`Replace ${p.label} photo`}
                    onClick={() => {
                      setReplacing(p.id);
                      replaceRef.current?.click();
                    }}
                    className="p-1 text-muted-foreground hover:text-primary"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${p.label} photo`}
                    onClick={() => onChange(photos.filter((x) => x.id !== p.id))}
                    className="p-1 text-muted-foreground hover:text-primary"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/95 p-4">
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setPreview(null)}
            className="absolute right-4 top-4 text-ink-foreground"
          >
            <X className="h-6 w-6" />
          </button>
          {isImage(preview) ? (
            <img src={preview.dataUrl} alt={preview.label} className="max-h-[85vh] max-w-full object-contain" />
          ) : (
            <FileText className="h-16 w-16 text-ink-foreground" />
          )}
          <span className="absolute bottom-5 text-xs font-bold uppercase tracking-wide text-ink-foreground">
            {preview.label} · {formatSize(preview.size)}
          </span>
        </div>
      )}
    </div>
  );
}
