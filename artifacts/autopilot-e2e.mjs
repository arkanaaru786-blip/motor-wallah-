/**
 * Master Admin — Phase 3 (MW Autopilot, MW Intelligence, reliability) suite.
 *
 * Covers the rule engine (create / validate / preview / run / pause / delete),
 * the execution log including a deliberate failure, the AI assistant's answers
 * and their scoping, and the no-missed-case check — including a real failed
 * write (localStorage refuses the case table) that the journal and the repair
 * path have to recover.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OWNER = { email: "owner@motorwallah.in", password: "MasterAdmin2026" };
const FINANCE_MANAGER = {
  name: "Sana Qureshi",
  email: "sana.qureshi@motorwallah.in",
  mobile: "9820099102",
  department: "Finance",
  role: "manager",
  password: "FinanceLead2026",
};
const FINANCE_EXEC = {
  name: "Neha Kulkarni",
  email: "neha.kulkarni@motorwallah.in",
  mobile: "9820099101",
  department: "Finance",
  role: "executive",
  password: "FinanceDesk2026",
};
const SALES_READONLY = {
  name: "Ravi Patel",
  email: "ravi.patel@motorwallah.in",
  mobile: "9820099103",
  department: "Sales",
  role: "read_only",
  password: "SalesView2026",
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` :: ${detail}` : ""}`);
}

const browser = await chromium.launch();
const consoleErrors = [];

function watch(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${label}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(`${label}: ${String(error)}`));
}

async function newPage(label, viewport = { width: 1440, height: 960 }, storageState) {
  const context = await browser.newContext({
    viewport,
    ...(storageState ? { storageState } : {}),
  });
  const page = await context.newPage();
  watch(page, label);
  return page;
}

async function signIn(page, email, password) {
  await page.goto(`${BASE}/master-admin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="admin-dashboard"], [data-testid="admin-email"]', {
    timeout: 20000,
  });
  if ((await page.locator('[data-testid="admin-dashboard"]').count()) > 0) {
    await page.evaluate(() => window.localStorage.removeItem("mw_admin_session"));
  }
  await page.goto(`${BASE}/master-admin/login`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="admin-email"]', { timeout: 20000 });
  await page.fill('[data-testid="admin-email"]', email);
  await page.fill('[data-testid="admin-password"]', password);
  await page.click('[data-testid="admin-submit"]');
  await page.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 25000 });
}

async function setupOwner(page) {
  await page.goto(`${BASE}/master-admin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="admin-setup-link"], [data-testid="admin-email"]', {
    timeout: 20000,
  });
  if ((await page.locator('[data-testid="admin-setup-link"]').count()) > 0) {
    await page.click('[data-testid="admin-setup-link"]');
    await page.fill('[data-testid="admin-name"]', "Ananya Rao");
    await page.fill('[data-testid="admin-email"]', OWNER.email);
    await page.fill('[data-testid="admin-password"]', OWNER.password);
    await page.fill('[data-testid="admin-confirm"]', OWNER.password);
  } else {
    await page.fill('[data-testid="admin-email"]', OWNER.email);
    await page.fill('[data-testid="admin-password"]', OWNER.password);
  }
  await page.click('[data-testid="admin-submit"]');
  await page.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 25000 });
}

async function addEmployee(page, person) {
  await page.goto(`${BASE}/master-admin/employees`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="employee-table"]', { timeout: 20000 });
  await page.click('[data-testid="employee-add"]');
  await page.waitForSelector('[data-testid="employee-drawer"]', { timeout: 10000 });
  await page.fill('[data-testid="employee-name"]', person.name);
  await page.fill('[data-testid="employee-email"]', person.email);
  await page.fill('[data-testid="employee-mobile"]', person.mobile);
  await page.selectOption('[data-testid="employee-department"]', person.department);
  await page.selectOption('[data-testid="employee-role"]', person.role);
  await page.fill('[data-testid="employee-password"]', person.password);
  await page.click('[data-testid="employee-save"]');
  await page.waitForSelector('[data-testid="employee-drawer"]', {
    state: "detached",
    timeout: 20000,
  });
  await page.screenshot({ path: "artifacts/p3-1-employees.png", fullPage: true });
}

/** Runs a module function in the page with the signed-in session as the actor. */
async function callModule(page, modulePath, fn, args = {}) {
  return page.evaluate(
    async ({ modulePath, fn, args }) => {
      const mod = await import(/* @vite-ignore */ modulePath);
      const session = JSON.parse(window.localStorage.getItem("mw_admin_session") ?? "{}");
      const actor = {
        id: session.employeeId,
        name: session.name,
        email: session.email,
        role: session.role,
        department: session.department,
      };
      return mod[fn](actor, ...(args.positional ?? []));
    },
    { modulePath, fn, args },
  );
}

