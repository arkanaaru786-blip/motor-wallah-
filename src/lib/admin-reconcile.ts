/**
 * No-missed-case reliability.
 *
 * The panel audits its own storage instead of trusting it. A case write is
 * journalled before it lands (see `saveCases`), so a save that never completed
 * leaves a trace. Leads captured by the public site wait in the lead queue
 * until they are imported. Assignments can outlive the employee they point at.
 *
 * `reconcileNow` reads all of that and reports what is wrong; `repairFindings`
 * fixes what can be fixed safely, through the same permission gates as a human
 * edit. The report is kept so the dashboard can show the last check.
 */
import {
  assignCase,
  clearCaseJournalEntry,
  employeeById,
  ensureAdminDatabase,
  importQueuedLeads,
  logAudit,
  readCaseJournal,
  replayCaseWrite,
  type AuditEntry,
  type CrmCase,
} from "./admin-crm";
import { canViewCase, departmentForCaseType, type Actor } from "./admin-rbac";
import { readLeadQueue } from "./leads";

export type FindingKind =
  "unsaved-case" | "unimported-lead" | "orphan-assignee" | "disabled-assignee" | "audit-orphan";

export type Finding = {
  id: string;
  kind: FindingKind;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  target: string;
  repairable: boolean;
  /** Journal ids / lead keys, so a repair knows exactly what to touch. */
  ref: string | null;
};

export type ReconcileReport = {
  at: string;
  by: { id: string; name: string };
  counts: {
    cases: number;
    leads: number;
    journal: number;
    audit: number;
    findings: number;
  };
  findings: Finding[];
};

const REPORT_KEY = "mw_admin_reconcile_v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const lastReport = (): ReconcileReport | null =>
  read<ReconcileReport | null>(REPORT_KEY, null);

/** Findings worth painting red on the dashboard. */
export const criticalCount = (report: ReconcileReport | null) =>
  report ? report.findings.filter((finding) => finding.severity === "critical").length : 0;

/** Scoped view: a manager only sees gaps on their own desk. */
function inScope(actor: Actor, kase: Pick<CrmCase, "type" | "assignedTo">): boolean {
  return canViewCase(actor, kase);
}

export function inspect(actor: Actor, options: { audit?: boolean } = {}): ReconcileReport {
  const snapshot = ensureAdminDatabase();
  const journal = readCaseJournal();
  const leads = readLeadQueue();
  const knownKeys = new Set(snapshot.cases.map((item) => item.sourceKey));
  const caseIds = new Set(snapshot.cases.map((item) => item.id));
  const findings: Finding[] = [];

  // 1. Saves that were journalled but never landed.
  for (const entry of journal) {
    const stored = snapshot.cases.find((item) => item.id === entry.caseId);
    if (stored && JSON.stringify(stored) === JSON.stringify(entry.case)) continue;
    if (!inScope(actor, entry.case)) continue;
    findings.push({
      id: `unsaved-${entry.id}`,
      kind: "unsaved-case",
      severity: "critical",
      title: stored
        ? `${entry.caseId} has an unsaved change`
        : `${entry.caseId} never reached the tracker`,
      detail: stored
        ? `The journalled version of ${entry.caseId} (${entry.case.type} · ${entry.case.customerName}) was written at ${new Date(
            entry.at,
          ).toLocaleString()} but the table still holds an older copy.`
        : `The ${entry.case.type} case for ${entry.case.customerName} was journalled at ${new Date(
            entry.at,
          ).toLocaleString()} but the table write failed. The record is still recoverable.`,
      target: entry.caseId,
      repairable: true,
      ref: entry.id,
    });
  }

  // 2. Website leads waiting in the queue that never became cases.
  for (const lead of leads) {
    const key = `lead:${lead.type}:${lead.createdAt}`;
    if (knownKeys.has(key)) continue;
    findings.push({
      id: `lead-${key}`,
      kind: "unimported-lead",
      severity: "critical",
      title: "A website submission is sitting in the lead queue",
      detail: `${lead.name ?? "A visitor"} submitted ${lead.type.replace(/_/g, " ")} on ${new Date(
        lead.createdAt,
      ).toLocaleString()} and it has not been imported into the tracker.`,
      target: lead.mobile ?? "lead queue",
      repairable: true,
      ref: key,
    });
  }

  // 3. A case pointing at an employee who is not in the directory any more.
  for (const item of snapshot.cases) {
    if (!item.assignedTo) continue;
    if (!inScope(actor, item)) continue;
    const owner = employeeById(snapshot.employees, item.assignedTo);
    if (!owner) {
      findings.push({
        id: `orphan-${item.id}`,
        kind: "orphan-assignee",
        severity: "warning",
        title: `${item.id} is assigned to a missing employee`,
        detail: `The case points at ${item.assignedTo}, which is no longer in the employee directory. Nobody is working it.`,
        target: item.id,
        repairable: true,
        ref: item.assignedTo,
      });
      continue;
    }
    if (owner.status !== "Active") {
      findings.push({
        id: `disabled-${item.id}`,
        kind: "disabled-assignee",
        severity: "warning",
        title: `${item.id} sits with a disabled employee`,
        detail: `${owner.name} (${owner.id}) is disabled, so this case has no active owner.`,
        target: item.id,
        repairable: true,
        ref: owner.id,
      });
    }
  }

  // 4. Audit rows whose case vanished — evidence of a lost write.
  const audit = read<AuditEntry[]>("mw_admin_audit_v1", []);
  const lost = new Set<string>();
  for (const entry of audit) {
    if (!/^MWC-\d+$/.test(entry.target)) continue;
    if (caseIds.has(entry.target) || lost.has(entry.target)) continue;
    lost.add(entry.target);
    findings.push({
      id: `audit-${entry.target}`,
      kind: "audit-orphan",
      severity: "info",
      title: `${entry.target} is referenced by the audit log but is not in the tracker`,
      detail: `“${entry.summary}” refers to a case the table no longer holds. It was removed, never saved, or cleared from this device.`,
      target: entry.target,
      repairable: false,
      ref: null,
    });
  }

  const report: ReconcileReport = {
    at: new Date().toISOString(),
    by: { id: actor.id, name: actor.name },
    counts: {
      cases: snapshot.cases.length,
      leads: leads.length,
      journal: journal.length,
      audit: audit.length,
      findings: findings.length,
    },
    findings,
  };

  write(REPORT_KEY, report);
  if (options.audit === false) return report;
  logAudit({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action: "reconcile.run",
    target: "Reconciliation",
    summary:
      findings.length === 0
        ? `checked ${snapshot.cases.length} cases and ${leads.length} queued leads — nothing missing`
        : `found ${findings.length} gap${findings.length === 1 ? "" : "s"} across ${snapshot.cases.length} cases and ${leads.length} queued leads`,
    department: actor.department,
    outcome: findings.length === 0 ? "allowed" : "denied",
  });

  return report;
}

