import { chromium } from "/workspace/homes/6c4a0adeccea143873c1c9fb/pwtools/node_modules/playwright/index.mjs";

const BASE = "http://localhost:3000";
const SHOTS = "artifacts";
const errors = [];
const results = [];

const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

/* ================================================================== */
/* 1. PAGE 1 — CATEGORY HUB + PILL NAVIGATION                         */
/* ================================================================== */
await page.goto(`${BASE}/buy`, { waitUntil: "networkidle" });

const pillLabels = await page.locator(".mw-buy-pill").allInnerTexts();
const pillNorm = pillLabels.map((p) => p.trim().toLowerCase());
check(
  "pill nav has all 8 items",
  ["buy", "sell", "exchange", "value", "compare", "service", "scrap", "franchise"].every((l) =>
    pillNorm.includes(l),
  ),
  pillLabels.join(", "),
);
const activePills = await page.locator(".mw-buy-pill--active").allInnerTexts();
check(
  "BUY pill is the solid red active pill",
  activePills.length >= 1 && activePills.every((t) => t.trim().toLowerCase() === "buy"),
  activePills.join(", "),
);
check(
  "pill nav is the light header (mw-buy-nav)",
  (await page.locator("header.mw-buy-nav").count()) === 1,
);

check("hero title renders", (await page.locator(".mw-buy-hero-title").count()) === 1);

const vehicleCards = page.locator(".mw-hub-card:not(.mw-hub-card--service)");
const serviceCards = page.locator(".mw-hub-card--service");
check(
  "8 vehicle category cards",
  (await vehicleCards.count()) === 8,
  `${await vehicleCards.count()} cards`,
);
check(
  "service cards: New Parts, Used Parts, Finance, Insurance, RTO",
  (await serviceCards.count()) === 5,
  (await serviceCards.locator(".mw-hub-name").allInnerTexts()).join(" | "),
);

const firstCard = vehicleCards.first();
check(
  "hub card has bold name + blurb",
  (await firstCard.locator(".mw-hub-name").innerText()).trim().toLowerCase() === "cars" &&
    (await firstCard.locator(".mw-hub-blurb").innerText()).trim().length > 0,
  await firstCard.locator(".mw-hub-name").innerText(),
);
check(
  "hub card shows brand logos at the bottom",
  (await firstCard.locator(".mw-hub-brand-slot").count()) >= 3,
  `${await firstCard.locator(".mw-hub-brand-slot").count()} logo slots`,
);
const shadowBefore = await firstCard.evaluate((el) => getComputedStyle(el).boxShadow);
await firstCard.hover();
await page.waitForTimeout(350);
const shadowAfter = await firstCard.evaluate((el) => getComputedStyle(el).boxShadow);
check(
  "hover lifts the card with a shadow",
  shadowBefore !== shadowAfter && shadowAfter !== "none",
  `${shadowBefore} -> ${shadowAfter.slice(0, 60)}`,
);

check(
  "no sidebar / listing grid before a category is chosen",
  (await page.locator(".mw-side").count()) === 0 && (await page.locator(".mw-card").count()) === 0,
);
await page.screenshot({ path: `${SHOTS}/buy-01-hub.png`, fullPage: true });

/* ================================================================== */
/* 2. PAGE 2 — GLASS SIDEBAR ON THE LISTING VIEW                      */
/* ================================================================== */
await firstCard.click();
await page.waitForSelector(".mw-buy-layout");
check("category click opens the listing view", page.url().includes("category=cars"), page.url());
check(
  "sticky sidebar present",
  (await page.locator(".mw-side").evaluate((el) => getComputedStyle(el).position)) === "sticky",
);