async function askAi(page, question) {
  const previous = (await page.locator('[data-testid="ai-headline"]').count())
    ? await page.locator('[data-testid="ai-headline"]').innerText()
    : "";
  await page.fill('[data-testid="ai-input"]', question);
  await page.click('[data-testid="ai-ask"]');
  await page.waitForFunction(
    (text) => {
      const node = document.querySelector('[data-testid="ai-headline"]');
      return Boolean(node) && node.textContent !== text && !document.querySelector('[data-testid="ai-ask"][disabled]');
    },
    previous,
    { timeout: 10000 },
  );
  return {
    headline: await page.locator('[data-testid="ai-headline"]').innerText(),
    rows: await page.locator('[data-testid="ai-rows"] li').count(),
    text: await page.locator('[data-testid="ai-answer"]').innerText(),
  };
}

/* ------------------------------------------------------------------ setup */

const owner = await newPage("owner");
await setupOwner(owner);

check(
  "Owner lands on a dashboard with the assistant and the reliability card",
  (await owner.locator('[data-testid="ai-assistant"]').count()) === 1 &&
    (await owner.locator('[data-testid="reliability-card"]').count()) === 1,
);
check(
  "The assistant is labelled as a demo engine",
  /demo engine/i.test(await owner.locator('[data-testid="ai-engine"]').innerText()),
  await owner.locator('[data-testid="ai-engine"]').innerText(),
);
check(
  "Autopilot appears in the control room navigation",
  (await owner.locator('[data-testid="admin-nav-autopilot"]').count()) === 1,
);

/* ------------------------------------------------------------------- AI */

const overdue = await askAi(owner, "Show all overdue finance leads");
check(
  "AI answers the overdue finance question with a count",
  /overdue/i.test(overdue.headline) && /finance/i.test(overdue.headline),
  overdue.headline,
);
const overdueRows = await owner.locator('[data-testid="ai-rows"] li').allInnerTexts();
check("AI lists the matching cases as rows", overdueRows.length > 0, `${overdueRows.length} rows`);
check(
  "Every AI row links back to the tracker",
  (await owner.locator('[data-testid="ai-rows"] a').count()) === overdueRows.length,
);
const financeOnly = overdueRows.every((row) => !/Insurance|Franchise|Service|Scrap/i.test(row));
check("AI never mixes other desks into a Finance answer", financeOnly, overdueRows[0] ?? "");
check(
  "AI marks the answer as device-computed",
  /demo engine/i.test(overdue.text),
  overdue.text.split("\n").slice(-1)[0],
);

const workload = await askAi(owner, "Which employee has the most pending tasks?");
check(
  "AI names the busiest employee",
  /carrying the most open work/i.test(workload.headline),
  workload.headline,
);
check("AI shows the workload table", workload.rows > 0, `${workload.rows} rows`);

const unowned = await askAi(owner, "Which cases have no owner?");
check(
  "AI answers the unassigned question",
  /owner/i.test(unowned.headline),
  unowned.headline,
);

const revenue = await askAi(owner, "How much revenue is closed?");
check("AI reports closed revenue", /₹/.test(revenue.headline), revenue.headline);

const approvals = await askAi(owner, "What is waiting for approval?");
check(
  "AI reports the approval queue",
  /decision|approval/i.test(approvals.headline),
  approvals.headline,
);

const renewals = await askAi(owner, "Which dealer plans are expiring?");
check(
  "AI reads the renewal watchlist",
  /dealer plan|watchlist/i.test(renewals.headline),
  renewals.headline,
);

