import { useCallback, useEffect, useState } from "react";

/**
 * Device-local shortlist for the BUY page.
 * There is no customer account backend yet, so the shortlist lives in
 * localStorage and never pretends to sync across devices.
 */
const KEY = "mw_buy_shortlist";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — the shortlist must never break browsing */
  }
}

export function useShortlist() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIds(read());
    setReady(true);
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setIds([]);
  }, []);

  return {
    ids,
    ready,
    has: (id: string) => ids.includes(id),
    toggle,
    clear,
  };
}
