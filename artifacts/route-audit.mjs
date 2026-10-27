import { chromium } from "/workspace/homes/6c4a0adeccea143873c1c9fb/pwtools/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";

/**
 * Full-flow audit (Buy, Sell, Exchange, Value, Compare, Service, Scrap):
 *  1. Every flow + category route responds and renders (no 404 / blank).
 *  2. Zero console errors, page errors or same-origin failed requests.
 *  3. No broken internal links (checked against the generated route tree).
 *  4. No broken <img> resources anywhere in the crawled pages.
 *  5. Homepage service tiles point at the flow routes (not /cars, /contact).
 *  6. /book-service redirects to /services.
 *  7. "Make an Offer" and "Chat with Seller" dialogs open on a listing page.
 */
const BASE = "http://localhost:3000";
const SHOTS = "artifacts";
const consoleErrors = [];
const pageErrors = [];
const badResponses = []; // same-origin HTTP >= 400
const externalBad = []; // cross-origin failures (reported as warnings)
const results = [];

const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
};

const ROUTES = [
  "/", "/buy", "/cars", "/buy/bikes", "/buy/buses", "/buy/scv", "/buy/taxi",
  "/buy/three-wheelers", "/buy/tractors", "/buy/trucks", "/buy/offers",
  "/sell-your-car", "/exchange", "/compare", "/services", "/scrap", "/track",
  "/finance", "/insurance", "/contact", "/locations",
];

const listen = (page, label) => {
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`${label}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => pageErrors.push(`${label}: ${err.message}`));
  page.on("response", (res) => {
    if (res.status() >= 400) {
      const entry = `${label}: ${res.status()} ${res.url()}`;
      if (new URL(res.url()).origin === new URL(BASE).origin) badResponses.push(entry);
      else externalBad.push(entry);
    }
  });
};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(`nav: ${msg.text()}`);
});
page.on("pageerror", (err) => pageErrors.push(`nav: ${err.message}`));

/* ---- 1. Route responses ---- */
const routeStatus = {};
for (const route of ROUTES) {
  const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  routeStatus[route] = res?.status() ?? 0;
  await page.waitForTimeout(250);
}
const deadRoutes = Object.entries(routeStatus).filter(([, s]) => s >= 400 || s === 0);
check(
  "All flow/category routes respond < 400",
  deadRoutes.length === 0,
  deadRoutes.length ? JSON.stringify(deadRoutes) : `${ROUTES.length} routes OK`,
);

/* Grid-first render checks (element presence, not just status). */
const gridFirst = [
  ["/buy", "#mw-hub", "buy hub"],
  ["/sell-your-car", ".mw-sell-grid", "sell grid"],
  ["/exchange", ".mw-sell-grid", "exchange grid"],
  ["/compare", ".mw-sell-grid", "compare grid"],
  ["/services", ".mw-sell-grid", "service grid"],
  ["/scrap", ".mw-sell-grid", "scrap grid"],
];
for (const [route, sel, label] of gridFirst) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const count = await page.locator(sel).count();
  const formish = await page.locator("#sell-form, #exchange-form, #compare-form, #service-form, #scrap-form").count();
  check(`GRID-FIRST: ${route} shows the ${label} (no form open)`, count >= 1 && formish === 0, `count=${count} forms=${formish}`);
}

/* ---- 6. /book-service redirect ---- */
await page.goto(`${BASE}/book-service`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
check(
  "Legacy /book-service redirects to /services (grid first)",
  page.url().includes("/services") &&
    (await page.locator(".mw-sell-grid").count()) >= 1,
  page.url(),
);

/* ---- 5. Homepage service tiles ---- */
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
const tileHrefs = await page.evaluate(() => {
  const map = {};
  for (const a of document.querySelectorAll("a[href]")) {
    const label = (a.textContent ?? "").trim().split("\n")[0].trim().slice(0, 30);
    map[label] = a.getAttribute("href");
  }
  return map;
});
const expected = [
  ["Buy", "/buy"], ["Sell", "/sell-your-car"], ["Exchange", "/exchange"],
  ["Value", "/sell-your-car"], ["Compare", "/compare"], ["Service", "/services"],
  ["Scrap", "/scrap"],
];
const wrongTiles = expected.filter(([label, want]) => {
  const href = tileHrefs[label];
  return href !== want;
});
check(
  "Homepage action tiles (Buy/Sell/Exchange/Value/Compare/Service/Scrap) point at their flows",
  wrongTiles.length === 0,
  wrongTiles.length
    ? JSON.stringify(wrongTiles.map(([l]) => `${l}→${tileHrefs[l]}`))
    : JSON.stringify(Object.fromEntries(expected)),
);
const bookLinks = await page.evaluate(() =>
  [...document.querySelectorAll('a[href="/book-service"]')].length,
);
check("No /book-service links remain on the homepage", bookLinks === 0, `${bookLinks} found`);
await page.screenshot({ path: `${SHOTS}/audit-home-actions.png`, fullPage: false });

/* ---- 3. Broken internal links vs generated route tree ---- */
const tree = readFileSync("src/routeTree.gen.ts", "utf8");
const routePaths = [...tree.matchAll(/path: '([^']+)'/g)].map((m) => m[1]);
const known = routePaths.map((p) =>
  (p.replace(/\$[^/]+/g, "__PARAM__").replace(/\/$/, "") || "/"),
);
const seen = new Set();
const brokenLinks = [];
for (const page_ of ["/", "/buy", "/sell-your-car", "/services", "/cars"]) {
  await page.goto(`${BASE}${page_}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
  );
  for (const href of hrefs) {
    if (!href || !href.startsWith("/") || href.startsWith("//") || seen.has(href)) continue;
    seen.add(href);
    const path = href.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
    const normalized = path === "" ? "/" : path;
    const matches = known.some((k) =>
      k === normalized || (k.includes("__PARAM__") && new RegExp(`^${k.replace(/__PARAM__/, "[^/]+")}$`).test(normalized)),
    );
    if (!matches && !normalized.startsWith("/assets")) brokenLinks.push(`${page_} → ${href}`);
  }
}
check(
  "Every internal link on home/buy/sell/services/cars resolves to a real route",
  brokenLinks.length === 0,
  brokenLinks.length ? brokenLinks.slice(0, 8).join(" | ") : `${seen.size} links checked`,
);

