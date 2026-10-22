import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Searchable dropdown that keeps the exact visual language of the plain
 * <select> fields used across the site (same border, padding, typography).
 */
export function SearchableSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  /** Label of the "no selection" entry, e.g. "All Models". */
  placeholder: string;
  /** Current value; the empty-selection value is passed through untouched. */
  value: string;
  /** Value used for "no selection" (e.g. "" or "any"). */
  emptyValue?: string;
  options: readonly string[];
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const selected = options.includes(value) ? value : "";

  return (
    <div ref={boxRef} className={`relative block min-w-0 ${className}`}>
      <div className="border border-border bg-background px-3 py-2">
        <span className="block text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setQuery("");
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 bg-transparent text-left text-sm font-semibold text-foreground outline-none"
        >
          <span className="truncate">{selected || placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-hidden border border-border bg-card shadow-panel">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              aria-label={`Search ${label}`}
              className="w-full border border-border bg-background px-2 py-1.5 text-sm outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary/60"
              >
                {placeholder}
                {!selected && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            </li>
            {filtered.map((o) => (
              <li key={o}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary/60"
                >
                  <span className="truncate">{o}</span>
                  {selected === o && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted-foreground">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
