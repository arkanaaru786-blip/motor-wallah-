import { useCallback, useEffect, useState } from "react";

import { replicaRead, replicaWrite } from "@/lib/cloud-store";

/**
 * Shortlist for the BUY page, stored in Supabase (see cloud-store) and read
 * from the on-device replica so saving a car never waits on the network.
 */
const KEY = "mw_buy_shortlist";

function read(): string[] {
  const raw = replicaRead<unknown>(KEY, []);
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
}

function write(ids: string[]) {
  replicaWrite(KEY, ids);
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
