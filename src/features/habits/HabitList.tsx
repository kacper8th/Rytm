import { useEffect, useState } from "react";
import { Link } from "react-router";
import { dateLabel } from "../../shared/dates";
import { ruleLabel } from "../../shared/recurrence";
import { deleteHabit, getHabits, goalRule, type Habit } from "./habits";
import { formatAmount, PERIOD_ADVERBS } from "./periods";
import "./Habits.css";

type Kind = "goal" | "limit";
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; habits: Habit[] };
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

/** Polish texts of the list, by kind. */
const TEXTS: Record<Kind, { path: string; back: string; title: string; count: string; empty: string; one: string; loadError: string }> = {
  goal: {
    path: "/habits/goals",
    back: "Cele",
    title: "Lista celów",
    count: "Cele",
    empty: "Brak celów.",
    one: "cel",
    loadError: "Nie udało się wczytać celów.",
  },
  limit: {
    path: "/habits/limits",
    back: "Limity",
    title: "Lista limitów",
    count: "Limity",
    empty: "Brak limitów.",
    one: "limit",
    loadError: "Nie udało się wczytać limitów.",
  },
};

/** The schedule and target, e.g. "≥ 2000 ml · codziennie", "≥ 3 razy w tygodniu", "≤ 4 szt. w miesiącu". */
export function habitLabel(habit: Habit): string {
  const target = `${habit.kind === "limit" ? "≤" : "≥"} ${formatAmount(habit.target ?? 0)} ${habit.unit ?? ""}`;
  const rule = goalRule(habit);
  if (rule) return `${target} · ${ruleLabel(rule)}`;
  return habit.period ? `${target} ${PERIOD_ADVERBS[habit.period]}` : target;
}

/** All goals or all limits, by name; ✎ edits, ✕ deletes the habit with its entries. Shared by Goals and Limits. */
export function HabitList({ kind }: { kind: Kind }) {
  const texts = TEXTS[kind];
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getHabits().then(
      (habits) => !cancelled && setLoad({ status: "ready", habits: habits.filter((h) => h.kind === kind) }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [kind, reloadCount]);

  function remove(habit: Habit) {
    if (!window.confirm(`Usunąć ${texts.one} „${habit.name}”? Zniknie też cała historia wpisów.`)) return;
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        await deleteHabit(habit.id);
        setLoad((prev) => (prev.status === "ready" ? { status: "ready", habits: prev.habits.filter((h) => h.id !== habit.id) } : prev));
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
          <Link to={texts.path} className="habits-back">
            ← {texts.back}
          </Link>
          <h1 className="habits-title">{texts.title}</h1>
          {load.status === "ready" && (
            <p className="habits-count">
              {texts.count}: {load.habits.length}
            </p>
          )}
        </div>
        <Link to={`${texts.path}/add`} className="habits-button is-primary">
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
          <span>
            {texts.loadError} {load.message}
          </span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "ready" && load.habits.length === 0 && <p className="habits-empty">{texts.empty}</p>}

      {load.status === "ready" && load.habits.length > 0 && (
        <ul className="habits-list">
          {load.habits.map((habit) => (
            <li key={habit.id} className="habits-row">
              <div className="habits-row-main">
                <span className="habits-row-title">{habit.name}</span>
                <span className="habits-row-note">
                  {habitLabel(habit)} · od {dateLabel(habit.startDate)}
                </span>
              </div>
              <Link
                to={`${texts.path}/${encodeURIComponent(habit.id)}/edit`}
                className="habits-icon-button"
                aria-label={`Edytuj ${texts.one} ${habit.name}`}
              >
                ✎
              </Link>
              <button
                type="button"
                className="habits-icon-button"
                onClick={() => remove(habit)}
                disabled={action.status === "saving"}
                aria-label={`Usuń ${texts.one} ${habit.name}`}
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
