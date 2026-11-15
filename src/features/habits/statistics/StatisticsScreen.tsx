import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  addDays,
  dateLabel,
  shiftWeek,
  toIsoDate,
  weekFromParam,
  weekLabel,
} from "../../../shared/dates";
import { occursOn, WEEKDAY_SHORT_NAMES } from "../../../shared/recurrence";
import { habitLabel } from "../HabitList";
import { getEntries, getHabits, getRuns, goalRule, type Entry, type Habit, type Run } from "../habits";
import {
  entriesIn,
  formatAmount,
  goalState,
  habitRange,
  limitState,
  periodRange,
  runLabel,
  sumOf,
} from "../periods";
import "../Habits.css";

type Data = { habits: Habit[]; entries: Entry[]; runs: Map<string, Run[]> };
type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Data };

/** What one cell of the grid shows. */
type Cell = { date: string; mark: "done" | "missed" | "open" | "off" | "none"; amount: number };

const MARKS: Record<Cell["mark"], string> = { done: "✓", missed: "✗", open: "…", off: "–", none: "" };
const MARK_TITLES: Record<Cell["mark"], string> = {
  done: "zaliczone",
  missed: "niezaliczone",
  open: "w trakcie",
  off: "nie w regule",
  none: "",
};

/**
 * The state of a goal or limit on one day: a goal with a rule — that day (or "off" when it is not in the rule);
 * a goal or limit with a period — the state of the period the day belongs to. Days before the start or after today
 * are empty.
 */
function cellOf(habit: Habit, date: string, entries: readonly Entry[], today: string): Cell {
  const amount = sumOf(entriesIn(entries, habit.id, { from: date, to: date }));
  if (date < habit.startDate || date > today) return { date, mark: "none", amount: 0 };
  const rule = goalRule(habit);
  if (rule && !occursOn(rule, date)) return { date, mark: "off", amount };
  const range = habitRange(habit, date);
  const sum = sumOf(entriesIn(entries, habit.id, range));
  const target = habit.target ?? 0;
  if (habit.kind === "limit") {
    return { date, mark: limitState(sum, target) === "exceeded" ? "missed" : range.to < today ? "done" : "open", amount };
  }
  const state = goalState(sum, target, range, today);
  return { date, mark: state, amount };
}

/** Week grid of goals and limits (view only) and the history of counter runs. */
export function StatisticsScreen() {
  const [params, setParams] = useSearchParams();
  const weekStart = weekFromParam(params.get("week"));
  const currentWeek = weekFromParam(null);
  const today = toIsoDate(new Date());
  const weekEnd = addDays(weekStart, 6);
  // Monthly periods need the whole months the week touches.
  const from = periodRange("month", weekStart).from;
  const to = periodRange("month", weekEnd).to;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    (async () => {
      const [habits, entries] = await Promise.all([getHabits(), getEntries(from, to)]);
      const counters = habits.filter((h) => h.kind === "counter");
      const runLists = await Promise.all(counters.map((c) => getRuns(c.id)));
      return { habits, entries, runs: new Map(counters.map((c, i) => [c.id, runLists[i]])) };
    })().then(
      (data) => !cancelled && setLoad({ status: "ready", data }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [from, to, reloadCount]);

  const data = load.status === "ready" ? load.data : null;

  const rows = useMemo(() => {
    if (!data) return null;
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return data.habits
      .filter((h) => (h.kind === "goal" || h.kind === "limit") && h.startDate <= weekEnd)
      .map((habit) => ({ habit, cells: days.map((date) => cellOf(habit, date, data.entries, today)) }));
  }, [data, weekStart, weekEnd, today]);
  const counters = data?.habits.filter((h) => h.kind === "counter") ?? [];

  function setWeek(next: string) {
    setParams(next === currentWeek ? {} : { week: next }, { replace: true });
  }

  return (
    <div className="habits">
      <header className="habits-header">
        <div>
          <Link to="/habits" className="habits-back">
            ← Nawyki
          </Link>
          <h1 className="habits-title">Statystyki</h1>
        </div>
      </header>

      {load.status === "loading" && <p className="habits-status">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="habits-status is-error" role="alert">
          <span>Nie udało się wczytać statystyk. {load.message}</span>
          <button type="button" className="habits-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      <section className="habits-section">
        <h2 className="habits-section-title">Cele i limity</h2>
        <nav className="habits-nav" aria-label="Tydzień">
          <button type="button" className="habits-button habits-arrow" onClick={() => setWeek(shiftWeek(weekStart, -1))} aria-label="Poprzedni tydzień">
            ‹
          </button>
          <span className="habits-nav-label">{weekLabel(weekStart)}</span>
          <button
            type="button"
            className="habits-button habits-arrow"
            onClick={() => setWeek(shiftWeek(weekStart, 1))}
            disabled={weekStart >= currentWeek}
            aria-label="Następny tydzień"
          >
            ›
          </button>
          {weekStart !== currentWeek && (
            <button type="button" className="habits-button" onClick={() => setWeek(currentWeek)}>
              Ten tydzień
            </button>
          )}
        </nav>

        {rows && rows.length === 0 && <p className="habits-empty">Brak celów i limitów w tym tygodniu.</p>}
        {rows && rows.length > 0 && (
          <ul className="habits-cards">
            {rows.map(({ habit, cells }) => (
              <li key={habit.id} className="habits-card">
                <div className="habits-card-head">
                  <span className="habits-card-name">{habit.name}</span>
                  <span className="habits-card-state">{habit.kind === "limit" ? "limit" : "cel"}</span>
                </div>
                <div className="habits-row-note">{habitLabel(habit)}</div>
                <div className="habits-week" role="list">
                  {cells.map((cell, i) => (
                    <div
                      key={cell.date}
                      role="listitem"
                      className={`habits-week-cell is-${cell.mark}${cell.date === today ? " is-today" : ""}`}
                      title={`${dateLabel(cell.date)}${MARK_TITLES[cell.mark] ? ` · ${MARK_TITLES[cell.mark]}` : ""}`}
                    >
                      <span className="habits-week-day">{WEEKDAY_SHORT_NAMES[i]}</span>
                      <span className="habits-week-mark">{MARKS[cell.mark]}</span>
                      <span className="habits-week-amount">{cell.amount > 0 ? formatAmount(cell.amount) : ""}</span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {rows && rows.length > 0 && (
          <p className="habits-row-note">
            ✓ zaliczone · ✗ niezaliczone / przekroczony · … w trakcie · – nie w regule. Cel lub limit z okresem: stan
            całego okresu; liczba pod znakiem = suma wpisów z tego dnia.
          </p>
        )}
      </section>

      <section className="habits-section">
        <h2 className="habits-section-title">Liczniki - historia serii</h2>
        {data && counters.length === 0 && <p className="habits-empty">Brak liczników.</p>}
        {data && counters.length > 0 && (
          <ul className="habits-cards">
            {counters.map((counter) => (
              <li key={counter.id} className="habits-card">
                <span className="habits-card-name">{counter.name}</span>
                <ul className="habits-entries-list">
                  {(data.runs.get(counter.id) ?? []).map((run) => {
                    const end = run.endDate ?? today;
                    return (
                      <li key={run.id} className="habits-entries-row">
                        <span>
                          {dateLabel(run.startDate)} – {run.endDate ? dateLabel(run.endDate) : "dziś"}
                        </span>
                        <span className={run.endDate ? "habits-row-note" : "habits-run-current"}>
                          {runLabel(run.startDate, end)}
                          {!run.endDate && " · bieżąca"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
