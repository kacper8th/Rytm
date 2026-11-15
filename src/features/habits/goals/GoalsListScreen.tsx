import { useEffect, useState } from "react";
import { Link } from "react-router";
import { dateLabel } from "../../../shared/dates";
import { ruleLabel } from "../../../shared/recurrence";
import { deleteHabit, getHabits, goalRule, type Habit } from "../habits";
import { formatAmount, PERIOD_ADVERBS } from "../periods";
import "../Habits.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; goals: Habit[] };
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

/** The goal's schedule and target, e.g. "≥ 2000 ml · codziennie" or "≥ 3 razy w tygodniu". */
function goalLabel(goal: Habit): string {
  const target = `≥ ${formatAmount(goal.target ?? 0)} ${goal.unit ?? ""}`;
  const rule = goalRule(goal);
  if (rule) return `${target} · ${ruleLabel(rule)}`;
  return goal.period ? `${target} ${PERIOD_ADVERBS[goal.period]}` : target;
}

/** All goals, by name; ✎ edits, ✕ deletes the goal with its entries. */
export function GoalsListScreen() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getHabits().then(
      (habits) => !cancelled && setLoad({ status: "ready", goals: habits.filter((h) => h.kind === "goal") }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function remove(goal: Habit) {
    if (!window.confirm(`Usunąć cel „${goal.name}”? Zniknie też cała historia wpisów.`)) return;
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        await deleteHabit(goal.id);
        setLoad((prev) => (prev.status === "ready" ? { status: "ready", goals: prev.goals.filter((g) => g.id !== goal.id) } : prev));
        setAction({ status: "idle" });
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits/goals" className="habits-back">
            ← Cele
          </Link>
          <h1 className="habits-title">Lista celów</h1>
          {load.status === "ready" && <p className="habits-count">Cele: {load.goals.length}</p>}
        </div>
        <Link to="/habits/goals/add" className="habits-button is-primary">
          + Dodaj
        </Link>
      </header>

      {action.status === "saving" && <p className="habits-status">Zapisywanie…</p>}
      {action.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się usunąć. {action.message}</span>
          <button type="button" className="habits-button" onClick={action.retry}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "loading" && <p className="habits-status">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się wczytać celów. {load.message}</span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "ready" && load.goals.length === 0 && <p className="habits-empty">Brak celów.</p>}

      {load.status === "ready" && load.goals.length > 0 && (
        <ul className="habits-list">
          {load.goals.map((goal) => (
            <li key={goal.id} className="habits-row">
              <div className="habits-row-main">
                <span className="habits-row-title">{goal.name}</span>
                <span className="habits-row-note">
                  {goalLabel(goal)} · od {dateLabel(goal.startDate)}
                </span>
              </div>
              <Link
                to={`/habits/goals/${encodeURIComponent(goal.id)}/edit`}
                className="habits-icon-button"
                aria-label={`Edytuj cel ${goal.name}`}
              >
                ✎
              </Link>
              <button
                type="button"
                className="habits-icon-button"
                onClick={() => remove(goal)}
                disabled={action.status === "saving"}
                aria-label={`Usuń cel ${goal.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
