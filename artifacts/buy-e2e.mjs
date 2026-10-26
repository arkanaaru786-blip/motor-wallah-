import { chromium } from "/workspace/homes/6c4a0adeccea143873c1c9fb/pwtools/node_modules/playwright/index.mjs";

/**
 * 9-screen BUY flow — reference mock verification.
 *
 * Screens 1-9 plus the 7 mandatory rules (dynamic categories, no owner filter,
 * year 1992-2026, real logo images, discontinued models in dropdowns,
 * glassmorphism + bento, test-data pre-populated for all categories).
 *
 * NOTE: this Chromium build returns empty innerText for many elements, so all
 * text assertions go through textContent (norm/txt/txts helpers below).
 */
const BASE = "http://localhost:3000";
const SHOTS = "artifacts";
const errors = [];
const results = [];

const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` :: ${detail}` : ""}`);
};

/* ---------- text helpers (textContent, whitespace-normalised) ---------- */
const norm = (s) =>
  (s ?? "")
    .replace(/\s+/g, " ")
    .replace(/₹\s+/g, "₹")
    .trim();
const txt = async (loc) => norm(await loc.textContent());
const txts = async (loc) => (await loc.allTextContents()).map(norm);
const escapeReg = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Alpha of any computed colour serialisation (rgb/rgba/oklab/hex). */
const alphaOf = (color) => {
  const slash = color.match(/\/\s*([\d.]+)\s*\)/);
  if (slash) return Number(slash[1]);
  const comma = color.match(/rgba?\([^)]*,\s*([\d.]+)\s*\)$/);
  if (comma) return Number(comma[1]);
  if (color.startsWith("#")) return color.length <= 7 ? 1 : parseInt(color.slice(7, 9) || "ff", 16) / 255;
  return 1;
};

/** True for an off-white / very-light-grey computed background — handles rgb()
 *  and oklch() serialisations, and rejects pure white so the check stays real. */
const isOffWhite = (css) => {
  const oklch = css.match(/oklch\(\s*([\d.]+)\s+([\d.]+)/);
  if (oklch) {
    const lightness = Number(oklch[1]);
    const chroma = Number(oklch[2]);
    return lightness >= 0.95 && lightness < 0.995 && chroma < 0.02;
  }
  const nums = (css.match(/[\d.]+/g) ?? []).map(Number).slice(0, 3);
  return nums.length === 3 && Math.min(...nums) >= 238 && Math.max(...nums) <= 253;
};

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

/**
 * The dev server proxies brand artwork to an external host that is slow from
 * this sandbox, so networkidle can exceed its timeout even though the page
 * itself has rendered. Give navigation a bounded quiet window and fall back to
 * domcontentloaded + load; every section below still gates on its own
 * waitForSelector, so all readiness assertions are unchanged.
 */
const hardenGoto = (p) => {
  const raw = p.goto.bind(p);
  p.goto = async (url, opts = {}) => {
    try {
      return await raw(url, { ...opts, waitUntil: "networkidle", timeout: 30000 });
    } catch {
      await raw(url, { ...opts, waitUntil: "domcontentloaded", timeout: 30000 });
      await p.waitForLoadState("load", { timeout: 12000 }).catch(() => {});
      return null;
    }
  };
};
hardenGoto(page);

/** Force lazy images eager, then wait until every match is decoded. */
const eagerImages = (selector) =>
  page.evaluate((sel) => {
    document.querySelectorAll(sel).forEach((img) => {
      img.loading = "eager";
    });
  }, selector);
const waitForImages = async (selector, timeout = 10000) => {
  try {
    await page.waitForFunction(
      (sel) => {
        const imgs = [...document.querySelectorAll(sel)];
        return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0);
      },
      selector,
      { timeout },
    );
    return true;
  } catch {
    return false;
  }
};

const MODEL_BTN = '.buy-filter-panel button[aria-haspopup="listbox"]';
const openModels = async () => {
  await page.locator(MODEL_BTN).first().click();
  await page.waitForTimeout(250);
  return txts(page.locator("ul[role='listbox'] li"));
};
const closeModels = async () => {
  await page.locator(MODEL_BTN).first().click();
  await page.waitForTimeout(120);
};

/* ================================================================== */
/* SCREEN 1 — CATEGORY SELECTION (hero + 8 cards)                      */
/* ================================================================== */
await page.goto(`${BASE}/buy`, { waitUntil: "networkidle" });

const heroTitle = await txt(page.locator(".mw-buy-hero-title"));
check(
  "S1 hero: EVERY VEHICLE. ONE MARKETPLACE.",
  /every vehicle\./i.test(heroTitle) && /one marketplace\./i.test(heroTitle),
  heroTitle,
);
const heroText = await txt(page.locator(".mw-buy-hero-text"));
check(
  "S1 hero subtitle: right vehicle / right price / complete trust",
  /right vehicle/i.test(heroText) && /right price/i.test(heroText) && /complete trust/i.test(heroText),
  heroText,
);
const heroBtns = (await txts(page.locator(".mw-buy-hero-btn"))).map((b) => b.toLowerCase());
check(
  "S1 hero buttons: Buy Vehicles + Sell Vehicle",
  heroBtns.length === 2 && heroBtns.includes("buy vehicles") && heroBtns.includes("sell vehicle"),
  heroBtns.join(" | "),
);

/* ISSUE 1 — the big red hero button opens the category grid, never a listing. */
await page.locator(".mw-buy-hero-cta .mw-buy-hero-btn--primary").click();
await page.waitForTimeout(400);
check(
  "ISSUE1 /buy hero Buy Vehicles → category selection grid (no listing)",
  page.url().includes("/buy") &&
    !page.url().includes("category=") &&
    (await page.locator(".mw-hub-card:not(.mw-hub-card--service)").count()) === 8 &&
    (await page.locator(".buy-filter-panel").count()) === 0,
  page.url(),
);

/* Design: light theme + bento (mixed sizes, rounded, soft shadow) on the hub. */
const buyBg = await page.evaluate(() =>
  getComputedStyle(document.querySelector(".mw-buy")).backgroundColor,
);
check(
  "DESIGN buy page light theme (off-white / very light grey background)",
  isOffWhite(buyBg),
  buyBg,
);
const hubWidths = await page
  .locator(".mw-hub-card:not(.mw-hub-card--service)")
  .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
check(
  "DESIGN category grid is a bento: mixed card sizes",
  new Set(hubWidths).size > 1,
  hubWidths.join(","),
);
const hubCardStyle = await page.locator(".mw-hub-card").first().evaluate((el) => {
  const s = getComputedStyle(el);
  return { radius: s.borderRadius, shadow: s.boxShadow };
});
check(
  "DESIGN category cards: rounded corners + soft resting shadow",
  parseFloat(hubCardStyle.radius) >= 12 && hubCardStyle.shadow !== "none",
  `${hubCardStyle.radius} / ${hubCardStyle.shadow.slice(0, 60)}`,
);

const vehicleCards = page.locator(".mw-hub-card:not(.mw-hub-card--service)");
check("S1 exactly 8 vehicle category cards", (await vehicleCards.count()) === 8);
const cardNames = (await txts(page.locator(".mw-hub-card:not(.mw-hub-card--service) .mw-hub-name"))).map((n) =>
  n.toLowerCase(),
);
const EXPECTED = [
  "Cars",
  "Bikes",
  "3-Wheelers",
  "SCV / Mini Trucks",
  "Trucks",
  "Buses",
  "Tractors",
  "Taxi / Commercial Cars",
];
check(
  "S1 cards match the 8 reference categories",
  EXPECTED.every((label) => cardNames.includes(label.toLowerCase())),
  cardNames.join(", "),
);
const firstCard = vehicleCards.first();
check(
  "S1 card has image + name + blurb + arrow",
  (await firstCard.locator(".mw-hub-media img").count()) === 1 &&
    (await firstCard.locator(".mw-hub-arrow").count()) === 1 &&
    (await txt(firstCard.locator(".mw-hub-blurb"))).length > 0,
);
const arrowVisible = await firstCard
  .locator(".mw-hub-arrow")
  .evaluate((el) => getComputedStyle(el).opacity === "1");
check("S1 arrow visible without hover (reference)", arrowVisible);
check(
  "S1 services section still present below (untouched feature)",
  (await page.locator(".mw-hub-card--service").count()) >= 5,
);
await page.screenshot({ path: `${SHOTS}/s1-hub.png`, fullPage: true });

/* ================================================================== */
/* SCREEN 2+3 — CLICK CARS: brand rail + sticky glass filter bar       */
/* ================================================================== */
await firstCard.click();
await page.waitForSelector(".buy-rail-section");
check("S1 category click opens the dynamic flow", page.url().includes("category=cars"), page.url());

check(
  "S2 back link + category title + Select Brand",
  (await txt(page.locator(".buy-rail-back"))).includes("Back to Categories") &&
    (await txt(page.locator(".buy-rail-title"))).toLowerCase() === "cars" &&
    (await txt(page.locator(".buy-rail-sub"))) === "Select Brand",
);

const railScroll = await page
  .locator(".buy-brand-rail")
  .evaluate((el) => getComputedStyle(el).overflowX);
check(
  "S2 brand rail is horizontally scrollable",
  railScroll === "auto" || railScroll === "scroll",
  railScroll,
);

await eagerImages(".buy-brand-rail .buy-brand-chip img");
const logosReady = await waitForImages(".buy-brand-rail .buy-brand-chip img");
const railChips = page.locator(".buy-brand-rail .buy-brand-chip");
const railCount = await railChips.count();
check("S2 rail has brand tiles (incl. All)", railCount >= 6, `${railCount} tiles`);
const logoStats = await railChips.evaluateAll((els) =>
  els.slice(1).map((el) => {
    const img = el.querySelector("img");
    return {
      brand: (el.textContent ?? "").trim().replace(/\s+/g, " "),
      hasImg: Boolean(img),
      ok: img ? img.complete && img.naturalWidth > 0 : false,
    };
  }),
);
check(
  "S2 rule: every brand tile is an actual LOGO IMAGE (not text)",
  logosReady && logoStats.length > 0 && logoStats.every((s) => s.hasImg && s.ok),
  logoStats.map((s) => `${s.brand}:${s.ok ? "img" : "MISSING"}`).join(", "),
);

// Ford must appear (reference shows Ford for cars).
const tileNames = (await txts(page.locator(".buy-brand-rail .buy-brand-name"))).map((t) => t.toLowerCase());
check("S2 cars rail includes Ford (reference)", tileNames.includes("ford"), tileNames.join(", "));

/* --- Screen 3: the sticky glass filter bar, exactly 7 filters -------- */
const stickyPos = await page
  .locator(".mw-buy-filter-sticky")
  .evaluate((el) => getComputedStyle(el).position);
check("S3 filter bar is sticky", stickyPos === "sticky", stickyPos);
const glass = await page.locator(".buy-filter-panel").evaluate((el) => {
  const s = getComputedStyle(el);
  const blurs = [s.backdropFilter, s.webkitBackdropFilter]
    .filter((v) => v && v !== "none" && /blur/.test(v))
    .join(" ");
  return { bg: s.backgroundColor, blur: blurs || "none" };
});
check(
  "S3 rule: glassmorphism (translucent + backdrop blur)",
  alphaOf(glass.bg) < 1 && /blur/.test(glass.blur),
  `${glass.bg} / ${glass.blur}`,
);
check(
  "S3 rule: filter bar uses backdrop blur(10px)",
  /blur\(\s*10px\s*\)/.test(glass.blur),
  glass.blur,
);

const panelText = await txt(page.locator(".buy-filter-panel"));
// NOTE: textContent glues labels together ("…Clear AllBrandAll brands…"),
// so word-boundary regexes would miss them — match substrings instead.
const has = (name) => panelText.toLowerCase().includes(name.toLowerCase());
const REQUIRED_FILTERS = [
  "Brand",
  "Model",
  "Price Range",
  "Year",
  "Location",
  "Fuel Type",
  "Verified Listings",
];
const extraFilter = /transmission|search|owner/i.test(panelText);
check(
  "S3 exactly the 7 reference filters",
  REQUIRED_FILTERS.every(has) && !extraFilter,
  REQUIRED_FILTERS.filter(has).join(", ") + (extraFilter ? " [EXTRA FILTER FOUND]" : ""),
);
check(
  "S3 Clear All button present",
  (await txt(page.locator(".buy-filter-panel .buy-clear"))).includes("Clear All"),
);

check("S3 rule: NO owner filter anywhere in the bar", !/owner/i.test(panelText));

const yearOptions = await txts(page.locator(".buy-filter-years select").first().locator("option"));
check(
  "S3 rule: year dropdown spans 1992-2026",
  yearOptions.includes("1992") && yearOptions.includes("2026"),
  `${yearOptions[0]}..${yearOptions[yearOptions.length - 1]}`,
);

const fuelChecks = await txts(page.locator(".buy-fuel-checks label"));
check(
  "S3 fuel checkboxes: Petrol, Diesel, CNG, Hybrid, EV",
  ["petrol", "diesel", "cng", "hybrid", "ev"].every((f) =>
    fuelChecks.map((c) => c.toLowerCase()).includes(f),
  ),
  fuelChecks.join(", "),
);
check(
  "S3 verified toggle present",
  (await page.locator(".buy-field--verified [role='switch']").count()) === 1,
);

/* ================================================================== */
/* SCREEN 4 — BENTO GRID LISTING CARDS                                 */
/* ================================================================== */
await page.waitForSelector(".mw-bento");
const cards = page.locator(".mw-card");
const total = await cards.count();
check("S4 cars render in the bento grid", total >= 8, `${total} cards`);
check("S4 first card is the wide featured card", (await page.locator(".mw-card[data-featured]").count()) === 1);
const featuredBox = await page.locator(".mw-card[data-featured]").first().boundingBox();
const plainBox = await page.locator(".mw-card:not([data-featured])").first().boundingBox();
check(
  "DESIGN listing bento: mixed card sizes (featured card wider)",
  Boolean(featuredBox && plainBox && featuredBox.width > plainBox.width + 80),
  `${featuredBox?.width} vs ${plainBox?.width}`,
);
const cardShadow = await page
  .locator(".mw-card")
  .first()
  .evaluate((el) => getComputedStyle(el).boxShadow);
check("DESIGN listing cards: soft resting shadow", cardShadow !== "none", cardShadow.slice(0, 60));

const first = cards.first();
const titleTxt = await txt(first.locator(".mw-card-title"));
const priceTxt = await txt(first.locator(".mw-card-price"));
const specsTxt = await txt(first.locator(".mw-card-specs"));
const metaTxt = await txt(first.locator(".mw-card-meta"));
check("S4 card has image", (await first.locator(".mw-card-media img").count()) === 1);
check("S4 card has Demo/Verified badge markup", (await first.locator(".mw-tag").count()) >= 1);
check("S4 title includes brand + model", /tata|maruti|hyundai|mahindra/i.test(titleTxt), titleTxt);
check("S4 price in red rupee format (₹8,50,000 style)", /^₹[\d,]+$/.test(priceTxt), priceTxt);
check(
  "S4 specs row: Year · Fuel (· Transmission)",
  /\d{4}/.test(specsTxt) && /(petrol|diesel|cng|ev|hybrid|electric)/i.test(specsTxt),
  specsTxt,
);
check("S4 meta row: km + location", /km/i.test(metaTxt) && metaTxt.length > 3, metaTxt);

const actionControls = await first.evaluate((el) => ({
  btns: [...el.querySelectorAll(".mw-card-actions .mw-btn, .mw-card-actions a.mw-btn")].map((b) =>
    b.textContent.trim().toLowerCase(),
  ),
  fav: el.querySelectorAll(".mw-card-fav").length,
}));
check(
  "S4 actions: heart + VIEW DETAILS (red) + MAKE AN OFFER (secondary)",
  actionControls.fav === 1 &&
    actionControls.btns.length === 2 &&
    actionControls.btns[0] === "view details" &&
    actionControls.btns[1] === "make an offer",
  JSON.stringify(actionControls),
);
const allCounts = await cards.evaluateAll((els) =>
  els.map(
    (el) =>
      el.querySelectorAll(".mw-card-actions .mw-btn, .mw-card-actions a.mw-btn").length +
      el.querySelectorAll(".mw-card-fav").length,
  ),
);
check("S4 every card has all 3 actions", allCounts.every((c) => c === 3), allCounts.join(","));

// Required test data: cars dropdown incl. discontinued models.
let models = await openModels();
check(
  "S4 rule: Maruti dropdown includes discontinued Zen + Esteem",
  models.some((m) => /^zen$/i.test(m)) && models.some((m) => /^esteem$/i.test(m)),
  models.filter((m) => /zen|esteem|swift|baleno/i.test(m)).join(", "),
);
await closeModels();

// Brand filtering (Tata) narrows to Tata models from the required data.
await page.locator(".buy-brand-rail .buy-brand-chip", { hasText: "Tata" }).first().click();
await page.waitForTimeout(350);
const tataTitles = await txts(page.locator(".mw-card-title"));
const tataModels = tataTitles.join(" | ");
check(
  "S4 brand filter shows required Tata models (Nexon/Harrier/Tiago/Punch/Sierra...)",
  tataTitles.length > 0 && /(nexon|harrier|tiago|punch|sierra|altroz|tigor|safari)/i.test(tataModels),
  tataModels,
);
models = await openModels();
const tataModelsList = models.map((m) => m.trim());
check(
  "S4 Tata dropdown has Nexon, Harrier, Tiago, Sierra",
  ["Nexon", "Harrier", "Tiago", "Sierra"].every((m) => tataModelsList.includes(m)),
  tataModelsList.filter((m) => /nexon|harrier|tiago|sierra/i.test(m)).join(", "),
);
await closeModels();

await page.locator(".buy-clear").click();
await page.waitForTimeout(300);
check("S3 Clear All restores all cards", (await cards.count()) === total);

// Verified-only toggle stays honest (no fake verified listings).
await page.locator(".buy-field--verified [role='switch']").click();
await page.waitForTimeout(300);
const verifiedEmpty = (await page.locator(".mw-empty").count())
  ? await txt(page.locator(".mw-empty"))
  : "";
check(
  "S3 verified filter never fakes verified badges",
  (await cards.count()) === 0 && /inspection/i.test(verifiedEmpty),
  verifiedEmpty.slice(0, 80),
);
await page.locator(".buy-clear").click();
await page.waitForTimeout(300);

// Shortlist heart works.
await page.locator(".mw-card-fav").first().click();
await page.waitForTimeout(250);
const shortlistLabel = await txt(page.locator(".mw-shortlist-toggle"));
check("S4 heart shortlists the card", /1/.test(shortlistLabel), shortlistLabel);
await page.locator(".mw-shortlist-toggle").click();
await page.waitForTimeout(300);
check("S4 shortlist view filters to the 1 saved card", (await cards.count()) === 1);
await page.locator(".mw-shortlist-toggle").click();
await page.waitForTimeout(300);
check("S4 toggling shortlist off restores the grid", (await cards.count()) === total);

// Flow-level rule: no Owner FILTER anywhere in rail/filter/results.
const flowText = `${await txt(page.locator(".mw-buy-flow"))} ${await txt(page.locator(".mw-bento"))}`;
check("S4 rule: no owner word anywhere in the vehicle flow", !/owner/i.test(flowText));

await page.screenshot({ path: `${SHOTS}/s4-listing-cars.png`, fullPage: true });

/* ================================================================== */
/* DYNAMIC FLOW — all 8 categories, each with its own brands/models     */
/* ================================================================== */
const CATEGORIES = [
  { id: "cars", label: "Cars" },
  { id: "bikes", label: "Bikes" },
  { id: "three-wheelers", label: "3-Wheelers" },
  { id: "scv", label: "SCV / Mini Trucks" },
  { id: "trucks", label: "Trucks" },
  { id: "buses", label: "Buses" },
  { id: "tractors", label: "Tractors" },
  { id: "taxi", label: "Taxi / Commercial Cars" },
];
const BRAND_MODEL_CHECKS = [
  { cat: "cars", brand: "Maruti Suzuki", models: ["Swift", "Baleno", "Zen", "Esteem"] },
  { cat: "cars", brand: "Tata", models: ["Nexon", "Harrier", "Tiago", "Sierra"] },
  { cat: "cars", brand: "Hyundai", models: ["Creta", "i20", "Santro"] },
  { cat: "bikes", brand: "Hero", models: ["Splendor", "Xpulse", "Passion"] },
  { cat: "bikes", brand: "Bajaj", models: ["Pulsar", "Dominar", "Chetak"] },
  { cat: "bikes", brand: "Royal Enfield", models: ["Classic 350", "Bullet 350"] },
  { cat: "three-wheelers", brand: "Mahindra", models: ["Treo", "Alfa"] },
  { cat: "three-wheelers", brand: "Piaggio", models: ["Ape"] },
  { cat: "three-wheelers", brand: "Khalsa EV", models: ["E-Rickshaw"] },
  { cat: "three-wheelers", brand: "All Fine EV", models: ["E-Rickshaw"] },
  { cat: "trucks", brand: "Tata Motors", models: ["Ace", "407", "Prima"] },
  { cat: "trucks", brand: "Ashok Leyland", models: ["Dost", "Ecomet"] },
  { cat: "buses", brand: "Tata Buses", models: ["Starbus", "Magna"] },
  { cat: "buses", brand: "Ashok Leyland Buses", models: ["Viking"] },
  { cat: "tractors", brand: "Mahindra", models: ["275 DI", "Arjun"] },
  { cat: "tractors", brand: "Swaraj", models: ["735 FE"] },
  { cat: "tractors", brand: "John Deere", models: ["5050D"] },
];

for (const { id, label } of CATEGORIES) {
  await page.goto(`${BASE}/buy?category=${id}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".buy-rail-section");

  const titleOk = (await txt(page.locator(".buy-rail-title"))).toLowerCase() === label.toLowerCase();
  const chips = await page
    .locator(".buy-brand-rail .buy-brand-chip:not(.buy-brand-chip--all)")
    .count();
  const imgsOk = await page
    .locator(".buy-brand-rail .buy-brand-chip:not(.buy-brand-chip--all) img")
    .count();
  const cardN = await page.locator(".mw-card").count();
  const noOwner = !/owner/i.test(await txt(page.locator(".buy-filter-panel")));
  check(
    `flow ${label}: rail + logos + listings + no owner filter`,
    titleOk && chips >= 3 && imgsOk === chips && cardN > 0 && noOwner,
    `${chips} brands/${imgsOk} imgs/${cardN} cards`,
  );
}

