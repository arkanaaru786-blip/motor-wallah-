import { Toaster } from "sonner";

import { TOAST_DURATION_MS } from "@/lib/notifications";

/**
 * The one toast stack for the whole site.
 *
 * Glass surface, sliding in from the top-right corner, four seconds on screen,
 * with a close button and one action. Messages arrive through
 * `src/lib/notifications.ts`, so every alert looks the same wherever it starts.
 */
export function ToastHost() {
  return (
    <Toaster
      className="mw-toaster"
      position="top-right"
      offset={20}
      gap={10}
      duration={TOAST_DURATION_MS}
      closeButton
      visibleToasts={3}
      theme="light"
      toastOptions={{
        classNames: {
          toast: "mw-toast",
          title: "mw-toast-title",
          description: "mw-toast-desc",
          closeButton: "mw-toast-close",
          actionButton: "mw-toast-action",
        },
        style: {
          background:
            "linear-gradient(150deg, oklch(99% 0.004 90 / 0.94), oklch(96% 0.012 30 / 0.86))",
          border: "1px solid oklch(100% 0 0 / 0.75)",
          borderRadius: "18px",
          boxShadow:
            "0 22px 45px -22px oklch(30% 0.05 25 / 0.42), 0 1px 0 oklch(100% 0 0 / 0.85) inset",
          backdropFilter: "blur(20px) saturate(140%)",
          padding: "13px 15px",
          color: "var(--ink)",
          fontFamily: "var(--font-body, Barlow, system-ui, sans-serif)",
        },
      }}
    />
  );
}
