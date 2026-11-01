import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Car, Cog, Search, Sparkles, X } from "lucide-react";
import { suggest, type Suggestion } from "@/lib/smart-search";

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  vehicle: "Vehicle",
  part: "Auto part",
  decor: "Decor",
};

const KIND_ICON = {
  vehicle: Car,
  part: Cog,
  decor: Sparkles,
} as const;

/**
 * The homepage marketplace search: submit goes to /search, and from three
 * characters it opens a glassy dropdown with the five closest records.
 * The dropdown is portalled to <body> so the hero's overflow never clips it.
 */
export function SmartSearch({
  variant = "hero",
  initialQuery = "",
  placeholder = "Search cars, bikes, parts or decor",
  ariaLabel = "Search vehicles, auto parts and decor",
}: {
  variant?: "hero" | "page";
  initialQuery?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [rect, setRect] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setValue(initialQuery), [initialQuery]);

  const suggestions = useMemo(() => suggest(value, 5), [value]);
  const showList = open && value.trim().length >= 3 && suggestions.length > 0;

  useEffect(() => {
    if (!showList) return;
    const sync = () => {
      const el = formRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const width = Math.min(box.width, window.innerWidth - 24);
      // Stay under the field: it is the natural reading position. Only flip
      // above when the space below has collapsed to almost nothing.
      const roomBelow = window.innerHeight - box.bottom - 8;
      let top = box.bottom + 8;
      if (roomBelow < 200) {
        top = Math.max(12, box.top - 8 - Math.min(320, box.top - 20));
      }
      setRect({
        left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)),
        top,
        width,
        maxHeight: Math.max(160, Math.min(420, window.innerHeight - top - 16)),
      });
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [showList, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (formRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const goToResults = () => {
    const term = value.trim();
    if (!term) {
      inputRef.current?.focus();
      return;
    }
    setOpen(false);
    void navigate({ to: "/search", search: { q: term } });
  };

  const pick = (item: Suggestion) => {
    setOpen(false);
    if (item.kind === "vehicle") {
      void navigate({ to: "/buy/vehicle/$id", params: { id: item.id } });
      return;
    }
    void navigate({
      to: "/search",
      search: { q: item.title, type: item.kind === "part" ? "parts" : "decor" },
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!showList) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      return;
    }
    if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      const chosen = suggestions[active];
      if (chosen) pick(chosen);
    }
  };

  return (
    <>
      <form
        ref={formRef}
        role="search"
        data-testid="smart-search"
        className={variant === "hero" ? "home-search mw-ss" : "mw-ss mw-ss--page"}
        onSubmit={(event) => {
          event.preventDefault();
          goToResults();
        }}
      >
        <label className="mw-ss-field">
          <Search className="h-4 w-4 shrink-0 text-ink-foreground/70" aria-hidden="true" />
          <input
            ref={inputRef}
            data-testid="search-input"
            type="search"
            value={value}
            aria-label={ariaLabel}
            aria-autocomplete="list"
            aria-expanded={showList}
            autoComplete="off"
            placeholder={placeholder}
            onChange={(event) => {
              setValue(event.target.value);
              setActive(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {value && (
            <button
              type="button"
              className="mw-ss-clear"
              data-testid="search-clear"
              aria-label="Clear search"
              onClick={() => {
                setValue("");
                setActive(-1);
                inputRef.current?.focus();
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </label>
        <button
          type="submit"
          data-testid="search-submit"
          className={variant === "hero" ? "home-search-button" : "mw-ss-submit"}
        >
          Search <ArrowRight size={14} aria-hidden="true" />
        </button>
      </form>

      {showList &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="mw-ss-menu"
            data-testid="search-suggestions"
            role="listbox"
            aria-label="Search suggestions"
            style={{
              left: rect.left,
              top: rect.top,
              width: rect.width,
              maxHeight: rect.maxHeight,
            }}
          >
            {suggestions.map((item, index) => {
              const Icon = KIND_ICON[item.kind];
              return (
                <button
                  key={`${item.kind}-${item.id}-${item.title}`}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  data-testid="search-suggestion"
                  data-kind={item.kind}
                  data-id={item.id}
                  className={`mw-ss-item${index === active ? " is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(item)}
                >
                  <span className="mw-ss-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="mw-ss-copy">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <span className="mw-ss-kind">{KIND_LABEL[item.kind]}</span>
                </button>
              );
            })}
            <button
              type="button"
              className="mw-ss-all"
              data-testid="search-see-all"
              onMouseDown={(event) => event.preventDefault()}
              onClick={goToResults}
            >
              See all results for “{value.trim()}”
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