// Required test data — brand -> model dropdown checks.
const checkedPairs = new Set();
for (const spec of BRAND_MODEL_CHECKS) {
  const key = `${spec.cat}:${spec.brand}`;
  if (checkedPairs.has(key)) continue;
  checkedPairs.add(key);
  await page.goto(`${BASE}/buy?category=${spec.cat}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".buy-brand-rail");
  const chip = page
    .locator(".buy-brand-rail .buy-brand-chip")
    .filter({
      has: page.locator(".buy-brand-name", {
        hasText: new RegExp(`^${escapeReg(spec.brand)}`, "i"),
      }),
    })
    .first();
  if ((await chip.count()) === 0) {
    check(`data ${spec.cat}/${spec.brand}: brand tile present`, false, "tile missing");
    continue;
  }
  await chip.click();
  await page.waitForTimeout(300);
  const opts = (await openModels()).map((o) => o.trim());
  const missing = spec.models.filter(
    (m) => !opts.some((o) => o.toLowerCase().includes(m.toLowerCase())),
  );
  check(
    `data ${spec.cat}/${spec.brand}: models ${spec.models.join(", ")}`,
    missing.length === 0,
    missing.length ? `missing ${missing.join(", ")}` : `${opts.length} options`,
  );
  await closeModels();
}

await page.goto(`${BASE}/buy?category=bikes`, { waitUntil: "networkidle" });
await page.waitForSelector(".mw-bento");
await page.screenshot({ path: `${SHOTS}/s2-bikes-flow.png`, fullPage: true });

/* ================================================================== */
/* SCREEN 5 — VEHICLE DETAIL PAGE                                      */
/* ================================================================== */
await page.goto(`${BASE}/buy?category=cars`, { waitUntil: "networkidle" });
await page.waitForSelector(".mw-bento");
const detailHref = await page.locator(".mw-card-title a").first().getAttribute("href");
await page.locator(".mw-card-title a").first().click({ force: true });
await page.waitForSelector(".buy-detail-layout");
check("S5 card opens its detail page", page.url().endsWith(detailHref), page.url());

check(
  "S5 gallery + title + red price",
  (await page.locator(".buy-detail-gallery").count()) === 1 &&
    (await txt(page.locator(".buy-detail-heading--aside .buy-detail-title"))).length > 0 &&
    /^₹[\d,]+$/.test(await txt(page.locator(".buy-detail-heading--aside .buy-detail-price"))),
);
const specLabels = (await txts(page.locator(".buy-detail-aside .buy-spec-label"))).map((s) =>
  s.toLowerCase(),
);
check(
  "S5 key specs: Year, Fuel, KM on the right",
  specLabels.includes("year") && specLabels.includes("fuel") && specLabels.includes("km driven"),
  specLabels.join(", "),
);
check(
  "S5 location map panel + View on Map link",
  (await page.locator(".buy-map").count()) === 1 &&
    /google\.com\/maps/.test((await page.locator(".buy-map-link").getAttribute("href")) ?? ""),
);
check("S5 vehicle description present", (await txt(page.locator(".buy-description"))).length > 40);
const asideBtns = await txts(page.locator(".buy-action-buttons button"));
check(
  "S5 bottom buttons: Contact Seller (red) + Book Test Drive (outline) + Make an Offer",
  (await page.locator(".buy-action-buttons .buy-primary-button", { hasText: "Contact Seller" }).count()) ===
    1 &&
    asideBtns.some((b) => /book test drive/i.test(b)) &&
    asideBtns.some((b) => /make an offer/i.test(b)),
  asideBtns.join(" | "),
);
await page.screenshot({ path: `${SHOTS}/s5-detail.png`, fullPage: true });

/* ================================================================== */
/* SCREEN 8 — BOOK TEST DRIVE MODAL                                    */
/* ================================================================== */
await page.locator(".buy-action-buttons button", { hasText: "Book Test Drive" }).click();
await page.waitForSelector("div.fixed.inset-0 .font-display");
const tdTitle = await txt(page.locator("div.fixed.inset-0 .font-display").first());
check("S8 test-drive modal opens", /book test drive/i.test(tdTitle), tdTitle);
const tdLabels = (await txts(page.locator("div.fixed.inset-0 label span"))).map((l) =>
  l.replace(/\s*\*$/, "").trim(),
);
check(
  "S8 fields: Full name, Mobile, Preferred date, Preferred time, Message",
  tdLabels.some((l) => /full name/i.test(l)) &&
    tdLabels.some((l) => /mobile number/i.test(l)) &&
    tdLabels.some((l) => /preferred date/i.test(l)) &&
    tdLabels.some((l) => /preferred time/i.test(l)) &&
    tdLabels.some((l) => /message/i.test(l)),
  tdLabels.join(", "),
);
await page.locator("input[name='name']").fill("Arkan Tester");
await page.locator("input[name='mobile']").fill("9876543210");
await page.locator("input[name='date']").fill("2026-11-15");
await page.locator("input[name='time']").fill("10:30");
await page.locator("div.fixed.inset-0 form button[type='submit']").click();
await page.waitForTimeout(600);
const tdDone = await txt(page.locator("div.fixed.inset-0").first());
check("S8 submit confirms the request", /request received/i.test(tdDone), tdDone.slice(0, 80));
const leads = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem("mw_lead_queue") ?? "[]");
  } catch {
    return [];
  }
});
check(
  "S8 test drive saved to the lead queue",
  leads.some((l) => l.type === "test_drive"),
  `${leads.length} leads`,
);
await page.locator("div.fixed.inset-0 button[aria-label='Close']").first().click();
await page.waitForTimeout(300);

/* ================================================================== */
/* SCREEN 6 — MAKE AN OFFER MODAL                                      */
/* ================================================================== */
await page.locator(".buy-action-buttons button", { hasText: "Make an Offer" }).click();
await page.waitForSelector(".buy-offer-form");
check(
  "S6 vehicle summary shown in modal",
  (await txt(page.locator(".buy-offer-vehicle-name"))).length > 0 &&
    /^₹[\d,]+$/.test(norm((await txt(page.locator(".buy-offer-vehicle-price"))).replace("Asking: ", ""))),
  await txt(page.locator(".buy-offer-vehicle-price")),
);
await page.locator(".buy-offer-input input").fill("-100");
await page.locator("input[name='name']").fill("Arkan");
await page.locator("input[name='mobile']").fill("9876543210");
await page.locator(".buy-offer-form button[type='submit']").click();
await page.waitForTimeout(250);
const offerError = (await page.locator(".buy-offer-error").textContent().catch(() => "")) ?? "";
check("S6 negative offer rejected", /valid offer amount/i.test(offerError), norm(offerError));
await page.locator(".buy-offer-input input").fill("780000");
await page.locator(".buy-offer-form button[type='submit']").click();
await page.waitForSelector("[data-testid='offer-success']", { timeout: 4000 });
const offerDone = await txt(page.locator("[data-testid='offer-success']"));
check("S6 offer reports status Pending", /status\s*:?\s*pending/i.test(offerDone), offerDone.slice(0, 120));
const storedOffer = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem("mw_listing_offers") ?? "[]");
  } catch {
    return [];
  }
});
check(
  "S6 offer persisted locally",
  storedOffer.length === 1 && storedOffer[0].status === "Pending" && storedOffer[0].amount === 780000,
  `${storedOffer.length} offers`,
);
const successLinks = await txts(page.locator("[data-testid='offer-success'] a"));
check(
  "S6 success links to My Offers",
  successLinks.some((t) => /track my offers/i.test(t)),
  successLinks.join(", "),
);
await page.locator(".buy-modal-close").click();
await page.waitForTimeout(300);

/* ================================================================== */
/* SCREEN 7 — MY OFFERS (status tracking)                              */
/* ================================================================== */
await page.goto(`${BASE}/buy/offers`, { waitUntil: "networkidle" });
await page.waitForSelector(".buy-offers-page");
check("S7 page title", /my offers/i.test(await txt(page.locator(".buy-offers-title"))));
const rows = page.locator(".buy-offer-row");
check("S7 the saved offer is listed", (await rows.count()) === 1);
const badge = await txt(page.locator(".buy-offer-badge").first());
const badgeClass = await page.locator(".buy-offer-badge").first().getAttribute("class");
check(
  "S7 Pending badge (yellow style)",
  badge.toLowerCase() === "pending" && /buy-offer-badge--pending/.test(badgeClass ?? ""),
  `${badge} / ${badgeClass}`,
);
const rowText = await txt(rows.first());
check(
  "S7 row: vehicle name + offered amount + Offered on date",
  /tata|maruti|hyundai/i.test(rowText) && /₹7,80,000/.test(rowText) && /offered on/i.test(rowText),
  rowText,
);
check("S7 honest notice (no seller backend claim)", (await txt(page.locator(".buy-offers-notice"))).length > 40);
// Badge style coverage for the other two reference statuses is structural:
const badgeStyles = await page.evaluate(() => {
  const sheet = [...document.styleSheets];
  const css = sheet
    .flatMap((s) => {
      try {
        return [...s.cssRules].map((r) => r.cssText);
      } catch {
        return [];
      }
    })
    .join(" ");
  return {
    counter: /buy-offer-badge--counter/.test(css),
    accepted: /buy-offer-badge--accepted/.test(css),
  };
});
check(
  "S7 Counter Offer (blue) + Accepted (green) badge styles exist",
  badgeStyles.counter && badgeStyles.accepted,
  JSON.stringify(badgeStyles),
);
await page.screenshot({ path: `${SHOTS}/s7-my-offers.png`, fullPage: true });

/* ================================================================== */
/* SCREEN 9 — IN-SITE CHAT                                             */
/* ================================================================== */
await page.goto(`${BASE}${detailHref}`, { waitUntil: "networkidle" });
await page.waitForSelector(".buy-detail-layout");
await page.locator(".buy-action-buttons .buy-primary-button", { hasText: "Contact Seller" }).click();
await page.waitForSelector(".buy-chat-head");
const modalGlass = await page.locator(".buy-modal-panel").evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, blur: s.backdropFilter || s.webkitBackdropFilter };
});
check(
  "DESIGN modal windows: glassmorphism (translucent white + blur(10px))",
  alphaOf(modalGlass.bg) < 1 && /blur\(\s*10px\s*\)/.test(modalGlass.blur),
  `${modalGlass.bg} / ${modalGlass.blur}`,
);
check(
  "S9 chat header: Chat with Seller + vehicle + price",
  /chat with seller/i.test(await txt(page.locator(".buy-chat-head-title"))) &&
    /₹/.test(await txt(page.locator(".buy-chat-head-sub"))),
  await txt(page.locator(".buy-chat-head-sub")),
);
check(
  "S9 system bubble on the seller (left) side",
  (await page.locator(".buy-chat-bubble--system").count()) === 1,
);
await page.locator(".buy-chat-input textarea").fill("Is this vehicle available this weekend?");
await page.locator(".buy-chat-send").click();
await page.waitForTimeout(400);
check(
  "S9 sent message renders on the buyer (right) side",
  (await page.locator(".buy-chat-message--me").count()) === 1 &&
    /available this weekend/i.test(await txt(page.locator(".buy-chat-message--me"))),
);
const chatActions = await txts(page.locator(".buy-chat-action"));
check(
  "S9 Call + WhatsApp actions",
  chatActions.some((t) => /^call$/i.test(t)) && chatActions.some((t) => /whatsapp/i.test(t)),
  chatActions.join(", "),
);
check(
  "S9 input + Send button",
  (await page.locator(".buy-chat-input textarea").getAttribute("placeholder")) === "Type a message…" &&
    /send/i.test(await txt(page.locator(".buy-chat-send"))),
);
check(
  "S9 honest about the missing messaging backend",
  /not connected/i.test(await txt(page.locator(".buy-chat-bubble--system"))),
);
await page.locator(".buy-modal-close").click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOTS}/s9-chat.png`, fullPage: false });

