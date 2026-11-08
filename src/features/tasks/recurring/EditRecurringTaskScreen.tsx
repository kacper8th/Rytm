import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { RecurringTaskForm } from "./RecurringTaskForm";
import { getTasks, updateTask, type Task } from "../tasks";
import "../Tasks.css";

type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; task: Task };

/** Edit form of one recurring task; done occurrences are kept. */
export function EditRecurringTaskScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoad({ status: "loading" });
    getTasks().then(
      ({ tasks }) => {
        if (cancelled) return;
        const task = tasks.find((t) => t.id === id);
        setLoad(task ? { status: "ready", task } : { status: "missing" });
      },
      (error: Error) => !cancelled && setLoad({ status: "error", message: error.message }),
    );
    return () => {
      cancelled = true;
    };
  }, [id, reloadCount]);

  return (
    <div className="tasks">
      <header className="tasks-header">
        <div>
          <Link to="/tasks/recurring" className="tasks-back">
            ← Zadania cykliczne
          </Link>
          <h1 className="tasks-title">Edycja zadania</h1>
        </div>
      </header>

      {load.status === "loading" && <p className="tasks-status">Wczytywanie…</p>}
      {load.status === "error" && (
        <div className="tasks-status is-error" role="alert">
          <span>Nie udało się wczytać zadania. {load.message}</span>
          <button type="button" className="tasks-button" onClick={() => setReloadCount((n) => n + 1)}>
            Spróbuj ponownie
          </button>
        </div>
      )}
      {load.status === "missing" && <p className="tasks-empty">Nie znaleziono zadania — mogło zostać usunięte.</p>}

      {load.status === "ready" && (
        <>
          <p className="tasks-count">Zmiana reguły nie usuwa historii wykonań.</p>
          <RecurringTaskForm
            initial={load.task}
            onSave={async (task) => {
              await updateTask(load.task.id, task);
              navigate("/tasks/recurring");
            }}
          />
        </>
      )}
    </div>
  );
}