const glass = await page.locator(".mw-side-inner").evaluate((el) => {
  const s = getComputedStyle(el);
  const blurs = [s.backdropFilter, s.webkitBackdropFilter]
    .filter((v) => v && v !== "none" && /blur/.test(v))
    .join(" ");
  return {
    bg: s.backgroundColor,
    blur: blurs || "none",
  };
});
check(
  "glassmorphism: rgba(255,255,255,0.8) background",
  glass.bg.replace(/\s/g, "") === "rgba(255,255,255,0.8)",
  glass.bg,
);
check("glassmorphism: backdrop blur(10px)", /blur\(10px\)/.test(glass.blur), glass.blur);

// Brand grid = logos only (plus the "All" tile), no text names.
const tiles = page.locator(".mw-brand-tile");
check("brand logo grid populated", (await tiles.count()) > 6, `${await tiles.count()} tiles`);
const tileText = await tiles.allInnerTexts();
check(
  "brand tiles are logo-only (just the All tile has text)",
  tileText.filter((t) => t.trim() && t.trim().toLowerCase() !== "all").length === 0,
  tileText.join(","),
);

// Model dropdown locked until a brand is picked.
check(
  "model dropdown disabled before picking a brand",
  (await page.locator(".mw-side-lock[data-disabled]").count()) === 1,
);

// Pick Maruti -> model dropdown unlocks with DISCONTINUED models included.
await page.locator('.mw-brand-tile[title^="Maruti"]').click();
await page.waitForTimeout(300);
check(
  "model dropdown unlocks after picking a brand",
  (await page.locator(".mw-side-lock[data-disabled]").count()) === 0,
);
await page.locator('.mw-side-panel button[aria-haspopup="listbox"]').first().click();
await page.waitForTimeout(250);
const modelOptions = (await page.locator("ul[role='listbox'] li").allInnerTexts()).map((m) =>
  m.trim(),
);
check(
  "Maruti model list includes discontinued models (Zen/Esteem)",
  modelOptions.some((m) => /zen|esteem/i.test(m)),
  modelOptions.join(", "),
);

// Pick a discontinued model: either zero listings with an honest message,
// or listings that really are that model.
const discontinued =
  modelOptions.find((m) => /zen/i.test(m)) ?? modelOptions.find((m) => /esteem/i.test(m));
if (discontinued) {
  await page.locator("ul[role='listbox'] li", { hasText: discontinued }).first().click();
  await page.waitForTimeout(400);
  const cardCount = await page.locator(".mw-card").count();
  if (cardCount === 0) {
    const emptyText = await page.locator(".mw-empty").innerText();
    check(
      `discontinued model "${discontinued}" shows an honest empty state`,
      /discontinued/i.test(emptyText),
      emptyText.split("\n")[1] ?? "",
    );
  } else {
    const titles = await page.locator(".mw-card-title").allInnerTexts();
    check(
      `discontinued model "${discontinued}" only shows its own listings`,
      titles.every((t) => t.toLowerCase().includes(discontinued.toLowerCase().split(" ").pop())),
      titles.join(" / "),
    );
  }
} else {
  check("discontinued model selectable", false, "Zen/Esteem missing from list");
}
await page.locator(".mw-side-clear").click();
await page.waitForTimeout(300);

// Year range 1992-2026.
const yearFrom = page.locator(".mw-side-years select").first();
const yearOptions = await yearFrom.locator("option").allInnerTexts();
check(
  "year dropdown spans 1992-2026",
  yearOptions.includes("1992") && yearOptions.includes("2026"),
  `${yearOptions[0]}..${yearOptions[yearOptions.length - 1]}`,
);

// Fuel + transmission chips (no Owners filter anywhere).
const sideText = await page.locator(".mw-side-panel").innerText();
check("no Owners filter in the sidebar", !/owner/i.test(sideText));
const chipText = (await page.locator(".mw-chip").allInnerTexts()).map((c) => c.trim());
check(
  "fuel chips present (Petrol/Diesel/CNG/EV-class)",
  ["All", "Petrol", "Diesel"].every((f) => chipText.includes(f)) &&
    chipText.some((c) => /CNG|EV/i.test(c)),
  chipText.join(", "),
);
check(
  "transmission chips Manual + Automatic",
  chipText.includes("Manual") && chipText.includes("Automatic"),
);
check("budget slider rendered", (await page.locator(".buy-slider-thumb").count()) === 2);
check(
  "budget shown in rupees",
  /₹[\d,]+/.test(await page.locator(".mw-side-budget").innerText()),
  await page.locator(".mw-side-budget").innerText(),
);
check(
  "location dropdown present",
  (await page.locator('.mw-side-panel button[aria-haspopup="listbox"]').count()) === 2,
);
check(
  "verified-only toggle present",
  (await page.locator('.mw-side-panel button[role="switch"]').count()) === 1,
);