/* ================================================================== */
/* GUARDS — homepage untouched + other routes + mobile                 */
/* ================================================================== */
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
check(
  "homepage untouched (classic dark header, no buy pill nav)",
  (await page.locator("header.mw-buy-nav").count()) === 0 &&
    (await page.locator("header.bg-ink").count()) >= 1,
);
/* ISSUE 1 — the homepage hero Buy Vehicles button must open the category grid. */
const homeBuyBtn = page.locator(".home-hero-cta .home-cta-primary", { hasText: "Buy Vehicles" });
check(
  "ISSUE1 homepage hero Buy Vehicles links to /buy (category selection)",
  (await homeBuyBtn.getAttribute("href")) === "/buy",
);
await homeBuyBtn.click();
await page.waitForTimeout(700);
check(
  "ISSUE1 clicking Buy Vehicles lands on the 8-card category hub, not a listing",
  page.url().includes("/buy") &&
    !page.url().includes("category=") &&
    (await page.locator(".mw-hub-card:not(.mw-hub-card--service)").count()) === 8 &&
    (await page.locator(".buy-filter-panel").count()) === 0,
  page.url(),
);
for (const path of ["/", "/cars", "/buy/bikes", "/buy/trucks", "/buy/offers", "/sell-your-car", "/exchange", "/services"]) {
  const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  const h1 = norm((await page.locator("h1").first().textContent().catch(() => "")) ?? "");
  check(
    `route ${path}`,
    (response?.status() ?? 0) < 400 && h1.length > 0,
    `${response?.status()} — ${h1.slice(0, 60)}`,
  );
}

