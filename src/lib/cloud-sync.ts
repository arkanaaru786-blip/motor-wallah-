import { useEffect, useReducer } from "react";

import { cloudStatus, startCloudSync, subscribeToCloud, type CloudStatus } from "@/lib/cloud-store";

/**
 * Keeps the React tree in step with the cloud data layer.
 *
 * Mounted once in the root route. The stores read the on-device replica
 * synchronously, so the first render is never blocked on the network; when
 * Supabase answers (or another tab writes) this hook re-renders the tree and
 * every store re-reads the fresh replica.
 */
export function useCloudSync(): CloudStatus {
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const unsubscribe = subscribeToCloud(rerender);
    void startCloudSync();
    return unsubscribe;
  }, []);

  return cloudStatus();
}