/* ================================================================== */
/* 3. BENTO GRID + 3-BUTTON LISTING CARDS                             */
/* ================================================================== */
const cards = page.locator(".mw-card");
const total = await cards.count();
check("listings render in the bento grid", total > 0, `${total} cards`);

const featured = page.locator(".mw-card[data-featured]");
check("first card is a wide featured listing", (await featured.count()) === 1);
const widths = await page.evaluate(() => {
  const f = document.querySelector(".mw-card[data-featured]")?.getBoundingClientRect().width ?? 0;
  const n =
    document.querySelector(".mw-card:not([data-featured])")?.getBoundingClientRect().width ?? 0;
  return { f: Math.round(f), n: Math.round(n) };
});
check("featured card spans ~2 columns", widths.f > widths.n * 1.6, JSON.stringify(widths));

const firstVehicleCard = cards.first();
const actionTexts = (await firstVehicleCard.locator(".mw-btn").allInnerTexts()).map((t) =>
  t.trim().toLowerCase(),
);
check(
  "card has exactly 3 full-width actions: View details / Chat with seller / Make an offer",
  actionTexts.length === 3 &&
    actionTexts[0] === "view details" &&
    actionTexts[1] === "chat with seller" &&
    actionTexts[2] === "make an offer",
  actionTexts.join(" | "),
);
const brandLine = await firstVehicleCard.locator(".mw-card-brand").innerText();
const priceLine = await firstVehicleCard.locator(".mw-card-price").innerText();
const metaLine = await firstVehicleCard.locator(".mw-card-meta").innerText();
check("red brand eyebrow rendered", brandLine.trim().length > 0, brandLine);
check("large red price in lakh format", /₹[\d.]+ Lakh/.test(priceLine), priceLine);
check(
  "Year · Fuel · Location row",
  /\d{4}/.test(metaLine) && metaLine.includes("·"),
  metaLine.replace(/\n/g, " "),
);

// All cards carry all three buttons.
const btnCounts = await cards.evaluateAll((els) =>
  els.map(
    (el) => el.querySelectorAll(".mw-card-actions .mw-btn, .mw-card-actions a.mw-btn").length,
  ),
);
check(
  "every card has 3 action buttons",
  btnCounts.every((c) => c === 3),
  btnCounts.join(","),
);

// Search filter -> honest empty state -> clear.
await page.locator(".mw-side-search input").fill("zzzznotavehicle");
await page.waitForTimeout(350);
check("nonsense search shows empty state", (await page.locator(".mw-empty").count()) === 1);
await page.locator(".mw-empty .mw-btn").click();
await page.waitForTimeout(350);
check("clear restores the listings", (await page.locator(".mw-card").count()) === total);

// Verified-only toggle keeps honesty.
await page.locator('.mw-side-panel button[role="switch"]').click();
await page.waitForTimeout(300);
const verifiedEmpty = (await page.locator(".mw-empty").count())
  ? await page.locator(".mw-empty").innerText()
  : "";
check(
  "verified filter never fakes verified listings",
  (await page.locator(".mw-card").count()) === 0 &&
    /completed Motor Wallah inspection/i.test(verifiedEmpty),
);
await page.locator(".mw-side-clear").click();
await page.waitForTimeout(300);