const fallback = await askAi(owner, "what is the meaning of life");
check(
  "An unknown question falls back to guidance instead of inventing an answer",
  /can answer questions/i.test(fallback.headline),
  fallback.headline,
);

await owner.click('[data-testid="ai-suggestion-0"]');
await owner.waitForTimeout(400);
check(
  "A suggestion chip asks a real question",
  /overdue/i.test(await owner.locator('[data-testid="ai-headline"]').innerText()),
);
await owner.screenshot({ path: "artifacts/p3-2-dashboard.png", fullPage: true });

/* ------------------------------------------------------------- autopilot */

await owner.goto(`${BASE}/master-admin/automation`, { waitUntil: "domcontentloaded" });
await owner.waitForSelector('[data-testid="rules-table"]', { timeout: 20000 });
check(
  "Four seeded rules ship with the panel",
  (await owner.locator('[data-testid="rules-table"] tbody tr').count()) === 4,
  await owner.locator('[data-testid="rules-total"]').innerText(),
);
check(
  "Rules show their trigger, conditions and actions",
  (await owner.locator('[data-testid="rule-row-RULE-01"]').innerText()).includes(
    "Assign to desk manager",
  ),
);
check(
  "The no-missed-case check runs without gaps on a clean device",
  (await owner.locator('[data-testid="recon-clear"]').count()) === 1,
);

// A rule with no actions must be refused, not silently saved.
await owner.click('[data-testid="rule-add"]');
await owner.waitForSelector('[data-testid="rule-drawer"]', { timeout: 10000 });
await owner.fill('[data-testid="rule-name"]', "Broken rule");
await owner.uncheck('[data-testid="rule-action-assign"]');
await owner.uncheck('[data-testid="rule-action-notify"]');
await owner.click('[data-testid="rule-save"]');
const ruleError = await owner.locator('[data-testid="rule-error"]').innerText();
check("A rule without actions is refused", /at least one action/i.test(ruleError), ruleError);

// Build a real Finance intake rule.
await owner.check('[data-testid="rule-action-assign"]');
await owner.check('[data-testid="rule-action-notify"]');
await owner.selectOption('[data-testid="rule-assign-target"]', "employee");
await owner.selectOption('[data-testid="rule-assign-employee"]', "EMP-1001");
await owner.fill('[data-testid="rule-name"]', "Finance intake → Ananya");
await owner.click('[data-testid="rule-type-finance"]');
await owner.click('[data-testid="rule-save"]');
await owner.waitForSelector('[data-testid="rule-drawer"]', { state: "detached", timeout: 15000 });
check(
  "New rule is created with the next id",
  (await owner.locator('[data-testid="rule-row-RULE-05"]').count()) === 1,
  await owner.locator('[data-testid="rules-total"]').innerText(),
);

await owner.click('[data-testid="rule-preview-RULE-05"]');
await owner.waitForSelector('[data-testid="rule-preview"]', { timeout: 10000 });
const previewText = await owner.locator('[data-testid="rule-preview"]').innerText();
check("Preview explains what the rule would touch", /RULE-05/.test(previewText), previewText.split("\n")[1] ?? "");
await owner.click('[data-testid="rule-preview"] .mw-admin-drawer-close');

// A renewal rule with an assign action must fail honestly: renewals are not cases.
await owner.click('[data-testid="rule-add"]');
await owner.waitForSelector('[data-testid="rule-drawer"]', { timeout: 10000 });
await owner.fill('[data-testid="rule-name"]', "Renewal → assign manager");
await owner.selectOption('[data-testid="rule-trigger"]', "subscription.expiring");
await owner.click('[data-testid="rule-save"]');
await owner.waitForSelector('[data-testid="rule-drawer"]', { state: "detached", timeout: 15000 });
await owner.click('[data-testid="rule-run-RULE-06"]');
await owner.waitForTimeout(900);
const failureRows = await owner
  .locator('[data-testid="run-log-list"] li')
  .filter({ hasText: /failure/i })
  .count();
check("A rule that cannot act is logged as a failure", failureRows > 0, `${failureRows} failures`);
check(
  "The failure explains why",
  /renewal row/i.test(await owner.locator('[data-testid="run-log-list"]').innerText()),
);

