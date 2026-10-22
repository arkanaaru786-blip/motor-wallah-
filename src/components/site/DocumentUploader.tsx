import { useRef, useState } from "react";
import { Camera, CheckCircle2, FileText, Trash2, Upload } from "lucide-react";
import { formatSize, isImage, toUploadedFile, type UploadedFile } from "@/lib/uploads";

export function DocumentUploader({
  label,
  subtext,
  required = false,
  file,
  onChange,
}: {
  label: string;
  subtext: string;
  required?: boolean;
  file: UploadedFile | null;
  onChange: (f: UploadedFile | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const handle = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      onChange(await toUploadedFile(f, label));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  };

  return (
    <div className="border border-border bg-background p-4">
      <p className="font-display text-sm font-bold uppercase">
        {label} {required ? <span className="text-primary">*</span> : <span className="text-muted-foreground">(Optional)</span>}
      </p>
      <p className="mt-1 text-[0.7rem] text-muted-foreground">{subtext}</p>

      {file ? (
        <div className="mt-3 flex items-center gap-3 border border-border p-2">
          {isImage(file) ? (
            <img src={file.dataUrl} alt={file.label} className="h-14 w-20 object-cover" />
          ) : (
            <FileText className="h-8 w-8 text-primary" />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" /> {label} Uploaded
            </p>
            <p className="truncate text-[0.7rem] text-muted-foreground">
              {file.name} · {formatSize(file.size)}
            </p>
            <div className="mt-1 flex gap-3">
              <a
                href={file.dataUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[0.7rem] font-semibold uppercase tracking-wide hover:text-primary"
              >
                Preview
              </a>
              <button
                type="button"
                onClick={() => pickRef.current?.click()}
                className="text-[0.7rem] font-semibold uppercase tracking-wide hover:text-primary"
              >
                Replace
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={() => onChange(null)}
            className="p-1 text-muted-foreground hover:text-primary"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => pickRef.current?.click()}
            className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] hover:border-primary hover:text-primary"
          >
            <Upload className="h-4 w-4" /> Upload File
          </button>
          <button
            type="button"
            onClick={() => camRef.current?.click()}
            className="inline-flex items-center gap-2 border border-border px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] hover:border-primary hover:text-primary"
          >
            <Camera className="h-4 w-4" /> Camera
          </button>
        </div>
      )}

      <input
        ref={pickRef}
        type="file"
        accept="image/*,application/pdf"
        hidden
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-xs font-semibold text-primary">{error}</p>}
    </div>
  );
}