/* ---- 7. Make an Offer + Chat with Seller ---- */
const firstListing = await page.evaluate(() => {
  const a = document.querySelector('a[href*="/buy/vehicle/"], a[href*="/cars/"]');
  return a?.getAttribute("href") ?? null;
});
await page.goto(`${BASE}/buy?category=cars`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const listingHref =
  (await page.evaluate(() =>
    document.querySelector('a[href*="vehicle"]')?.getAttribute("href") ?? null,
  )) ?? firstListing;
check("A listing detail link exists on the buy listing page", Boolean(listingHref), String(listingHref));

let offerOk = false;
let chatOk = false;
let offerDetail = "";
let chatDetail = "";
try {
if (listingHref) {
  await page.goto(`${BASE}${listingHref}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const offerBtn = page.locator("button:visible, a:visible").filter({ hasText: /make an offer/i }).first();
  if ((await offerBtn.count()) > 0) {
    await offerBtn.click();
    await page.waitForTimeout(500);
    const dialogText = await page
      .locator('[role="dialog"], .MakeOfferDialog, dialog')
      .first()
      .textContent()
      .catch(() => null);
    offerOk = Boolean(dialogText && /offer/i.test(dialogText));
    offerDetail = (dialogText ?? "").replace(/\s+/g, " ").slice(0, 90);
    await page.screenshot({ path: `${SHOTS}/audit-make-offer.png`, fullPage: false });
    const cancel = page.locator(".buy-offer-cancel");
    if ((await cancel.count()) > 0) await cancel.click();
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
  } else {
    offerDetail = "button not found";
  }
  check('Listing page has a working "Make an Offer" dialog', offerOk, offerDetail);

  const chatBtn = page
    .locator("button:visible, a:visible")
    .filter({ hasText: /chat with seller|contact seller|chat/i })
    .first();
  if ((await chatBtn.count()) > 0) {
    await chatBtn.click();
    await page.waitForTimeout(500);
    const dialogText = await page
      .locator('[role="dialog"], dialog')
      .first()
      .textContent()
      .catch(() => null);
    chatOk = Boolean(dialogText && /chat with seller/i.test(dialogText));
    chatDetail = (dialogText ?? "").replace(/\s+/g, " ").slice(0, 90);
    await page.screenshot({ path: `${SHOTS}/audit-chat-seller.png`, fullPage: false });
  } else {
    chatDetail = "button not found";
  }
  check('Listing page has a working "Chat with Seller" dialog', chatOk, chatDetail);
} else {
  check('Listing page has a working "Make an Offer" dialog', false, "no listing page");
  check('Listing page has a working "Chat with Seller" dialog', false, "no listing page");
}
} catch (err) {
  if (!results.some((r) => r.name.includes("Make an Offer")))
    check('Listing page has a working "Make an Offer" dialog', false, err.message.split("\n")[0]);
  if (!results.some((r) => r.name.includes("Chat with Seller")))
    check('Listing page has a working "Chat with Seller" dialog', false, err.message.split("\n")[0]);
}

/* ---- 2 & 4. Console / response health across every route ---- */
for (const route of ROUTES) {
  listen(page, route);
}
for (const route of ROUTES) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(350);
}
check(
  "Zero console errors across all routes",
  consoleErrors.length === 0,
  consoleErrors.slice(0, 5).join(" | ") || "none",
);
check(
  "Zero page (uncaught) errors across all routes",
  pageErrors.length === 0,
  pageErrors.slice(0, 5).join(" | ") || "none",
);
check(
  "Zero same-origin 404/500 responses (routes, chunks, images)",
  badResponses.length === 0,
  badResponses.slice(0, 8).join(" | ") || "none",
);
console.log(
  `WARN — cross-origin asset failures (external proxy, non-blocking): ${externalBad.length}`,
);
if (externalBad.length) console.log(externalBad.slice(0, 6).join("\n"));

const failed = results.filter((r) => !r.pass);
console.log(`AUDIT RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log("FAILED:\n" + failed.map((f) => `- ${f.name} (${f.detail})`).join("\n"));
await browser.close();
process.exit(failed.length ? 1 : 0);
