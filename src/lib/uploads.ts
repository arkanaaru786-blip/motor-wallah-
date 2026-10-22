/** Customer-uploaded photo / document attached to an enquiry. */
export type UploadedFile = {
  id: string;
  /** Recommended slot label for photos, or document label. */
  label: string;
  name: string;
  type: string;
  size: number;
  /** Data URL — viewable and downloadable from the internal evaluation view. */
  dataUrl: string;
};

export const PHOTO_SLOTS = [
  "Front",
  "Rear",
  "Left Side",
  "Right Side",
  "Front Left",
  "Front Right",
  "Rear Left",
  "Rear Right",
  "Interior Front",
  "Interior Rear",
  "Dashboard / Odometer",
  "Engine Bay",
  "Tyres",
  "Any Damage / Scratch / Dent",
] as const;

/** Exterior angles counted toward the 4-photo minimum. */
export const EXTERIOR_SLOTS: readonly string[] = PHOTO_SLOTS.slice(0, 8);

export const MIN_EXTERIOR_PHOTOS = 4;

export const MAX_FILE_MB = 8;

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

export async function toUploadedFile(file: File, label: string): Promise<UploadedFile> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`${file.name} is larger than ${MAX_FILE_MB} MB.`);
  }
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    name: file.name.slice(0, 120),
    type: file.type || "application/octet-stream",
    size: file.size,
    dataUrl: await readFileAsDataUrl(file),
  };
}

export const isImage = (f: UploadedFile) => f.type.startsWith("image/");
export const formatSize = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
