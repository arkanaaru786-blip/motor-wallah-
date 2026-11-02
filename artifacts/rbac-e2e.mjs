/**
 * Master Admin — Phase 2 (employees, departments, RBAC, audit) end-to-end suite.
 *
 * Covers the employee directory (create / validate / disable / reset), the
 * department and role model, department-scoped visibility in the Master
 * Tracker, My tasks vs All tasks, audit logging of allowed *and* refused
 * actions, and — most importantly — that the data layer refuses writes even
 * when the UI is bypassed via a direct module call.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OWNER = { email: "owner@motorwallah.in", password: "MasterAdmin2026" };

const FINANCE_EXEC = {
  name: "Neha Kulkarni",
  email: "neha.kulkarni@motorwallah.in",
  mobile: "9820099001",
  department: "Finance",
  role: "executive",
  password: "FinanceDesk2026",
};
const FINANCE_MANAGER = {
  name: "Sana Qureshi",
  email: "sana.qureshi@motorwallah.in",
  mobile: "9820099002",
  department: "Finance",
  role: "manager",
  password: "FinanceLead2026",
};
const SALES_READONLY = {
  name: "Ravi Patel",
  email: "ravi.patel@motorwallah.in",
  mobile: "9820099003",
  department: "Sales",
  role: "read_only",
  password: "SalesView2026",
};
const INSURANCE_EXEC = {
  name: "Dev Iyer",
  email: "dev.iyer@motorwallah.in",
  mobile: "9820099004",
  department: "Insurance",
  role: "executive",
  password: "InsuranceDesk26",
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

/**
 * The admin database lives in localStorage, so a fresh browser context starts
 * empty. Every actor context is seeded from the owner's storage snapshot, which
 * is how a server-backed deployment would share one database across devices.
 */
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
  // A seeded database may still carry the previous owner's session.
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
    await page.click('[data-testid="admin-submit"]');
  } else {
    await page.fill('[data-testid="admin-email"]', OWNER.email);
    await page.fill('[data-testid="admin-password"]', OWNER.password);
    await page.click('[data-testid="admin-submit"]');
  }
  await page.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 25000 });
}

async function openEmployeeForm(page) {
  await page.click('[data-testid="employee-add"]');
  await page.waitForSelector('[data-testid="employee-drawer"]', { timeout: 10000 });
}

async function fillEmployee(page, person, password) {
  await page.fill('[data-testid="employee-name"]', person.name);
  await page.fill('[data-testid="employee-email"]', person.email);
  await page.fill('[data-testid="employee-mobile"]', person.mobile);
  await page.selectOption('[data-testid="employee-department"]', person.department);
  await page.selectOption('[data-testid="employee-role"]', person.role);
  await page.fill('[data-testid="employee-password"]', password ?? person.password);
}

async function saveEmployee(page) {
  await page.click('[data-testid="employee-save"]');
  await page.waitForSelector('[data-testid="employee-drawer"]', {
    state: "detached",
    timeout: 20000,
  });
}

async function addEmployee(page, person) {
  await page.goto(`${BASE}/master-admin/employees`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="employee-table"]', { timeout: 20000 });
  await openEmployeeForm(page);
  await fillEmployee(page, person);
  await saveEmployee(page);
}