// Budget slider narrows results.
const beforeBudget = await page.locator(".mw-card").count();
const maxThumb = page.locator(".buy-slider-thumb").nth(1);
await maxThumb.focus();
for (let i = 0; i < 15; i += 1) await page.keyboard.press("ArrowLeft");
await page.waitForTimeout(400);
const afterBudget = await page.locator(".mw-card").count();
check(
  "budget slider filters listings",
  afterBudget < beforeBudget,
  `${beforeBudget} -> ${afterBudget}`,
);
await page.locator(".mw-side-clear").click();
await page.waitForTimeout(300);

// Shortlist from the card heart.
await page.locator(".mw-card-fav").first().click();
await page.waitForTimeout(250);
const shortlistLabel = await page.locator(".mw-shortlist-toggle").innerText();
check("heart shortlists the card", /1/.test(shortlistLabel), shortlistLabel.replace(/\n/g, " "));
await page.locator(".mw-shortlist-toggle").click();
await page.waitForTimeout(300);
check("shortlist toggle filters to 1 card", (await page.locator(".mw-card").count()) === 1);
await page.locator(".mw-shortlist-toggle").click();
await page.waitForTimeout(200);

await page.screenshot({ path: `${SHOTS}/buy-02-listing.png`, fullPage: true });

/* ================================================================== */
/* 4. CARD DIALOGS — CHAT + MAKE AN OFFER                             */
/* ================================================================== */
await page.locator("button", { hasText: "Chat with seller" }).first().click();
await page.waitForSelector(".buy-chat-notice");
check(
  "chat dialog discloses the missing messaging backend",
  /not connected/i.test(await page.locator(".buy-chat-notice").innerText()),
);
await page.locator(".buy-chat-input textarea").fill("Is this vehicle available this weekend?");
await page.locator(".buy-chat-send").click();
await page.waitForTimeout(400);
check(
  "chat message saves to the local thread",
  /available this weekend/i.test(await page.locator(".buy-chat-thread").innerText()),
);
await page.locator(".buy-modal-close").click();
await page.waitForTimeout(300);

await page.locator("button", { hasText: "Make an offer" }).first().click();
await page.waitForSelector(".buy-offer-form");
await page.locator(".buy-offer-input input").fill("-100");
await page.locator("input[name='name']").fill("Test Buyer");
await page.locator("input[name='mobile']").fill("9876543210");
await page.locator(".buy-offer-form button[type='submit']").click();
await page.waitForTimeout(250);
const offerError = await page
  .locator(".buy-offer-error")
  .innerText()
  .catch(() => "");
check("negative offer rejected", /valid offer amount/i.test(offerError), offerError);
await page.locator(".buy-offer-input input").fill("450000");
await page.locator(".buy-offer-form button[type='submit']").click();
await page.waitForSelector("[data-testid='offer-success']", { timeout: 4000 });
const offerDone = await page.locator("[data-testid='offer-success']").innerText();
check("offer reports Pending status", /status Pending/i.test(offerDone));
check(
  "offer discloses missing seller backend",
  /No seller offer backend is connected/i.test(offerDone),
);
const storedOffer = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem("mw_listing_offers") ?? "[]");
  } catch {
    return [];
  }
});
check(
  "offer persisted locally",
  storedOffer.length === 1 &&
    storedOffer[0].status === "Pending" &&
    storedOffer[0].amount === 450000,
  JSON.stringify(storedOffer.map((o) => ({ id: o.listingId, amount: o.amount }))),
);
await page.locator(".buy-modal-close").click();
await page.waitForTimeout(300);

/* ================================================================== */
/* 5. DETAIL PAGE (unchanged component, still wired)                  */
/* ================================================================== */
const detailHref = await page.locator(".mw-card-title a").first().getAttribute("href");
await page.locator(".mw-card-title a").first().scrollIntoViewIfNeeded();
await page.locator(".mw-card-title a").first().click({ force: true });
await page.waitForTimeout(800);
check(
  "card opens its detail page",
  page.url().endsWith(detailHref),
  `${page.url()} vs ${detailHref}`,
);
await page.waitForSelector(".buy-detail-title");
check(
  "detail highlights bar rendered",
  (await page.locator(".buy-highlights").innerText()).split("\n").filter(Boolean).length >= 3,
);
check("detail ownership/history rows", (await page.locator(".buy-row").count()) >= 6);

