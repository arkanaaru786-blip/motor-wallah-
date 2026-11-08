import { useEffect, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";

import { subscribeToDeskData, type DeskKey, type DeskRow } from "@/lib/employee-desk";

/** Reads one desk's rows and re-renders when the desk (or the CRM) changes. */
export function useDeskRows<T extends DeskRow>(desk: DeskKey, read: () => T[]): T[] {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeToDeskData(() => setVersion((value) => value + 1)), []);
  return useMemo(() => {
    void version;
    void desk;
    return read();
    // `read` is recreated per render; version + desk drive the refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, desk]);
}

export function DeskKpis({
  items,
}: {
  items: { label: string; value: string; hint?: string; tone?: "brand" | "ok" | "warn" }[];
}) {
  return (
    <div className="mw-desk-kpis">
      {items.map((item) => (
        <div key={item.label} className={`mw-desk-kpi${item.tone ? ` is-${item.tone}` : ""}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.hint ? <small>{item.hint}</small> : null}
        </div>
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone = status
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return <span className={`mw-desk-pill is-${tone}`}>{status}</span>;
}

export function StatusSelect({
  value,
  options,
  disabled,
  onChange,
  label,
}: {
  value: string;
  options: readonly string[];
  disabled?: boolean;
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <label
      className="mw-desk-select"
      title={disabled ? "You can read this desk but not change it." : label}
    >
      {/* The native select is the accessible control; this pill is only its paint. */}
      <span aria-hidden="true">
        <StatusPill status={value} />
      </span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        data-testid={`desk-status-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ContactActions({ mobile, name }: { mobile: string; name: string }) {
  const digits = mobile.replace(/\D+/g, "");
  if (digits.length < 10) return <span className="mw-desk-muted">No number</span>;
  const tel = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  return (
    <span className="mw-desk-actions">
      <a className="mw-desk-action" href={`tel:${tel}`} title={`Call ${name}`}>
        Call
      </a>
      <a
        className="mw-desk-action is-wa"
        href={`https://wa.me/${tel.replace("+", "")}`}
        target="_blank"
        rel="noreferrer"
        title={`WhatsApp ${name}`}
      >
        WhatsApp
      </a>
    </span>
  );
}

export function DeskDrawer({
  open,
  title,
  subtitle,
  facts,
  notes,
  noteLabel,
  onAddNote,
  onClose,
  children,
  busy,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  facts: { label: string; value: ReactNode }[];
  notes: { id: string; at: string; by: string; text: string }[];
  noteLabel: string;
  onAddNote: (text: string) => void;
  onClose: () => void;
  children?: ReactNode;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) setDraft("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="mw-desk-drawer-root" role="dialog" aria-modal="true" aria-label={title}>
      <button className="mw-desk-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="mw-desk-drawer">
        <header>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="mw-desk-close" onClick={onClose} aria-label="Close details">
            <X size={17} />
          </button>
        </header>

        <div className="mw-desk-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </div>
          ))}
        </div>

        {children}

        <section className="mw-desk-notes">
          <h3>{noteLabel}</h3>
          <ul>
            {notes.length === 0 ? <li className="is-empty">No notes yet.</li> : null}
            {notes
              .slice()
              .reverse()
              .map((note) => (
                <li key={note.id}>
                  <p>{note.text}</p>
                  <small>
                    {note.by} · {new Date(note.at).toLocaleString("en-IN")}
                  </small>
                </li>
              ))}
          </ul>
          <form
            className="mw-desk-noteform"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (!text) return;
              onAddNote(text);
              setDraft("");
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a note for the file…"
              rows={3}
              aria-label={noteLabel}
            />
            <button type="submit" disabled={busy || draft.trim().length < 2}>
              Save note
            </button>
          </form>
        </section>
      </aside>
    </div>
  );
}

export function DeskEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mw-desk-empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}