await owner.click('[data-testid="automation-run-all"]');
await owner.waitForTimeout(900);
const runCount = await owner.locator('[data-testid="run-log-list"] li').count();
check("Running the autopilot writes to the execution log", runCount > 0, `${runCount} rows`);
const outboxCount = await owner.locator('[data-testid="outbox-list"] li').count();
check("Rule notifications land in the outbox", outboxCount > 0, `${outboxCount} notifications`);

const runDetail = await owner.locator('[data-testid="run-log-list"] li').first().innerText();
check(
  "Each run names the rule, the target and the outcome",
  /RULE-|Renewal|SLA|Finance/.test(runDetail) && /success|failure/i.test(runDetail),
  runDetail.replace(/\n/g, " | ").slice(0, 120),
);

// Assignment audit: run rule 05 against the Finance lead and check the outcome.
const assignOutcome = await callModule(owner, "/src/lib/admin-automation.ts", "sweepAutomation", {
  positional: [{ ruleId: "RULE-05" }],
});
check(
  "Rule 05 runs through the data layer for the owner",
  assignOutcome.ok === true,
  assignOutcome.ok ? `${assignOutcome.result.entries.length} entries` : assignOutcome.error,
);

await owner.goto(`${BASE}/master-admin/audit`, { waitUntil: "domcontentloaded" });
await owner.waitForSelector('[data-testid="audit-table"]', { timeout: 20000 });
const auditText = await owner.locator('[data-testid="audit-table"]').innerText();
check("Creating a rule is written to the audit log", /created the rule/i.test(auditText));
check("An autopilot run is written to the audit log", /ran the autopilot/i.test(auditText));

// Pausing and deleting.
await owner.goto(`${BASE}/master-admin/automation`, { waitUntil: "domcontentloaded" });
await owner.waitForSelector('[data-testid="rules-table"]', { timeout: 20000 });
await owner.click('[data-testid="rule-toggle-RULE-06"]');
await owner.waitForTimeout(500);
check(
  "A rule can be paused",
  (await owner.locator('[data-testid="rule-state-RULE-06"]').innerText()).toLowerCase() === "paused",
);
await owner.click('[data-testid="rule-toggle-RULE-06"]');
await owner.waitForTimeout(400);
await owner.click('[data-testid="rule-delete-RULE-06"]');
await owner.waitForTimeout(600);
check(
  "An admin-created rule can be deleted",
  (await owner.locator('[data-testid="rule-row-RULE-06"]').count()) === 0,
);
check(
  "Example rules cannot be deleted",
  await owner.locator('[data-testid="rule-delete-RULE-01"]').isDisabled(),
);

/* ------------------------------------------------ reliability / recovery */

// A failed write: localStorage refuses the case table for one mutation.
await owner.goto(`${BASE}/master-admin`, { waitUntil: "domcontentloaded" });
await owner.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 20000 });

const failedWrite = await owner.evaluate(async () => {
  const crm = await import("/src/lib/admin-crm.ts");
  const session = JSON.parse(window.localStorage.getItem("mw_admin_session") ?? "{}");
  const actor = {
    id: session.employeeId,
    name: session.name,
    email: session.email,
    role: session.role,
    department: session.department,
  };
  const snapshot = crm.ensureAdminDatabase();
  const target = snapshot.cases.find((item) => item.id === "MWC-1002");
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (key === "mw_admin_cases_v1") throw new Error("QuotaExceededError");
    return original.call(this, key, value);
  };
  const result = crm.updateCaseStatus(target.id, "In Progress", actor);
  Storage.prototype.setItem = original;
  const journal = JSON.parse(window.localStorage.getItem("mw_admin_case_journal_v1") ?? "[]");
  const stored = JSON.parse(window.localStorage.getItem("mw_admin_cases_v1") ?? "[]");
  return {
    ok: result.ok,
    journal: journal.length,
    persisted: stored.find((item) => item.id === target.id)?.status ?? null,
  };
});
check(
  "A refused storage write leaves a journal entry behind",
  failedWrite.journal > 0,
  `${failedWrite.journal} pending`,
);
check(
  "The case itself never reached the table",
  failedWrite.persisted !== "In Progress",
  `status ${failedWrite.persisted}`,
);