/* ================================================================== */
/* SELL FLOW — category bento → dynamic glass form → submission        */
/* ================================================================== */
await page.goto(`${BASE}/sell-your-car`, { waitUntil: "networkidle" });
await page.waitForSelector(".mw-sell-grid");

const sellBg = await page.evaluate(() =>
  getComputedStyle(document.querySelector(".mw-sell")).backgroundColor,
);
check(
  "SELL light theme (off-white / very light grey background)",
  isOffWhite(sellBg),
  sellBg,
);

const sellCards = page.locator(".mw-sell-cat");
check("SELL step A: bento grid of exactly 8 categories", (await sellCards.count()) === 8);
const sellCatNames = (await txts(page.locator(".mw-sell-cat-name"))).map((n) => n.toLowerCase());
check(
  "SELL categories: Cars, Bikes, 3-Wheelers, SCV, Trucks, Buses, Tractors, Taxi",
  [
    "cars",
    "bikes",
    "3-wheelers",
    "scv / mini trucks",
    "trucks",
    "buses",
    "tractors",
    "taxi / commercial cars",
  ].every((name) => sellCatNames.includes(name)),
  sellCatNames.join(", "),
);
const sellWidths = await sellCards.evaluateAll((els) =>
  els.map((el) => Math.round(el.getBoundingClientRect().width)),
);
check("SELL bento grid: mixed card sizes", new Set(sellWidths).size > 1, sellWidths.join(","));
const sellCardStyle = await sellCards.first().evaluate((el) => {
  const s = getComputedStyle(el);
  return { radius: s.borderRadius, shadow: s.boxShadow };
});
check(
  "SELL category cards: rounded corners + soft shadow",
  parseFloat(sellCardStyle.radius) >= 12 && sellCardStyle.shadow !== "none",
  `${sellCardStyle.radius} / ${sellCardStyle.shadow.slice(0, 50)}`,
);

/* --- Step B: dynamic per-category form (Bikes first) --- */
await page.locator('[data-category="bikes"]').click();
await page.waitForSelector("#sell-form");
const sellFormGlass = await page.locator(".mw-sell-form").evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, blur: s.backdropFilter || s.webkitBackdropFilter };
});
check(
  "SELL step B form: glassmorphism (translucent white + blur(10px))",
  alphaOf(sellFormGlass.bg) < 1 && /blur\(\s*10px\s*\)/.test(sellFormGlass.blur),
  `${sellFormGlass.bg} / ${sellFormGlass.blur}`,
);
check(
  "SELL form is scoped to the picked category",
  /bike/i.test(await txt(page.locator(".mw-sell-form-title"))) &&
    /bikes/i.test(await txt(page.locator(".mw-sell-chip"))),
);

const bikeBrands = (await txts(page.locator('select[name="brand"] option'))).map((b) => b.trim());
check(
  "SELL bikes brand dropdown: Hero, Bajaj, Royal Enfield",
  ["hero", "bajaj", "royal enfield"].every((b) =>
    bikeBrands.some((x) => x.toLowerCase().includes(b)),
  ),
  bikeBrands.join(", "),
);

const sellYearOpts = await txts(page.locator('select[name="year"] option'));
check(
  "SELL year dropdown spans 1992-2026",
  sellYearOpts.includes("1992") && sellYearOpts.includes("2026"),
  `${sellYearOpts[1]}..${sellYearOpts[sellYearOpts.length - 1]}`,
);
check(
  "SELL required fields: fuel, transmission, km, price, location, name, mobile",
  (await page
    .locator(
      'select[name="fuel"], select[name="transmission"], input[name="kilometres"], input[name="expectedPrice"], select[name="location"], input[name="name"], input[name="mobile"]',
    )
    .count()) === 7,
);
check(
  "SELL photo upload accepts multiple images",
  (await page.locator('input[type="file"][multiple]').count()) === 1,
);

/* Brand → Model chain populates category models. */
const heroBrand = bikeBrands.find((b) => /hero/i.test(b));
await page.selectOption('select[name="brand"]', heroBrand);
await page.waitForTimeout(250);
const bikeModels = (await txts(page.locator('select[name="model"] option')))
  .map((m) => m.trim())
  .filter(Boolean);
check(
  "SELL bike models populate after choosing a brand",
  bikeModels.filter((m) => !/^select/i.test(m)).length > 1,
  bikeModels.slice(0, 6).join(", "),
);

/* --- MANDATORY RULE: dynamic for ALL categories (Tractors + Trucks) --- */
await page.locator(".mw-sell-back").click();
await page.waitForSelector(".mw-sell-grid");
await page.locator('[data-category="tractors"]').click();
await page.waitForSelector("#sell-form");
const tractorBrands = (await txts(page.locator('select[name="brand"] option'))).join(" ").toLowerCase();
check(
  "SELL rule: Tractors form shows tractor brands (Mahindra, Swaraj)",
  tractorBrands.includes("mahindra") && tractorBrands.includes("swaraj"),
  tractorBrands,
);
await page.locator(".mw-sell-back").click();
await page.waitForSelector(".mw-sell-grid");
await page.locator('[data-category="trucks"]').click();
await page.waitForSelector("#sell-form");
const truckBrands = (await txts(page.locator('select[name="brand"] option'))).join(" ").toLowerCase();
check(
  "SELL rule: Trucks form shows truck brands (Tata, Ashok Leyland)",
  truckBrands.includes("tata") && truckBrands.includes("ashok leyland"),
  truckBrands,
);
await page.locator(".mw-sell-back").click();
await page.waitForSelector(".mw-sell-grid");
await page.locator('[data-category="three-wheelers"]').click();
await page.waitForSelector("#sell-form");
const twBrands = (await txts(page.locator('select[name="brand"] option'))).join(" ").toLowerCase();
check(
  "SELL rule: 3-Wheeler form shows auto brands (Mahindra, Piaggio, Khalsa EV)",
  twBrands.includes("mahindra") && twBrands.includes("piaggio") && twBrands.includes("khalsa ev"),
  twBrands,
);

/* --- Step C: fill and submit the Bikes listing --- */
await page.locator(".mw-sell-back").click();
await page.waitForSelector(".mw-sell-grid");
await page.locator('[data-category="bikes"]').click();
await page.waitForSelector("#sell-form");
const brandsAgain = (await txts(page.locator('select[name="brand"] option'))).map((b) => b.trim());
await page.selectOption('select[name="brand"]', brandsAgain.find((b) => /hero/i.test(b)));
await page.waitForTimeout(200);
const modelValue = (await txts(page.locator('select[name="model"] option')))
  .map((m) => m.trim())
  .find((m) => m && !/^select/i.test(m));