export type RepairResult = {
  repaired: number;
  skipped: number;
  messages: string[];
};

/**
 * Repairs what can be repaired without guessing: replays journalled saves,
 * imports queued leads (super admin only — it touches every desk), and returns
 * cases with no active owner to the unassigned queue.
 */
export function repairFindings(
  actor: Actor,
  report: ReconcileReport | null = lastReport(),
): { ok: true; result: RepairResult } | { ok: false; error: string } {
  if (!report) return { ok: false, error: "Run the check first." };
  const messages: string[] = [];
  let repaired = 0;
  let skipped = 0;

  if (report.findings.some((finding) => finding.kind === "unimported-lead")) {
    if (actor.role !== "super_admin") {
      skipped += 1;
      messages.push("Only a super admin can re-import website leads across every desk.");
    } else {
      const imported = importQueuedLeads();
      if (imported.ok && imported.imported.length) {
        repaired += imported.imported.length;
        messages.push(
          `Imported ${imported.imported.length} queued lead${imported.imported.length === 1 ? "" : "s"}.`,
        );
      } else if (!imported.ok) {
        messages.push(imported.error ?? "The lead import was refused.");
      }
    }
  }

  for (const finding of report.findings) {
    if (finding.kind === "unsaved-case" && finding.ref) {
      const entry = readCaseJournal().find((row) => row.id === finding.ref);
      if (!entry) {
        skipped += 1;
        continue;
      }
      if (!inScope(actor, entry.case)) {
        skipped += 1;
        messages.push(`${entry.caseId} belongs to another desk.`);
        continue;
      }
      const replay = replayCaseWrite(entry);
      if (replay.ok) {
        repaired += 1;
        messages.push(
          `Recovered ${entry.caseId} (${entry.case.type} · ${entry.case.customerName}).`,
        );
      } else {
        clearCaseJournalEntry(entry.id);
        skipped += 1;
        messages.push(replay.error ?? `${entry.caseId} could not be recovered.`);
      }
    }

    if (finding.kind === "orphan-assignee" || finding.kind === "disabled-assignee") {
      const result = assignCase(finding.target, null, actor);
      if (result.ok) {
        repaired += 1;
        messages.push(`Returned ${finding.target} to the unassigned queue.`);
      } else {
        skipped += 1;
        messages.push(`${finding.target}: ${result.error ?? "could not be reassigned"}.`);
      }
    }

    if (finding.kind === "audit-orphan") skipped += 1;
  }

  if (repaired > 0) {
    logAudit({
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: "reconcile.repair",
      target: "Reconciliation",
      summary: `repaired ${repaired} gap${repaired === 1 ? "" : "s"} found by the reliability check`,
      department: actor.department,
      outcome: "allowed",
    });
  }

  return { ok: true, result: { repaired, skipped, messages } };
}

/** Names every case's desk, used by the report table. */
export const deskOf = (kase: Pick<CrmCase, "type">) =>
  departmentForCaseType(kase.type) ?? "Unmapped";