await owner.goto(`${BASE}/master-admin/automation`, { waitUntil: "domcontentloaded" });
await owner.waitForSelector('[data-testid="recon-findings"]', { timeout: 20000 });
const findingsText = await owner.locator('[data-testid="recon-findings"]').innerText();
check(
  "The check reports the unsaved case",
  /unsaved change|never reached the tracker/i.test(findingsText),
  findingsText.split("\n")[0] ?? "",
);
check(
  "The finding is marked critical",
  (await owner.locator('[data-testid="recon-findings"] li.is-critical').count()) >= 1,
);
await owner.screenshot({ path: "artifacts/p3-3-reliability.png", fullPage: true });

await owner.click('[data-testid="automation-reconcile-repair"]');
await owner.waitForTimeout(1000);
const repairedStatus = await owner.evaluate(() => {
  const stored = JSON.parse(window.localStorage.getItem("mw_admin_cases_v1") ?? "[]");
  return stored.find((item) => item.id === "MWC-1002")?.status ?? null;
});
check(
  "Repair replays the journalled save",
  repairedStatus === "In Progress",
  `status ${repairedStatus}`,
);
check(
  "The journal is cleared once the case is stored",
  (await owner.evaluate(
    () => JSON.parse(window.localStorage.getItem("mw_admin_case_journal_v1") ?? "[]").length,
  )) === 0,
);
await owner.click('[data-testid="automation-reconcile-run"]');
await owner.waitForTimeout(700);
check(
  "A clean re-check reports no gaps",
  (await owner.locator('[data-testid="recon-clear"]').count()) === 1,
);

await owner.goto(`${BASE}/master-admin/audit`, { waitUntil: "domcontentloaded" });
await owner.waitForSelector('[data-testid="audit-table"]', { timeout: 20000 });
const repairAudit = await owner.locator('[data-testid="audit-table"]').innerText();
check("The repair is attributed in the audit log", /repaired 1 gap/i.test(repairAudit));

/* ------------------------------------------------------------- permissions */

await owner.goto(`${BASE}/master-admin/employees`, { waitUntil: "domcontentloaded" });
await owner.waitForSelector('[data-testid="employee-table"]', { timeout: 20000 });
for (const person of [FINANCE_MANAGER, FINANCE_EXEC, SALES_READONLY]) {
  await addEmployee(owner, person);
}
const dbState = await owner.context().storageState();

const manager = await newPage("manager", undefined, dbState);
await signIn(manager, FINANCE_MANAGER.email, FINANCE_MANAGER.password);
await manager.goto(`${BASE}/master-admin/automation`, { waitUntil: "domcontentloaded" });
await manager.waitForSelector('[data-testid="automation-root"]', { timeout: 20000 });
const managerScope = await manager.locator('[data-testid="automation-scope"]').innerText();
check(
  "A Finance manager sees the autopilot scoped to their desk",
  /Finance desk only/i.test(managerScope),
  managerScope.split("\n")[0] ?? "",
);
const managerRules = await manager.locator('[data-testid="rules-table"] tbody tr').count();
check("A manager can see the shared and desk rules", managerRules >= 4, `${managerRules} rules`);

const crossDeskRule = await callModule(manager, "/src/lib/admin-automation.ts", "createRule", {
  positional: [
    {
      name: "Sales poaching",
      trigger: "lead.created",
      enabled: true,
      conditions: { types: ["Sell"], priorities: [], unassignedOnly: false, withinDays: null },
      actions: [{ kind: "notify", to: "admins" }],
    },
  ],
});
check(
  "The data layer refuses a manager's cross-desk rule",
  crossDeskRule.ok === false,
  crossDeskRule.ok ? "rule was created" : crossDeskRule.error,
);

const managerRule = await callModule(manager, "/src/lib/admin-automation.ts", "createRule", {
  positional: [
    {
      name: "Finance follow-up sweep",
      trigger: "followup.due",
      enabled: true,
      conditions: { types: ["Finance"], priorities: [], unassignedOnly: false, withinDays: 1 },
      actions: [{ kind: "notify", to: "desk-manager" }],
    },
  ],
});
check(
  "A manager can create a rule for their own desk",
  managerRule.ok === true,
  managerRule.ok ? managerRule.rule.id : managerRule.error,
);

