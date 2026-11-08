import { Link, useNavigate } from "react-router";
import { RecurringTaskForm } from "./RecurringTaskForm";
import { addTask } from "./tasks";
import "./Tasks.css";

export function AddRecurringTaskScreen() {
  const navigate = useNavigate();

  return (
    <div className="tasks">
      <header className="tasks-header">
        <div>
          <Link to="/tasks/recurring" className="tasks-back">
            ← Zadania cykliczne
          </Link>
          <h1 className="tasks-title">Nowe zadanie cykliczne</h1>
        </div>
      </header>

      <RecurringTaskForm
        onSave={async (task) => {
          await addTask(task);
          navigate("/tasks/recurring");
        }}
      />
    </div>
  );
}