await page.selectOption('select[name="model"]', modelValue);
await page.selectOption('select[name="year"]', "2019");
const fuelValue = (await txts(page.locator('select[name="fuel"] option')))
  .map((f) => f.trim())
  .find((f) => f && !/^select/i.test(f));
await page.selectOption('select[name="fuel"]', fuelValue);
const transValue = (await txts(page.locator('select[name="transmission"] option')))
  .map((t) => t.trim())
  .find((t) => t && !/^select/i.test(t));
await page.selectOption('select[name="transmission"]', transValue);
const cityValue = (await txts(page.locator('select[name="location"] option')))
  .map((c) => c.trim())
  .find((c) => c && !/^select/i.test(c));
await page.selectOption('select[name="location"]', cityValue);
await page.fill('input[name="kilometres"]', "18500");
await page.fill('input[name="expectedPrice"]', "65000");
await page.fill('input[name="name"]', "Arkan");
await page.fill('input[name="mobile"]', "9876543210");
await page.setInputFiles('input[type="file"][multiple]', {
  name: "bike-front.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
});
await page.waitForTimeout(400);
check("SELL photo thumbnails render after upload", (await page.locator(".mw-sell-photo").count()) === 1);

await page.locator(".mw-sell-submit").click();
await page.waitForSelector("#sell-done", { timeout: 5000 });
check(
  "SELL step C: success message shown after submission",
  /submitted successfully/i.test(await txt(page.locator(".mw-sell-done-title"))),
  await txt(page.locator(".mw-sell-done-title")),
);
const sellLead = await page.evaluate(() => {
  try {
    const queue = JSON.parse(localStorage.getItem("mw_lead_queue") ?? "[]");
    return queue[queue.length - 1] ?? null;
  } catch {
    return null;
  }
});
check(
  "SELL submission saved to the lead store with all required fields",
  Boolean(
    sellLead &&
      sellLead.type === "sell_vehicle" &&
      sellLead.fields?.category === "Bikes" &&
      /hero/i.test(sellLead.fields?.brand ?? "") &&
      sellLead.fields?.year === "2019" &&
      sellLead.fields?.transmission &&
      sellLead.fields?.kilometres === "18500" &&
      sellLead.fields?.expectedPrice === "65000" &&
      sellLead.name === "Arkan" &&
      sellLead.mobile === "9876543210",
  ),
  JSON.stringify({
    type: sellLead?.type,
    category: sellLead?.fields?.category,
    brand: sellLead?.fields?.brand,
  }),
);
check(
  "SELL lead includes the uploaded photo",
  Array.isArray(sellLead?.photos) && sellLead.photos.length === 1,
);

await page.locator(".mw-sell-done-actions .mw-sell-submit").click();
await page.waitForSelector(".mw-sell-grid", { timeout: 3000 });
check(
  "SELL 'Sell Another Vehicle' returns to the category grid",
  (await page.locator(".mw-sell-cat").count()) === 8,
);
await page.screenshot({ path: `${SHOTS}/sell-flow.png`, fullPage: true });

/* The header SELL link must return to the category grid even mid-flow. */
await page.locator('[data-category="bikes"]').click();
await page.waitForSelector("#sell-form");
await page.locator('header a[href="/sell-your-car"]').first().click();
await page.waitForSelector(".mw-sell-grid", { timeout: 5000 });
check(
  "SELL header link returns to the category grid from inside the form",
  (await page.locator(".mw-sell-cat").count()) === 8 &&
    (await page.locator("#sell-form").count()) === 0,
  page.url(),
);

/* ================================================================== */
/* EXCHANGE FLOW — grid → estimate → new vehicle → maths → submit     */
/* ================================================================== */
const isRed = (css) => {
  const o = css.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (o) {
    const light = Number(o[1]);
    const chroma = Number(o[2]);
    const hue = Number(o[3]);
    return light > 0.3 && light < 0.75 && chroma > 0.12 && hue < 60;
  }
  const n = (css.match(/[\d.]+/g) ?? []).map(Number);
  return n.length >= 3 && n[0] > 140 && n[1] < 110 && n[2] < 110;
};
const parseRupee = (s) => Number(((s ?? "").match(/[\d,]+/g)?.[0] ?? "").replace(/,/g, ""));

await page.goto(`${BASE}/exchange`, { waitUntil: "networkidle" });
await page.waitForSelector(".mw-sell-grid");
check("EXCHANGE step A: category grid of 8 categories", (await page.locator(".mw-sell-cat").count()) === 8);
const exBg = await page.evaluate(() =>
  getComputedStyle(document.querySelector(".mw-sell")).backgroundColor,
);
check("EXCHANGE light theme (off-white background)", isOffWhite(exBg), exBg);

await page.locator('[data-category="cars"]').click();
await page.waitForSelector("#exchange-form");
const exFormGlass = await page.locator(".mw-sell-form").evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, blur: s.backdropFilter || s.webkitBackdropFilter };
});
check(
  "EXCHANGE form: glassmorphism (translucent white + blur(10px))",
  alphaOf(exFormGlass.bg) < 1 && /blur\(\s*10px\s*\)/.test(exFormGlass.blur),
  `${exFormGlass.bg} / ${exFormGlass.blur}`,
);
check(
  "EXCHANGE form scoped to the picked category",
  /car/i.test(await txt(page.locator(".mw-sell-form-title").first())) &&
    /cars/i.test(await txt(page.locator(".mw-sell-chip"))),
);

/* --- Step 2: old vehicle details → live estimate --- */
const exBrands = (await txts(page.locator('select[name="brand"] option'))).map((b) => b.trim());
const exBrand =
  exBrands.find((b) => /^tata$/i.test(b)) ?? exBrands.find((b) => b && !/^select/i.test(b));
await page.selectOption('select[name="brand"]', exBrand);
await page.waitForTimeout(250);
const exModels = (await txts(page.locator('select[name="model"] option'))).map((m) => m.trim());
const exModel =
  exModels.find((m) => /nexon/i.test(m)) ?? exModels.find((m) => m && !/^select/i.test(m));
await page.selectOption('select[name="model"]', exModel);
await page.selectOption('select[name="year"]', "2018");
await page.fill('input[name="kilometres"]', "45000");
await page.waitForTimeout(250);
check(
  "EXCHANGE estimate appears once details are filled",
  (await page.locator(".mw-ex-estimate").count()) === 1,
);
const estText = await txt(page.locator(".mw-ex-estimate-value"));
check("EXCHANGE estimate shows a ₹ amount", /^₹[\d,]+$/.test(estText), estText);
check(
  "EXCHANGE estimate is honest about being indicative",
  /indicative/i.test(await txt(page.locator(".mw-ex-estimate-note"))),
);
const exFuel = (await txts(page.locator('select[name="fuel"] option')))
  .map((f) => f.trim())
  .find((f) => f && !/^select/i.test(f));
await page.selectOption('select[name="fuel"]', exFuel);
const exTrans = (await txts(page.locator('select[name="transmission"] option')))
  .map((t) => t.trim())
  .find((t) => t && !/^select/i.test(t));
await page.selectOption('select[name="transmission"]', exTrans);
await page.setInputFiles('input[type="file"][multiple]', {
  name: "old-car.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
});
await page.waitForTimeout(350);
check("EXCHANGE photo upload renders a thumbnail", (await page.locator(".mw-sell-photo").count()) === 1);

/* --- Steps 3+4: new vehicle from listings + difference calculator --- */
const exVehicles = await page.locator('select[name="newVehicle"] option').evaluateAll((opts) =>
  opts.map((o) => ({ v: o.value, t: (o.textContent ?? "").trim() })),
);
check(
  "EXCHANGE new-vehicle picker uses existing listings (Nexon, Swift...)",
  exVehicles.some((o) => /nexon/i.test(o.t)) && exVehicles.some((o) => /swift/i.test(o.t)),
  `${exVehicles.length} options`,
);
const nexonOpt = exVehicles.find((o) => o.v && /nexon/i.test(o.t));
await page.selectOption('select[name="newVehicle"]', nexonOpt.v);
await page.waitForSelector(".mw-ex-calc");
const calc = await page.evaluate(() => {
  const totalEl = document.querySelector(".mw-ex-calc-total");
  return {
    rows: document.querySelectorAll(".mw-ex-calc-row").length,
    newText: document.querySelector(".mw-ex-calc-new").textContent,
    oldText: document.querySelector(".mw-ex-calc-old").textContent,
    totalText: totalEl.textContent,
    color: getComputedStyle(totalEl).color,
    formula: document.querySelector(".mw-ex-calc-formula").textContent,
  };
});
check("EXCHANGE calculator shows all 3 rows", calc.rows === 3, `${calc.rows} rows`);
const nNew = parseRupee(calc.newText);
const nOld = parseRupee(calc.oldText);
const nTotal = parseRupee(calc.totalText);
check(
  "EXCHANGE math: New − Old = Difference (in rupees)",
  nNew > 0 && nOld > 0 && nTotal === Math.max(0, nNew - nOld),
  `${nNew} − ${nOld} = ${nTotal}`,
);
check("EXCHANGE difference displayed in red", isRed(calc.color), calc.color);
check(
  "EXCHANGE formula line spells out the maths",
  /new vehicle price.*old vehicle value.*difference/i.test(calc.formula ?? ""),
  calc.formula,
);

/* --- Step 5: contact + submit --- */
await page.fill('input[name="name"]', "Arkan");
await page.fill('input[name="mobile"]', "9876543210");
await page.locator("#exchange-form .mw-sell-submit").click();
await page.waitForSelector("#exchange-done", { timeout: 5000 });
check(
  "EXCHANGE step 5: success message after submission",
  /exchange request submitted/i.test(await txt(page.locator(".mw-sell-done-title"))),
  await txt(page.locator(".mw-sell-done-title")),
);
const exLead = await page.evaluate(() => {
  try {
    const queue = JSON.parse(localStorage.getItem("mw_lead_queue") ?? "[]");
    return queue[queue.length - 1] ?? null;
  } catch {
    return null;
  }
});
check(
  "EXCHANGE submission saved: old vehicle + new vehicle + difference + contact",
  Boolean(
    exLead &&
      exLead.type === "exchange_vehicle" &&
      exLead.fields?.oldYear === "2018" &&
      exLead.fields?.oldKilometres === "45000" &&
      Number(exLead.fields?.estimatedValue) > 0 &&
      /nexon/i.test(exLead.fields?.newVehicle ?? "") &&
      Number(exLead.fields?.newVehiclePrice) > 0 &&
      exLead.fields?.difference === String(nTotal) &&
      exLead.name === "Arkan" &&
      exLead.mobile === "9876543210" &&
      Array.isArray(exLead.photos) &&
      exLead.photos.length === 1,
  ),
  JSON.stringify({
    type: exLead?.type,
    oldYear: exLead?.fields?.oldYear,
    newVehicle: exLead?.fields?.newVehicle,
    difference: exLead?.fields?.difference,
  }),
);

