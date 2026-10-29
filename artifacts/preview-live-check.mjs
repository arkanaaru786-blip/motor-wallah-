import { chromium } from "playwright";

// The public hostname is verified separately with a Host header; inside the
// sandbox DNS for *.style.dev may not resolve, so the browser hits localhost.
const BASE = "http://127.0.0.1:3000";
const results = [];
const check = (name, ok, extra = "") =>
  (results.push(ok), console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

// Auto Parts — grid first, then form after click.
await page.goto(`${BASE}/accessories`, { waitUntil: "networkidle" });
check("AUTO PARTS grid first", (await page.locator(".mw-sell-cat").count()) === 3);
await page.screenshot({ path: "artifacts/live-parts-grid.png" });
await page.getByRole("button", { name: /Request New Auto Parts/i }).click();
await page.waitForSelector('[data-testid="part-type"]', { timeout: 5000 });
check("AUTO PARTS form opens", true);
await page.screenshot({ path: "artifacts/live-parts-form.png" });

// Exchange — grid first, then form.
await page.goto(`${BASE}/exchange`, { waitUntil: "networkidle" });
check("EXCHANGE grid first", (await page.locator(".mw-sell-cat").count()) === 8);
await page.locator('.mw-sell-cat[data-category="cars"]').click();
await page.waitForSelector("#exchange-form", { timeout: 5000 });
check("EXCHANGE form opens after category click", true);
await page.screenshot({ path: "artifacts/live-exchange-form.png" });

// Service — grid first, dynamic service type after click.
await page.goto(`${BASE}/services`, { waitUntil: "networkidle" });
check("SERVICE grid first", (await page.locator(".mw-sell-cat").count()) === 8);
await page.locator('.mw-sell-cat[data-category="bikes"]').click();
await page.waitForSelector('[data-testid="service-type"]', { timeout: 5000 });
const opts = await page.locator('[data-testid="service-type"] option').allTextContents();
check("SERVICE dynamic dropdown (Bikes)", opts.includes("Clutch & Chain Sprocket"), `${opts.length - 1} options`);
await page.screenshot({ path: "artifacts/live-service-form.png" });

check("NO console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
