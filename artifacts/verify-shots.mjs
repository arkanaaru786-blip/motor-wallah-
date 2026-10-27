import { chromium } from "/workspace/homes/6c4a0adeccea143873c1c9fb/pwtools/node_modules/playwright/index.mjs";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const flows = [
  ["/buy", "#mw-hub", "verify-buy-grid"],
  ["/sell-your-car", ".mw-sell-grid", "verify-sell-grid"],
  ["/exchange", ".mw-sell-grid", "verify-exchange-grid"],
  ["/services", ".mw-sell-grid", "verify-service-grid"],
];
for (const [route, sel, name] of flows) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(sel, { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `artifacts/${name}.png` });
  console.log(`shot ${name}: grid visible`);
  const card = page.locator('[data-category="cars"], .mw-hub-card').first();
  if ((await card.count()) > 0) {
    await card.click();
    await page.waitForTimeout(900);
    const formSel = route === "/buy" ? "#buy-browse" : "#sell-form, #exchange-form, #service-form";
    const ok = (await page.locator(formSel).count()) > 0;
    await page.screenshot({ path: `artifacts/${name.replace("grid", "form")}.png` });
    console.log(`  ${route} → category click → ${ok ? "form/listing OPEN" : "MISSING"} (${formSel})`);
  }
}
// Service type list check (cars) for the shot
await page.goto(`${BASE}/services`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".mw-sell-grid");
await page.locator('[data-category="cars"]').click();
await page.waitForSelector("#service-form");
const opts = await page.locator('select[name="serviceType"] option').allTextContents();
console.log("cars service types:", opts.filter(Boolean).join(" | "));
await browser.close();
