import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { dateLabel, dayDate, DAYS_IN_WEEK, shiftWeek, toIsoDate, weekFromParam, weekLabel } from "../../shared/dates";
import { occursOn, overdueDates } from "./recurrence";
import { getTasks, markDone, unmarkDone, type Completion, type Task, type TasksData } from "./tasks";
import "./Tasks.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: TasksData };

type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

type Occurrence = { task: Task; date: string };
type OverdueRow = { task: Task; dates: string[] };

const byTitle = (a: { task: Task }, b: { task: Task }) => a.task.title.localeCompare(b.task.title, "pl");

/** Done dates of each task. */
function doneByTask(completions: readonly Completion[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const c of completions) {
    const set = map.get(c.taskId) ?? new Set<string>();
    set.add(c.date);
    map.set(c.taskId, set);
  }
  return map;
}

/**
 * Week view: overdue occurrences (from any week) on top, then the shown week's occurrences by day, then the done ones.
 * Marking an overdue row marks its oldest missed occurrence.
 */
export function CurrentTasksScreen() {
  const [params, setParams] = useSearchParams();
  const weekStart = weekFromParam(params.get("week"));
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });
  const today = toIsoDate(new Date());

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getTasks().then(
      (data) => !cancelled && setLoad({ status: "ready", data }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  const data = load.status === "ready" ? load.data : null;

  const view = useMemo(() => {
    if (!data) return null;
    const done = doneByTask(data.completions);
    const doneOf = (task: Task) => done.get(task.id) ?? new Set<string>();

    const overdue: OverdueRow[] = data.tasks
      .map((task) => ({ task, dates: overdueDates(task, doneOf(task), today) }))
      .filter((row) => row.dates.length > 0)
      .sort(byTitle);

    const days = Array.from({ length: DAYS_IN_WEEK }, (_, day) => {
      const date = toIsoDate(dayDate(weekStart, day));
      const due = data.tasks.filter((task) => occursOn(task, date) && !doneOf(task).has(date));
      return { date, items: due.map((task) => ({ task, date })).sort(byTitle) };
    });

    const doneInWeek: Occurrence[] = days.flatMap(({ date }) =>
      data.tasks.filter((task) => doneOf(task).has(date)).map((task) => ({ task, date })),
    );
    return { overdue, days, doneInWeek };
  }, [data, weekStart, today]);

  function setWeek(next: string) {
    setParams(next === weekFromParam(null) ? {} : { week: next }, { replace: true });
  }

  /** Saves on the server, then updates the local list of done occurrences. */
  function toggle(task: Task, date: string, makeDone: boolean) {
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        await (makeDone ? markDone(task.id, date) : unmarkDone(task.id, date));
        setLoad((prev) => {
          if (prev.status !== "ready") return prev;
          const rest = prev.data.completions.filter((c) => !(c.taskId === task.id && c.date === date));
          const completions = makeDone ? [...rest, { taskId: task.id, date, doneAt: new Date().toISOString() }] : rest;
          return { status: "ready", data: { ...prev.data, completions } };
        });
        setAction({ status: "idle" });
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  const busy = action.status === "saving";
  const weekIsEmpty = view && view.days.every((d) => d.items.length === 0) && view.doneInWeek.length === 0;

  return (
    <div className="tasks">
      <header className="tasks-header">
        <div>
          <Link to="/tasks" className="tasks-back">
            ← Zadania
          </Link>
          <h1 className="tasks-title">Aktualne zadania</h1>
        </div>
      </header>

      <nav className="tasks-nav" aria-label="Tydzień">
        <button type="button" className="tasks-button tasks-arrow" onClick={() => setWeek(shiftWeek(weekStart, -1))} aria-label="Poprzedni tydzień">
          ‹
        </button>
        <span className="tasks-nav-label">{weekLabel(weekStart)}</span>
        <button type="button" className="tasks-button tasks-arrow" onClick={() => setWeek(shiftWeek(weekStart, 1))} aria-label="Następny tydzień">
          ›
        </button>
        {weekStart !== weekFromParam(null) && (
          <button type="button" className="tasks-button" onClick={() => setWeek(weekFromParam(null))}>
            Dziś
          </button>
        )}
      </nav>

      {action.status === "saving" && <p className="tasks-status">Zapisywanie…</p>}
      {action.status === "error" && (
        <div className="tasks-status is-error" role="alert">
          <span>Nie udało się zapisać. {action.message}</span>
          <button type="button" className="tasks-button" onClick={action.retry}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {load.status === "loading" && <p className="tasks-status">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="tasks-status is-error" role="alert">
          <span>Nie udało się wczytać zadań. {load.message}</span>
          <button type="button" className="tasks-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}

      {view && data && (
        <>
          {data.tasks.length === 0 && (
            <p className="tasks-empty">
              Brak zadań. <Link to="/tasks/recurring/add">Dodaj zadanie cykliczne</Link>.
            </p>
          )}

          {view.overdue.length > 0 && (
            <section className="tasks-section is-overdue">
              <h2 className="tasks-section-title">Spóźnione</h2>
              <ul className="tasks-list">
                {view.overdue.map(({ task, dates }) => (
                  <TaskRow
                    key={task.id}
                    title={task.title}
                    note={dates.length > 1 ? `pominięte ${dates.length}× · od ${dateLabel(dates[0])}` : dateLabel(dates[0])}
                    done={false}
                    disabled={busy}
                    onToggle={() => toggle(task, dates[0], true)}
                  />
                ))}
              </ul>
            </section>
          )}

          {view.days.map(({ date, items }) =>
            items.length === 0 ? null : (
              <section key={date} className={`tasks-section${date === today ? " is-today" : ""}`}>
                <h2 className="tasks-section-title">
                  {dateLabel(date)}
                  {date === today && " · dziś"}
                </h2>
                <ul className="tasks-list">
                  {items.map(({ task }) => (
                    <TaskRow
                      key={task.id}
                      title={task.title}
                      note={date < today ? "pominięte" : undefined}
                      done={false}
                      disabled={busy}
                      onToggle={() => toggle(task, date, true)}
                    />
                  ))}
                </ul>
              </section>
            ),
          )}

          {weekIsEmpty && data.tasks.length > 0 && <p className="tasks-empty">Brak zadań w tym tygodniu.</p>}

          {view.doneInWeek.length > 0 && (
            <section className="tasks-section is-done">
              <h2 className="tasks-section-title">Wykonane</h2>
              <ul className="tasks-list">
                {view.doneInWeek.map(({ task, date }) => (
                  <TaskRow
                    key={`${task.id}-${date}`}
                    title={task.title}
                    note={dateLabel(date)}
                    done
                    disabled={busy}
                    onToggle={() => toggle(task, date, false)}
                  />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow(props: { title: string; note?: string; done: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <li className={`tasks-row${props.done ? " is-done" : ""}`}>
      <label className="tasks-check">
        <input type="checkbox" checked={props.done} disabled={props.disabled} onChange={props.onToggle} />
        <span className="tasks-row-title">{props.title}</span>
      </label>
      {props.note && <span className="tasks-row-note">{props.note}</span>}
    </li>
  );
}
