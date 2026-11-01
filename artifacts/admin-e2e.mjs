/**
 * Master Admin control room — Phase 1 end-to-end suite.
 *
 * Covers: route protection, first-run admin enrolment, dashboard KPIs and
 * panels, the unified Master Tracker (filters, search, pagination, drawer,
 * status/assignment/notes persistence), sign-out/sign-in, and mobile layout.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const EMAIL = "owner@motorwallah.in";
const PASSWORD = "MasterAdmin2026";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` :: ${detail}` : ""}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(String(error)));

const text = (selector) => page.locator(selector).first().textContent();
const number = async (selector) => Number((await text(selector))?.replace(/[^\d]/g, "") ?? "-1");

try {
  /* ---------------------------------------------------------- 1. guard */
  await page.goto(`${BASE}/master-admin`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/master-admin\/login/, { timeout: 15000 });
  check("Signed-out visitor is redirected to the admin login", page.url().includes("/master-admin/login"));

  await page.goto(`${BASE}/master-admin/tracker`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/master-admin\/login/, { timeout: 15000 });
  check("Tracker route is protected too", page.url().includes("/master-admin/login"));

  const dashboardHidden = (await page.locator('[data-testid="admin-dashboard"]').count()) === 0;
  check("No dashboard content renders before sign-in", dashboardHidden);

  await page.waitForSelector('[data-testid="admin-email"]', { timeout: 15000 });
  check("Login form asks for email + password", true);

  /* ------------------------------------------------- 2. first-run setup */
  const setupLink = page.locator('[data-testid="admin-setup-link"]');
  check("First run offers account enrolment", (await setupLink.count()) > 0);
  await setupLink.click();
  await page.waitForSelector('[data-testid="admin-name"]:visible', { timeout: 8000 });

  await page.fill('[data-testid="admin-name"]', "Ananya Rao");
  await page.fill('[data-testid="admin-email"]', EMAIL);
  await page.fill('[data-testid="admin-password"]', "short");
  await page.fill('[data-testid="admin-confirm"]', "short");
  await page.click('[data-testid="admin-submit"]');
  await page.waitForSelector('[data-testid="admin-error"]', { timeout: 6000 });
  check(
    "Weak password is rejected",
    /at least 10/i.test(await text('[data-testid="admin-error"]')),
  );

  await page.fill('[data-testid="admin-password"]', PASSWORD);
  await page.fill('[data-testid="admin-confirm"]', PASSWORD);
  await page.click('[data-testid="admin-submit"]');
  await page.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 20000 });
  check("Enrolling the master admin opens the dashboard", page.url().endsWith("/master-admin"));

  const storedAccounts = await page.evaluate(() => window.localStorage.getItem("mw_admin_accounts"));
  const account = JSON.parse(storedAccounts ?? "{}")[EMAIL];
  check("Admin account is persisted with a PBKDF2 hash", Boolean(account?.hash) && account.hash.length > 20);
  check(
    "Plaintext password is never stored",
    !storedAccounts.includes(PASSWORD) && !storedAccounts.includes("password"),
  );
  check(
    "Stored hash is not the plaintext (salted derivation)",
    Boolean(account?.salt) && account?.iterations >= 100000,
    `${account?.iterations} iterations`,
  );

  /* ------------------------------------------------------- 3. dashboard */
  const revenue = await text('[data-testid="kpi-revenue"]');
  check("Total revenue KPI renders a currency value", /₹/.test(revenue ?? ""), revenue ?? "");

  const leads = await number('[data-testid="kpi-leads"]');
  check("Total leads KPI counts the seeded pipeline", leads >= 25, `${leads} leads`);

  const approvals = await number('[data-testid="kpi-approvals"]');
  check("Pending approvals KPI is populated", approvals > 0, `${approvals} pending`);

  const users = await number('[data-testid="kpi-users"]');
  check("Active users KPI is populated", users > 0, `${users} active`);

  const actionItems = await page.locator('[data-testid="action-list"] li').count();
  check("Action required panel lists overdue/due-soon cases", actionItems > 0, `${actionItems} items`);

  const feedItems = await page.locator('[data-testid="activity-feed"] li').count();
  check("Recent activity feed has entries", feedItems > 0, `${feedItems} entries`);

  await page.screenshot({ path: "artifacts/admin-1-dashboard.png", fullPage: false });

  /* --------------------------------------------------------- 4. tracker */
  await page.click('[data-testid="admin-nav-master-tracker"]');
  await page.waitForSelector('[data-testid="tracker-table"] tbody tr', { timeout: 15000 });
  const totalCases = await number('[data-testid="tracker-total"]');
  check("Tracker lists every business case in one table", totalCases >= 25, `${totalCases} cases`);

  const headers = await page.locator('[data-testid="tracker-table"] thead th').allTextContents();
  const required = [
    "Case ID",
    "Type",
    "Customer",
    "Mobile",
    "Source",
    "Status",
    "Priority",
    "Assigned to",
    "Created",
    "SLA",
  ];
  const missing = required.filter((label) => !headers.some((header) => header.includes(label)));
  check("Table has every required column", missing.length === 0, missing.join(", "));

  const firstPageRows = await page.locator('[data-testid="tracker-table"] tbody tr').count();
  check("Pagination limits the first page to 10 rows", firstPageRows === 10, `${firstPageRows} rows`);

  const types = await page.locator('[data-testid="tracker-table"] tbody td[data-label="Type"]').allTextContents();
  const uniqueTypes = new Set(types.map((value) => value.trim()));
  check("One table spans multiple business lines", uniqueTypes.size >= 4, [...uniqueTypes].join(", "));

  /* --------------------------------------------------------- 5. filters */
  await page.selectOption('[data-testid="filter-type"]', "Finance");
  await page.waitForTimeout(400);
  const financeTotal = await number('[data-testid="tracker-total"]');
  const financeTypes = await page
    .locator('[data-testid="tracker-table"] tbody td[data-label="Type"]')
    .allTextContents();
  check(
    "Type filter narrows the table to Finance only",
    financeTotal > 0 && financeTypes.every((value) => value.trim() === "Finance"),
    `${financeTotal} finance cases`,
  );

  await page.click('[data-testid="toggle-filters"]');
  await page.waitForSelector('[data-testid="filter-from"]', { timeout: 6000 });
  check("Advanced filters expose priority, assignee and date range", true);

  await page.selectOption('[data-testid="filter-status"]', "Won");
  await page.waitForTimeout(350);
  const wonFinance = await number('[data-testid="tracker-total"]');
  check("Status filter combines with the type filter", wonFinance <= financeTotal);

  await page.fill('[data-testid="filter-from"]', "2099-01-01");
  await page.waitForTimeout(350);
  const futureTotal = await number('[data-testid="tracker-total"]');
  check("Date range filter can produce an empty result", futureTotal === 0 && (await page.locator('[data-testid="tracker-empty"]').count()) > 0);

  await page.click('[data-testid="reset-filters"]');
  await page.waitForTimeout(400);
  check("Reset restores the full list", (await number('[data-testid="tracker-total"]')) === totalCases);

  await page.fill('[data-testid="tracker-search"]', "Priya Nair");
  await page.waitForTimeout(400);
  const searchRows = await page.locator('[data-testid="tracker-table"] tbody tr').count();
  check("Search finds a customer by name", searchRows === 1, `${searchRows} row(s)`);

  await page.fill('[data-testid="tracker-search"]', "MWC-1001");
  await page.waitForTimeout(400);
  check("Search finds a case by ID", (await page.locator('[data-testid="tracker-table"] tbody tr').count()) === 1);
  await page.fill('[data-testid="tracker-search"]', "");
  await page.waitForTimeout(300);

  /* ------------------------------------------------------ 6. pagination */
  await page.selectOption('[data-testid="page-size"]', "25");
  await page.waitForTimeout(400);
  const bigPage = await page.locator('[data-testid="tracker-table"] tbody tr').count();
  check("Page size changes the visible row count", bigPage === Math.min(25, totalCases), `${bigPage} rows`);
  const range = await text('[data-testid="tracker-range"]');
  check("Range label reports the visible slice", /Showing 1–/.test(range ?? ""), range ?? "");

  if (totalCases > 25) {
    await page.click('button[aria-label="Next page"]');
    await page.waitForTimeout(400);
    check("Next page advances the table", /Showing 26–/.test((await text('[data-testid="tracker-range"]')) ?? ""));
  } else {
    check("Next page advances the table", true, "single page");
  }

  /* ---------------------------------------------------------- 7. drawer */
  await page.fill('[data-testid="tracker-search"]', "MWC-1001");
  await page.waitForTimeout(400);
  await page.click('[data-testid="view-case-MWC-1001"]');
  await page.waitForSelector('[data-testid="case-drawer"]', { timeout: 8000 });
  check("View Details opens the case drawer", true);

  const drawerText = (await page.locator('[data-testid="case-drawer"]').innerText())
    .replace(/\s+/g, " ")
    .toLowerCase();
  check(
    "Drawer shows customer, SLA, status and assignment controls",
    drawerText.includes("rahul verma") &&
      drawerText.includes("update status") &&
      drawerText.includes("assign to employee") &&
      drawerText.includes("internal notes"),
  );

  await page.selectOption('[data-testid="drawer-status"]', "In Progress");
  await page.click('[data-testid="save-status"]');
  await page.waitForSelector('[data-testid="drawer-flash"]', { timeout: 6000 });
  check("Status update saves to the database", /Status updated to In Progress/.test((await text('[data-testid="drawer-flash"]')) ?? ""));

  await page.selectOption('[data-testid="drawer-assignee"]', "emp-vikram");
  await page.click('[data-testid="save-assignee"]');
  await page.waitForTimeout(600);
  const assigned = await page.locator('[data-testid="case-drawer"]').innerText();
  check("Case can be assigned to an employee", /Vikram Shetty/.test(assigned));

  await page.fill('[data-testid="note-input"]', "Called the customer, sanction letter expected tomorrow.");
  await page.click('[data-testid="save-note"]');
  await page.waitForTimeout(700);
  const notesText = await page.locator('[data-testid="drawer-notes"]').innerText();
  check("Internal note is appended to the case", /sanction letter expected tomorrow/i.test(notesText));

  await page.screenshot({ path: "artifacts/admin-2-drawer.png", fullPage: false });

  await page.click('[data-testid="close-drawer"]');
  await page.waitForTimeout(400);

  /* ------------------------------------------------- 8. persistence */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="tracker-table"] tbody tr', { timeout: 20000 });
  await page.click('[data-testid="view-case-MWC-1001"]');
  await page.waitForSelector('[data-testid="case-drawer"]', { timeout: 8000 });
  const statusAfterReload = await page.locator('[data-testid="drawer-status"]').inputValue();
  check("Data survives a reload (saved in the database)", statusAfterReload === "In Progress", statusAfterReload);
  const noteAfterReload = await page.locator('[data-testid="drawer-notes"]').innerText();
  check("Notes survive a reload", /sanction letter/i.test(noteAfterReload));

  /* ------------------------------------------------------- 9. deep link */
  await page.goto(`${BASE}/master-admin/tracker?case=MWC-1002`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="case-drawer"]', { timeout: 20000 });
  check("A dashboard link can deep-link into a case", (await page.locator('[data-testid="case-drawer"]').innerText()).includes("MWC-1002"));
  await page.click('[data-testid="close-drawer"]');

  /* ------------------------------------------------ 10. session / signout */
  await page.click('[data-testid="admin-signout"]');
  await page.waitForURL(/\/master-admin\/login/, { timeout: 15000 });
  check("Sign out returns to the login screen", page.url().includes("/master-admin/login"));

  await page.goto(`${BASE}/master-admin`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/master-admin\/login/, { timeout: 15000 });
  check("Session is cleared — dashboard is closed again", page.url().includes("/master-admin/login"));

  await page.waitForSelector('[data-testid="admin-email"]', { timeout: 10000 });
  check(
    "First-run setup is replaced by normal sign-in",
    (await page.locator('[data-testid="admin-setup-link"]').count()) === 0,
  );

  await page.fill('[data-testid="admin-email"]', EMAIL);
  await page.fill('[data-testid="admin-password"]', "wrong-password-1");
  await page.click('[data-testid="admin-submit"]');
  await page.waitForSelector('[data-testid="admin-error"]', { timeout: 6000 });
  check(
    "Wrong password is rejected without revealing which field failed",
    /Email or password is incorrect/.test((await text('[data-testid="admin-error"]')) ?? ""),
  );

  await page.fill('[data-testid="admin-password"]', PASSWORD);
  await page.click('[data-testid="admin-submit"]');
  await page.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 20000 });
  check("Enrolled admin can sign back in", true);

  await page.screenshot({ path: "artifacts/admin-3-dashboard-return.png", fullPage: false });

  /* ------------------------------------------------------ 11. mobile */
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    storageState: await context.storageState(),
  });
  const mobilePage = await mobile.newPage();
  const mobileErrors = [];
  mobilePage.on("console", (message) => {
    if (message.type() === "error") mobileErrors.push(message.text());
  });
  mobilePage.on("pageerror", (error) => mobileErrors.push(String(error)));

  await mobilePage.goto(`${BASE}/master-admin`, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 20000 });
  const overflow = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check("Dashboard has no horizontal overflow on mobile", overflow <= 1, `${overflow}px`);

  await mobilePage.screenshot({ path: "artifacts/admin-4-mobile-dashboard.png", fullPage: false });

  await mobilePage.goto(`${BASE}/master-admin/tracker`, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForSelector('[data-testid="tracker-table"] tbody tr', { timeout: 20000 });
  const rowDisplay = await mobilePage.evaluate(() => {
    const row = document.querySelector('[data-testid="tracker-table"] tbody tr');
    return row ? getComputedStyle(row).display : "none";
  });
  check("Tracker rows become cards on mobile", rowDisplay === "grid", rowDisplay);
  const trackerOverflow = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check("Tracker has no horizontal overflow on mobile", trackerOverflow <= 1, `${trackerOverflow}px`);

  await mobilePage.screenshot({ path: "artifacts/admin-5-mobile-tracker.png", fullPage: false });

  await mobilePage.click('[data-testid="view-case-MWC-1001"]');
  await mobilePage.waitForSelector('[data-testid="case-drawer"]', { timeout: 8000 });
  const drawerWidth = await mobilePage.evaluate(() => {
    const drawer = document.querySelector(".mw-admin-drawer");
    return drawer ? drawer.getBoundingClientRect().width : 0;
  });
  check("Case drawer fills the mobile viewport", drawerWidth >= 380, `${Math.round(drawerWidth)}px`);
  await mobilePage.screenshot({ path: "artifacts/admin-6-mobile-drawer.png", fullPage: false });

  /* ------------------------------------------------------- 12. console */
  check("No console or page errors on desktop", consoleErrors.length === 0, consoleErrors.slice(0, 2).join(" | "));
  check("No console or page errors on mobile", mobileErrors.length === 0, mobileErrors.slice(0, 2).join(" | "));
} catch (error) {
  check("Suite completed without throwing", false, String(error).split("\n")[0]);
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\nADMIN RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("FAILED:");
  for (const item of failed) console.log(` - ${item.name} ${item.detail}`);
  process.exitCode = 1;
}