async function openCase(page, caseId) {
  await page.goto(`${BASE}/master-admin/tracker?case=${caseId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="case-drawer"], [data-testid="case-drawer-denied"]', {
    timeout: 20000,
  });
}

async function assignViaDrawer(page, caseId, employeeId) {
  await openCase(page, caseId);
  await page.selectOption('[data-testid="drawer-assignee"]', employeeId);
  await page.click('[data-testid="save-assignee"]');
  await page.waitForTimeout(700);
}

/** Calls the CRM module directly — the UI never runs this path. */
async function callDataLayer(page, caseId, status) {
  return page.evaluate(
    async ({ id, next }) => {
      const crm = await import("/src/lib/admin-crm.ts");
      const session = JSON.parse(window.localStorage.getItem("mw_admin_session") ?? "{}");
      const actor = {
        id: session.employeeId,
        name: session.name,
        email: session.email,
        role: session.role,
        department: session.department,
      };
      return crm.updateCaseStatus(id, next, actor);
    },
    { id: caseId, next: status },
  );
}

async function callAssign(page, caseId, employeeId) {
  return page.evaluate(
    async ({ id, target }) => {
      const crm = await import("/src/lib/admin-crm.ts");
      const session = JSON.parse(window.localStorage.getItem("mw_admin_session") ?? "{}");
      const actor = {
        id: session.employeeId,
        name: session.name,
        email: session.email,
        role: session.role,
        department: session.department,
      };
      return crm.assignCase(id, target, actor);
    },
    { id: caseId, target: employeeId },
  );
}

async function callCreateEmployee(page) {
  return page.evaluate(async () => {
    const crm = await import("/src/lib/admin-crm.ts");
    const session = JSON.parse(window.localStorage.getItem("mw_admin_session") ?? "{}");
    const actor = {
      id: session.employeeId,
      name: session.name,
      email: session.email,
      role: session.role,
      department: session.department,
    };
    return crm.createEmployee(
      {
        name: "Ghost User",
        email: "ghost@motorwallah.in",
        mobile: "9820012345",
        department: "IT",
        role: "super_admin",
        status: "Active",
        password: "GhostPass2026",
      },
      actor,
    );
  });
}

try {
  /* ============================================================ 1. owner */
  const owner = await newPage("owner");
  await setupOwner(owner);

  const roleLabel = await owner.locator('[data-testid="admin-user-role"]').innerText();
  check("Owner session is a super admin", /Super Admin/.test(roleLabel), roleLabel);

  await owner.goto(`${BASE}/master-admin/employees`, { waitUntil: "domcontentloaded" });
  await owner.waitForSelector('[data-testid="employee-table"]', { timeout: 20000 });
  const seedRows = await owner.locator('[data-testid="employee-table"] tbody tr').count();
  check("Directory starts with the seeded team", seedRows === 5, `${seedRows} rows`);
  const seedIds = await owner.locator('[data-testid="employee-table"] tbody tr td:first-child').allInnerTexts();
  check(
    "Employees carry a generated ID (EMP-1001…)",
    seedIds.every((id) => /^EMP-\d{4}$/.test(id.trim())),
    seedIds.join(","),
  );

  /* -------------------------------------------------- create + validate */
  await openEmployeeForm(owner);
  await fillEmployee(owner, FINANCE_EXEC, "weak");
  await owner.click('[data-testid="employee-save"]');
  await owner.waitForSelector('[data-testid="employee-form-error"]', { timeout: 10000 });
  check(
    "Weak password is rejected when creating an employee",
    /at least 10/i.test(await owner.locator('[data-testid="employee-form-error"]').innerText()),
  );

  await owner.fill('[data-testid="employee-password"]', FINANCE_EXEC.password);
  await owner.fill('[data-testid="employee-mobile"]', "12345");
  await owner.click('[data-testid="employee-save"]');
  await owner.waitForTimeout(500);
  check(
    "Invalid mobile number is rejected",
    /10-digit/i.test(await owner.locator('[data-testid="employee-form-error"]').innerText()),
  );

  await owner.fill('[data-testid="employee-mobile"]', FINANCE_EXEC.mobile);
  await owner.selectOption('[data-testid="employee-department"]', "Finance");
  const deskHint = await owner.locator('[data-testid="employee-desk-hint"]').innerText();
  check(
    "Form explains the department scope",
    /Finance cases/.test(deskHint),
    deskHint.replace(/\s+/g, " ").slice(0, 70),
  );
  await owner.screenshot({ path: "artifacts/rbac-3-employee-form.png" });
  await saveEmployee(owner);

  const flash = await owner.locator('[data-testid="employee-flash"]').innerText();
  check("Employee is created with the next ID", /EMP-1006/.test(flash), flash);

  const stored = await owner.evaluate(() =>
    JSON.parse(window.localStorage.getItem("mw_admin_employees_v2") ?? "[]"),
  );
  const created = stored.find((item) => item.email === FINANCE_EXEC.email);
  check(
    "Employee password is stored as a salted PBKDF2 hash",
    Boolean(created?.credential?.hash) && created.credential.iterations >= 100_000,
    `${created?.credential?.iterations} iterations`,
  );
  check(
    "Plaintext employee password is never stored",
    !JSON.stringify(stored).includes(FINANCE_EXEC.password),
  );

  /* duplicate email */
  await openEmployeeForm(owner);
  await fillEmployee(owner, { ...FINANCE_MANAGER, email: FINANCE_EXEC.email });
  await owner.click('[data-testid="employee-save"]');
  await owner.waitForTimeout(500);
  check(
    "Duplicate work email is rejected",
    /already uses that email/i.test(await owner.locator('[data-testid="employee-form-error"]').innerText()),
  );
  await owner.click('[data-testid="employee-cancel"]');

  await addEmployee(owner, FINANCE_MANAGER);
  await addEmployee(owner, SALES_READONLY);
  await addEmployee(owner, INSURANCE_EXEC);

  /* disable / enable */
  await owner.goto(`${BASE}/master-admin/employees`, { waitUntil: "domcontentloaded" });
  await owner.waitForSelector('[data-testid="employee-row-EMP-1009"]', { timeout: 15000 });
  await owner.click('[data-testid="employee-toggle-EMP-1009"]');
  await owner.waitForTimeout(600);
  check(
    "Employee can be disabled",
    (await owner.locator('[data-testid="employee-status-EMP-1009"]').innerText()) === "Disabled",
  );

  /* --------------------------------------------------- assignment rules */
  await assignViaDrawer(owner, "MWC-1001", "EMP-1006");
  const assignFlash = await owner.locator('[data-testid="drawer-flash"]').innerText();
  check("Super admin can assign a Finance case", /assigned/i.test(assignFlash), assignFlash);

  await openCase(owner, "MWC-1005");
  const insuranceOptions = await owner.locator('[data-testid="drawer-assignee"] option').allInnerTexts();
  check(
    "Assignment list only offers employees from the case's desk",
    !insuranceOptions.some((option) => option.includes("Neha Kulkarni")),
    insuranceOptions.join(" | "),
  );
  await owner.click('[data-testid="close-drawer"]');

  const crossAssign = await owner.evaluate(async () => {
    const crm = await import("/src/lib/admin-crm.ts");
    return crm.assignCase("MWC-1005", "EMP-1006", {
      id: "OWNER-1",
      name: "Owner",
      email: "owner@motorwallah.in",
      role: "super_admin",
      department: null,
    });
  });
  check(
    "Data layer refuses a cross-department assignment",
    crossAssign.ok === false && /cannot take a Insurance case/i.test(crossAssign.error ?? ""),
    crossAssign.error,
  );

  const disabledAssign = await owner.evaluate(async () => {
    const crm = await import("/src/lib/admin-crm.ts");
    return crm.assignCase("MWC-1005", "EMP-1009", {
      id: "OWNER-1",
      name: "Owner",
      email: "owner@motorwallah.in",
      role: "super_admin",
      department: null,
    });
  });
  check(
    "Data layer refuses work to a disabled employee",
    disabledAssign.ok === false && /disabled/i.test(disabledAssign.error ?? ""),
    disabledAssign.error,
  );

  /* -------------------------------------------------------- audit (owner) */
  await owner.goto(`${BASE}/master-admin/audit`, { waitUntil: "domcontentloaded" });
  await owner.waitForSelector('[data-testid="audit-table"]', { timeout: 15000 });
  const auditText = await owner.locator('[data-testid="audit-table"]').innerText();
  check("Audit log records the employee creation", /added Neha Kulkarni \(EMP-1006\)/.test(auditText));
  check(
    "Audit log records the assignment in plain language",
    /assigned MWC-1001 to Neha Kulkarni \(EMP-1006\)/.test(auditText),
  );
  check("Audit log records the refused cross-desk assignment", /refused/i.test(auditText));
  await owner.screenshot({ path: "artifacts/rbac-4-audit.png", fullPage: true });

  // One database snapshot shared by every signed-in actor below.
  const dbState = await owner.context().storageState();

  /* ================================================= 2. finance executive */
  const exec = await newPage("exec", undefined, dbState);
  await signIn(exec, FINANCE_EXEC.email, FINANCE_EXEC.password);
  const execRole = await exec.locator('[data-testid="admin-user-role"]').innerText();
  check("Employee signs in with the directory credential", /Executive · Finance/.test(execRole), execRole);

  await exec.goto(`${BASE}/master-admin/tracker`, { waitUntil: "domcontentloaded" });
  await exec.waitForSelector('[data-testid="master-tracker"]', { timeout: 20000 });
  check(
    "Finance employee sees the Finance desk scope",
    /Finance desk only/.test(await exec.locator('[data-testid="tracker-scope-label"]').innerText()),
  );
  check(
    "Executive lands on My tasks",
    (await exec.locator('[data-testid="scope-my"]').getAttribute("aria-pressed")) === "true",
  );
  check(
    "My tasks is filtered to their own assignment",
    (await exec.locator('[data-testid="tracker-total"]').innerText()) === "1",
    await exec.locator('[data-testid="tracker-total"]').innerText(),
  );

  const typeOptions = await exec.locator('[data-testid="filter-type"] option').allInnerTexts();
  check(
    "Case type filter only offers the Finance desk",
    typeOptions.length === 2 && typeOptions[1] === "Finance",
    typeOptions.join(","),
  );

  await exec.click('[data-testid="scope-all"]');
  await exec.waitForTimeout(500);
  const execRows = await exec.locator('[data-testid="tracker-table"] tbody tr').count();
  const execTypes = await exec.locator('[data-testid="tracker-table"] tbody tr td:nth-child(2)').allInnerTexts();
  check(
    "All tasks shows the Finance queue only",
    execRows > 1 && execTypes.every((type) => type.trim() === "Finance"),
    `${execTypes.join(",")}`,
  );
  await exec.screenshot({ path: "artifacts/rbac-6-executive-tracker.png", fullPage: true });

  /* own work can be progressed */
  await openCase(exec, "MWC-1001");
  await exec.selectOption('[data-testid="drawer-status"]', "In Progress");
  await exec.click('[data-testid="save-status"]');
  await exec.waitForSelector('[data-testid="drawer-flash"]', { timeout: 10000 });
  check(
    "Executive can progress a case assigned to them",
    /Status updated/.test(await exec.locator('[data-testid="drawer-flash"]').innerText()),
  );
  await exec.click('[data-testid="close-drawer"]');

  /* someone else's case is read-only */
  await openCase(exec, "MWC-1002");
  check("A colleague's case opens read-only for an executive", (await exec.locator('[data-testid="drawer-readonly"]').count()) === 1);
  check(
    "Status control is disabled on someone else's case",
    await exec.locator('[data-testid="drawer-status"]').isDisabled(),
  );
  check("Assignment is locked for an executive", (await exec.locator('[data-testid="assign-locked"]').count()) === 1);

  const execStatus = await callDataLayer(exec, "MWC-1002", "Won");
  check(
    "Data layer refuses a status change on a colleague's case",
    execStatus.ok === false && /assigned executive or a manager/i.test(execStatus.error ?? ""),
    execStatus.error,
  );
  const execAssign = await callAssign(exec, "MWC-1002", "EMP-1006");
  check(
    "Data layer refuses assignment by an executive",
    execAssign.ok === false && /cannot assign/i.test(execAssign.error ?? ""),
    execAssign.error,
  );
  const execCreate = await callCreateEmployee(exec);
  check(
    "Data layer refuses employee creation by an executive",
    execCreate.ok === false && /can view the directory but not change it/i.test(execCreate.error ?? ""),
    execCreate.error,
  );

  /* department isolation through a direct link */
  await openCase(exec, "MWC-1005");
  check(
    "A case from another department is refused, not shown",
    (await exec.locator('[data-testid="case-drawer-denied"]').count()) === 1,
  );
  await exec.click('[data-testid="close-drawer"]').catch(() => {});

  const execNav = await exec.locator(".mw-admin-nav").innerText();
  check("Executive has no Employees or Audit Log nav entry", !/Employees|Audit Log/.test(execNav), execNav.replace(/\s+/g, " "));

  await exec.goto(`${BASE}/master-admin/employees`, { waitUntil: "domcontentloaded" });
  await exec.waitForTimeout(700);
  check("Executive cannot open the directory", (await exec.locator('[data-testid="access-denied"]').count()) === 1);
  await exec.goto(`${BASE}/master-admin/audit`, { waitUntil: "domcontentloaded" });
  await exec.waitForTimeout(700);
  check("Executive cannot open the audit log", (await exec.locator('[data-testid="access-denied"]').count()) === 1);

  /* =================================================== 3. finance manager */
  const manager = await newPage("manager", undefined, dbState);
  await signIn(manager, FINANCE_MANAGER.email, FINANCE_MANAGER.password);

  await manager.goto(`${BASE}/master-admin/tracker`, { waitUntil: "domcontentloaded" });
  await manager.waitForSelector('[data-testid="master-tracker"]', { timeout: 20000 });
  check(
    "Manager lands on All tasks for their desk",
    (await manager.locator('[data-testid="scope-all"]').getAttribute("aria-pressed")) === "true",
  );
  const managerTypes = await manager
    .locator('[data-testid="tracker-table"] tbody tr td:nth-child(2)')
    .allInnerTexts();
  check(
    "Manager sees Finance cases only",
    managerTypes.length > 0 && managerTypes.every((type) => type.trim() === "Finance"),
    `${managerTypes.length} rows`,
  );

  await assignViaDrawer(manager, "MWC-1002", "EMP-1006");
  check(
    "Manager can assign work inside the department",
    /assigned/i.test(await manager.locator('[data-testid="drawer-flash"]').innerText()),
  );

  await manager.goto(`${BASE}/master-admin/employees`, { waitUntil: "domcontentloaded" });
  await manager.waitForSelector('[data-testid="employee-table"]', { timeout: 15000 });
  check("Manager can view the directory", (await manager.locator('[data-testid="employee-table"] tbody tr').count()) === 9);
  check("Manager cannot add employees", (await manager.locator('[data-testid="employee-add"]').count()) === 0);
  check("Directory is labelled read-only for a manager", (await manager.locator('[data-testid="employee-readonly"]').count()) === 1);
  const managerCreate = await callCreateEmployee(manager);
  check(
    "Data layer refuses employee creation by a manager",
    managerCreate.ok === false,
    managerCreate.error,
  );

  await manager.goto(`${BASE}/master-admin/audit`, { waitUntil: "domcontentloaded" });
  await manager.waitForSelector('[data-testid="audit-table"]', { timeout: 15000 });
  const managerAudit = await manager.locator('[data-testid="audit-table"] tbody').innerText();
  check(
    "Manager audit log is limited to their department",
    /Finance desk/.test(managerAudit) && !/Insurance desk/.test(managerAudit),
  );

  /* ======================================================= 4. read-only */
  const viewer = await newPage("viewer", undefined, dbState);
  await signIn(viewer, SALES_READONLY.email, SALES_READONLY.password);
  const viewerRole = await viewer.locator('[data-testid="admin-user-role"]').innerText();
  check("Read-only employee signs in", /Read-Only · Sales/.test(viewerRole), viewerRole);

  await viewer.goto(`${BASE}/master-admin/tracker`, { waitUntil: "domcontentloaded" });
  await viewer.waitForSelector('[data-testid="master-tracker"]', { timeout: 20000 });
  const viewerTypes = await viewer
    .locator('[data-testid="tracker-table"] tbody tr td:nth-child(2)')
    .allInnerTexts();
  check(
    "Sales read-only user sees Sales cases only",
    viewerTypes.length > 0 &&
      viewerTypes.every((type) => ["Sell", "Exchange", "Test Drive", "Vehicle Enquiry"].includes(type.trim())),
    `${viewerTypes.join(",")}`,
  );

  await viewer.locator('[data-testid="tracker-table"] tbody tr').first().click();
  await viewer.waitForSelector('[data-testid="case-drawer"]', { timeout: 10000 });
  check("Read-only user sees the read-only banner", (await viewer.locator('[data-testid="drawer-readonly"]').count()) === 1);
  check("Read-only user cannot save a status", await viewer.locator('[data-testid="save-status"]').isDisabled());
  check("Read-only user cannot add a note", await viewer.locator('[data-testid="save-note"]').isDisabled());
  const viewerStatus = await callDataLayer(viewer, "MWC-1014", "Won");
  check(
    "Data layer refuses a status change from a read-only role",
    viewerStatus.ok === false && /read-only/i.test(viewerStatus.error ?? ""),
    viewerStatus.error,
  );
  const viewerNote = await viewer.evaluate(async () => {
    const crm = await import("/src/lib/admin-crm.ts");
    const session = JSON.parse(window.localStorage.getItem("mw_admin_session") ?? "{}");
    return crm.addCaseNote("MWC-1014", "should not save", {
      id: session.employeeId,
      name: session.name,
      email: session.email,
      role: session.role,
      department: session.department,
    });
  });
  check(
    "Data layer refuses a note from a read-only role",
    viewerNote.ok === false,
    viewerNote.error,
  );

  /* ============================================ 5. audit completeness */
  await owner.goto(`${BASE}/master-admin/audit`, { waitUntil: "domcontentloaded" });
  await owner.waitForSelector('[data-testid="audit-table"]', { timeout: 15000 });
  await owner.fill('[data-testid="audit-search"]', "refused");
  await owner.waitForTimeout(500);
  const deniedRows = await owner.locator('[data-testid="audit-table"] tbody tr').count();
  check("Refused attempts are visible in the audit log", deniedRows > 0, `${deniedRows} rows`);
  await owner.selectOption('[data-testid="audit-outcome"]', "denied");
  await owner.waitForTimeout(400);
  const deniedOutcomes = await owner.locator('[data-testid="audit-table"] tbody tr td:last-child').allInnerTexts();
  check(
    "Denied filter returns only refusals",
    deniedOutcomes.length > 0 && deniedOutcomes.every((value) => value.trim() === "Refused"),
    deniedOutcomes.join(","),
  );
  await owner.screenshot({ path: "artifacts/rbac-7-audit-denied.png", fullPage: true });

  /* ================================================= 6. mobile layout */
  const mobile = await newPage("mobile", { width: 390, height: 844 }, dbState);
  await signIn(mobile, FINANCE_EXEC.email, FINANCE_EXEC.password);
  await mobile.goto(`${BASE}/master-admin/tracker`, { waitUntil: "domcontentloaded" });
  await mobile.waitForSelector('[data-testid="master-tracker"]', { timeout: 20000 });
  const trailOverflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check("Executive tracker has no horizontal overflow on mobile", trailOverflow === 0, `${trailOverflow}px`);
  await mobile.screenshot({ path: "artifacts/rbac-8-mobile-tracker.png", fullPage: true });

  await mobile.goto(`${BASE}/master-admin/employees`, { waitUntil: "domcontentloaded" });
  await mobile.waitForTimeout(500);
  check("Employee directory is refused on mobile for an executive", (await mobile.locator('[data-testid="access-denied"]').count()) === 1);

  await owner.setViewportSize({ width: 1440, height: 960 });
  await owner.goto(`${BASE}/master-admin/employees`, { waitUntil: "domcontentloaded" });
  await owner.waitForSelector('[data-testid="employee-table"]', { timeout: 15000 });
  await owner.screenshot({ path: "artifacts/rbac-2-employees.png", fullPage: true });

  await owner.setViewportSize({ width: 390, height: 844 });
  await owner.waitForTimeout(400);
  const dirOverflow = await owner.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  check("Employee directory has no horizontal overflow on mobile", dirOverflow === 0, `${dirOverflow}px`);
  await owner.screenshot({ path: "artifacts/rbac-9-mobile-employees.png", fullPage: true });

  await owner.setViewportSize({ width: 1440, height: 960 });
  await owner.goto(`${BASE}/master-admin`, { waitUntil: "domcontentloaded" });
  await owner.waitForSelector('[data-testid="admin-dashboard"]', { timeout: 15000 });
  await owner.screenshot({ path: "artifacts/rbac-1-dashboard.png", fullPage: true });

  check("No console or page errors during the run", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} catch (error) {
  check("Suite completed without throwing", false, String(error));
} finally {
  await browser.close();
}

const failed = results.filter((result) => !result.ok);
console.log(`\nRBAC RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFAILED:");
  for (const result of failed) console.log(` - ${result.name} :: ${result.detail}`);
  process.exitCode = 1;
}
