import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const results = [];
const check = (name, ok, extra = "") =>
  (results.push(ok), console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

// Step 1 — vehicle category grid FIRST (no products, no form).
await page.goto(`${BASE}/accessories`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('[data-category="cars"]', { timeout: 10000 });
const vehicleCards = await page.locator(".mw-sell-cat").count();
const productsShown = await page.locator('[data-testid="product-card"]').count();
check("STEP 1 vehicle grid first", vehicleCards === 8 && productsShown === 0, `${vehicleCards} vehicles`);
await page.screenshot({ path: "artifacts/ecom-1-vehicle.png" });

// Step 2a — brand grid with logos after picking Cars.
await page.locator('[data-category="cars"]').click();
await page.waitForSelector('[data-testid="brand-card"]', { timeout: 8000 });
const brandCards = await page.locator('[data-testid="brand-card"]').count();
check("STEP 2 brand grid after vehicle", brandCards >= 4, `${brandCards} brands`);
await page.screenshot({ path: "artifacts/ecom-2-brand.png" });

// Step 2b — model list after picking a brand.
await page.locator('[data-testid="brand-card"]').first().click();
await page.waitForSelector('[data-testid="model-chip"]', { timeout: 8000 });
const models = await page.locator('[data-testid="model-chip"]').count();
check("STEP 2 model list after brand", models >= 3, `${models} models`);

// Step 3 — parts category grid after picking a model.
await page.locator('[data-testid="model-chip"]').first().click();
await page.waitForSelector('[data-testid="part-card"]', { timeout: 8000 });
const partCards = await page.locator('[data-testid="part-card"]').count();
check("STEP 3 parts category grid", partCards === 8, `${partCards} part categories`);
await page.screenshot({ path: "artifacts/ecom-3-parts.png" });

// Step 4 — product listing (Flipkart style).
await page.locator('[data-testid="part-card"]').nth(1).click();
await page.waitForSelector('[data-testid="product-card"]', { timeout: 8000 });
const productCards = await page.locator('[data-testid="product-card"]').count();
const firstName = await page.locator('[data-testid="product-card"] h3').first().textContent();
const hasPrice = (await page.locator('[data-testid="product-card"] strong').first().textContent() ?? "").includes("₹");
const hasAdd = (await page.locator('[data-testid="add-to-cart"]').count()) > 0;
const hasBuy = (await page.locator('[data-testid="buy-now"]').count()) > 0;
check(
  "STEP 4 product grid: image/name/price/Add to Cart/Buy Now",
  productCards >= 6 && hasPrice && hasAdd && hasBuy,
  `${productCards} products, e.g. "${firstName?.slice(0, 40)}"`,
);
check("STEP 4 prepaid notice shown", (await page.locator('[data-testid="prepaid-notice"]').count()) > 0);
await page.screenshot({ path: "artifacts/ecom-4-products.png" });

// Add to Cart → cart counter increments, drawer opens.
await page.locator('[data-testid="add-to-cart"]').first().click();
await page.locator('[data-testid="add-to-cart"]').nth(1).click();
const cartCount = await page.locator('[data-testid="cart-count"]').textContent();
check("CART counter after 2 adds", cartCount?.trim() === "2", `count=${cartCount}`);
await page.locator('[data-testid="cart-button"]').click();
await page.waitForSelector('.mw-parts-drawer', { timeout: 5000 });
const drawerLines = await page.locator(".mw-parts-drawer-lines li").count();
check("CART drawer lists 2 lines", drawerLines === 2, `${drawerLines} lines`);
check(
  "CART drawer prepaid notice",
  (await page.locator('.mw-parts-drawer [data-testid="prepaid-notice"]').count()) > 0,
);
await page.screenshot({ path: "artifacts/ecom-5-cart.png" });

// Buy Now on a product → checkout with prepaid payment block.
await page.locator('.mw-parts-drawer-foot .mw-sell-submit').click();
await page.waitForSelector('[data-testid="place-order"]', { timeout: 8000 });
check(
  "CHECKOUT prepaid-only block",
  (await page.locator('.mw-parts-payment').count()) > 0,
);
await page.screenshot({ path: "artifacts/ecom-6-checkout.png" });

// Place the prepaid order → success with order id.
await page.fill('input[name="name"]', "Test Buyer");
await page.fill('input[name="mobile"]', "9876543210");
await page.fill('input[name="city"]', "Indore");
await page.locator('[data-testid="place-order"]').click();
await page.waitForSelector('[data-testid="order-id"]', { timeout: 8000 });
const orderId = await page.locator('[data-testid="order-id"] strong').textContent();
check("ORDER success with MW-ORD id", /^MW-ORD-\d{5}$/.test(orderId?.trim() ?? ""), orderId ?? "");
await page.screenshot({ path: "artifacts/ecom-7-done.png" });

// The lead was actually saved to the queue.
const leadSaved = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("mw_lead_queue") ?? "[]").some((lead) =>
    lead.type === "parts_enquiry" && Boolean(lead.fields && lead.fields.orderId),
  ),
);
check("LEAD saved with orderId", leadSaved);

check("NO console/page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