const exec = await newPage("exec", undefined, dbState);
await signIn(exec, FINANCE_EXEC.email, FINANCE_EXEC.password);
check(
  "An executive has no Autopilot navigation",
  (await exec.locator('[data-testid="admin-nav-autopilot"]').count()) === 0,
  (await exec.locator('nav[aria-label="Control room sections"]').innerText()).replace(/\n/g, " "),
);
await exec.goto(`${BASE}/master-admin/automation`, { waitUntil: "domcontentloaded" });
await exec.waitForTimeout(700);
check(
  "The autopilot route is refused for an executive",
  (await exec.locator('[data-testid="automation-root"]').count()) === 0,
);
const execRule = await callModule(exec, "/src/lib/admin-automation.ts", "createRule", {
  positional: [
    {
      name: "Executive rule",
      trigger: "lead.created",
      enabled: true,
      conditions: { types: [], priorities: [], unassignedOnly: false, withinDays: null },
      actions: [{ kind: "notify", to: "admins" }],
    },
  ],
});
check(
  "The data layer refuses rule creation by an executive",
  execRule.ok === false,
  execRule.ok ? "rule was created" : execRule.error,
);

await exec.goto(`${BASE}/master-admin`, { waitUntil: "domcontentloaded" });
await exec.waitForSelector('[data-testid="ai-input"]', { timeout: 20000 });
const execAi = await askAi(exec, "Show all overdue leads");
check(
  "An executive can use the assistant, scoped to Finance",
  /Finance desk/i.test(execAi.headline) || /Finance desk/i.test(execAi.text),
  execAi.headline,
);

const viewer = await newPage("viewer", undefined, dbState);
await signIn(viewer, SALES_READONLY.email, SALES_READONLY.password);
await viewer.waitForSelector('[data-testid="ai-input"]', { timeout: 20000 });
const viewerAi = await askAi(viewer, "How many open cases are there?");
check(
  "A read-only user sees only their own desk through the assistant",
  /open cases are on the Sales desk/i.test(viewerAi.headline),
  viewerAi.headline,
);
const viewerSweep = await callModule(viewer, "/src/lib/admin-automation.ts", "sweepAutomation", {
  positional: [{}],
});
check(
  "The data layer refuses a read-only user running the autopilot",
  viewerSweep.ok === false,
  viewerSweep.ok ? "sweep ran" : viewerSweep.error,
);

/* ------------------------------------------------------------------ mobile */

const mobile = await newPage("mobile", { width: 390, height: 844 }, dbState);
await signIn(mobile, OWNER.email, OWNER.password);
await mobile.goto(`${BASE}/master-admin/automation`, { waitUntil: "domcontentloaded" });
await mobile.waitForSelector('[data-testid="automation-root"]', { timeout: 20000 });
await mobile.waitForTimeout(400);
const overflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("The autopilot page has no horizontal overflow on mobile", overflow === 0, `${overflow}px`);
await mobile.screenshot({ path: "artifacts/p3-4-mobile.png", fullPage: true });

await mobile.goto(`${BASE}/master-admin`, { waitUntil: "domcontentloaded" });
await mobile.waitForSelector('[data-testid="ai-assistant"]', { timeout: 20000 });
await mobile.waitForTimeout(300);
const dashOverflow = await mobile.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("The dashboard stays inside 390px", dashOverflow === 0, `${dashOverflow}px`);

/* ------------------------------------------------------------------- done */

check("No console or page errors during the run", consoleErrors.length === 0, consoleErrors[0] ?? "");

const passed = results.filter((row) => row.ok).length;
console.log(`\nAUTOPILOT RESULT: ${passed}/${results.length} checks passed`);
if (passed !== results.length) {
  console.log("\nFAILED:");
  for (const row of results.filter((entry) => !entry.ok)) {
    console.log(` - ${row.name} :: ${row.detail}`);
  }
  process.exitCode = 1;
}

await browser.close();