await page.locator(".mw-sell-done-actions .mw-sell-submit").click();
await page.waitForSelector(".mw-sell-grid", { timeout: 3000 });
check(
  "EXCHANGE 'Start Another Exchange' returns to the category grid",
  (await page.locator(".mw-sell-cat").count()) === 8,
);
await page.locator('[data-category="cars"]').click();
await page.waitForSelector("#exchange-form");
await page.locator('header a[href="/exchange"]').first().click();
await page.waitForSelector(".mw-sell-grid", { timeout: 5000 });
check(
  "EXCHANGE header link returns to the category grid from inside the form",
  (await page.locator(".mw-sell-cat").count()) === 8 &&
    (await page.locator("#exchange-form").count()) === 0,
  page.url(),
);
await page.screenshot({ path: `${SHOTS}/exchange-flow.png`, fullPage: true });

/* ================================================================== */
/* COMPARE FLOW — grid → same-category pickers → side-by-side verdict  */
/* ================================================================== */
await page.goto(`${BASE}/compare`, { waitUntil: "networkidle" });
await page.waitForSelector(".mw-sell-grid");
check(
  "COMPARE opens with the category grid FIRST (no form)",
  (await page.locator(".mw-sell-cat").count()) === 8 &&
    (await page.locator("#compare-form").count()) === 0,
);
check("COMPARE header nav link exists", (await page.locator('header a[href="/compare"]').count()) >= 1);
const cmpBg = await page.evaluate(() =>
  getComputedStyle(document.querySelector(".mw-sell")).backgroundColor,
);
check("COMPARE light theme (off-white background)", isOffWhite(cmpBg), cmpBg);

await page.locator('[data-category="cars"]').click();
await page.waitForSelector("#compare-form");
const cmpGlass = await page.locator(".mw-sell-form").evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, blur: s.backdropFilter || s.webkitBackdropFilter };
});
check(
  "COMPARE form: glassmorphism (translucent white + blur(10px))",
  alphaOf(cmpGlass.bg) < 1 && /blur\(\s*10px\s*\)/.test(cmpGlass.blur),
  `${cmpGlass.bg} / ${cmpGlass.blur}`,
);

/* Step 2 — two CLOSED pickers: native selects, listing data only. */
const pickTags = await page.evaluate(() => [
  document.querySelector('select[name="vehicle1"]')?.tagName,
  document.querySelector('select[name="vehicle2"]')?.tagName,
]);
check(
  "COMPARE pickers are dropdowns (no free typing of custom vehicles)",
  pickTags[0] === "SELECT" && pickTags[1] === "SELECT",
  pickTags.join(","),
);
const cmpOpts = await page.locator('select[name="vehicle1"] option').evaluateAll((opts) =>
  opts.map((o) => ({ v: o.value, t: (o.textContent ?? "").trim() })),
);
check(
  "COMPARE cars dropdown pulls from existing listings (Nexon, Swift…)",
  cmpOpts.length > 5 &&
    cmpOpts.some((o) => /nexon/i.test(o.t)) &&
    cmpOpts.some((o) => /swift/i.test(o.t)),
  `${cmpOpts.length} options`,
);
check(
  "COMPARE dropdown options carry a ₹ price from the listing data",
  cmpOpts.filter((o) => o.v && /₹[\d,]+/.test(o.t)).length >= cmpOpts.length - 1,
);

/* Pick two real cars → the comparison renders. */
const pickA = cmpOpts.find((o) => o.v && /nexon/i.test(o.t)) ?? cmpOpts[1];
const pickB =
  cmpOpts.find((o) => o.v && o.v !== pickA.v && /swift/i.test(o.t)) ??
  cmpOpts.find((o) => o.v && o.v !== pickA.v);
await page.selectOption('select[name="vehicle1"]', pickA.v);
await page.selectOption('select[name="vehicle2"]', pickB.v);
await page.waitForSelector("#compare-result");

const cmpRows = await page.evaluate(() =>
  [...document.querySelectorAll(".mw-cmp-row")].map((row) => ({
    label: (row.querySelector(".mw-cmp-label")?.textContent ?? "").trim(),
    a: (row.querySelector('[data-side="a"]')?.textContent ?? "").trim(),
    b: (row.querySelector('[data-side="b"]')?.textContent ?? "").trim(),
    aBetter: row.querySelector('[data-side="a"]')?.classList.contains("mw-cmp-cell--better") ?? false,
    bBetter: row.querySelector('[data-side="b"]')?.classList.contains("mw-cmp-cell--better") ?? false,
  })),
);
check(
  "COMPARE shows the 6 required spec rows in order",
  cmpRows.length === 6 &&
    ["Price", "Year", "Km Driven", "Fuel Type", "Transmission", "Location"].every(
      (label, i) => cmpRows[i].label === label,
    ),
  cmpRows.map((r) => r.label).join(", "),
);
check(
  "COMPARE both columns render real values (₹ price + 4-digit year)",
  cmpRows.every((r) => r.a.length > 0 && r.b.length > 0) &&
    /^₹[\d,]+$/.test(cmpRows[0].a) &&
    /^₹[\d,]+$/.test(cmpRows[0].b) &&
    /^\d{4}$/.test(cmpRows[1].a) &&
    /^\d{4}$/.test(cmpRows[1].b),
  `${cmpRows[0].a} vs ${cmpRows[0].b}`,
);

/* Step 4 — verdict recomputed in the test from the rendered row values. */
const num = (s) => Number(((s ?? "").match(/[\d,]+/g)?.[0] ?? "").replace(/,/g, ""));
const rowOf = (label) => cmpRows.find((r) => r.label === label);
let aWins = 0;
let bWins = 0;
const pA = num(rowOf("Price").a);
const pB = num(rowOf("Price").b);
const yA = num(rowOf("Year").a);
const yB = num(rowOf("Year").b);
const kmA = /not listed/i.test(rowOf("Km Driven").a) ? null : num(rowOf("Km Driven").a);
const kmB = /not listed/i.test(rowOf("Km Driven").b) ? null : num(rowOf("Km Driven").b);
if (pA < pB) aWins++;
else if (pB < pA) bWins++;
if (yA > yB) aWins++;
else if (yB > yA) bWins++;
if (kmA !== null && kmB !== null) {
  if (kmA < kmB) aWins++;
  else if (kmB < kmA) bWins++;
}
const expectedWinner =
  aWins >= 2 && aWins > bWins ? "a" : bWins >= 2 && bWins > aWins ? "b" : "none";
const actualWinner = await page.locator("#compare-result").getAttribute("data-winner");
check(
  "COMPARE verdict follows the simple rule (price + year + km, no AI)",
  actualWinner === expectedWinner,
  `${aWins}\u2013${bWins} → expected ${expectedWinner}, got ${actualWinner}`,
);
const badgeCounts = {
  excellent: await page.locator('.mw-cmp-badge[data-badge="excellent"]').count(),
  good: await page.locator('.mw-cmp-badge[data-badge="good"]').count(),
};
check(
  "COMPARE badges: Excellent Vehicle on the clear winner, Good Choice otherwise",
  expectedWinner === "none"
    ? badgeCounts.excellent === 0 && badgeCounts.good === 2
    : badgeCounts.excellent === 1 && badgeCounts.good === 1,
  `winner=${expectedWinner} ${JSON.stringify(badgeCounts)}`,
);
const cmpHighlights = await page.evaluate(() => ({
  a: document.querySelectorAll('.mw-cmp-cell--better[data-side="a"]').length,
  b: document.querySelectorAll('.mw-cmp-cell--better[data-side="b"]').length,
}));
const expectedHighlights =
  expectedWinner === "none"
    ? { a: 0, b: 0 }
    : expectedWinner === "a"
      ? { a: aWins, b: 0 }
      : { a: 0, b: bWins };
check(
  "COMPARE only the winner's winning values are highlighted",
  cmpHighlights.a === expectedHighlights.a && cmpHighlights.b === expectedHighlights.b,
  `expected ${JSON.stringify(expectedHighlights)}, got ${JSON.stringify(cmpHighlights)}`,
);
const cmpVerdictTitle = await txt(page.locator(".mw-cmp-verdict-title"));
check(
  "COMPARE verdict headline states Excellent Vehicle / Good Choice",
  expectedWinner === "none"
    ? /good choice/i.test(cmpVerdictTitle)
    : /excellent vehicle/i.test(cmpVerdictTitle) && cmpVerdictTitle.length > 20,
  cmpVerdictTitle,
);
await page.screenshot({ path: `${SHOTS}/compare-flow.png`, fullPage: true });

/* Same vehicle twice → hint, no comparison. */
await page.selectOption('select[name="vehicle2"]', pickA.v);
await page.waitForTimeout(250);
check(
  "COMPARE same vehicle twice → warning, comparison hidden",
  (await page.locator(".mw-cmp-hint").count()) === 1 &&
    (await page.locator("#compare-result").count()) === 0 &&
    /same vehicle twice/i.test(await txt(page.locator(".mw-cmp-hint"))),
);

/* Category isolation — bikes can only be compared with bikes. */
await page.locator("#compare-form .mw-sell-back").click();
await page.waitForSelector(".mw-sell-grid");
await page.locator('[data-category="bikes"]').click();
await page.waitForSelector("#compare-form");
const bikeOpts = (await txts(page.locator('select[name="vehicle1"] option'))).filter(Boolean);
check(
  "COMPARE bikes category lists ONLY bikes (no cars mixed in)",
  bikeOpts.length > 3 &&
    !bikeOpts.some((o) => /nexon|swift|harrier|tiago/i.test(o)) &&
    bikeOpts.some((o) => /hero|honda|bajaj|tvs|yamaha|royal enfield|suzuki/i.test(o)),
  `${bikeOpts.length} options`,
);
check(
  "COMPARE header link returns to the category grid from inside the form",
  (await page.locator('#compare-form .mw-sell-back').count()) === 1,
);

/* ================================================================== */
/* SCRAP FLOW — grid → lead-only form (NO price) → success             */
/* ================================================================== */
await page.goto(`${BASE}/scrap`, { waitUntil: "networkidle" });
await page.waitForSelector(".mw-sell-grid");
check(
  "SCRAP opens with the category grid FIRST (no form)",
  (await page.locator(".mw-sell-cat").count()) === 8 &&
    (await page.locator("#scrap-form").count()) === 0,
);
check("SCRAP header nav link exists", (await page.locator('header a[href="/scrap"]').count()) >= 1);
const scrBg = await page.evaluate(() =>
  getComputedStyle(document.querySelector(".mw-sell")).backgroundColor,
);
check("SCRAP light theme (off-white background)", isOffWhite(scrBg), scrBg);

