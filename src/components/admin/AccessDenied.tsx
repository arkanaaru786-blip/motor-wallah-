import { Lock } from "lucide-react";

/** Shown when a route exists but the signed-in role may not open it. */
export function AccessDenied({ title, description }: { title: string; description: string }) {
  return (
    <section className="mw-admin-panel mw-admin-denied" data-testid="access-denied">
      <span className="mw-admin-denied-icon">
        <Lock size={20} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}