await page.locator(".buy-detail-aside .buy-primary-button", { hasText: "Enquire Now" }).click();
await page.waitForSelector(".buy-chat-notice");
check(
  "detail chat is honest",
  /not connected/i.test(await page.locator(".buy-chat-notice").innerText()),
);
await page.locator(".buy-modal-close").click();
await page.waitForTimeout(200);

await page.locator(".buy-report-link").click();
await page.waitForSelector(".buy-report-form");
await page.locator(".buy-report-form select").selectOption("Wrong or misleading photos");
await page.locator(".buy-report-form button[type='submit']").click();
await page.waitForTimeout(400);
check(
  "report listing honest about moderation backend",
  /not transmitted|not connected/i.test(await page.locator(".buy-report-done").innerText()),
);
await page.locator(".buy-modal-close").click();
await page.waitForTimeout(200);

/* ================================================================== */
/* 6. SERVICE CATEGORY — ALTERNATE FILTERS + APPLY/ENQUIRE            */
/* ================================================================== */
await page.goto(`${BASE}/buy`, { waitUntil: "networkidle" });
await page.locator(".mw-hub-card--service", { hasText: "Finance" }).click();
await page.waitForSelector(".mw-buy-layout");
check("finance service opens its listing view", page.url().includes("service=finance"), page.url());
check(
  "service disclaimer banner shown",
  (await page.locator(".mw-service-banner").count()) === 1,
  (await page.locator(".mw-service-banner").innerText()).slice(0, 80),
);

const sideLabels = await page.locator(".mw-side-panel .mw-side-label").allInnerTexts();
check(
  "sidebar swaps Brand for Bank name",
  sideLabels.some((l) => /bank name/i.test(l)) && !sideLabels.some((l) => /^brand/i.test(l)),
  sideLabels.join(" | "),
);
check(
  "no vehicle controls on service view",
  (await page.locator(".mw-brand-grid").count()) === 0 &&
    (await page.locator(".mw-side-years").count()) === 0 &&
    (await page.locator(".mw-chip").count()) === 0,
);

const serviceCardsDom = page.locator(".mw-card--service");
const svcCount = await serviceCardsDom.count();
check("service partner cards render", svcCount >= 5, `${svcCount} cards`);
const svcButtons = await serviceCardsDom.first().locator(".mw-btn").allInnerTexts();
check(
  "service cards have Apply now + Enquire",
  svcButtons.map((b) => b.trim().toLowerCase()).join("|") === "apply now|enquire",
  svcButtons.join(" | "),
);
check(
  "service cards show provider eyebrow + value line",
  (await serviceCardsDom.first().locator(".mw-card-brand").innerText()).trim().length > 0 &&
    /₹/.test(await serviceCardsDom.first().locator(".mw-card-price").innerText()),
);

// Enquire dialog -> leads queue.
await serviceCardsDom.first().locator("button", { hasText: "Enquire" }).click();
await page.waitForTimeout(300);
const enquireTitle = await page.locator("div.fixed.inset-0 .font-display").first().innerText();
check("Enquire opens the enquiry dialog", /enquire/i.test(enquireTitle), enquireTitle);
await page.locator("input[name='name']").fill("Service Tester");
await page.locator("input[name='mobile']").fill("9876543210");
await page.locator("input[name='city']").fill("Indore");
await page.locator("div.fixed.inset-0 form button[type='submit']").click();
await page.waitForTimeout(400);
check(
  "enquiry confirms submission",
  /request received/i.test(await page.locator("div.fixed.inset-0").innerText()),
);
const leads = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem("mw_lead_queue") ?? "[]");
  } catch {
    return [];
  }
});
check(
  "enquiry saved as a finance lead",
  leads.some((l) => l.type === "finance_enquiry"),
  `${leads.length} leads`,
);
await page.locator("div.fixed.inset-0 button[aria-label='Close']").first().click();
await page.waitForTimeout(300);