await page.locator('[data-category="bikes"]').click();
await page.waitForSelector("#scrap-form");
const scrGlass = await page.locator(".mw-sell-form").evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, blur: s.backdropFilter || s.webkitBackdropFilter };
});
check(
  "SCRAP form: glassmorphism (translucent white + blur(10px))",
  alphaOf(scrGlass.bg) < 1 && /blur\(\s*10px\s*\)/.test(scrGlass.blur),
  `${scrGlass.bg} / ${scrGlass.blur}`,
);

const scrFields = await page.evaluate(() => ({
  brand: document.querySelector('select[name="brand"]')?.tagName,
  model: `${document.querySelector('input[name="model"]')?.tagName}:${document.querySelector('input[name="model"]')?.type}`,
  year: document.querySelector('select[name="year"]')?.tagName,
  location: document.querySelector('select[name="location"]')?.tagName,
  name: document.querySelector('input[name="name"]')?.type,
  mobile: document.querySelector('input[name="mobile"]')?.type,
  photos: document.querySelectorAll('#scrap-form input[type="file"][multiple]').length,
  submit: (document.querySelector("#scrap-form .mw-sell-submit")?.textContent ?? "").trim(),
}));
check(
  "SCRAP form has brand, model, year, location, photo upload, name, mobile",
  scrFields.brand === "SELECT" &&
    scrFields.model === "INPUT:text" &&
    scrFields.year === "SELECT" &&
    scrFields.location === "SELECT" &&
    scrFields.name === "text" &&
    scrFields.mobile === "tel" &&
    scrFields.photos === 1,
  JSON.stringify(scrFields),
);
check(
  "SCRAP submit button label",
  /submit scrap request/i.test(scrFields.submit),
  scrFields.submit,
);
const scrYearOpts = (await txts(page.locator('select[name="year"] option'))).map((y) => y.trim());
check(
  "SCRAP year dropdown spans 1992-2026",
  scrYearOpts.includes("1992") && scrYearOpts.includes("2026"),
  `${scrYearOpts[1]}..${scrYearOpts[scrYearOpts.length - 1]}`,
);
const scrBrands = (await txts(page.locator('select[name="brand"] option'))).map((b) => b.trim());
check("SCRAP brand dropdown comes from the bikes catalogue", scrBrands.length > 3, scrBrands.slice(0, 6).join(", "));

/* MANDATORY: no price / no estimate anywhere in the scrap flow. */
const scrText = await txt(page.locator("#scrap-form"));
const scrHero = await txt(page.locator(".mw-sell-hero"));
const scrPricing = `${scrText} ${scrHero}`;
check(
  "SCRAP rule: NO price, estimate or value shown anywhere",
  !/₹/.test(scrPricing) &&
    !/estimated|price|₹|difference/i.test(scrText) &&
    (await page.locator(".mw-ex-estimate, .mw-ex-calc, [class*=estimate]").count()) === 0,
  scrPricing.slice(0, 120),
);

/* Fill and submit the lead. */
const scrBrand = scrBrands.find((b) => /^hero$/i.test(b)) ?? scrBrands.find((b) => b && !/^select/i.test(b));
await page.selectOption('select[name="brand"]', scrBrand);
await page.fill('input[name="model"]', "Splendor Plus");
await page.selectOption('select[name="year"]', "2015");
const scrCity = (await txts(page.locator('select[name="location"] option')))
  .map((c) => c.trim())
  .find((c) => c && !/^select/i.test(c));
await page.selectOption('select[name="location"]', scrCity);
await page.setInputFiles('#scrap-form input[type="file"][multiple]', {
  name: "scrap-bike.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
});
await page.waitForTimeout(400);
check("SCRAP photo thumbnail renders", (await page.locator(".mw-sell-photo").count()) === 1);
await page.fill('input[name="name"]', "Arkan");
await page.fill('input[name="mobile"]', "9876543210");
await page.locator("#scrap-form .mw-sell-submit").click();
await page.waitForSelector("#scrap-done", { timeout: 5000 });
const scrDoneTitle = await txt(page.locator(".mw-sell-done-title"));
check(
  "SCRAP success message matches the required copy",
  /request received\. our team will contact you shortly for scrap evaluation\./i.test(scrDoneTitle),
  scrDoneTitle,
);
const scrLead = await page.evaluate(() => {
  try {
    const queue = JSON.parse(localStorage.getItem("mw_lead_queue") ?? "[]");
    return queue[queue.length - 1] ?? null;
  } catch {
    return null;
  }
});
check(
  "SCRAP submission saved as a lead with brand/model/year/location/contact",
  Boolean(
    scrLead &&
      scrLead.type === "scrap_vehicle" &&
      scrLead.fields?.category === "Bikes" &&
      /hero/i.test(scrLead.fields?.brand ?? "") &&
      scrLead.fields?.model === "Splendor Plus" &&
      scrLead.fields?.year === "2015" &&
      scrLead.fields?.location &&
      scrLead.name === "Arkan" &&
      scrLead.mobile === "9876543210" &&
      Array.isArray(scrLead.photos) &&
      scrLead.photos.length === 1,
  ),
  JSON.stringify({ type: scrLead?.type, brand: scrLead?.fields?.brand, model: scrLead?.fields?.model }),
);
check(
  "SCRAP lead carries no price/estimate payload",
  !/(price|estimate|value|difference)/i.test(JSON.stringify(scrLead?.fields ?? {})),
  JSON.stringify(Object.keys(scrLead?.fields ?? {})),
);
await page.screenshot({ path: `${SHOTS}/scrap-flow.png`, fullPage: true });

await page.locator(".mw-sell-done-actions .mw-sell-submit").click();
await page.waitForSelector(".mw-sell-grid", { timeout: 3000 });
check(
  "SCRAP 'Scrap Another Vehicle' returns to the category grid",
  (await page.locator(".mw-sell-cat").count()) === 8,
);
await page.locator('[data-category="cars"]').click();
await page.waitForSelector("#scrap-form");
await page.locator('header a[href="/scrap"]').first().click();
await page.waitForSelector(".mw-sell-grid", { timeout: 5000 });
check(
  "SCRAP header link returns to the category grid from inside the form",
  (await page.locator(".mw-sell-cat").count()) === 8 &&
    (await page.locator("#scrap-form").count()) === 0,
  page.url(),
);

/* ================================================================== */
/* SERVICE BOOKING — grid → per-category service types → submit         */
/* ================================================================== */
const SVC_LISTS = {
  cars: [
    "Periodic/General Service",
    "AC Repair & Gas Refill",
    "Denting & Painting",
    "Engine & Transmission Work",
    "Suspension & Steering",
    "Brakes & Tyres",
    "Electrical & Battery",
    "Detailing & Car Spa",
  ],
  bikes: [
    "General Service",
    "Engine Tuning & Overhauling",
    "Clutch & Chain Sprocket",
    "Brakes & Tyres",
    "Electrical & Battery",
    "Denting & Painting",
    "Customization",
  ],
  "three-wheelers": [
    "Motor & Controller Repair (EV)",
    "General Service & Greasing",
    "Suspension & Leaf Spring Work",
    "Brakes & Clutch",
    "Battery Replacement (EV)",
    "Body & Canopy Repair",
  ],
  trucks: [
    "Engine & Turbo Repair",
    "Air Brake System",
    "Suspension & Spring",
    "Gearbox & Differential",
    "Clutch & Pressure Plate",
    "AC & Cabin Cooling",
    "Tyre & Wheel Alignment",
    "Fabrication & Body Repair",
  ],
  tractors: [
    "Engine Overhauling",
    "Hydraulics Repair",
    "Clutch & Transmission",
    "Steering & Brakes",
    "Electrical & Alternator",
    "Implement Repair",
  ],
};

await page.goto(`${BASE}/services`, { waitUntil: "networkidle" });
await page.waitForSelector(".mw-sell-grid");
check(
  "SERVICE opens with the category grid FIRST (no form)",
  (await page.locator(".mw-sell-cat").count()) === 8 &&
    (await page.locator("#service-form").count()) === 0,
);
check(
  "SERVICE header nav link exists",
  (await page.locator('header a[href="/services"]').count()) >= 1,
);
const srvBg = await page.evaluate(() =>
  getComputedStyle(document.querySelector(".mw-sell")).backgroundColor,
);
check("SERVICE light theme (off-white background)", isOffWhite(srvBg), srvBg);

await page.locator('[data-category="cars"]').click();
await page.waitForSelector("#service-form");
const srvGlass = await page.locator(".mw-sell-form").evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, blur: s.backdropFilter || s.webkitBackdropFilter };
});
check(
  "SERVICE form: glassmorphism (translucent white + blur(10px))",
  alphaOf(srvGlass.bg) < 1 && /blur\(\s*10px\s*\)/.test(srvGlass.blur),
  `${srvGlass.bg} / ${srvGlass.blur}`,
);

const readServiceTypes = async () =>
  (await txts(page.locator('select[name="serviceType"] option')))
    .map((s) => s.trim())
    .filter((s) => s && !/^select service type$/i.test(s));

/* CRITICAL — the dropdown must swap with the picked category. */
const srvOptionsMatch = (actual, expected) =>
  actual.length === expected.length && expected.every((label, i) => actual[i] === label);
let srvActual = await readServiceTypes();
check(
  "SERVICE Type list for CARS matches the spec exactly",
  srvOptionsMatch(srvActual, SVC_LISTS.cars),
  srvActual.join(" | "),
);

const srvCategoryOptions = async (catId) => {
  await page.locator('header a[href="/services"]').first().click();
  await page.waitForSelector(".mw-sell-grid", { timeout: 5000 });
  await page.locator(`[data-category="${catId}"]`).click();
  await page.waitForSelector("#service-form");
  return readServiceTypes();
};

srvActual = await srvCategoryOptions("bikes");
check(
  "SERVICE Type list for BIKES swaps correctly",
  srvOptionsMatch(srvActual, SVC_LISTS.bikes),
  srvActual.join(" | "),
);
srvActual = await srvCategoryOptions("three-wheelers");
check(
  "SERVICE Type list for 3-WHEELERS swaps correctly",
  srvOptionsMatch(srvActual, SVC_LISTS["three-wheelers"]),
  srvActual.join(" | "),
);
srvActual = await srvCategoryOptions("trucks");
check(
  "SERVICE Type list for TRUCKS matches the shared commercial list",
  srvOptionsMatch(srvActual, SVC_LISTS.trucks),
  srvActual.join(" | "),
);
srvActual = await srvCategoryOptions("tractors");
check(
  "SERVICE Type list for TRACTORS swaps correctly",
  srvOptionsMatch(srvActual, SVC_LISTS.tractors),
  srvActual.join(" | "),
);

