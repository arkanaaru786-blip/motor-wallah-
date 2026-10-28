import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const results = [];
const check = (name, ok, extra = "") =>
  (results.push({ name, ok, extra }), console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

// 1. Every service route opens its CATEGORY GRID first — no form, no old listing.
const gridFirst = [
  ["/buy", ".mw-hub-card"],
  ["/sell-your-car", ".mw-sell-cat"],
  ["/exchange", ".mw-sell-cat"],
  ["/compare", ".mw-sell-cat"],
  ["/services", ".mw-sell-cat"],
  ["/scrap", ".mw-sell-cat"],
  ["/accessories", ".mw-sell-cat"],
];
for (const [route, sel] of gridFirst) {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  const gridCount = await page.locator(sel).count();
  const formVisible = await page.locator("form select, form input").count().catch(() => 0);
  check(`GRID FIRST ${route}`, gridCount >= 3 && formVisible === 0, `${gridCount} cards, ${formVisible} form inputs`);
}

// 2. Auto Parts: click "New Auto Parts" → dynamic form with category-scoped Part dropdown.
await page.goto(BASE + "/accessories", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Request New Auto Parts/i }).click();
await page.waitForSelector('[data-testid="part-type"]', { timeout: 5000 });
const partOptions = await page.locator('[data-testid="part-type"] option').allTextContents();
check(
  "AUTO PARTS form opens after grid click",
  partOptions.includes("Brake Components") && partOptions.includes("Lights & Electrical"),
  `${partOptions.length - 1} part options`,
);
await page.screenshot({ path: "artifacts/verify-parts-form.png", fullPage: false });

// Part options change for accessories category (CRITICAL dynamic dropdown).
await page.goto(BASE + "/accessories?view=form&cat=accessories", { waitUntil: "networkidle" });
const accOptions = await page.locator('[data-testid="part-type"] option').allTextContents();
check(
  "AUTO PARTS options scoped per category",
  accOptions.includes("Seat Covers & Cushions") && !accOptions.includes("Brake Components"),
  accOptions.length - 1 + " options",
);

// Grid screenshot for the report.
await page.goto(BASE + "/accessories", { waitUntil: "networkidle" });
await page.screenshot({ path: "artifacts/verify-parts-grid.png", fullPage: false });

// 3. Service: dynamic Service Type still scoped per category.
await page.goto(BASE + "/services?view=form&cat=cars", { waitUntil: "networkidle" });
const carSvc = await page.locator('[data-testid="service-type"] option').allTextContents();
check(
  "SERVICE dropdown scoped (Cars)",
  carSvc.includes("Periodic/General Service") && carSvc.includes("Detailing & Car Spa"),
  `${carSvc.length - 1} options`,
);

// 4. A category click on /services opens the form (grid → form navigation).
await page.goto(BASE + "/services", { waitUntil: "networkidle" });
await page.locator('.mw-sell-cat[data-category="bikes"]').click();
await page.waitForSelector('[data-testid="service-type"]', { timeout: 5000 });
const bikeSvc = await page.locator('[data-testid="service-type"] option').allTextContents();
check(
  "SERVICE grid → form click-through (Bikes)",
  bikeSvc.includes("Clutch & Chain Sprocket") && !bikeSvc.includes("Periodic/General Service"),
  `${bikeSvc.length - 1} options`,
);

// 5. Buy: grid click → listing browser.
await page.goto(BASE + "/buy", { waitUntil: "networkidle" });
await page.locator(".mw-hub-card").first().click();
await page.waitForSelector("#buy-browse", { timeout: 5000 });
check("BUY grid → listing browser", true);

// 6. Console errors so far.
check("NO console/page errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
