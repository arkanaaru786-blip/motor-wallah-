import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CornerDownLeft, Sparkles } from "lucide-react";
import { askIntelligence, ENGINE_LABEL, SUGGESTIONS, type Answer } from "@/lib/admin-ai";
import { actorFromSession } from "@/lib/admin-rbac";
import type { AdminSession } from "@/lib/admin-auth";

/**
 * The dashboard assistant. Answers are computed on the device from the caller's
 * scoped snapshot, so the card is labelled as a demo engine rather than an LLM.
 */
export function AiAssistant({ session }: { session: AdminSession }) {
  const actor = useMemo(() => actorFromSession(session), [session]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => setBusy(false), []);

  const ask = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;
    setQuestion(trimmed);
    setBusy(true);
    window.setTimeout(() => {
      setAnswer(askIntelligence(trimmed, actor));
      setBusy(false);
    }, 180);
  };

  return (
    <section className="mw-admin-panel mw-admin-span-7 mw-admin-ai" data-testid="ai-assistant">
      <header className="mw-admin-panel-head">
        <div>
          <h2>
            <Sparkles size={16} /> MW Intelligence
          </h2>
          <p>Ask about the work you can see — answers come from your live tracker.</p>
        </div>
        <span className="mw-admin-chip is-demo" data-testid="ai-engine">
          Demo engine
        </span>
      </header>

      <form
        className="mw-admin-ai-form"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label className="mw-admin-input mw-admin-ai-input">
          <span className="mw-admin-sr">Ask MW Intelligence</span>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Show all overdue finance leads…"
            data-testid="ai-input"
            autoComplete="off"
          />
          <button type="submit" className="mw-admin-ai-send" data-testid="ai-ask" disabled={busy}>
            {busy ? "Thinking…" : "Ask"} <CornerDownLeft size={13} />
          </button>
        </label>
      </form>

      <div className="mw-admin-ai-suggest" data-testid="ai-suggestions">
        {SUGGESTIONS.slice(0, 3).map((suggestion, index) => (
          <button
            key={suggestion}
            type="button"
            className="mw-admin-chip is-ghost"
            onClick={() => ask(suggestion)}
            data-testid={`ai-suggestion-${index}`}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="mw-admin-ai-answer" data-testid="ai-answer">
          <p className="mw-admin-ai-headline" data-testid="ai-headline">
            {answer.headline}
          </p>
          {answer.bullets.length ? (
            <ul className="mw-admin-ai-bullets">
              {answer.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
          {answer.rows.length ? (
            <ul className="mw-admin-ai-rows" data-testid="ai-rows">
              {answer.rows.map((row) => (
                <li key={`${row.label}-${row.meta}`} className={row.tone ? `is-${row.tone}` : ""}>
                  <span>
                    <strong>{row.label}</strong>
                    <small>{row.meta}</small>
                  </span>
                  {row.caseId ? (
                    <Link
                      to="/master-admin/tracker"
                      search={{ case: row.caseId }}
                      className="mw-admin-link"
                    >
                      Open <ArrowUpRight size={12} />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mw-admin-empty">Nothing matches that in your scope.</p>
          )}
          <p className="mw-admin-ai-engine">{ENGINE_LABEL}</p>
        </div>
      ) : (
        <div className="mw-admin-ai-idle">
          <p>It can answer, inside your scope:</p>
          <ul>
            <li>Which cases are overdue, for a desk or across all of them</li>
            <li>Who is carrying the most open work, and who has nothing</li>
            <li>Revenue closed, approvals waiting, dealer plans about to lapse</li>
          </ul>
        </div>
      )}
    </section>
  );
}