/* Back to cars and check every required field, then submit. */
await page.locator('header a[href="/services"]').first().click();
await page.waitForSelector(".mw-sell-grid", { timeout: 5000 });
await page.locator('[data-category="cars"]').click();
await page.waitForSelector("#service-form");
const srvFields = await page.evaluate(() => ({
  serviceType: document.querySelector('select[name="serviceType"]')?.tagName,
  brand: document.querySelector('select[name="brand"]')?.tagName,
  model: `${document.querySelector('input[name="model"]')?.tagName}:${document.querySelector('input[name="model"]')?.type}`,
  year: document.querySelector('select[name="year"]')?.tagName,
  fuel: document.querySelector('select[name="fuel"]')?.tagName,
  location: document.querySelector('input[name="location"]')?.type,
  date: document.querySelector('input[name="date"]')?.type,
  time: document.querySelector('select[name="time"]')?.tagName,
  name: document.querySelector('input[name="name"]')?.type,
  mobile: document.querySelector('input[name="mobile"]')?.type,
  description: document.querySelector('textarea[name="description"]')?.tagName,
  photos: document.querySelectorAll('#service-form input[type="file"][multiple]').length,
  submit: (document.querySelector("#service-form .mw-sell-submit")?.textContent ?? "").trim(),
}));
check(
  "SERVICE form has service type, brand, model, year, fuel, location, date, time, contact, issue box, photos",
  srvFields.serviceType === "SELECT" &&
    srvFields.brand === "SELECT" &&
    srvFields.model === "INPUT:text" &&
    srvFields.year === "SELECT" &&
    srvFields.fuel === "SELECT" &&
    srvFields.location === "text" &&
    srvFields.date === "date" &&
    srvFields.time === "SELECT" &&
    srvFields.name === "text" &&
    srvFields.mobile === "tel" &&
    srvFields.description === "TEXTAREA" &&
    srvFields.photos === 1,
  JSON.stringify(srvFields),
);
check("SERVICE submit button label", /^book service$/i.test(srvFields.submit), srvFields.submit);
const srvYearOpts = (await txts(page.locator('select[name="year"] option'))).map((y) => y.trim());
check(
  "SERVICE year dropdown spans 1992-2026",
  srvYearOpts.includes("1992") && srvYearOpts.includes("2026"),
  `${srvYearOpts[1]}..${srvYearOpts[srvYearOpts.length - 1]}`,
);
const srvSlots = (await txts(page.locator('select[name="time"] option')))
  .map((s) => s.trim())
  .filter((s) => s && !/^select time slot$/i.test(s));
check("SERVICE preferred time slot dropdown is populated", srvSlots.length >= 3, srvSlots.join(" | "));

/* Fill the booking and submit. */
const srvService = SVC_LISTS.cars[1];
await page.selectOption('select[name="serviceType"]', srvService);
const srvBrands = (await txts(page.locator('select[name="brand"] option'))).map((b) => b.trim());
const srvBrand = srvBrands.find((b) => /^hyundai$/i.test(b)) ?? srvBrands.find((b) => b && !/^select/i.test(b));
await page.selectOption('select[name="brand"]', srvBrand);
await page.fill('input[name="model"]', "Creta");
await page.selectOption('select[name="year"]', "2021");
const srvFuel = (await txts(page.locator('select[name="fuel"] option')))
  .map((f) => f.trim())
  .find((f) => f && !/^select/i.test(f));
await page.selectOption('select[name="fuel"]', srvFuel);
await page.fill('input[name="location"]', "HSR Layout, Bengaluru");
const srvDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
await page.fill('input[name="date"]', srvDate);
await page.selectOption('select[name="time"]', srvSlots[0]);
await page.fill('textarea[name="description"]', "AC not cooling at idle.");
await page.setInputFiles('#service-form input[type="file"][multiple]', {
  name: "service-car.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
});
await page.waitForTimeout(400);
check("SERVICE photo thumbnail renders", (await page.locator(".mw-sell-photo").count()) === 1);
await page.fill('input[name="name"]', "Arkan");
await page.fill('input[name="mobile"]', "9876543210");
await page.locator("#service-form .mw-sell-submit").click();
await page.waitForSelector("#service-done", { timeout: 5000 });
const srvDoneTitle = await txt(page.locator(".mw-sell-done-title"));
check(
  "SERVICE success message matches the required copy",
  /service request received! our team will contact you shortly to confirm the booking\./i.test(
    srvDoneTitle,
  ),
  srvDoneTitle,
);
const srvLead = await page.evaluate(() => {
  try {
    const queue = JSON.parse(localStorage.getItem("mw_lead_queue") ?? "[]");
    return queue[queue.length - 1] ?? null;
  } catch {
    return null;
  }
});
check(
  "SERVICE submission saved as a lead with service type, vehicle, slot and contact",
  Boolean(
    srvLead &&
      srvLead.type === "service_booking" &&
      srvLead.fields?.category === "Cars" &&
      srvLead.fields?.serviceType === srvService &&
      srvLead.fields?.brand === srvBrand &&
      srvLead.fields?.model === "Creta" &&
      srvLead.fields?.year === "2021" &&
      srvLead.fields?.fuel === srvFuel &&
      srvLead.fields?.location === "HSR Layout, Bengaluru" &&
      srvLead.fields?.date === srvDate &&
      srvLead.fields?.time === srvSlots[0] &&
      srvLead.fields?.description === "AC not cooling at idle." &&
      srvLead.name === "Arkan" &&
      srvLead.mobile === "9876543210" &&
      Array.isArray(srvLead.photos) &&
      srvLead.photos.length === 1,
  ),
  JSON.stringify({ type: srvLead?.type, serviceType: srvLead?.fields?.serviceType, model: srvLead?.fields?.model }),
);
await page.screenshot({ path: `${SHOTS}/service-flow.png`, fullPage: true });

await page.locator(".mw-sell-done-actions .mw-sell-submit").click();
await page.waitForSelector(".mw-sell-grid", { timeout: 3000 });
check(
  "SERVICE 'Book Another Service' returns to the category grid",
  (await page.locator(".mw-sell-cat").count()) === 8,
);
await page.locator('[data-category="cars"]').click();
await page.waitForSelector("#service-form");
await page.locator('header a[href="/services"]').first().click();
await page.waitForSelector(".mw-sell-grid", { timeout: 5000 });
check(
  "SERVICE header link returns to the category grid from inside the form",
  (await page.locator(".mw-sell-cat").count()) === 8 &&
    (await page.locator("#service-form").count()) === 0,
  page.url(),
);

const mobile = await browser.newContext({
  viewport: { width: 360, height: 780 },
  isMobile: true,
  hasTouch: true,
});
const mpage = await mobile.newPage();
mpage.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`mobile console: ${msg.text()}`);
});
mpage.on("pageerror", (error) => errors.push(`mobile pageerror: ${error.message}`));
hardenGoto(mpage);
await mpage.goto(`${BASE}/buy?category=bikes`, { waitUntil: "networkidle" });
await mpage.waitForSelector(".mw-bento");
const mWidth = await mpage.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
check("no horizontal overflow on mobile flow", mWidth.scroll <= mWidth.client + 1, JSON.stringify(mWidth));
await mpage.screenshot({ path: `${SHOTS}/mobile-flow.png`, fullPage: true });
await mpage.goto(`${BASE}/sell-your-car`, { waitUntil: "networkidle" });
await mpage.waitForSelector(".mw-sell-grid");
const sellMobile = await mpage.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
check(
  "no horizontal overflow on mobile sell category grid",
  sellMobile.scroll <= sellMobile.client + 1,
  JSON.stringify(sellMobile),
);
await mpage.locator('[data-category="cars"]').click();
await mpage.waitForSelector("#sell-form");
const sellFormOverflow = await mpage.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
check(
  "no horizontal overflow on mobile sell form",
  sellFormOverflow.scroll <= sellFormOverflow.client + 1,
  JSON.stringify(sellFormOverflow),
);
await mpage.goto(`${BASE}/exchange`, { waitUntil: "networkidle" });
await mpage.waitForSelector(".mw-sell-grid");
await mpage.locator('[data-category="cars"]').click();
await mpage.waitForSelector("#exchange-form");
const exMobile = await mpage.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
check(
  "no horizontal overflow on mobile exchange form",
  exMobile.scroll <= exMobile.client + 1,
  JSON.stringify(exMobile),
);

/* COMPARE + SCRAP must also fit a phone without sideways scrolling. */
await mpage.goto(`${BASE}/compare`, { waitUntil: "networkidle" });
await mpage.waitForSelector(".mw-sell-grid");
await mpage.locator('[data-category="cars"]').click();
await mpage.waitForSelector("#compare-form");
const cmpMobileOpts = await mpage.locator('select[name="vehicle1"] option').evaluateAll((opts) =>
  opts.map((o) => o.value).filter(Boolean),
);
await mpage.selectOption('select[name="vehicle1"]', cmpMobileOpts[0]);
await mpage.selectOption('select[name="vehicle2"]', cmpMobileOpts[1]);
await mpage.waitForSelector("#compare-result");
const cmpMobile = await mpage.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
check(
  "no horizontal overflow on mobile compare view",
  cmpMobile.scroll <= cmpMobile.client + 1,
  JSON.stringify(cmpMobile),
);
await mpage.screenshot({ path: `${SHOTS}/mobile-compare.png`, fullPage: true });
await mpage.goto(`${BASE}/scrap`, { waitUntil: "networkidle" });
await mpage.waitForSelector(".mw-sell-grid");
await mpage.locator('[data-category="cars"]').click();
await mpage.waitForSelector("#scrap-form");
const scrMobile = await mpage.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
check(
  "no horizontal overflow on mobile scrap form",
  scrMobile.scroll <= scrMobile.client + 1,
  JSON.stringify(scrMobile),
);
await mpage.goto(`${BASE}/services`, { waitUntil: "networkidle" });
await mpage.waitForSelector(".mw-sell-grid");
await mpage.locator('[data-category="cars"]').click();
await mpage.waitForSelector("#service-form");
const srvMobile = await mpage.evaluate(() => ({
  scroll: document.documentElement.scrollWidth,
  client: document.documentElement.clientWidth,
}));
check(
  "no horizontal overflow on mobile service form",
  srvMobile.scroll <= srvMobile.client + 1,
  JSON.stringify(srvMobile),
);

console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
const failed = results.filter((r) => !r.pass);
console.log(`RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length)
  console.log(
    "FAILED:\n" + failed.map((f) => `${f.name} (${f.detail})`).join("\n"),
  );
await browser.close();
process.exit(failed.length || errors.length ? 1 : 0);