// Apply now uses the same dialog with the Apply title.
await serviceCardsDom.first().locator("button", { hasText: "Apply now" }).click();
await page.waitForTimeout(300);
check(
  "Apply now opens apply dialog",
  /apply now/i.test(await page.locator("div.fixed.inset-0 .font-display").first().innerText()),
);
await page.locator("div.fixed.inset-0 button[aria-label='Close']").first().click();
await page.waitForTimeout(200);

// Service sidebar filter actually filters.
await page.locator('.mw-side-panel button[aria-haspopup="listbox"]').first().click();
await page.waitForTimeout(250);
const bankOptions = (await page.locator("ul[role='listbox'] li").allInnerTexts()).map((b) =>
  b.trim(),
);
const bank = bankOptions.find((b) => b && !/^all/i.test(b));
if (bank) {
  await page.locator("ul[role='listbox'] li", { hasText: bank }).first().click();
  await page.waitForTimeout(350);
  const providers = await page.locator(".mw-card-brand").allInnerTexts();
  check(
    "bank filter filters the finance cards",
    providers.length > 0 &&
      providers.every((p) =>
        p.toLowerCase().includes(bank.toLowerCase().split(" ")[0].toLowerCase()),
      ),
    `${bank}: ${providers.join(", ")}`,
  );
} else {
  check("bank filter filters the finance cards", false, "no bank options");
}
await page.locator(".mw-side-clear").click();
await page.waitForTimeout(250);
await page.screenshot({ path: `${SHOTS}/buy-03-service.png`, fullPage: true });

// Back to categories.
await page.locator(".mw-side-back").click();
await page.waitForTimeout(400);
check("back to categories returns to the hub", (await page.locator(".mw-hub-grid").count()) >= 1);

/* ================================================================== */
/* 7. OTHER ROUTES UNCHANGED + NO OVERFLOW                            */
/* ================================================================== */
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
check(
  "homepage keeps the classic dark header (no buy pill nav)",
  (await page.locator("header.mw-buy-nav").count()) === 0 &&
    (await page.locator("header.bg-ink").count()) >= 1,
);
for (const path of ["/", "/cars", "/buy/bikes", "/buy/trucks", "/sell-your-car", "/services"]) {
  const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const h1 = await page
    .locator("h1")
    .first()
    .innerText()
    .catch(() => "");
  check(
    `existing route ${path}`,
    (response?.status() ?? 0) < 400 && h1.length > 0,
    `${response?.status()} — ${h1}`,
  );
}

// Mobile overflow sanity on the new pages.
const mobile = await browser.newContext({
  viewport: { width: 360, height: 780 },
  isMobile: true,
  hasTouch: true,
});
const mpage = await mobile.newPage();
mpage.on("pageerror", (error) => errors.push(`mobile pageerror: ${error.message}`));
await mpage.goto(`${BASE}/buy`, { waitUntil: "networkidle" });
await mpage.locator(".mw-hub-card").first().click();
await mpage.waitForSelector(".mw-buy-layout");
await mpage.waitForTimeout(500);
if (await mpage.locator(".mw-side-toggle").isVisible()) {
  await mpage.locator(".mw-side-toggle").click();
  await mpage.waitForTimeout(300);
}
const mWidth = await mpage.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
check(
  "no horizontal overflow on mobile listing",
  mWidth.scroll <= mWidth.client + 1,
  JSON.stringify(mWidth),
);
await mpage.screenshot({ path: `${SHOTS}/buy-04-mobile.png`, fullPage: true });

console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
const failed = results.filter((r) => !r.pass);
console.log(`RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log("FAILED:", failed.map((f) => f.name).join(", "));
await browser.close();
process.exit(failed.length || errors.length ? 1 : 0);
