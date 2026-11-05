import { useState } from "react";
import { CheckCircle2, PlusCircle } from "lucide-react";

import { dealerCategoryLabel, dealerCategorySingular } from "@/lib/dealer-categories";
import { addVehicle, type VehicleInput } from "@/lib/dealer-data";
import type { DealerSession } from "@/lib/dealer-session";
import { VehicleForm } from "./VehicleForm";

export function DealerAddVehicle({
  session,
  onAdded,
  goToInventory,
}: {
  session: DealerSession;
  onAdded: () => void;
  goToInventory: () => void;
}) {
  const [flash, setFlash] = useState<string | null>(null);
  const category = dealerCategoryLabel(session.category);
  const singular = dealerCategorySingular(session.category);

  const submit = (input: VehicleInput) => {
    const result = addVehicle(session, input);
    if (!result.ok) return result;
    setFlash(`${result.value.name} added to your ${category.toLowerCase()} inventory.`);
    onAdded();
    return { ok: true as const };
  };

  return (
    <>
      <div className="mw-dealer-head">
        <div>
          <h1>Add a {singular}</h1>
          <p>
            This form is pre-set to <strong>{category}</strong> — the only category your account can
            list. Brands and models below come from the {category.toLowerCase()} catalogue.
          </p>
        </div>
        <button type="button" className="mw-dealer-btn" onClick={goToInventory}>
          View inventory
        </button>
      </div>

      {flash ? (
        <p className="mw-dealer-flash" role="status" data-testid="add-vehicle-flash">
          <CheckCircle2 size={15} /> {flash}
        </p>
      ) : null}

      <section className="mw-dealer-panel is-wide">
        <div className="mw-dealer-panel-head">
          <div>
            <h2>
              <PlusCircle size={15} /> New {singular.toLowerCase()} listing
            </h2>
            <p>New listings start as Pending until you or Motor Wallah staff publish them.</p>
          </div>
        </div>
        <VehicleForm session={session} submitLabel={`Add ${singular}`} onSubmit={submit} />
      </section>
    </>
  );
}
