import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { addDays, dateLabel, toIsoDate } from "../../../shared/dates";
import { EntryControls } from "../EntryControls";
import { addEntry, deleteEntry, getEntries, getHabits, type Entry, type Habit } from "../habits";
import {
  dateFromParam,
  entriesIn,
  formatAmount,
  goalState,
  habitRange,
  loadRange,
  periodLabel,
  showsOn,
  sumOf,
} from "../periods";
import "../Habits.css";

type Data = { habits: Habit[]; entries: Entry[] };
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Data };
type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

const STATE_LABELS = { done: "zaliczone", open: "w trakcie", missed: "niezaliczone" } as const;

/**
 * Day screen of Goals: goals of the shown day with their progress, and controls to add and correct entries.
 * A goal with a repeat rule is shown only on the days of its rule; a goal with a period shows its period's sum.
 */
export function GoalsScreen() {
  const [params, setParams] = useSearchParams();
  const today = toIsoDate(new Date());
  const date = dateFromParam(params.get("date"), today);
  const range = loadRange(date);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    Promise.all([getHabits(), getEntries(range.from, range.to)]).then(
      ([habits, entries]) => !cancelled && setLoad({ status: "ready", data: { habits, entries } }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadCount]);

  const data = load.status === "ready" ? load.data : null;

  const goals = useMemo(() => {
    if (!data) return null;
    return data.habits
      .filter((h) => h.kind === "goal" && showsOn(h, date))
      .map((goal) => {
        const goalRange = habitRange(goal, date);
        const sum = sumOf(entriesIn(data.entries, goal.id, goalRange));
        return {
          goal,
          sum,
          state: goalState(sum, goal.target ?? 0, goalRange, today),
          dayEntries: entriesIn(data.entries, goal.id, { from: date, to: date }),
        };
      });
  }, [data, date, today]);
  const hasGoals = data?.habits.some((h) => h.kind === "goal") ?? false;

  function setDate(next: string) {
    setParams(next === today ? {} : { date: next }, { replace: true });
  }

  /** Runs a change on the server, then applies it to the loaded entries. */
  function save(run: () => Promise<(entries: Entry[]) => Entry[]>) {
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        const apply = await run();
        setLoad((prev) => (prev.status === "ready" ? { status: "ready", data: { ...prev.data, entries: apply(prev.data.entries) } } : prev));
        setAction({ status: "idle" });
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  const add = (goal: Habit, amount: number) =>
    save(async () => {
      const entry = await addEntry(goal.id, date, amount);
      return (entries) => [...entries, entry];
    });

  const remove = (entry: Entry) =>
    save(async () => {
      await deleteEntry(entry.id);
      return (entries) => entries.filter((e) => e.id !== entry.id);
    });

  const busy = action.status === "saving";

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits" className="habits-back">
            ← Nawyki
          </Link>
          <h1 className="habits-title">Cele</h1>
        </div>
        <div className="habits-header-actions">
          <Link to="/habits/goals/list" className="habits-button">
            Lista celów
          </Link>
          <Link to="/habits/goals/add" className="habits-button is-primary">
            + Dodaj
          </Link>
        </div>
      </header>

      <nav className="habits-nav" aria-label="Dzień">
        <button type="button" className="habits-button habits-arrow" onClick={() => setDate(addDays(date, -1))} aria-label="Poprzedni dzień">
          ‹
        </button>
        <span className="habits-nav-label">
          {dateLabel(date)}
          {date === today && " · dziś"}
        </span>
        <button
          type="button"
          className="habits-button habits-arrow"
          onClick={() => setDate(addDays(date, 1))}
          disabled={date >= today}
          aria-label="Następny dzień"
        >
          ›
        </button>
        {date !== today && (
          <button type="button" className="habits-button" onClick={() => setDate(today)}>
            Dziś
          </button>
        )}
      </nav>

      {action.status === "saving" && <p className="habits-status">Zapisywanie…</p>}
      {action.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się zapisać. {action.message}</span>
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

      {goals && !hasGoals && (
        <p className="habits-empty">
          Brak celów. <Link to="/habits/goals/add">Dodaj cel</Link>.
        </p>
      )}
      {goals && hasGoals && goals.length === 0 && <p className="habits-empty">Brak celów na ten dzień.</p>}

      {goals && goals.length > 0 && (
        <ul className="habits-cards">
          {goals.map(({ goal, sum, state, dayEntries }) => {
            const target = goal.target ?? 0;
            return (
              <li key={goal.id} className={`habits-card is-${state}`}>
                <div className="habits-card-head">
                  <span className="habits-card-name">{goal.name}</span>
                  <span className="habits-card-state">{STATE_LABELS[state]}</span>
                </div>
                <div className="habits-progress-text">
                  <strong>
                    {formatAmount(sum)} / {formatAmount(target)}
                  </strong>{" "}
                  {goal.unit}
                  {goal.period && goal.period !== "day" && (
                    <span className="habits-row-note"> · {periodLabel(goal.period, date)}</span>
                  )}
                </div>
                <div className="habits-progress" aria-hidden="true">
                  <div className="habits-progress-bar" style={{ width: `${Math.min(sum / target, 1) * 100}%` }} />
                </div>
                <EntryControls
                  habit={goal}
                  entries={dayEntries}
                  showDates={false}
                  disabled={busy}
                  onAdd={(amount) => add(goal, amount)}
                  onDelete={remove}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
