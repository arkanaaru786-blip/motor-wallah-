import { describeSupabaseError, supabaseClient } from "@/lib/supabase";
import { staffClient, staffSession } from "@/lib/staff-auth";
import { BUY_CATEGORY_LIST, type BuyCategoryId, type BuyListing } from "@/lib/buy-catalog";
import type { DealerScope, DealerVehicle } from "@/lib/dealer-data";

/**
 * Vehicle approval queue.
 *
 * A dealer's new listing is written to `vehicle_approvals` as Pending (see
 * supabase/admin-features.sql). The control room approves or rejects it; the
 * public site can read Approved rows, which is how an approved vehicle goes
 * live without giving dealers a way to publish directly.
 */

export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

export type VehicleApproval = {
  id: string;
  dealerId: string;
  dealerName: string;
  category: BuyCategoryId;
  brand: string;
  model: string;
  vehicleName: string;
  year: number;
  price: number;
  km: number;
  fuel: string;
  city: string;
  status: ApprovalStatus;
  featured: boolean;
  description: string;
  images: string[];
  rejectionReason: string;
  createdAt: string;
  decidedAt: string | null;
};

export const APPROVALS_SETUP_HINT =
  "The vehicle_approvals table is not in this database yet. Run supabase/admin-features.sql in the Supabase SQL editor, then reload this page.";

const COLUMNS =
  "id, dealer_id, dealer_name, category, brand, model, vehicle_name, year, price, km, fuel, city, status, featured, description, image_urls, rejection_reason, created_at, decided_at";

type Row = {
  id: string;
  dealer_id: string;
  dealer_name: string | null;
  category: string;
  brand: string;
  model: string;
  vehicle_name: string | null;
  year: number;
  price: number | string;
  km: number | null;
  fuel: string | null;
  city: string | null;
  status: string | null;
  featured: boolean | null;
  description: string | null;
  image_urls: string[] | null;
  rejection_reason: string | null;
  created_at: string;
  decided_at: string | null;
};

const isBuyCategory = (value: string): value is BuyCategoryId =>
  BUY_CATEGORY_LIST.some((category) => category.id === value);

const rowToApproval = (row: Row): VehicleApproval => ({
  id: row.id,
  dealerId: row.dealer_id,
  dealerName: row.dealer_name ?? "",
  category: isBuyCategory(row.category) ? row.category : "cars",
  brand: row.brand,
  model: row.model,
  vehicleName: row.vehicle_name ?? `${row.brand} ${row.model}`,
  year: Number(row.year),
  price: Number(row.price),
  km: Number(row.km ?? 0),
  fuel: row.fuel ?? "Petrol",
  city: row.city ?? "",
  status: row.status === "Approved" || row.status === "Rejected" ? row.status : "Pending",
  featured: Boolean(row.featured),
  description: row.description ?? "",
  images: Array.isArray(row.image_urls)
    ? row.image_urls.filter((url) => typeof url === "string" && url.trim().length > 0)
    : [],
  rejectionReason: row.rejection_reason ?? "",
  createdAt: row.created_at,
  decidedAt: row.decided_at,
});

const isMissingTable = (error: { code?: string; message?: string } | null): boolean =>
  Boolean(error) &&
  (error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST205" ||
    /does not exist|column .* does not exist|could not find the table|schema cache/i.test(
      error?.message ?? "",
    ));

/**
 * Submit a dealer's new vehicle for review. Fire-and-forget: the portal's own
 * inventory is saved first, and a missing queue must not break that save.
 */
export async function submitVehicleForApproval(
  dealer: DealerScope & { dealerName?: string },
  vehicle: DealerVehicle,
): Promise<void> {
  const client = supabaseClient();
  if (!client) return;
  try {
    await client.from("vehicle_approvals").insert({
      dealer_id: dealer.dealerId,
      dealer_name: dealer.dealerName ?? "",
      category: vehicle.category,
      brand: vehicle.brand,
      model: vehicle.model,
      vehicle_name: vehicle.name,
      year: vehicle.year,
      price: vehicle.price,
      km: vehicle.km,
      fuel: vehicle.fuel,
      city: "",
    });
  } catch {
    /* the approval queue is unavailable; the dealer's own record is kept */
  }
}

