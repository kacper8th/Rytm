import { useEffect, useState } from "react";
import { Link } from "react-router";
import { dateLabel } from "../../../shared/dates";
import { ruleLabel } from "../recurrence";
import { deleteTask, getTasks, type Task } from "../tasks";
import "../Tasks.css";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; tasks: Task[] };

type Action = { status: "idle" } | { status: "saving" } | { status: "error"; message: string; retry: () => void };

/** All recurring tasks with their repeat rule; ✕ deletes the whole series with its history. */
export function RecurringTasksScreen() {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);
  const [action, setAction] = useState<Action>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getTasks().then(
      ({ tasks }) => !cancelled && setLoad({ status: "ready", tasks }),
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  function remove(task: Task) {
    if (!window.confirm(`Usunąć zadanie „${task.title}”? Zniknie też cała historia wykonań.`)) return;
    const attempt = async () => {
      setAction({ status: "saving" });
      try {
        await deleteTask(task.id);
        setLoad((prev) => (prev.status === "ready" ? { status: "ready", tasks: prev.tasks.filter((t) => t.id !== task.id) } : prev));
        setAction({ status: "idle" });
      } catch (error) {
        setAction({ status: "error", message: (error as Error).message, retry: () => void attempt() });
      }
    };
    void attempt();
  }

  return (
    <div className="tasks">
      <header className="tasks-header">
        <div>
          <Link to="/tasks" className="tasks-back">
            ← Zadania
          </Link>
          <h1 className="tasks-title">Zadania cykliczne</h1>
          {load.status === "ready" && <p className="tasks-count">Zadania: {load.tasks.length}</p>}
        </div>
        <Link to="/tasks/recurring/add" className="tasks-button is-primary">
          + Dodaj
        </Link>
      </header>

      {action.status === "saving" && <p className="tasks-status">Zapisywanie…</p>}
      {action.status === "error" && (
        <div className="tasks-status is-error" role="alert">
          <span>Nie udało się usunąć. {action.message}</span>
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

      {load.status === "ready" && load.tasks.length === 0 && <p className="tasks-empty">Brak zadań cyklicznych.</p>}

      {load.status === "ready" && load.tasks.length > 0 && (
        <ul className="tasks-list">
          {load.tasks.map((task) => (
            <li key={task.id} className="tasks-row">
              <div className="tasks-row-main">
                <span className="tasks-row-title">{task.title}</span>
                <span className="tasks-row-note">
                  {ruleLabel(task)} · od {dateLabel(task.startDate)}
                </span>
              </div>
              <Link
                to={`/tasks/recurring/${encodeURIComponent(task.id)}/edit`}
                className="tasks-icon-button"
                aria-label={`Edytuj zadanie ${task.title}`}
              >
                ✎
              </Link>
              <button
                type="button"
                className="tasks-icon-button"
                onClick={() => remove(task)}
                disabled={action.status === "saving"}
                aria-label={`Usuń zadanie ${task.title}`}
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
