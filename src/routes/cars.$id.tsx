import { createFileRoute, redirect } from "@tanstack/react-router";
import { getVehicle } from "@/lib/cars-data";
import { getBuyListing } from "@/lib/buy-catalog";

/**
 * Legacy car listing URLs (slug or internal id) resolve to the one unified
 * vehicle page. There is no second listing design any more.
 */
export const Route = createFileRoute("/cars/$id")({
  beforeLoad: ({ params }) => {
    const vehicle = getVehicle(params.id);
    const id = vehicle?.id ?? params.id;
    if (!getBuyListing(id))
      throw redirect({ to: "/buy", search: { category: "cars" }, replace: true });
    throw redirect({ to: "/buy/vehicle/$id", params: { id }, replace: true });
  },
});