export async function loadApprovals(): Promise<{
  approvals: VehicleApproval[];
  missing: boolean;
  error: string | null;
}> {
  const client = staffClient();
  if (!client) return { approvals: [], missing: false, error: "The database is not configured." };
  await staffSession();

  const { data, error } = await client
    .from("vehicle_approvals")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    return {
      approvals: [],
      missing: isMissingTable(error),
      error: isMissingTable(error) ? APPROVALS_SETUP_HINT : describeSupabaseError(error),
    };
  }
  return { approvals: ((data ?? []) as Row[]).map(rowToApproval), missing: false, error: null };
}

export type AdminVehicleInput = {
  category: BuyCategoryId;
  brand: string;
  model: string;
  year: number;
  price: number;
  km: number;
  fuel: string;
  city: string;
  description: string;
  photos: string[];
  featured: boolean;
};

/**
 * Add a vehicle directly from Master Control.
 *
 * It is inserted already Approved (the admin is the reviewer), and the
 * featured flag is what lifts it above normal inventory in the BUY grid.
 */
export async function createAdminVehicle(
  input: AdminVehicleInput,
): Promise<{ ok: boolean; error?: string }> {
  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };
  await staffSession();

  const { error } = await client.from("vehicle_approvals").insert({
    dealer_id: "master-admin",
    dealer_name: "Motor Wallah",
    category: input.category,
    brand: input.brand.trim(),
    model: input.model.trim(),
    vehicle_name: `${input.brand.trim()} ${input.model.trim()}`,
    year: Math.round(input.year),
    price: Math.round(input.price),
    km: Math.round(input.km),
    fuel: input.fuel,
    city: input.city.trim(),
    description: input.description.trim(),
    image_urls: input.photos.map((url) => url.trim()).filter(Boolean),
    featured: input.featured,
    status: "Approved",
    decided_at: new Date().toISOString(),
  });

  return error ? { ok: false, error: describeSupabaseError(error) } : { ok: true };
}

export async function decideApproval(
  id: string,
  status: "Approved" | "Rejected",
  reason = "",
): Promise<{ ok: boolean; error?: string }> {
  const client = staffClient();
  if (!client) return { ok: false, error: "The database is not configured for this build." };
  await staffSession();

  const { error } = await client
    .from("vehicle_approvals")
    .update({
      status,
      rejection_reason: status === "Rejected" ? reason.trim() : "",
      decided_at: new Date().toISOString(),
    })
    .eq("id", id);

  return error ? { ok: false, error: describeSupabaseError(error) } : { ok: true };
}

/** Public: approved dealer vehicles, shaped like the BUY catalogue. */
export async function loadApprovedListings(): Promise<BuyListing[]> {
  const client = supabaseClient();
  if (!client) return [];

  const { data, error } = await client
    .from("vehicle_approvals")
    .select(COLUMNS)
    .eq("status", "Approved")
    .order("decided_at", { ascending: false })
    .limit(100);

  if (error) return [];

  return ((data ?? []) as Row[]).map((row): BuyListing => {
    const approval = rowToApproval(row);
    const category = BUY_CATEGORY_LIST.find((entry) => entry.id === approval.category);
    const name = approval.vehicleName || `${approval.brand} ${approval.model}`;
    return {
      id: `dealer-${approval.id}`,
      categoryId: approval.category,
      categoryLabel: category?.label ?? "Vehicle",
      brand: approval.brand,
      model: approval.model,
      variant: null,
      year: approval.year,
      registrationYear: null,
      priceLakh: approval.price / 100000,
      kilometres: approval.km,
      fuel: approval.fuel,
      transmission: null,
      bodyType: null,
      city: approval.city || "Indore",
      locality: null,
      ownership: null,
      images: approval.images.length > 0 ? approval.images : category ? [category.image] : [],
      verified: true,
      status: "Available",
      demo: false,
      featured: approval.featured,
      description:
        approval.description ||
        `Approved ${approval.dealerName === "Motor Wallah" ? "Motor Wallah" : "dealer"} listing from ${approval.dealerName || approval.dealerId}.`,
      photoNote:
        approval.images.length > 0
          ? "Photos supplied with this listing."
          : "Illustrative category photograph — real photos are added after handover.",
      photoAlt: `${name} ${category?.label ?? "vehicle"} photograph`,
    };
  });
}

export const approvalDate = (iso: string | null) => {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
};

export const approvalPrice = (price: number) => `₹${Math.round(price).toLocaleString("en-IN")}`;
