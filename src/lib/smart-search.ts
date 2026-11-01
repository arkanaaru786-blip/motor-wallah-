/**
 * SMART SEARCH — one fuzzy index over everything the marketplace actually
 * stocks: vehicles from the BUY catalogue, auto-parts items from the parts
 * store and decor items from the decor store.
 *
 * No second inventory is invented here; every hit points back at a real
 * listing or catalogue record. Matching is deliberately forgiving so a
 * half-typed query ("swit", "tata", "brake pad") still finds the record.
 */
import { BUY_LISTINGS, lakhLabel, rupees, type BuyListing } from "@/lib/buy-catalog";
import { PART_CATEGORY_LIST } from "@/lib/parts-store";
import { DECOR_CATEGORY_LIST } from "@/lib/decor-store";

export type SuggestionKind = "vehicle" | "part" | "decor";

export type Suggestion = {
  kind: SuggestionKind;
  /** Vehicle id, or `category|item` for parts/decor. */
  id: string;
  title: string;
  subtitle: string;
  score: number;
};

export type PartHit = {
  id: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  min: number;
  max: number;
  score: number;
};

export type DecorHit = {
  id: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  min: number;
  max: number;
  score: number;
};

export type VehicleHit = { listing: BuyListing; score: number };

/* ------------------------------------------------------------------ fuzzy */
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** True when every character of `needle` appears in `hay`, in order. */
const isSubsequence = (needle: string, hay: string) => {
  let cursor = 0;
  for (const char of hay) {
    if (char === needle[cursor]) cursor += 1;
    if (cursor === needle.length) return true;
  }
  return needle.length === 0;
};

/** Levenshtein distance, bailing out once it cannot stay small. */
const editDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = prev[j]!;
      prev[j] = Math.min(
        prev[j]! + 1,
        prev[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = temp;
    }
  }
  return prev[b.length]!;
};

/** How well one typed word matches one word of a record. 0 means no match. */
const wordScore = (token: string, word: string): number => {
  if (!word) return 0;
  if (word === token) return 100;
  if (word.startsWith(token)) return 92;
  if (token.length >= 3 && word.includes(token)) return 74;
  if (token.length >= 3 && isSubsequence(token, word)) return 58;
  const limit = token.length <= 4 ? 1 : 2;
  if (editDistance(token, word) <= limit) return 52; // Typo in a partially typed word: "balenoo" vs "baleno…", long tokens only so
  // short words cannot drag in unrelated records.
  if (
    token.length >= 5 &&
    word.length > token.length &&
    editDistance(token, word.slice(0, token.length)) <= 1
  )
    return 44;
  return 0;
};

/** 0 = no match. Higher is better. Every query word must match something. */
export const fuzzyScore = (query: string, target: string): number => {
  const tokens = normalize(query).split(" ").filter(Boolean);
  if (!tokens.length) return 0;
  const words = normalize(target).split(" ").filter(Boolean);
  if (!words.length) return 0;

  let total = 0;
  for (const token of tokens) {
    let best = 0;
    for (const word of words) best = Math.max(best, wordScore(token, word));
    if (best === 0) return 0;
    total += best;
  }
  const phrase = normalize(query);
  const bonus = words.join(" ").includes(phrase) ? 12 : 0;
  return total / tokens.length + bonus;
};

/* --------------------------------------------------------------- indexing */
const vehicleTarget = (listing: BuyListing) =>
  `${listing.brand} ${listing.model} ${listing.variant ?? ""} ${listing.categoryLabel} ${listing.city} ${listing.year}`;

const vehicleTitle = (listing: BuyListing) => `${listing.brand} ${listing.model}`;

const vehicleSubtitle = (listing: BuyListing) =>
  [listing.categoryLabel, String(listing.year), lakhLabel(listing.priceLakh), listing.city]
    .filter(Boolean)
    .join(" · ");

export const searchVehicles = (query: string): VehicleHit[] => {
  const q = query.trim();
  if (!q) return [];
  return BUY_LISTINGS.map((listing) => ({ listing, score: fuzzyScore(q, vehicleTarget(listing)) }))
    .filter((hit) => hit.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.listing.year - a.listing.year ||
        a.listing.priceLakh - b.listing.priceLakh,
    );
};

export const searchParts = (query: string): PartHit[] => {
  const q = query.trim();
  if (!q) return [];
  const seen = new Set<string>();
  const hits: PartHit[] = [];
  for (const category of PART_CATEGORY_LIST) {
    for (const item of category.items) {
      const score = fuzzyScore(q, `${item} ${category.label} parts ${category.blurb}`);
      if (score <= 0) continue;
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        id: `${category.id}|${item}`,
        name: item,
        categoryId: category.id,
        categoryLabel: category.label,
        min: category.min,
        max: category.max,
        score,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
};

export const searchDecor = (query: string): DecorHit[] => {
  const q = query.trim();
  if (!q) return [];
  const seen = new Set<string>();
  const hits: DecorHit[] = [];
  for (const category of DECOR_CATEGORY_LIST) {
    for (const item of category.items) {
      const score = fuzzyScore(q, `${item} ${category.label} decor ${category.blurb}`);
      if (score <= 0) continue;
      const key = item.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        id: `${category.id}|${item}`,
        name: item,
        categoryId: category.id,
        categoryLabel: category.label,
        min: category.min,
        max: category.max,
        score,
      });
    }
  }
  return hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
};

/** Top suggestions for the dropdown: vehicles first, then parts, then decor. */
export const suggest = (query: string, limit = 5): Suggestion[] => {
  const q = query.trim();
  if (q.length < 2) return [];

  const pool: Suggestion[] = [
    ...searchVehicles(q)
      .slice(0, 12)
      .map(({ listing, score }) => ({
        kind: "vehicle" as const,
        id: listing.id,
        title: vehicleTitle(listing),
        subtitle: vehicleSubtitle(listing),
        score: score + 6,
      })),
    ...searchParts(q)
      .slice(0, 8)
      .map((hit) => ({
        kind: "part" as const,
        id: hit.id,
        title: hit.name,
        subtitle: `${hit.categoryLabel} · ${rupees(hit.min)} – ${rupees(hit.max)}`,
        score: hit.score,
      })),
    ...searchDecor(q)
      .slice(0, 8)
      .map((hit) => ({
        kind: "decor" as const,
        id: hit.id,
        title: hit.name,
        subtitle: `${hit.categoryLabel} · ${rupees(hit.min)} – ${rupees(hit.max)}`,
        score: hit.score,
      })),
  ];

  const seen = new Set<string>();
  return pool
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .filter((item) => {
      const key = `${item.kind}|${item.title.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

/** How a hit reads in the results page: "2022 Maruti Suzuki Baleno Zeta". */
export const vehicleHitName = (listing: BuyListing) =>
  [listing.year, listing.brand, listing.model, listing.variant].filter(Boolean).join(" ");
