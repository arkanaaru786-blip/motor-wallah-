import { useState } from "react";
import { CheckCircle2, Pencil, Trash2, X } from "lucide-react";

import { dealerCategoryLabel } from "@/lib/dealer-categories";
import {
  deleteVehicle,
  updateVehicle,
  type DealerVehicle,
  type VehicleInput,
} from "@/lib/dealer-data";
import { rupees, shortDate } from "@/lib/dealer-format";
import type { DealerSession } from "@/lib/dealer-session";
import { VehicleForm } from "./VehicleForm";

const CHIP: Record<DealerVehicle["status"], string> = {
  Pending: "is-pending",
  Active: "is-active",
  Sold: "is-sold",
};

export function DealerInventory({
  session,
  vehicles,
  refresh,
}: {
  session: DealerSession;
  vehicles: DealerVehicle[];
  refresh: () => void;
}) {
  const [editing, setEditing] = useState<DealerVehicle | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = (input: VehicleInput) => {
    if (!editing) return { ok: false as const, error: "Choose a listing first." };
    const result = updateVehicle(session, editing.id, input);
    if (!result.ok) return result;
    setFlash(`${result.value.name} updated.`);
    setEditing(null);
    refresh();
    return { ok: true as const };
  };

  const remove = (vehicle: DealerVehicle) => {
    const result = deleteVehicle(session, vehicle.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirming(null);
    setFlash(`${vehicle.name} deleted from your inventory.`);
    refresh();
  };

  return (
    <>
      <div className="mw-dealer-head">
        <div>
          <h1>My {dealerCategoryLabel(session.category)} Inventory</h1>
          <p>
            Every listing you own, with its live views, leads and status. Only{" "}
            {dealerCategoryLabel(session.category).toLowerCase()} rows can exist here.
          </p>
        </div>
      </div>

      {flash ? (
        <p className="mw-dealer-flash" role="status" data-testid="inventory-flash">
          <CheckCircle2 size={15} /> {flash}
        </p>
      ) : null}
      {error ? (
        <p className="mw-dealer-error" role="alert">
          {error}
        </p>
      ) : null}

      {editing ? (
        <section className="mw-dealer-panel is-wide">
          <div className="mw-dealer-panel-head">
            <div>
              <h2>
                <Pencil size={15} /> Edit {editing.name}
              </h2>
              <p>The category stays fixed; brand and model come from your own catalogue.</p>
            </div>
          </div>
          <VehicleForm
            session={session}
            initial={editing}
            submitLabel="Save changes"
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </section>
      ) : null}

      <section className="mw-dealer-panel is-wide">
        <div className="mw-dealer-panel-head">
          <div>
            <h2>Listings ({vehicles.length})</h2>
            <p>Vehicle name, views, leads and status. Edit or delete from the last column.</p>
          </div>
        </div>

        {vehicles.length === 0 ? (
          <p className="mw-dealer-empty">
            Nothing in your inventory yet. Use “Add Vehicle” to create your first listing.
          </p>
        ) : (
          <div className="mw-dealer-tablewrap">
            <table className="mw-dealer-table" data-testid="inventory-table">
              <thead>
                <tr>
                  <th scope="col">Vehicle name</th>
                  <th scope="col">Views</th>
                  <th scope="col">Leads</th>
                  <th scope="col">Status</th>
                  <th scope="col">Added</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id} data-testid={`inventory-row-${vehicle.id}`}>
                    <td>
                      <strong>{vehicle.name}</strong>
                      <div className="is-muted">
                        {vehicle.year} · {vehicle.km.toLocaleString("en-IN")} km · {vehicle.fuel} ·{" "}
                        {rupees(vehicle.price)}
                      </div>
                    </td>
                    <td className="is-num">{vehicle.views.toLocaleString("en-IN")}</td>
                    <td className="is-num">{vehicle.leads}</td>
                    <td>
                      <span className={`mw-dealer-chip ${CHIP[vehicle.status]}`}>
                        {vehicle.status}
                      </span>
                    </td>
                    <td className="is-muted">{shortDate(vehicle.createdAt)}</td>
                    <td>
                      <div className="mw-dealer-actions">
                        <button
                          type="button"
                          className="mw-dealer-btn is-small"
                          onClick={() => {
                            setEditing(vehicle);
                            setFlash(null);
                          }}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        {confirming === vehicle.id ? (
                          <>
                            <button
                              type="button"
                              className="mw-dealer-btn is-small is-danger"
                              onClick={() => remove(vehicle)}
                              data-testid="inventory-delete-confirm"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              className="mw-dealer-btn is-small is-quiet"
                              onClick={() => setConfirming(null)}
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="mw-dealer-btn is-small is-danger"
                            onClick={() => {
                              setConfirming(vehicle.id);
                              setError(null);
                            }}
                            data-testid="inventory-delete"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
